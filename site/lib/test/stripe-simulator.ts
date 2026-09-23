/**
 * Test-only Stripe stand-in. Must never be reachable from production HTTP routes.
 * Enable exclusively via LICENSE_VERSION_E2E_SIMULATOR=true in local E2E checks.
 */

export const STRIPE_SIMULATOR_ENV = "LICENSE_VERSION_E2E_SIMULATOR";

export type StripeSimulatorSession = {
  id: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "complete" | "open" | "expired";
  mode: "payment" | "subscription";
  customer: string;
  customer_details?: { email?: string };
  metadata?: Record<string, string>;
  line_items?: { data: Array<{ quantity?: number; price?: { id: string } }> };
  livemode?: boolean;
};

export function assertStripeSimulatorAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Stripe simulator is forbidden in production runtime");
  }
  if (process.env[STRIPE_SIMULATOR_ENV] !== "true") {
    throw new Error(`${STRIPE_SIMULATOR_ENV} must be true for simulator use`);
  }
}

export async function signStripeWebhookPayload(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  const digest = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${digest}`;
}

export function catalogPriceFixture(
  id: string,
  kind: "lifetime" | "monthly" | "upgrade" | "wrong",
): Record<string, unknown> {
  if (kind === "monthly") {
    return {
      id,
      livemode: false,
      currency: "eur",
      unit_amount: 500,
      type: "recurring",
      recurring: { interval: "month" },
    };
  }
  if (kind === "upgrade") {
    return {
      id,
      livemode: false,
      currency: "eur",
      unit_amount: 500,
      type: "one_time",
      recurring: null,
    };
  }
  if (kind === "wrong") {
    return {
      id,
      livemode: false,
      currency: "eur",
      unit_amount: 999,
      type: "recurring",
      recurring: { interval: "month" },
    };
  }
  return {
    id,
    livemode: false,
    currency: "eur",
    unit_amount: 4200,
    type: "one_time",
    recurring: null,
  };
}

export type StripeFetchSimulator = {
  sessions: Map<string, StripeSimulatorSession>;
  install(): () => void;
};

export function createStripeFetchSimulator(options: {
  lifetimePriceId: string;
  monthlyPriceId: string;
  upgradePriceId: string;
}): StripeFetchSimulator {
  const sessions = new Map<string, StripeSimulatorSession>();

  return {
    sessions,
    install() {
      assertStripeSimulatorAllowed();
      const original = globalThis.fetch;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/v1/prices/")) {
          const priceId = decodeURIComponent(url.split("/v1/prices/")[1]?.split("?")[0] ?? "");
          if (priceId === options.lifetimePriceId) {
            return new Response(JSON.stringify(catalogPriceFixture(priceId, "lifetime")), { status: 200 });
          }
          if (priceId === options.monthlyPriceId) {
            return new Response(JSON.stringify(catalogPriceFixture(priceId, "monthly")), { status: 200 });
          }
          if (priceId === options.upgradePriceId) {
            return new Response(JSON.stringify(catalogPriceFixture(priceId, "upgrade")), { status: 200 });
          }
          if (priceId === "price_test_wrong") {
            return new Response(JSON.stringify(catalogPriceFixture(priceId, "wrong")), { status: 200 });
          }
        }
        if (url.includes("/v1/checkout/sessions") && init?.method === "POST") {
          const body = typeof init.body === "string" ? init.body : "";
          const sessionId = `cs_test_e2e${String(sessions.size + 1).padStart(4, "0")}`;
          const emailMatch = body.match(/customer_email=([^&]+)/);
          const email = emailMatch ? decodeURIComponent(emailMatch[1]!.replace(/\+/g, "%20")) : "";
          const session: StripeSimulatorSession = {
            id: sessionId,
            payment_status: "paid",
            status: "complete",
            mode: body.includes("mode=subscription") ? "subscription" : "payment",
            customer: "cus_e2e_sim",
            customer_details: email ? { email } : undefined,
            metadata: { plan: "lifetime", edition: "personal_lifetime" },
            line_items: {
              data: [{ quantity: 1, price: { id: options.lifetimePriceId } }],
            },
            livemode: false,
          };
          sessions.set(sessionId, session);
          return new Response(
            JSON.stringify({ id: sessionId, url: `https://checkout.stripe.com/c/pay/${sessionId}` }),
            { status: 200 },
          );
        }
        const sessionGet = url.match(/\/v1\/checkout\/sessions\/([^/?]+)/);
        if (sessionGet) {
          const session = sessions.get(sessionGet[1]!);
          if (session) return new Response(JSON.stringify(session), { status: 200 });
        }
        return original(input, init);
      }) as typeof fetch;
      return () => {
        globalThis.fetch = original;
      };
    },
  };
}
