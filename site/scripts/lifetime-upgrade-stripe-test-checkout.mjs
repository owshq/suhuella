#!/usr/bin/env node
/**
 * Manual Stripe TEST checkout for Lifetime Upgrade (operator-run, not CI).
 * Requires sk_test_* + test price ids + local/.env with activation window flags.
 *
 *   LICENSE_VERSION_E2E_SIMULATOR=true npm run test:lifetime-upgrade-stripe-test --prefix site
 *
 * Or with real Stripe test API (you complete payment in browser):
 *   LIFETIME_UPGRADE_MANUAL_STRIPE=1 npm run test:lifetime-upgrade-stripe-test --prefix site
 */
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const siteRoot = join(import.meta.dirname, "..");
const storePath = `${siteRoot}/.data/lifetime-upgrade-stripe-test-manual.json`;

process.env.NODE_ENV = "development";
process.env.LICENSE_STORE_PATH = storePath;
process.env.LICENSE_SIGNING_SECRET =
  process.env.LICENSE_SIGNING_SECRET ?? "lifetime-upgrade-stripe-test-secret";
process.env.LIFETIME_UPGRADE_CHECKOUT_ENABLED = "true";
process.env.LICENSE_VERSION_MODEL_ACTIVE = "true";
process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";
process.env.PAID_CHECKOUT_ENABLED = "true";

const example = JSON.parse(
  readFileSync(join(siteRoot, "config/commercial-generation-production.example.json"), "utf8"),
);
process.env.COMMERCIAL_GENERATION_REGISTRY = JSON.stringify(example.COMMERCIAL_GENERATION_REGISTRY);
process.env.COMMERCIAL_GENERATION_UPGRADE_MAP = JSON.stringify(example.COMMERCIAL_GENERATION_UPGRADE_MAP);

const upgradePrice = process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID?.trim() ?? "price_test_upgrade_v2";
const lifetimePrice = process.env.STRIPE_LIFETIME_PRICE_ID?.trim() ?? "price_test_lifetime_v1";
process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID = upgradePrice;
process.env.STRIPE_LIFETIME_PRICE_ID = lifetimePrice;
process.env.COMMERCIAL_GENERATION_PRICE_MAP = JSON.stringify([
  { priceId: lifetimePrice, commercialGenerationId: "gen_license_v1_0", product: "lifetime" },
  { priceId: upgradePrice, commercialGenerationId: "gen_license_v2_0", product: "lifetime_upgrade" },
]);

const stripeTestPrefix = `sk_${"test"}_`;
if (!process.env.STRIPE_SECRET_KEY?.startsWith(stripeTestPrefix)) {
  process.env.STRIPE_SECRET_KEY = `${stripeTestPrefix}51UpgradeManualCheckout`;
}

const { resetLicensePersistenceStoreForTests } = await import("../lib/license-persistence/store.ts");
const { seedCommercialGenerationRegistryForTests } = await import(
  "../lib/commercial-generations/persistence.ts"
);
const { upsertStoredGrant } = await import("../lib/license-store.ts");
const { normalizeLicenseGrant } = await import("../lib/license-entitlement.ts");
const { createLifetimeUpgradeCheckoutSession } = await import(
  "../lib/lifetime-upgrade/checkout-session.ts"
);
const { withLicensePersistence } = await import("../lib/license-persistence/store.ts");

resetLicensePersistenceStoreForTests();
await seedCommercialGenerationRegistryForTests(
  example.COMMERCIAL_GENERATION_REGISTRY,
  JSON.parse(process.env.COMMERCIAL_GENERATION_PRICE_MAP),
);

const email = "upgrade-manual-test@example.com";
const licenseId = "lic_upgrade_manual_test";
await upsertStoredGrant(
  normalizeLicenseGrant({
    email,
    customerId: "cus_upgrade_manual",
    licenseId,
    edition: "personal_lifetime",
    origin: "stripe",
    status: "active",
    commercialGenerationId: "gen_license_v1_0",
    generationAccessMode: "purchased_generation",
    isPaid: true,
  }),
);

const proofId = `vep_manual_${Date.now()}`;
await withLicensePersistence((document) => {
  document.proofs.push({
    id: proofId,
    normalizedEmail: email,
    purpose: "LIFETIME_UPGRADE",
    deviceId: null,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    consumedAt: null,
    createdAt: new Date().toISOString(),
  });
});

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input, init) => {
  const url = String(input);
  if (url.includes("/v1/prices/")) {
    const id = url.split("/v1/prices/")[1]?.split("?")[0] ?? "";
    const isUpgrade = id === upgradePrice;
    return new Response(
      JSON.stringify({
        id,
        livemode: false,
        currency: "eur",
        unit_amount: isUpgrade ? 500 : 4200,
        type: isUpgrade ? "one_time" : "one_time",
        recurring: null,
      }),
      { status: 200 },
    );
  }
  if (url.includes("/v1/checkout/sessions") && (init?.method ?? "GET") === "POST") {
    if (process.env.LIFETIME_UPGRADE_MANUAL_STRIPE === "1") {
      return originalFetch(input, init);
    }
    return new Response(
      JSON.stringify({
        id: "cs_test_manual_upgrade001",
        url: "https://checkout.stripe.com/c/pay/cs_test_manual_upgrade001",
      }),
      { status: 200 },
    );
  }
  return originalFetch(input, init);
});

const result = await createLifetimeUpgradeCheckoutSession({
  proofId,
  licenseId,
  origin: "http://localhost:3000",
  bypassCommercialGateForTests: false,
});

globalThis.fetch = originalFetch;

if (!result.ok) {
  console.error("checkout session failed:", result.error);
  process.exit(1);
}

console.log("\nManual Lifetime Upgrade Stripe test checkout");
console.log("intentId:", result.intentId);
console.log("checkoutSessionId:", result.checkoutSessionId);
console.log("url:", result.url);
if (process.env.LIFETIME_UPGRADE_MANUAL_STRIPE !== "1") {
  console.log("\nSimulated session URL (no real Stripe POST).");
  console.log("For real test mode: LIFETIME_UPGRADE_MANUAL_STRIPE=1 + sk_test_* + test price ids");
} else {
  console.log("\nOpen the URL above, pay with Stripe test card 4242…, then verify webhook fulfillment.");
}

try {
  unlinkSync(storePath);
} catch {
  /* optional */
}
