import { snapshotFromStripeSubscription } from "./business-billing.ts";
import { businessService } from "./business-service.ts";
import type { BusinessError } from "./business-types.ts";

export type StripeWebhookEvent = {
  id: string;
  type: string;
  created?: number;
  livemode?: boolean;
  data?: { object?: Record<string, unknown> };
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.resumed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

export function stripeWebhookEventRelevant(type: string): boolean {
  return SUBSCRIPTION_EVENTS.has(type);
}

export async function applyStripeBusinessWebhook(
  event: StripeWebhookEvent,
  service: Pick<
    typeof businessService,
    "markStripeEventProcessed" | "findAccountByStripeRef" | "reconcileSeatBilling"
  > = businessService,
): Promise<{ ok: true; duplicate?: boolean } | { ok: false; error: BusinessError }> {
  if (!event.id || !stripeWebhookEventRelevant(event.type)) {
    return { ok: true };
  }
  const firstSeen = service.markStripeEventProcessed(event.id);
  if (!firstSeen) return { ok: true, duplicate: true };

  const object = event.data?.object ?? {};
  const subscriptionObject =
    object.object === "subscription"
      ? object
      : typeof object.subscription === "object" && object.subscription
        ? (object.subscription as Record<string, unknown>)
        : null;
  const subscriptionId =
    (typeof object.subscription === "string" ? object.subscription : null) ??
    (typeof subscriptionObject?.id === "string" ? subscriptionObject.id : null) ??
    (typeof object.id === "string" && String(object.object ?? "").includes("subscription")
      ? object.id
      : null);
  const customerId = typeof object.customer === "string" ? object.customer : null;

  const account = service.findAccountByStripeRef({ subscriptionId, customerId });
  if (!account) return { ok: true };

  if (subscriptionObject) {
    const snapshot = snapshotFromStripeSubscription(subscriptionObject);
    if (snapshot.ok) {
      const result = await service.reconcileSeatBilling(
        { kind: "superadmin" },
        account.organisationId,
        { id: event.id, created: event.created ?? null },
      );
      if (!result.ok && result.error !== "needs_reconciliation") return result;
      return { ok: true };
    }
  }

  const result = await service.reconcileSeatBilling(
    { kind: "superadmin" },
    account.organisationId,
    { id: event.id, created: event.created ?? null },
  );
  if (!result.ok && result.error !== "needs_reconciliation") return result;
  return { ok: true };
}

export async function verifyStripeWebhookSignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const parts = header.split(",").map((item) => item.trim());
  const timestamp = parts.find((item) => item.startsWith("t="))?.slice(2) ?? "";
  const signatures = parts.filter((item) => item.startsWith("v1=")).map((item) => item.slice(3));
  if (!timestamp || signatures.length === 0 || !secret) return false;
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
  const digest = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return signatures.some((signature) => signature === digest);
}
