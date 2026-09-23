import type { StripeWebhookEvent } from "./business-webhooks.ts";
import { rememberStripeEvent, stripeEventAlreadyHandled } from "./checkout-reconciliation.ts";
import { fulfillLifetimeUpgradeFromCheckout } from "./lifetime-upgrade/fulfillment.ts";

export type LifetimeUpgradeWebhookResult =
  | { ok: true; fulfilled: boolean; duplicate?: boolean; paymentRecorded?: boolean }
  | { ok: false; error: "server_error" };

function metadataOf(event: StripeWebhookEvent): Record<string, string> {
  const object = event.data?.object;
  const metadata = object?.metadata;
  if (!metadata || typeof metadata !== "object") return {};
  const record = metadata as Record<string, unknown>;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") next[key] = value;
  }
  return next;
}

function objectId(event: StripeWebhookEvent): string {
  const id = event.data?.object?.id;
  return typeof id === "string" ? id : "";
}

/** Lifetime Upgrade checkout only. Does not create a new Lifetime license. */
export function isLifetimeUpgradeCheckoutEvent(event: StripeWebhookEvent): boolean {
  if (event.type !== "checkout.session.completed") return false;
  const metadata = metadataOf(event);
  return metadata.productType === "lifetime_upgrade" || metadata.plan === "lifetime_upgrade";
}

export async function applyLifetimeUpgradeCheckoutWebhook(
  event: StripeWebhookEvent,
  input: { secretKey: string; origin?: string },
): Promise<LifetimeUpgradeWebhookResult> {
  if (!isLifetimeUpgradeCheckoutEvent(event)) return { ok: true, fulfilled: false };

  const sessionId = objectId(event);
  const secretKey = input.secretKey.trim();
  if (!secretKey) return { ok: false, error: "server_error" };

  const paymentStatus = event.data?.object?.payment_status;
  if (paymentStatus && paymentStatus !== "paid") {
    return { ok: true, fulfilled: false };
  }

  const result = await fulfillLifetimeUpgradeFromCheckout({
    sessionId,
    secretKey,
    origin: input.origin,
    stripeEventId: event.id,
  });
  if (!result.ok) {
    if (result.error === "server_error") return { ok: false, error: "server_error" };
    return { ok: true, fulfilled: false };
  }
  return {
    ok: true,
    fulfilled: result.fulfilled,
    duplicate: result.duplicate,
    paymentRecorded: result.paymentRecorded,
  };
}

export async function applyLifetimeUpgradeStripeWebhook(
  event: StripeWebhookEvent,
  input: { secretKey: string; origin?: string },
): Promise<LifetimeUpgradeWebhookResult> {
  const eventId = event.id?.trim() ?? "";
  if (eventId && (await stripeEventAlreadyHandled(eventId))) {
    return { ok: true, fulfilled: false, duplicate: true };
  }
  const result = await applyLifetimeUpgradeCheckoutWebhook(event, input);
  if (!result.ok) return result;
  if (eventId) await rememberStripeEvent(eventId);
  return result;
}
