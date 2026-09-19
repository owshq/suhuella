import { brand } from "@suhuella/brand";

export type EnvLike = Record<string, string | undefined>;

export const PAID_CHECKOUT_ENABLED_ENV = "PAID_CHECKOUT_ENABLED";

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
export function isPaidCheckoutPubliclyEnabled(env: EnvLike = process.env): boolean {
  return brandAllowsPaidCheckout() && isPaidCheckoutEnvEnabled(env);
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
  return secret.startsWith("sk_test_");
}

export function isStripeLiveSecret(secret: string): boolean {
  return secret.startsWith("sk_live_");
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
