import { snapshotFromStripeSubscription } from "./business-billing.ts";
import { isBusinessCheckoutMetadata } from "./business-checkout-webhook.ts";
import { BUSINESS_PLAN_ID, BUSINESS_PRODUCT_TYPE } from "./business/stripe-account.ts";
import { withBusinessService } from "./business-persistence/store.ts";
import { BusinessPersistenceUnavailableError } from "./business-persistence/types.ts";
import { configuredPriceId, loadCatalogPrice } from "./stripe-catalog.ts";
import { normalizeEmail } from "./license-context.ts";

export type BusinessReconcileResult =
  | { ok: true; organisationId: string; duplicate?: boolean }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "invalid_session"
        | "invalid_request"
        | "server_error"
        | "persistence_unavailable"
        | "not_paid";
    };

function metadataOf(object: Record<string, unknown>): Record<string, string> {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return {};
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (typeof value === "string") next[key] = value;
  }
  return next;
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
 * Owner-authenticated reconciliation for a paid Business checkout session.
 * Requires verified owner email matching Stripe session metadata/customer email.
 */
export async function reconcileBusinessCheckoutForOwner(input: {
  sessionId: string;
  ownerEmail: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<BusinessReconcileResult> {
  const sessionId = input.sessionId.trim();
  const ownerEmail = normalizeEmail(input.ownerEmail);
  const secretKey = input.secretKey.trim();
  if (!sessionId || !ownerEmail.includes("@") || !secretKey) {
    return { ok: false, error: "invalid_request" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const session = await stripeGet(
    secretKey,
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription&expand[]=line_items`,
    fetchImpl,
  );
  if (!session) return { ok: false, error: "invalid_session" };
  if (session.payment_status !== "paid") return { ok: false, error: "not_paid" };

  const sessionMeta = metadataOf(session);
  if (
    !isBusinessCheckoutMetadata(sessionMeta) &&
    sessionMeta.plan !== BUSINESS_PLAN_ID &&
    sessionMeta.productType !== BUSINESS_PRODUCT_TYPE
  ) {
    return { ok: false, error: "invalid_session" };
  }

  const rawEmail =
    sessionMeta.email ??
    (typeof session.customer_email === "string" ? session.customer_email : "");
  if (normalizeEmail(rawEmail) !== ownerEmail) {
    return { ok: false, error: "unauthorized" };
  }

  const lineItems = session.line_items as
    | { data?: Array<{ quantity?: number; price?: { id?: string } | string }> }
    | undefined;
  const line = lineItems?.data?.[0];
  const priceRef = line?.price;
  const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id ?? "";
  const expectedPrice = configuredPriceId("business");
  if (!priceId || !expectedPrice || priceId !== expectedPrice) {
    return { ok: false, error: "invalid_session" };
  }

  const catalog = await loadCatalogPrice("business", secretKey);
  if (!catalog.ok) return { ok: false, error: "server_error" };

  const subscription = session.subscription;
  const subscriptionBody =
    subscription && typeof subscription === "object"
      ? (subscription as Record<string, unknown>)
      : null;
  if (!subscriptionBody) return { ok: false, error: "invalid_session" };

  const snapshot = snapshotFromStripeSubscription(
    subscriptionBody as Parameters<typeof snapshotFromStripeSubscription>[0],
  );
  const quantity = line?.quantity ?? Number.parseInt(sessionMeta.seatQuantity ?? "", 10);
  if (!snapshot.ok || snapshot.value.quantity !== quantity) {
    return { ok: false, error: "invalid_session" };
  }

  const organisationName = (sessionMeta.organisationName || "Business organisation").trim();
  const reconcileEventId = `reconcile:${sessionId}`;

  try {
    const provisioned = await withBusinessService(async (service) => {
      const existing = service.findAccountByCheckoutSessionId(sessionId);
      if (existing) {
        return { organisationId: existing.organisationId, duplicate: true as const };
      }
      const result = service.provisionFromStripeCheckout({
        email: ownerEmail,
        organisationName,
        checkoutSessionId: sessionId,
        confirmed: snapshot.value,
        eventId: reconcileEventId,
        eventCreated: null,
      });
      if (!result.ok) throw new Error(result.error);
      return { organisationId: result.value.account.organisationId, duplicate: false as const };
    });
    return {
      ok: true,
      organisationId: provisioned.organisationId,
      duplicate: provisioned.duplicate,
    };
  } catch (error) {
    if (error instanceof BusinessPersistenceUnavailableError) {
      return { ok: false, error: "persistence_unavailable" };
    }
    return { ok: false, error: "server_error" };
  }
}
