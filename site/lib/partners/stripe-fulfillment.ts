import {
  beginStripeEventProcessing,
  completeStripeEventProcessing,
  failStripeEventProcessing,
} from "../stripe-event-processing.ts";
import { configuredPriceId, loadCatalogPrice } from "../stripe-catalog.ts";
import { findPartnerApplication } from "./application-store.ts";
import {
  refreshStripePartnerPeriod,
  suspendStripePartnerSubscription,
  upsertStripePartnerFromVerifiedPayment,
} from "./service.ts";
import { PARTNER_PLAN_ID, PARTNER_PRODUCT_TYPE, SUHUELLA_STRIPE_ACCOUNT_ID } from "./stripe-account.ts";
import { getPartnerStripeLedger } from "./stripe-ledger.ts";

export type PartnerWebhookResult =
  | { ok: true; fulfilled: boolean; duplicate?: boolean }
  | { ok: false; error: "server_error" | "busy" };

type StripeEvent = {
  id?: string;
  type?: string;
  livemode?: boolean;
  account?: string;
  data?: { object?: Record<string, unknown> };
};

function metadataOf(object: Record<string, unknown> | undefined): Record<string, string> {
  const metadata = object?.metadata;
  if (!metadata || typeof metadata !== "object") return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === "string") next[key] = value;
  }
  return next;
}

function isPartnerMetadata(metadata: Record<string, string>): boolean {
  return (
    metadata.productType === PARTNER_PRODUCT_TYPE ||
    metadata.plan === PARTNER_PLAN_ID ||
    metadata.plan === "partner"
  );
}

export function isPartnerCheckoutEvent(event: StripeEvent): boolean {
  const object = event.data?.object;
  const metadata = metadataOf(object);
  if (event.type === "checkout.session.completed") return isPartnerMetadata(metadata);
  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_succeeded" ||
    event.type === "invoice.payment_failed" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    return isPartnerMetadata(metadata);
  }
  return false;
}

