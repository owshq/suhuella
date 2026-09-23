import { fulfillLicenseFromCheckout, type FulfilledLicense } from "./license-fulfillment.ts";
import { readLicensePersistence, withLicensePersistence } from "./license-persistence/store.ts";
import {
  configuredPriceId,
  loadCatalogPrice,
  type CatalogProduct,
} from "./stripe-catalog.ts";
import {
  verifyStripeCheckoutSession,
  type FulfilledCheckoutSession,
  type VerifySessionError,
} from "./verify-stripe-session.ts";

const BLOCKED_PRODUCTS = ["business", "partner", "lifetime_upgrade"] as const;

function productForSession(session: FulfilledCheckoutSession): CatalogProduct | null {
  if (session.priceId && session.priceId === configuredPriceId("lifetime_upgrade")) return "lifetime_upgrade";
  if (session.priceId && session.priceId === configuredPriceId("partner")) return "partner";
  if (session.priceId && session.priceId === configuredPriceId("business")) return "business";
  if (session.edition === "personal_monthly" || session.mode === "subscription") return "monthly";
  if (session.edition === "personal_lifetime" || session.mode === "payment") return "lifetime";
  return null;
}

export async function reconcilePaidCheckoutSession(input: {
  sessionId: string;
  secretKey: string;
  origin?: string;
  stripeEventId?: string;
}): Promise<
  | { ok: true; license: FulfilledLicense | null; session: FulfilledCheckoutSession }
  | { ok: false; error: VerifySessionError }
> {
  const verified = await verifyStripeCheckoutSession(input.sessionId, input.secretKey, input.origin);
  if (!verified.ok) return verified;

  const product = productForSession(verified.session);
  if (!product || BLOCKED_PRODUCTS.includes(product as (typeof BLOCKED_PRODUCTS)[number])) {
    return { ok: false, error: "invalid_session" };
  }
  if (product !== "monthly" && product !== "lifetime") {
    return { ok: false, error: "invalid_session" };
  }
  if (verified.session.quantity != null && verified.session.quantity !== 1) {
    return { ok: false, error: "invalid_session" };
  }
  const expectedPrice = configuredPriceId(product);
  if (!expectedPrice || verified.session.priceId !== expectedPrice) {
    return { ok: false, error: "invalid_session" };
  }

  const price = await loadCatalogPrice(product, input.secretKey);
  if (!price.ok) {
    return {
      ok: false,
      error: price.reason === "stripe_unavailable" ? "server_error" : "invalid_session",
    };
  }

  const license = await fulfillLicenseFromCheckout(verified.session, {
    stripeEventId: input.stripeEventId,
  });
  return { ok: true, license, session: verified.session };
}

export async function stripeEventAlreadyHandled(eventId: string): Promise<boolean> {
  const id = eventId.trim();
  if (!id) return false;
  const document = await readLicensePersistence();
  return document.stripeEvents.some((event) => event.id === id);
}

export async function rememberStripeEvent(eventId: string): Promise<void> {
  const id = eventId.trim();
  if (!id) return;
  await withLicensePersistence((document) => {
    if (document.stripeEvents.some((event) => event.id === id)) return;
    document.stripeEvents.push({ id, processedAt: new Date().toISOString() });
  });
}
