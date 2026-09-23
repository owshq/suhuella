import { brand } from "@suhuella/brand";

export type EnvLike = Record<string, string | undefined>;

export const PAID_CHECKOUT_ENABLED_ENV = "PAID_CHECKOUT_ENABLED";
export const PARTNER_CHECKOUT_ENABLED_ENV = "PARTNER_CHECKOUT_ENABLED";
export const LIFETIME_UPGRADE_CHECKOUT_ENABLED_ENV = "LIFETIME_UPGRADE_CHECKOUT_ENABLED";
export const COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED_ENV = "COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED";
export const LICENSE_VERSION_MODEL_ACTIVE_ENV = "LICENSE_VERSION_MODEL_ACTIVE";

/** Brand eligibility only. Not the production sales switch. */
export function brandAllowsPaidCheckout(): boolean {
  return brand.paidCheckoutEnabled === true;
}

/** Explicit commercial switch. Off unless the env value is exactly "true". */
export function isPaidCheckoutEnvEnabled(env: EnvLike = process.env): boolean {
  return env[PAID_CHECKOUT_ENABLED_ENV] === "true";
}

/**
 * Public paid checkout may run only when the brand allows it and the
 * production switch is on. Missing, empty, or any other value stays off.
 */
/**
 * Personal Lifetime/Monthly checkout runs only when this is true — on every origin
 * (suhuella.com, workers.dev, localhost). Stripe secrets present without this
 * switch do not open checkout (Gate C).
 */
export function isPaidCheckoutPubliclyEnabled(env: EnvLike = process.env): boolean {
  return brandAllowsPaidCheckout() && isPaidCheckoutEnvEnabled(env);
}

/** Partner annual checkout switch. Off unless exactly "true". Independent from personal plans. */
export function isPartnerCheckoutEnvEnabled(env: EnvLike = process.env): boolean {
  return env[PARTNER_CHECKOUT_ENABLED_ENV] === "true";
}

/** Lifetime Upgrade checkout. Off unless exactly "true". Independent from personal checkout. */
export function isLifetimeUpgradeCheckoutEnvEnabled(env: EnvLike = process.env): boolean {
  return env[LIFETIME_UPGRADE_CHECKOUT_ENABLED_ENV] === "true";
}

export function isCommercialGenerationEnforcementEnvEnabled(env: EnvLike = process.env): boolean {
  return env[COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED_ENV] === "true";
}

export function isLicenseVersionModelActiveEnvEnabled(env: EnvLike = process.env): boolean {
  return env[LICENSE_VERSION_MODEL_ACTIVE_ENV] === "true";
}

export function isLiveCommerceOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "suhuella.com" || host === "www.suhuella.com";
  } catch {
    return false;
  }
}

export function isStripeTestSecret(secret: string): boolean {
  return /^sk_test_[A-Za-z0-9]{16,}$/.test(secret.trim());
}

export function isStripeLiveSecret(secret: string): boolean {
  return /^sk_live_[A-Za-z0-9]{16,}$/.test(secret.trim());
}

export function isStripeTestSessionId(sessionId: string): boolean {
  return sessionId.startsWith("cs_test_");
}

export function isStripeLiveSessionId(sessionId: string): boolean {
  return sessionId.startsWith("cs_live_");
}

/** Live site cannot use test Stripe material. Local / preview may use test keys. */
export function stripeSecretAllowedForOrigin(secret: string, origin: string): boolean {
  const key = secret.trim();
  if (!key) return false;
  if (!isLiveCommerceOrigin(origin)) {
    return isStripeTestSecret(key) || isStripeLiveSecret(key);
  }
  return isStripeLiveSecret(key);
}

/** suhuella.com never accepts a test Checkout Session. Preview may use either. */
export function stripeSessionAllowedForOrigin(sessionId: string, origin: string): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  if (!isLiveCommerceOrigin(origin)) {
    return isStripeTestSessionId(id) || isStripeLiveSessionId(id);
  }
  return isStripeLiveSessionId(id);
}

/** Test secrets can only verify test sessions. Live secrets can only verify live sessions. */
export function stripeSessionMatchesSecret(sessionId: string, secret: string): boolean {
  const id = sessionId.trim();
  const key = secret.trim();
  if (isStripeTestSecret(key)) return isStripeTestSessionId(id);
  if (isStripeLiveSecret(key)) return isStripeLiveSessionId(id);
  return false;
}

/** Live secret accepts only livemode=true events. Test secret accepts only livemode=false.
 * Receives STRIPE_SECRET_KEY (not the webhook signing secret).
 */
export function stripeWebhookLivemodeAllowed(
  event: { livemode?: boolean },
  secretKey: string,
): boolean {
  const key = secretKey.trim();
  if (!key) return false;
  if (typeof event.livemode !== "boolean") return false;
  if (isStripeLiveSecret(key)) return event.livemode === true;
  if (isStripeTestSecret(key)) return event.livemode === false;
  return false;
}
