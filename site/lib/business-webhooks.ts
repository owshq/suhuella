import { snapshotFromStripeSubscription } from "./business-billing.ts";
import { businessService } from "./business-service.ts";
import type { BusinessError } from "./business-types.ts";
import { withBusinessService, isBusinessPersistenceReady } from "./business-persistence/store.ts";
import { BusinessPersistenceUnavailableError } from "./business-persistence/types.ts";
import {
  beginStripeEventProcessing,
  completeStripeEventProcessing,
  failStripeEventProcessing,
} from "./stripe-event-processing.ts";

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

type BusinessWebhookService = Pick<
  typeof businessService,
  "findAccountByStripeRef" | "reconcileSeatBilling"
>;

async function reconcileForAccount(
  service: BusinessWebhookService,
  organisationId: string,
  event: StripeWebhookEvent,
): Promise<{ ok: true } | { ok: false; error: BusinessError }> {
  const result = await service.reconcileSeatBilling(
    { kind: "superadmin" },
    organisationId,
    { id: event.id, created: event.created ?? null },
  );
  if (!result.ok && result.error !== "needs_reconciliation") return result;
  return { ok: true };
}

export async function applyStripeBusinessWebhook(
  event: StripeWebhookEvent,
  service: BusinessWebhookService = businessService,
  options: { skipPersistenceRequirement?: boolean } = {},
): Promise<
  | { ok: true; duplicate?: boolean }
  | { ok: false; error: BusinessError | "busy" | "persistence_unavailable" }
> {
  if (!event.id || !stripeWebhookEventRelevant(event.type)) {
    return { ok: true };
  }

  if (!options.skipPersistenceRequirement && !(await isBusinessPersistenceReady())) {
    return { ok: false, error: "persistence_unavailable" };
  }

  const begun = await beginStripeEventProcessing(event.id, "business_subscription");
  if (begun.action === "duplicate") return { ok: true, duplicate: true };
  if (begun.action === "busy") return { ok: false, error: "busy" };

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
  if (!account) {
    await completeStripeEventProcessing(event.id);
    return { ok: true };
  }

  try {
    const run = async (activeService: BusinessWebhookService) => {
      const current = activeService.findAccountByStripeRef({ subscriptionId, customerId });
      if (!current) return { ok: true as const };
      if (subscriptionObject) {
        const snapshot = snapshotFromStripeSubscription(
          subscriptionObject as Parameters<typeof snapshotFromStripeSubscription>[0],
        );
        if (snapshot.ok) {
          return reconcileForAccount(activeService, current.organisationId, event);
        }
      }
      return reconcileForAccount(activeService, current.organisationId, event);
    };

    const result = options.skipPersistenceRequirement
      ? await run(service)
      : await withBusinessService((activeService) => run(activeService));

    if (!result.ok) {
      await failStripeEventProcessing(event.id, result.error);
      return result;
    }
    await completeStripeEventProcessing(event.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof BusinessPersistenceUnavailableError) {
      await failStripeEventProcessing(event.id, "persistence_unavailable");
      return { ok: false, error: "persistence_unavailable" };
    }
    await failStripeEventProcessing(event.id, error instanceof Error ? error.message : "reconcile_failed");
    return { ok: false, error: "stripe_unavailable" };
  }
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
