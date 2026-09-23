import { applyBusinessCheckoutWebhook } from "@/lib/business-checkout-webhook";
import { applyPartnerStripeWebhook } from "@/lib/partners/stripe-fulfillment";
import { applyLifetimeUpgradeStripeWebhook } from "@/lib/lifetime-upgrade-webhook";
import {
  applyPersonalStripeWebhook,
} from "@/lib/personal-checkout-webhook";
import {
  applyStripeBusinessWebhook,
  verifyStripeWebhookSignature,
  type StripeWebhookEvent,
} from "@/lib/business-webhooks";
import { stripeWebhookLivemodeAllowed } from "@/lib/paid-checkout";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const payload = await request.text();
  const header = request.headers.get("stripe-signature") ?? "";

  if (!secret || !(await verifyStripeWebhookSignature(payload, header, secret))) {
    return json({ ok: false, error: "invalid_signature" }, 400);
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(payload) as StripeWebhookEvent;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!stripeWebhookLivemodeAllowed(event, secretKey)) {
    return json({ ok: false, error: "livemode_mismatch" }, 400);
  }

  const result = await applyStripeBusinessWebhook(event);
  if (!result.ok) return json({ ok: false, error: result.error }, 500);

  const businessCheckout = await applyBusinessCheckoutWebhook(event, { secretKey });
  if (!businessCheckout.ok) return json({ ok: false, error: businessCheckout.error }, 500);

  let origin = "";
  try {
    origin = new URL(request.url).origin;
  } catch {
    origin = "";
  }
  const upgrade = await applyLifetimeUpgradeStripeWebhook(event, {
    secretKey,
    origin: origin || undefined,
  });
  if (!upgrade.ok) return json({ ok: false, error: upgrade.error }, 500);

  const personal = await applyPersonalStripeWebhook(event, {
    secretKey,
    origin: origin || undefined,
  });
  if (!personal.ok) return json({ ok: false, error: personal.error }, 500);

  const partner = await applyPartnerStripeWebhook(event, { secretKey });
  if (!partner.ok) return json({ ok: false, error: partner.error }, 500);

  return json({
    ok: true,
    duplicate:
      result.duplicate === true ||
      upgrade.duplicate === true ||
      partner.duplicate === true ||
      businessCheckout.duplicate === true,
  });
}
