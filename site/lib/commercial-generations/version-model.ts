/**
 * When true, new fulfillments without a checkout version binding are not treated as legacy.
 * Requires `LICENSE_VERSION_MODEL_ACTIVE=true` — operator-controlled cutover, not inferred from registry.
 */
export function isLicenseVersionModelActive(): boolean {
  return process.env.LICENSE_VERSION_MODEL_ACTIVE === "true";
}
