import {
  consumeVerifiedEmailProof,
  peekVerifiedEmailProof,
} from "@/lib/email-verification";
import { createBusinessCheckoutSession } from "@/lib/business/checkout";
import { rawCardRejection } from "@/lib/raw-card-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const CARD_FIELDS = ["card", "number", "cvc", "pan", "payment_method_data", "paymentMethod"];

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Hosted Business Checkout. Closed while PAID_CHECKOUT_ENABLED is off. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const cardRejected = rawCardRejection({ body });
  if (cardRejected) return cardRejected;

  if (CARD_FIELDS.some((field) => body[field] != null)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (body.origin != null || body.price != null || body.amount != null || body.priceId != null) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const proofId = typeof body.proofId === "string" ? body.proofId.trim() : "";
  const organisationName = typeof body.organisationName === "string" ? body.organisationName : "";
  const seats = body.seats;
  if (!proofId) return json({ ok: false, error: "unauthorized" }, 401);

  const proof = await peekVerifiedEmailProof({ proofId, purpose: "BUSINESS_CHECKOUT" });
  if (!proof.ok) {
    return json({ ok: false, error: proof.error === "expired" ? "expired" : "unauthorized" }, 401);
  }

  const consumed = await consumeVerifiedEmailProof({ proofId, purpose: "BUSINESS_CHECKOUT" });
  if (!consumed.ok) return json({ ok: false, error: "unauthorized" }, 401);

  const origin = request.nextUrl.origin;
  const result = await createBusinessCheckoutSession({
    email: consumed.email,
    organisationName,
    seats,
    origin,
  });

  if (!result.ok) {
    const status =
      result.error === "checkout_closed"
        ? 403
        : result.error === "already_subscribed"
          ? 409
          : result.error === "below_minimum" || result.error === "invalid_quantity"
            ? 400
            : 400;
    return json({ ok: false, error: result.error }, status);
  }

  return json({ ok: true, url: result.url });
}
