import { snapshotFromStripeSubscription } from "./business-billing.ts";
import { businessService } from "./business-service.ts";
import type { StripeWebhookEvent } from "./business-webhooks.ts";
import { BUSINESS_PLAN_ID, BUSINESS_PRODUCT_TYPE } from "./business/stripe-account.ts";
import {
  isBusinessPersistenceReady,
  withBusinessService,
} from "./business-persistence/store.ts";
import { BusinessPersistenceUnavailableError } from "./business-persistence/types.ts";
import { configuredPriceId, loadCatalogPrice } from "./stripe-catalog.ts";
import {
  beginStripeEventProcessing,
  completeStripeEventProcessing,
  failStripeEventProcessing,
} from "./stripe-event-processing.ts";

export type BusinessCheckoutWebhookResult =
  | { ok: true; fulfilled: boolean; duplicate?: boolean }
  | { ok: false; error: "server_error" | "busy" | "persistence_unavailable" };

function metadataOf(object: Record<string, unknown> | undefined): Record<string, string> {
  const metadata = object?.metadata;
  if (!metadata || typeof metadata !== "object") return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === "string") next[key] = value;
  }
  return next;
}

export function isBusinessCheckoutMetadata(metadata: Record<string, string>): boolean {
  return metadata.productType === BUSINESS_PRODUCT_TYPE || metadata.plan === BUSINESS_PLAN_ID;
}

/** Business seat checkout only. Personal and Partner events stay in their handlers. */
export function isBusinessCheckoutEvent(event: StripeWebhookEvent): boolean {
  if (event.type !== "checkout.session.completed") return false;
  return isBusinessCheckoutMetadata(metadataOf(event.data?.object));
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

type BusinessCheckoutService = Pick<
  typeof businessService,
  "provisionFromStripeCheckout" | "pricing" | "findAccountByCheckoutSessionId"
>;

/**
 * Creates or links a Business organisation after Stripe confirms payment.
 * checkout.session.completed alone is not enough when payment_status is not paid.
 */
export async function applyBusinessCheckoutWebhook(
  event: StripeWebhookEvent,
  input: {
    secretKey: string;
    fetchImpl?: typeof fetch;
    service?: BusinessCheckoutService;
    /** Tests may skip D1 requirement. Production never sets this. */
    skipPersistenceRequirement?: boolean;
  },
): Promise<BusinessCheckoutWebhookResult> {
  if (!isBusinessCheckoutEvent(event)) return { ok: true, fulfilled: false };

  const eventId = event.id?.trim() ?? "";
  if (!eventId) return { ok: false, error: "server_error" };

  if (!input.skipPersistenceRequirement && !(await isBusinessPersistenceReady())) {
    return { ok: false, error: "persistence_unavailable" };
  }

  const begun = await beginStripeEventProcessing(eventId, "business_checkout");
  if (begun.action === "duplicate") return { ok: true, fulfilled: false, duplicate: true };
  if (begun.action === "busy") return { ok: false, error: "busy" };

  const secretKey = input.secretKey.trim();
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!secretKey) {
    await failStripeEventProcessing(eventId, "missing_stripe_secret");
    return { ok: false, error: "server_error" };
  }

  const object = event.data?.object ?? {};
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
  if (!isBusinessCheckoutMetadata(sessionMeta)) {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }

  const lineItems = session.line_items as
    | { data?: Array<{ quantity?: number; price?: { id?: string } | string }> }
    | undefined;
  const line = lineItems?.data?.[0];
  const priceRef = line?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id ?? "";
  const expectedPrice = configuredPriceId("business");
  if (!priceId || !expectedPrice || priceId !== expectedPrice) {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }

  const catalog = await loadCatalogPrice("business", secretKey);
  if (!catalog.ok) {
    await failStripeEventProcessing(eventId, "catalog_unavailable");
    return { ok: false, error: "server_error" };
  }

  const service = input.service;
  const minSeats = service?.pricing().minSeats ?? businessService.pricing().minSeats;
  const quantity = line?.quantity ?? Number.parseInt(sessionMeta.seatQuantity ?? "", 10);
  if (!Number.isInteger(quantity) || quantity < minSeats) {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }

  const subscription = session.subscription;
  const subscriptionBody =
    subscription && typeof subscription === "object"
      ? (subscription as Record<string, unknown>)
      : null;
  if (!subscriptionBody) {
    await failStripeEventProcessing(eventId, "missing_subscription");
    return { ok: false, error: "server_error" };
  }

  const snapshot = snapshotFromStripeSubscription(
    subscriptionBody as Parameters<typeof snapshotFromStripeSubscription>[0],
  );
  if (!snapshot.ok || snapshot.value.quantity !== quantity) {
    await failStripeEventProcessing(eventId, "subscription_snapshot_mismatch");
    return { ok: false, error: "server_error" };
  }

  const rawEmail =
    sessionMeta.email ??
    (typeof session.customer_email === "string" ? session.customer_email : "");
  const email = rawEmail.trim().toLowerCase();
  const organisationName = (sessionMeta.organisationName || "Business organisation").trim();
  if (!email) {
    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: false };
  }

  try {
    const provision = async (activeService: BusinessCheckoutService) => {
      const existing = activeService.findAccountByCheckoutSessionId(sessionId);
      if (existing) return { fulfilled: true as const, duplicateOrg: true as const };
      const provisioned = activeService.provisionFromStripeCheckout({
        email,
        organisationName,
        checkoutSessionId: sessionId,
        confirmed: snapshot.value,
        eventId,
        eventCreated: event.created ?? null,
      });
      if (!provisioned.ok) {
        if (provisioned.error === "busy") throw new Error("busy");
        return { fulfilled: false as const, duplicateOrg: false as const };
      }
      return { fulfilled: true as const, duplicateOrg: false as const };
    };

    const result = service
      ? await provision(service)
      : input.skipPersistenceRequirement
        ? await provision(businessService)
        : await withBusinessService((activeService) => provision(activeService));

    if (!result.fulfilled) {
      await failStripeEventProcessing(eventId, "provision_not_fulfilled");
      return { ok: false, error: "server_error" };
    }

    await completeStripeEventProcessing(eventId);
    return { ok: true, fulfilled: true, duplicate: result.duplicateOrg ? true : undefined };
  } catch (error) {
    if (error instanceof BusinessPersistenceUnavailableError) {
      await failStripeEventProcessing(eventId, "persistence_unavailable");
      return { ok: false, error: "persistence_unavailable" };
    }
    if (error instanceof Error && error.message === "busy") {
      await failStripeEventProcessing(eventId, "service_busy");
      return { ok: false, error: "busy" };
    }
    await failStripeEventProcessing(eventId, error instanceof Error ? error.message : "provision_failed");
    return { ok: false, error: "server_error" };
  }
}
