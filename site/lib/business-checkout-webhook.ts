import { snapshotFromStripeSubscription } from "./business-billing.ts";
import { businessService } from "./business-service.ts";
import type { StripeWebhookEvent } from "./business-webhooks.ts";
import { BUSINESS_PLAN_ID, BUSINESS_PRODUCT_TYPE } from "./business/stripe-account.ts";
import { configuredPriceId, loadCatalogPrice } from "./stripe-catalog.ts";

export type BusinessCheckoutWebhookResult =
  | { ok: true; fulfilled: boolean; duplicate?: boolean }
  | { ok: false; error: "server_error" | "busy" };

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

/**
 * Creates or links a Business organisation after Stripe confirms payment.
 * checkout.session.completed alone is not enough when payment_status is not paid.
 */
export async function applyBusinessCheckoutWebhook(
  event: StripeWebhookEvent,
  input: {
    secretKey: string;
    fetchImpl?: typeof fetch;
    service?: Pick<
      typeof businessService,
      | "markStripeEventProcessed"
      | "provisionFromStripeCheckout"
      | "pricing"
    >;
  },
): Promise<BusinessCheckoutWebhookResult> {
  if (!isBusinessCheckoutEvent(event)) return { ok: true, fulfilled: false };

  const service = input.service ?? businessService;
  const eventId = event.id?.trim() ?? "";
  if (!eventId) return { ok: false, error: "server_error" };
  const firstSeen = service.markStripeEventProcessed(eventId);
  if (!firstSeen) return { ok: true, fulfilled: false, duplicate: true };

  const secretKey = input.secretKey.trim();
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!secretKey) return { ok: false, error: "server_error" };

  const object = event.data?.object ?? {};
  const sessionId = typeof object.id === "string" ? object.id : "";
  if (!sessionId) return { ok: false, error: "server_error" };

  const session = await stripeGet(
    secretKey,
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=line_items`,
    fetchImpl,
  );
  if (!session) return { ok: false, error: "server_error" };
  if (session.payment_status !== "paid") return { ok: true, fulfilled: false };

  const sessionMeta = metadataOf(session);
  if (!isBusinessCheckoutMetadata(sessionMeta)) return { ok: true, fulfilled: false };

  const lineItems = session.line_items as
    | { data?: Array<{ quantity?: number; price?: { id?: string } | string }> }
    | undefined;
  const line = lineItems?.data?.[0];
  const priceRef = line?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id ?? "";
  const expectedPrice = configuredPriceId("business");
  if (!priceId || !expectedPrice || priceId !== expectedPrice) {
    return { ok: true, fulfilled: false };
  }

  const catalog = await loadCatalogPrice("business", secretKey);
  if (!catalog.ok) return { ok: false, error: "server_error" };

  const quantity = line?.quantity ?? Number.parseInt(sessionMeta.seatQuantity ?? "", 10);
  const minSeats = service.pricing().minSeats;
  if (!Number.isInteger(quantity) || quantity < minSeats) {
    return { ok: true, fulfilled: false };
  }

  const subscription = session.subscription;
  const subscriptionBody =
    subscription && typeof subscription === "object"
      ? (subscription as Record<string, unknown>)
      : null;
  if (!subscriptionBody) return { ok: true, fulfilled: false };

  const snapshot = snapshotFromStripeSubscription(subscriptionBody as Parameters<typeof snapshotFromStripeSubscription>[0]);
  if (!snapshot.ok || snapshot.value.quantity !== quantity) {
    return { ok: true, fulfilled: false };
  }

  const rawEmail =
    sessionMeta.email ??
    (typeof session.customer_email === "string" ? session.customer_email : "");
  const email = rawEmail.trim().toLowerCase();
  const organisationName = (sessionMeta.organisationName || "Business organisation").trim();
  if (!email) return { ok: true, fulfilled: false };

  const provisioned = service.provisionFromStripeCheckout({
    email,
    organisationName,
    checkoutSessionId: sessionId,
    confirmed: snapshot.value,
    eventId,
    eventCreated: event.created ?? null,
  });
  if (!provisioned.ok) {
    if (provisioned.error === "busy") return { ok: false, error: "busy" };
    return { ok: true, fulfilled: false };
  }

  return { ok: true, fulfilled: true };
}
