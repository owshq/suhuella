import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readProductionCommercialConfig,
  validateProductionCommercialConfig,
} from "./commercial-generations/production-config.ts";
import { syncCommercialGenerationRegistryFromEnv } from "./commercial-generations/sync-registry-from-env.ts";
import { evaluateLifetimeUpgradeCheckout } from "./lifetime-upgrade-audit.ts";
import {
  isCommercialGenerationEnforcementEnvEnabled,
  isLifetimeUpgradeCheckoutEnvEnabled,
  isLicenseVersionModelActiveEnvEnabled,
  isPaidCheckoutPubliclyEnabled,
} from "./paid-checkout.ts";
import { configuredPriceId, lifetimeUpgradeSaleEnabled } from "./stripe-catalog.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

async function runLifetimeUpgradeProductionActivationCheck(): Promise<void> {
  const previous = { ...process.env };
  try {
    const example = JSON.parse(
      readFileSync(join(siteRoot, "config/commercial-generation-production.example.json"), "utf8"),
    ) as Record<string, unknown>;

    process.env.COMMERCIAL_GENERATION_REGISTRY = JSON.stringify(example.COMMERCIAL_GENERATION_REGISTRY);
    process.env.COMMERCIAL_GENERATION_PRICE_MAP = JSON.stringify([
      {
        priceId: "price_test_lifetime_v1",
        commercialGenerationId: "gen_license_v1_0",
        product: "lifetime",
      },
      {
        priceId: "price_test_upgrade_v2",
        commercialGenerationId: "gen_license_v2_0",
        product: "lifetime_upgrade",
      },
    ]);
    process.env.COMMERCIAL_GENERATION_UPGRADE_MAP = JSON.stringify(
      example.COMMERCIAL_GENERATION_UPGRADE_MAP,
    );
    process.env.STRIPE_LIFETIME_PRICE_ID = "price_test_lifetime_v1";
    process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID = "price_test_upgrade_v2";
    process.env.LICENSE_SIGNING_SECRET = "activation-check-secret";

    const config = readProductionCommercialConfig();
    assert(config !== null, "production config parses from env");
    assert(
      validateProductionCommercialConfig(
        config!,
        "price_test_upgrade_v2",
        "price_test_lifetime_v1",
      ).length === 0,
      "production config validates price mappings",
    );

    const synced = await syncCommercialGenerationRegistryFromEnv();
    assert(synced.ok && synced.generationCount === 2, "registry sync writes two generations");

    assert(lifetimeUpgradeSaleEnabled() === false, "upgrade sale off without window flag");
    assert(
      evaluateLifetimeUpgradeCheckout().allowed === false,
      "audit closed without full activation window",
    );

    process.env.LIFETIME_UPGRADE_CHECKOUT_ENABLED = "true";
    process.env.LICENSE_VERSION_MODEL_ACTIVE = "true";
    process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";
    process.env.PAID_CHECKOUT_ENABLED = "true";

    assert(isLifetimeUpgradeCheckoutEnvEnabled(), "upgrade env switch reads true");
    assert(isLicenseVersionModelActiveEnvEnabled(), "version model env switch reads true");
    assert(isCommercialGenerationEnforcementEnvEnabled(), "enforcement env switch reads true");
    assert(isPaidCheckoutPubliclyEnabled(), "paid checkout env on for window simulation");

    const open = evaluateLifetimeUpgradeCheckout();
    assert(open.allowed === true, "audit opens when full controlled window env is set");

    const wrangler = readFileSync(join(siteRoot, "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "wrangler default stays off");
    assert(!wrangler.includes('"LIFETIME_UPGRADE_CHECKOUT_ENABLED": "true"'), "upgrade not hard-open in wrangler");

    console.log("lifetime-upgrade-production-activation-check: PASS");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
}

runLifetimeUpgradeProductionActivationCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