function unixToIso(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

async function stripeGet(
  secretKey: string,
  path: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown> | null> {
  let response: Response;
  try {
    response = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Grants a Partner license only after Stripe confirms payment.
 * checkout.session.completed alone is not enough when payment_status is not paid.
 * A browser return never calls this.
 */
export async function applyPartnerStripeWebhook(
  event: StripeEvent,
  input: { secretKey: string; fetchImpl?: typeof fetch },
): Promise<PartnerWebhookResult> {
  if (event.account && event.account !== SUHUELLA_STRIPE_ACCOUNT_ID) {
    return { ok: true, fulfilled: false };
  }
  if (!isPartnerCheckoutEvent(event)) return { ok: true, fulfilled: false };

  const eventId = event.id?.trim() ?? "";
  if (!eventId) return { ok: false, error: "server_error" };
  const begun = await beginStripeEventProcessing(eventId, "partner");
  if (begun.action === "duplicate") return { ok: true, fulfilled: false, duplicate: true };
  if (begun.action === "busy") return { ok: false, error: "busy" };

  const secretKey = input.secretKey.trim();
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!secretKey) {
    await failStripeEventProcessing(eventId, "missing_stripe_secret");
    return { ok: false, error: "server_error" };
  }

  const object = event.data?.object ?? {};
  const metadata = metadataOf(object);

  if (event.type === "invoice.payment_failed") {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const status = typeof object.status === "string" ? object.status : "";
    const subscriptionId = typeof object.id === "string" ? object.id : "";
    const ended =
      event.type === "customer.subscription.deleted" ||
      status === "canceled" ||
      status === "unpaid" ||
      status === "incomplete_expired";
    if (ended && subscriptionId) {
      await suspendStripePartnerSubscription(subscriptionId);
    }
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: ended };
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const subscriptionId = typeof object.subscription === "string" ? object.subscription : "";
    if (!subscriptionId) {
      await completeStripeEventProcessing(eventId);
      return { ok: true, fulfilled: false };
    }
    const subscription = await stripeGet(
      secretKey,
      `subscriptions/${encodeURIComponent(subscriptionId)}`,
      fetchImpl,
    );
    if (!subscription) {
      await failStripeEventProcessing(eventId, "subscription_unavailable");
      return { ok: false, error: "server_error" };
    }
    const subMeta = metadataOf(subscription);
    if (!isPartnerMetadata(subMeta) && !isPartnerMetadata(metadata)) {
      await completeStripeEventProcessing(eventId);
      return { ok: true, fulfilled: false };
    }
    if (subscription.status !== "active") {
      await completeStripeEventProcessing(eventId);
      return { ok: true, fulfilled: false };
    }
    const email = subMeta.email || metadata.email || "";
    const customerId = typeof subscription.customer === "string" ? subscription.customer : "";
    const validUntil = unixToIso(subscription.current_period_end);
    const ledger = await getPartnerStripeLedger();
    const existing = await ledger.findFulfillment(subscriptionId);
    if (!existing?.partnerId) {
      if (!email || !customerId) {
        await completeStripeEventProcessing(eventId);
        return { ok: true, fulfilled: false };
      }
      const claim = await ledger.claimFulfillment({
        stripeSubscriptionId: subscriptionId,
        email,
        stripeCustomerId: customerId,
        stripeCheckoutSessionId: null,
      });
      if (claim === "busy") return { ok: false, error: "busy" };
      if (claim !== "fulfilled") {
        const application = await findPartnerApplication(email);
        const provisioned = await upsertStripePartnerFromVerifiedPayment({
          email,
          displayName: application?.displayName || email,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          validUntil,
        });
        await ledger.markFulfillment({
          stripeSubscriptionId: subscriptionId,
          partnerId: provisioned.partnerId,
        });
        await ledger.completeAttempt(email);
      }
    } else {
      await refreshStripePartnerPeriod({ stripeSubscriptionId: subscriptionId, validUntil });
    }
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: true };
  }

  if (event.type !== "checkout.session.completed") {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }

  const sessionId = typeof object.id === "string" ? object.id : "";
  if (!sessionId) {
    await failStripeEventProcessing(eventId, "missing_session_id");
    return { ok: false, error: "server_error" };
  }
  const session = await stripeGet(
    secretKey,
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=line_items`,
    fetchImpl,
  );
  if (!session) {
    await failStripeEventProcessing(eventId, "stripe_session_unavailable");
    return { ok: false, error: "server_error" };
  }
  if (session.payment_status !== "paid") {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }
  const sessionMeta = metadataOf(session);
  if (!isPartnerMetadata(sessionMeta)) {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }
  const lineItems = session.line_items as { data?: Array<{ price?: { id?: string } | string }> } | undefined;
  const priceRef = lineItems?.data?.[0]?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id ?? "";
  if (!priceId || priceId !== configuredPriceId("partner")) {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }
  const catalog = await loadCatalogPrice("partner", secretKey);
  if (!catalog.ok) {
    await failStripeEventProcessing(eventId, "catalog_unavailable");
    return { ok: false, error: "server_error" };
  }

  const subscription = session.subscription as Record<string, unknown> | string | null | undefined;
  const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;
  const customerRef = session.customer;
  const customerId =
    typeof customerRef === "string"
      ? customerRef
      : customerRef && typeof customerRef === "object" && typeof (customerRef as { id?: string }).id === "string"
        ? (customerRef as { id: string }).id
        : "";
  const email =
    sessionMeta.email ||
    (typeof session.customer_email === "string" ? session.customer_email : "") ||
    "";
  if (typeof subscriptionId !== "string" || !subscriptionId || !customerId || !email) {
    await failStripeEventProcessing(eventId, "missing_partner_checkout_refs");
    return { ok: false, error: "server_error" };
  }
  let subscriptionStatus =
    typeof subscription === "object" && subscription && typeof subscription.status === "string"
      ? subscription.status
      : "";
  if (subscriptionStatus !== "active") {
    const fetched = await stripeGet(secretKey, `subscriptions/${encodeURIComponent(subscriptionId)}`, fetchImpl);
    subscriptionStatus = typeof fetched?.status === "string" ? fetched.status : "";
    if (subscriptionStatus !== "active") {
      await completeStripeEventProcessing(eventId);
      return { ok: true, fulfilled: false };
    }
  }

  const ledger = await getPartnerStripeLedger();
  const claim = await ledger.claimFulfillment({
    stripeSubscriptionId: subscriptionId,
    email,
    stripeCustomerId: customerId,
    stripeCheckoutSessionId: sessionId,
  });
  if (claim === "busy") return { ok: false, error: "busy" };
  if (claim === "fulfilled") {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: true, duplicate: true };
  }

  const validUntil =
    typeof subscription === "object" && subscription
      ? unixToIso(subscription.current_period_end)
      : null;
  const application = await findPartnerApplication(email);
  try {
    const provisioned = await upsertStripePartnerFromVerifiedPayment({
      email,
      displayName: application?.displayName || email,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      validUntil,
    });
    await ledger.markFulfillment({
      stripeSubscriptionId: subscriptionId,
      partnerId: provisioned.partnerId,
    });
    await ledger.completeAttempt(email);
  } catch {
    await ledger.releaseUnfinishedClaim(subscriptionId);
    await failStripeEventProcessing(eventId, "partner_provision_failed");
    return { ok: false, error: "server_error" };
  }
  await completeStripeEventProcessing(eventId);
  return { ok: true, fulfilled: true };
}
