import { businessService } from "./business-service.ts";
import type { StripeWebhookEvent } from "./business-webhooks.ts";
import { reconcilePaidCheckoutSession, rememberStripeEvent, stripeEventAlreadyHandled } from "./checkout-reconciliation.ts";
import { normalizeLicenseGrant } from "./license-entitlement.ts";
import { listDurableGrants, upsertStoredGrant } from "./license-store.ts";

const PERSONAL_EDITIONS = new Set(["personal_lifetime", "personal_monthly"]);
const PERSONAL_PLANS = new Set(["lifetime", "monthly"]);

export type PersonalWebhookResult =
  | { ok: true; fulfilled: boolean }
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

/** Personal Checkout only. Partner and Business events are not personal grants. */
export function isPersonalCheckoutEvent(event: StripeWebhookEvent): boolean {
  if (event.type !== "checkout.session.completed") return false;
  const metadata = metadataOf(event);
  if (
    metadata.productType === "operator_license" ||
    metadata.productType === "lifetime_upgrade" ||
    metadata.productType === "business_seats"
  ) {
    return false;
  }
  if (
    metadata.plan === "partner" ||
    metadata.plan === "partner_annual" ||
    metadata.plan === "lifetime_upgrade" ||
    metadata.plan === "business"
  ) {
    return false;
  }
  return PERSONAL_EDITIONS.has(metadata.edition ?? "") || PERSONAL_PLANS.has(metadata.plan ?? "");
}

export async function applyPersonalCheckoutWebhook(
  event: StripeWebhookEvent,
  input: { secretKey: string; origin?: string },
): Promise<PersonalWebhookResult> {
  if (!isPersonalCheckoutEvent(event)) return { ok: true, fulfilled: false };

  const sessionId = objectId(event);
  const secretKey = input.secretKey.trim();
  if (!secretKey) return { ok: false, error: "server_error" };

  const reconciled = await reconcilePaidCheckoutSession({
    sessionId,
    secretKey,
    origin: input.origin,
    stripeEventId: event.id,
  });
  if (!reconciled.ok) {
    if (reconciled.error === "server_error") return { ok: false, error: "server_error" };
    return { ok: true, fulfilled: false };
  }
  return { ok: true, fulfilled: reconciled.license !== null };
}

function subscriptionObject(event: StripeWebhookEvent): Record<string, unknown> | null {
  const object = event.data?.object;
  if (!object) return null;
  if (object.object === "subscription") return object;
  return null;
}

function unixToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

/**
 * Updates an existing Stripe Personal Monthly grant.
 * Does not create a grant, does not change edition, and does not touch manual licenses.
 */
export async function applyPersonalSubscriptionWebhook(
  event: StripeWebhookEvent,
  input: { secretKey?: string } = {},
): Promise<PersonalWebhookResult> {
  if (event.type === "invoice.payment_failed") {
    const subscriptionId =
      typeof event.data?.object?.subscription === "string" ? event.data.object.subscription : "";
    if (!subscriptionId) return { ok: true, fulfilled: false };
    const grant = (await listDurableGrants()).find(
      (item) =>
        item.origin === "stripe" &&
        item.edition === "personal_monthly" &&
        item.subscriptionId === subscriptionId,
    );
    if (!grant) return { ok: true, fulfilled: false };
    await upsertStoredGrant(
      normalizeLicenseGrant({
        ...grant,
        edition: "personal_monthly",
        origin: "stripe",
        status: "active",
        entitlementStatus: "past_due",
        updatedAt: new Date().toISOString(),
      }),
    );
    return { ok: true, fulfilled: true };
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const subscriptionId =
      typeof event.data?.object?.subscription === "string" ? event.data.object.subscription : "";
    if (!subscriptionId) return { ok: true, fulfilled: false };
    const secretKey = input.secretKey?.trim() ?? "";
    if (!secretKey) return { ok: false, error: "server_error" };
    let response: Response;
    try {
      response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: "no-store",
      });
    } catch {
      return { ok: false, error: "server_error" };
    }
    if (!response.ok) return { ok: false, error: "server_error" };
    const subscription = (await response.json()) as Record<string, unknown>;
    return applyPersonalSubscriptionWebhook(
      {
        id: `${event.id}:subscription`,
        type: "customer.subscription.updated",
        data: { object: subscription },
      },
      input,
    );
  }

  if (
    event.type !== "customer.subscription.updated" &&
    event.type !== "customer.subscription.deleted" &&
    event.type !== "customer.subscription.created" &&
    event.type !== "customer.subscription.resumed"
  ) {
    return { ok: true, fulfilled: false };
  }

  const subscription = subscriptionObject(event);
  const subscriptionId =
    (typeof subscription?.id === "string" ? subscription.id : "") || objectId(event);
  if (!subscriptionId) return { ok: true, fulfilled: false };

  const customerId = typeof subscription?.customer === "string" ? subscription.customer : "";
  if (
    businessService.findAccountByStripeRef({
      subscriptionId,
      customerId: customerId || null,
    })
  ) {
    return { ok: true, fulfilled: false };
  }

  const grant = (await listDurableGrants()).find(
    (item) =>
      item.origin === "stripe" &&
      item.edition === "personal_monthly" &&
      item.subscriptionId === subscriptionId,
  );
  if (!grant) return { ok: true, fulfilled: false };

  const status = typeof subscription?.status === "string" ? subscription.status : "";
  const periodEnd = unixToIso(subscription?.current_period_end) ?? grant.currentPeriodEnd ?? null;
  const periodStillOpen = Boolean(periodEnd && new Date(periodEnd).getTime() > Date.now());
  const ended =
    event.type === "customer.subscription.deleted" ||
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired";

  if (ended && !periodStillOpen) {
    await upsertStoredGrant(
      normalizeLicenseGrant({
        ...grant,
        edition: "personal_monthly",
        origin: "stripe",
        status: "expired",
        currentPeriodEnd: periodEnd,
        validUntil: periodEnd,
        updatedAt: new Date().toISOString(),
      }),
    );
    return { ok: true, fulfilled: true };
  }

  if (ended && periodStillOpen) {
    await upsertStoredGrant(
      normalizeLicenseGrant({
        ...grant,
        edition: "personal_monthly",
        origin: "stripe",
        status: "active",
        entitlementStatus: "canceled_at_period_end",
        currentPeriodEnd: periodEnd,
        validUntil: periodEnd,
        updatedAt: new Date().toISOString(),
      }),
    );
    return { ok: true, fulfilled: true };
  }

  if (status === "active" || status === "trialing") {
    await upsertStoredGrant(
      normalizeLicenseGrant({
        ...grant,
        edition: "personal_monthly",
        origin: "stripe",
        status: "active",
        currentPeriodEnd: periodEnd,
        validUntil: periodEnd,
        updatedAt: new Date().toISOString(),
      }),
    );
    return { ok: true, fulfilled: true };
  }

  return { ok: true, fulfilled: false };
}

export async function applyPersonalStripeWebhook(
  event: StripeWebhookEvent,
  input: { secretKey: string; origin?: string },
): Promise<PersonalWebhookResult> {
  const eventId = event.id?.trim() ?? "";
  if (eventId && (await stripeEventAlreadyHandled(eventId))) {
    return { ok: true, fulfilled: false };
  }
  const result = isPersonalCheckoutEvent(event)
    ? await applyPersonalCheckoutWebhook(event, input)
    : await applyPersonalSubscriptionWebhook(event, input);
  if (!result.ok) return result;
  if (eventId) await rememberStripeEvent(eventId);
  return result;
}
