import { getBusinessPricingConfig, monthlyAmountCents } from "../business-config.ts";
import { businessService } from "../business-service.ts";
import { isPaidCheckoutPubliclyEnabled, stripeSecretAllowedForOrigin } from "../paid-checkout.ts";
import { configuredPriceId, loadCatalogPrice, STRIPE_CATALOG } from "../stripe-catalog.ts";
import {
  assertSuhuellaLiveStripeAccount,
  BUSINESS_PLAN_ID,
  BUSINESS_PRODUCT_TYPE,
} from "./stripe-account.ts";

export type BusinessSeatValidation =
  | { ok: true; seats: number }
  | { ok: false; error: "invalid_quantity" | "below_minimum" };

export type BusinessCheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      error:
        | "checkout_closed"
        | "invalid_quantity"
        | "below_minimum"
        | "invalid_request"
        | "already_subscribed"
        | "invalid_price"
        | "invalid_account"
        | "stripe_unavailable";
    };

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

/** Public Business checkout runs only when catalog, brand, and PAID_CHECKOUT_ENABLED are on. */
export function isBusinessCheckoutPubliclyEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!STRIPE_CATALOG.business.checkoutEnabled) return false;
  if (!isPaidCheckoutPubliclyEnabled(env)) return false;
  return Boolean(configuredPriceId("business"));
}

export function validateBusinessSeatQuantity(value: unknown): BusinessSeatValidation {
  if (typeof value === "string" && value.includes(".")) {
    return { ok: false, error: "invalid_quantity" };
  }
  const seats = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(seats) || seats < 1) {
    return { ok: false, error: "invalid_quantity" };
  }
  const minSeats = getBusinessPricingConfig().minSeats;
  if (seats < minSeats) {
    return { ok: false, error: "below_minimum" };
  }
  return { ok: true, seats };
}

export function businessCheckoutSummary(seats: number): {
  seats: number;
  seatPriceCents: number;
  currency: string;
  subtotalCents: number;
} {
  const pricing = getBusinessPricingConfig();
  return {
    seats,
    seatPriceCents: pricing.seatPriceCents,
    currency: pricing.currency,
    subtotalCents: monthlyAmountCents(seats, pricing),
  };
}

function organisationNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 120;
}

/**
 * Hosted Checkout for Business seat subscriptions.
 * Quantity is validated server-side; never trust browser defaults at charge time.
 */
export async function createBusinessCheckoutSession(input: {
  email: string;
  organisationName: string;
  seats: unknown;
  origin: string;
  fetchImpl?: typeof fetch;
  /** Tests only. The HTTP route never sets this. */
  testUnlock?: boolean;
}): Promise<BusinessCheckoutResult> {
  if (input.testUnlock !== true && !isBusinessCheckoutPubliclyEnabled()) {
    return { ok: false, error: "checkout_closed" };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !organisationNameValid(input.organisationName)) {
    return { ok: false, error: "invalid_request" };
  }

  const quantity = validateBusinessSeatQuantity(input.seats);
  if (!quantity.ok) return { ok: false, error: quantity.error };

  const managed = businessService.findManagedOrganisation(email);
  if (managed?.account.stripeSubscriptionId && managed.account.stripeStatus === "active") {
    return { ok: false, error: "already_subscribed" };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!secretKey || !stripeSecretAllowedForOrigin(secretKey, input.origin)) {
    return { ok: false, error: "checkout_closed" };
  }

  const account = await assertSuhuellaLiveStripeAccount(secretKey, fetchImpl);
  if (!account.ok) {
    return {
      ok: false,
      error: account.reason === "stripe_unavailable" ? "stripe_unavailable" : "invalid_account",
    };
  }

  const price = await loadCatalogPrice("business", secretKey);
  if (!price.ok || !price.price.livemode) {
    return {
      ok: false,
      error: price.ok ? "invalid_price" : price.reason === "stripe_unavailable" ? "stripe_unavailable" : "invalid_price",
    };
  }

  const priceId = configuredPriceId("business");
  const orgName = input.organisationName.trim();
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `business-checkout:${email}:${quantity.seats}:${priceId}`.slice(0, 255),
    },
    body: formBody({
      mode: "subscription",
      "line_items[0][price]": price.price.priceId,
      "line_items[0][quantity]": String(quantity.seats),
      success_url: `${input.origin}/settings?prefs=organisation&checkout=return&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}/checkout/business?checkout=canceled`,
      customer_email: email,
      "metadata[plan]": BUSINESS_PLAN_ID,
      "metadata[productType]": BUSINESS_PRODUCT_TYPE,
      "metadata[email]": email,
      "metadata[organisationName]": orgName,
      "metadata[seatQuantity]": String(quantity.seats),
      "subscription_data[metadata][plan]": BUSINESS_PLAN_ID,
      "subscription_data[metadata][productType]": BUSINESS_PRODUCT_TYPE,
      "subscription_data[metadata][email]": email,
      "subscription_data[metadata][organisationName]": orgName,
      "subscription_data[metadata][seatQuantity]": String(quantity.seats),
    }),
    cache: "no-store",
  });

  if (!response.ok) return { ok: false, error: "stripe_unavailable" };
  const session = (await response.json()) as { url?: string };
  if (!session.url?.startsWith("https://checkout.stripe.com/")) {
    return { ok: false, error: "stripe_unavailable" };
  }
  return { ok: true, url: session.url };
}
