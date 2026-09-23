import { commercialGenerationEnforcementActive } from "./commercial-generations/enforcement.ts";
import {
  readProductionCommercialConfig,
  validateProductionCommercialConfig,
} from "./commercial-generations/production-config.ts";
import {
  isCommercialGenerationEnforcementEnvEnabled,
  isLicenseVersionModelActiveEnvEnabled,
} from "./paid-checkout.ts";
import { configuredPriceId, isLifetimeUpgradeCatalogEnabled, lifetimeUpgradeSaleEnabled } from "./stripe-catalog.ts";

/** Commercial blockers. All must clear before Upgrade checkout may open. */
export type LifetimeUpgradeBlockReason =
  | "sale_switch_off"
  | "catalog_disabled"
  | "price_not_configured"
  | "upgrade_map_missing"
  | "production_registry_missing"
  | "production_config_invalid"
  | "version_model_inactive"
  | "signing_material_missing"
  | "eligibility_enforcement_missing"
  | "desktop_enforcement_missing";

export type LifetimeUpgradeCheckoutDecision =
  | { allowed: true }
  | { allowed: false; reasons: LifetimeUpgradeBlockReason[] };

function signingMaterialConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(
    env.LICENSE_SIGNING_PRIVATE_KEY?.trim() || env.LICENSE_SIGNING_SECRET?.trim(),
  );
}

/**
 * Server gate for Lifetime Upgrade checkout.
 * A Stripe Price alone is not sufficient — generation path and enforcement must exist first.
 */
export function evaluateLifetimeUpgradeCheckout(
  env: Record<string, string | undefined> = process.env,
): LifetimeUpgradeCheckoutDecision {
  const reasons: LifetimeUpgradeBlockReason[] = [];

  if (lifetimeUpgradeSaleEnabled(env) !== true) reasons.push("sale_switch_off");
  if (!isLifetimeUpgradeCatalogEnabled(env)) reasons.push("catalog_disabled");
  if (!configuredPriceId("lifetime_upgrade")) reasons.push("price_not_configured");

  const production = readProductionCommercialConfig(env);
  if (!production) {
    reasons.push("production_registry_missing");
    reasons.push("upgrade_map_missing");
  } else {
    const configIssues = validateProductionCommercialConfig(
      production,
      configuredPriceId("lifetime_upgrade"),
      configuredPriceId("lifetime"),
    );
    if (configIssues.length > 0) reasons.push("production_config_invalid");
    if (production.upgradeMap.length === 0) reasons.push("upgrade_map_missing");
  }

  if (!isLicenseVersionModelActiveEnvEnabled(env)) reasons.push("version_model_inactive");
  if (!signingMaterialConfigured(env)) reasons.push("signing_material_missing");

  if (!commercialGenerationEnforcementActive() || !isCommercialGenerationEnforcementEnvEnabled(env)) {
    reasons.push("eligibility_enforcement_missing");
    reasons.push("desktop_enforcement_missing");
  }

  if (reasons.length > 0) return { allowed: false, reasons };
  return { allowed: true };
}

/** Explicit guard for session creation routes. Closed until commercial flags and enforcement open. */
export function lifetimeUpgradeCheckoutBlocked(): boolean {
  return evaluateLifetimeUpgradeCheckout().allowed === false;
}
