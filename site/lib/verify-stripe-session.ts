const SESSION_ID_PATTERN = /^cs_(test|live)_[a-zA-Z0-9]+$/;

type StripeCheckoutSession = {
  id: string;
  payment_status: string;
  status: string | null;
  mode?: string;
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

export async function verifyStripeCheckoutSession(
  sessionId: string,
  secretKey: string,
): Promise<{ ok: true; session: VerifiedSession } | { ok: false; error: VerifySessionError }> {
  if (!isValidSessionId(sessionId)) {
    return { ok: false, error: "invalid_session" };
  }

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
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
      return { ok: false, error: "server_error" };
    }

    const session = (await response.json()) as StripeCheckoutSession;

    if (session.mode && session.mode !== "payment") {
      return { ok: false, error: "invalid_session" };
    }

    if (session.payment_status !== "paid") {
      return { ok: false, error: "payment_incomplete" };
    }

    return {
      ok: true,
      session: { sessionId: session.id },
    };
  } catch {
    return { ok: false, error: "server_error" };
  }
}
