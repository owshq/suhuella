import { isPaidCheckoutPubliclyEnabled, type EnvLike } from "../paid-checkout.ts";
import { configuredPriceId, STRIPE_CATALOG } from "../stripe-catalog.ts";

export const BUSINESS_CHECKOUT_ENABLED_ENV = "BUSINESS_CHECKOUT_ENABLED";

/** Independent commercial gate for Business self-serve checkout. */
export function isBusinessCheckoutGateEnabled(env: EnvLike = process.env): boolean {
  return env[BUSINESS_CHECKOUT_ENABLED_ENV] === "true";
}

/** Public Business checkout requires its own gate plus personal paid checkout and catalog. */
export function isBusinessCheckoutPubliclyEnabled(env: EnvLike = process.env): boolean {
  if (!isBusinessCheckoutGateEnabled(env)) return false;
  if (!STRIPE_CATALOG.business.checkoutEnabled) return false;
  if (!isPaidCheckoutPubliclyEnabled(env)) return false;
  return Boolean(configuredPriceId("business"));
}
