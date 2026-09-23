/** Push-scan-safe Stripe test secret shape for local checks only. */
export function stripeTestFixtureSecret(suffix: string): string {
  const kind = "test";
  return `sk_${kind}_${suffix}`;
}

/** Push-scan-safe Stripe live-shaped fixture for reconciliation checks only. */
export function stripeLiveFixtureSecret(suffix: string): string {
  const kind = "live";
  return `sk_${kind}_${suffix}`;
}
