import {
  stripeSecretAllowedForOrigin,
  stripeSessionAllowedForOrigin,
  stripeSessionMatchesSecret,
} from "./paid-checkout.ts";

const SESSION_ID_PATTERN = /^cs_(test|live)_[a-zA-Z0-9]+$/;

type StripeCheckoutSession = {
  id: string;
  payment_status: string;
  status: string | null;
  mode?: string;
  customer?: string | { id?: string } | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string> | null;
  subscription?:
    | string
    | {
        id?: string;
        current_period_end?: number;
      }
    | null;
  line_items?: {
    data?: Array<{
      quantity?: number;
      price?: string | { id?: string };
    }>;
  };
};

export type FulfilledCheckoutSession = {
  sessionId: string;
  email: string;
  customerId: string;
  mode: "payment" | "subscription";
  edition?: string;
  currentPeriodEnd?: string | null;
  subscriptionId?: string | null;
  priceId?: string | null;
  quantity?: number;
};

export type VerifiedSession = {
  sessionId: string;
};

export type VerifySessionError =
  | "missing_session"
  | "invalid_session"
  | "payment_incomplete"
  | "server_error";

export function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}

export function checkoutVerificationAllowed(input: {
  sessionId: string;
  secretKey: string;
  origin?: string;
}): { ok: true } | { ok: false; error: VerifySessionError } {
  const sessionId = input.sessionId.trim();
  const secretKey = input.secretKey.trim();
  if (!isValidSessionId(sessionId)) return { ok: false, error: "invalid_session" };
  if (input.origin && !stripeSessionAllowedForOrigin(sessionId, input.origin)) {
    return { ok: false, error: "invalid_session" };
  }
  if (!secretKey) return { ok: false, error: "invalid_session" };
  if (input.origin && !stripeSecretAllowedForOrigin(secretKey, input.origin)) {
    return { ok: false, error: "invalid_session" };
  }
  if (!stripeSessionMatchesSecret(sessionId, secretKey)) {
    return { ok: false, error: "invalid_session" };
  }
  return { ok: true };
}

function customerIdFrom(session: StripeCheckoutSession): string {
  if (typeof session.customer === "string") return session.customer;
  if (session.customer && typeof session.customer === "object" && session.customer.id) {
    return session.customer.id;
  }
  return "";
}

function emailFrom(session: StripeCheckoutSession): string {
  return (
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    ""
  );
}

function periodEndFrom(session: StripeCheckoutSession): string | null {
  const subscription = session.subscription;
  if (subscription && typeof subscription === "object" && subscription.current_period_end) {
    return new Date(subscription.current_period_end * 1000).toISOString();
  }
  return null;
}

function priceIdFrom(session: StripeCheckoutSession): string | null {
  const price = session.line_items?.data?.[0]?.price;
  if (typeof price === "string") return price;
  if (price && typeof price.id === "string") return price.id;
  return null;
}

function subscriptionIdFrom(session: StripeCheckoutSession): string | null {
  if (typeof session.subscription === "string") return session.subscription;
  if (session.subscription && typeof session.subscription === "object") {
    return session.subscription.id ?? null;
  }
  return null;
}

export async function verifyStripeCheckoutSession(
  sessionId: string,
  secretKey: string,
  origin?: string,
): Promise<
  | { ok: true; session: FulfilledCheckoutSession }
  | { ok: false; error: VerifySessionError }
> {
  const allowed = checkoutVerificationAllowed({ sessionId, secretKey, origin });
  if (!allowed.ok) return allowed;

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=line_items`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
        cache: "no-store",
      },
    );

    if (response.status === 404) {
      return { ok: false, error: "invalid_session" };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return { ok: false, error: "invalid_session" };
      }
      return { ok: false, error: "server_error" };
    }

    const session = (await response.json()) as StripeCheckoutSession;
    if (!session.id || session.id !== sessionId) {
      return { ok: false, error: "invalid_session" };
    }

    const mode = session.mode === "subscription" ? "subscription" : session.mode === "payment" ? "payment" : null;

    if (!mode) {
      return { ok: false, error: "invalid_session" };
    }

    if (session.payment_status !== "paid") {
      return { ok: false, error: "payment_incomplete" };
    }

    if (session.status && session.status !== "complete") {
      return { ok: false, error: "payment_incomplete" };
    }

    return {
      ok: true,
      session: {
        sessionId: session.id,
        email: emailFrom(session),
        customerId: customerIdFrom(session),
        mode,
        edition: session.metadata?.edition,
        currentPeriodEnd: periodEndFrom(session),
        subscriptionId: subscriptionIdFrom(session),
        priceId: priceIdFrom(session),
        quantity: session.line_items?.data?.[0]?.quantity,
      },
    };
  } catch {
    return { ok: false, error: "server_error" };
  }
}
