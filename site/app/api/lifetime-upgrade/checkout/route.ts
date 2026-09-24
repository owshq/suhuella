import { createLifetimeUpgradeCheckoutSession } from "@/lib/lifetime-upgrade/checkout-session";
import { isCheckoutReturnTo } from "@/lib/checkout";
import { rawCardRejection } from "@/lib/raw-card-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const CARD_FIELDS = ["card", "number", "cvc", "pan", "payment_method_data", "paymentMethod"];

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Hosted Lifetime Upgrade Checkout. Closed until commercial flags and enforcement open. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const cardRejected = rawCardRejection({ body });
  if (cardRejected) return cardRejected;

  if (
    body.origin != null ||
    body.price != null ||
    body.amount != null ||
    body.priceId != null ||
    body.generationId != null
  ) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (CARD_FIELDS.some((field) => body[field] != null)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const proofId = typeof body.proofId === "string" ? body.proofId.trim() : "";
  const licenseId = typeof body.licenseId === "string" ? body.licenseId.trim() : "";
  const returnToRaw = typeof body.returnTo === "string" ? body.returnTo.trim() : "settings";
  const returnTo = isCheckoutReturnTo(returnToRaw) ? returnToRaw : "settings";

  if (!proofId || !licenseId) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const result = await createLifetimeUpgradeCheckoutSession({
    proofId,
    licenseId,
    origin: request.nextUrl.origin,
    returnTo,
  });

  if (!result.ok) {
    const status =
      result.error === "checkout_closed"
        ? 403
        : result.error === "invalid_proof"
          ? 401
          : result.error === "not_eligible" || result.error === "checkout_in_progress"
            ? 409
            : result.error === "price_invalid"
              ? 422
              : 400;
    return json({ ok: false, error: result.error }, status);
  }

  return json({
    ok: true,
    url: result.url,
    intentId: result.intentId,
    checkoutSessionId: result.checkoutSessionId,
  });
}
