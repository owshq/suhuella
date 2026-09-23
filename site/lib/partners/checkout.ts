import { isPartnerCheckoutPubliclyEnabled } from "./program-journey.ts";
import { getPartnerStore } from "./store.ts";
import { assertSuhuellaLiveStripeAccount, PARTNER_PLAN_ID, PARTNER_PRODUCT_TYPE } from "./stripe-account.ts";
import { getPartnerStripeLedger } from "./stripe-ledger.ts";
import { configuredPriceId, loadCatalogPrice } from "../stripe-catalog.ts";

export type PartnerCheckoutResult =
  | { ok: true; url: string; reused: boolean }
  | {
      ok: false;
      error:
        | "checkout_closed"
        | "already_covered"
        | "invalid_price"
        | "invalid_account"
        | "stripe_unavailable";
    };

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function partnerAlreadyCovered(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const store = await getPartnerStore();
  const doc = await store.read();
  const partner = doc.partners.find(
    (item) => item.ownerEmail === normalized && item.status !== "revoked" && item.status !== "suspended",
  );
  if (!partner) return false;
  return doc.entitlements.some(
    (item) => item.partnerId === partner.partnerId && item.status === "active",
  );
}

/**
 * Hosted Checkout for the platform Partner annual price.
 * Closed unless both checkout flags and the catalog switch are on.
 * Never reads price, amount, or account from the browser.
 */
export async function createPartnerCheckoutSession(input: {
  email: string;
  origin: string;
  fetchImpl?: typeof fetch;
  /** Tests only. The HTTP route never sets this. */
  testUnlock?: boolean;
}): Promise<PartnerCheckoutResult> {
  if (input.testUnlock !== true && !isPartnerCheckoutPubliclyEnabled()) {
    return { ok: false, error: "checkout_closed" };
  }
  const email = input.email.trim().toLowerCase();
  const fetchImpl = input.fetchImpl ?? fetch;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (await partnerAlreadyCovered(email)) {
    return { ok: false, error: "already_covered" };
  }

  const account = await assertSuhuellaLiveStripeAccount(secretKey, fetchImpl);
  if (!account.ok) {
    return {
      ok: false,
      error: account.reason === "stripe_unavailable" ? "stripe_unavailable" : "invalid_account",
    };
  }

  const price = await loadCatalogPrice("partner", secretKey);
  if (!price.ok || !price.price.livemode) {
    return { ok: false, error: price.ok ? "invalid_price" : price.reason === "stripe_unavailable" ? "stripe_unavailable" : "invalid_price" };
  }

  let productResponse: Response;
  try {
    productResponse = await fetchImpl(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(price.price.priceId)}?expand[]=product`,
      { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" },
    );
  } catch {
    return { ok: false, error: "stripe_unavailable" };
  }
  if (!productResponse.ok) return { ok: false, error: "invalid_price" };
  const expanded = (await productResponse.json()) as {
    product?: { metadata?: Record<string, string> } | string;
  };
  const product = expanded.product;
  const metadata = product && typeof product === "object" ? product.metadata ?? {} : {};
  if (metadata.productType !== PARTNER_PRODUCT_TYPE || metadata.planId !== PARTNER_PLAN_ID) {
    return { ok: false, error: "invalid_price" };
  }

  const ledger = await getPartnerStripeLedger();
  const open = await ledger.insertOpenAttempt({ email, priceId: price.price.priceId });
  if (open.checkoutUrl?.startsWith("https://checkout.stripe.com/")) {
    return { ok: true, url: open.checkoutUrl, reused: true };
  }

  const priceId = configuredPriceId("partner");
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `partner-checkout:${email}:${priceId}`.slice(0, 255),
    },
    body: formBody({
      mode: "subscription",
      "line_items[0][price]": price.price.priceId,
      "line_items[0][quantity]": "1",
      success_url: `${input.origin}/partners/portal?checkout=return`,
      cancel_url: `${input.origin}/partners`,
      customer_email: email,
      "metadata[plan]": PARTNER_PLAN_ID,
      "metadata[productType]": PARTNER_PRODUCT_TYPE,
      "metadata[email]": email,
      "subscription_data[metadata][plan]": PARTNER_PLAN_ID,
      "subscription_data[metadata][productType]": PARTNER_PRODUCT_TYPE,
      "subscription_data[metadata][email]": email,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, error: "stripe_unavailable" };
  const session = (await response.json()) as { id?: string; url?: string };
  if (!session.id || !session.url?.startsWith("https://checkout.stripe.com/")) {
    return { ok: false, error: "stripe_unavailable" };
  }
  await ledger.attachCheckoutSession({
    attemptId: open.attemptId,
    sessionId: session.id,
    checkoutUrl: session.url,
  });
  return { ok: true, url: session.url, reused: false };
}
