/**
 * LICENSE-VERSION-CONTRACT-CLOSURE-005
 */
import { readFileSync } from "node:fs";
import { stripeTestFixtureSecret } from "./test/stripe-fixture-secret.ts";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  effectiveCapabilitiesForLicense,
  validateGrantConfiguration,
} from "@suhuella/product/lib/generation-rights.ts";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import { classifyGrantVersionFromBinding } from "./commercial-generations/grant-classification.ts";
import {
  resolvePersonalCheckoutVersionBinding,
  validatePersonalCheckoutBeforeStripe,
} from "./commercial-generations/checkout-version-binding.ts";
import { createStripeCheckoutSession } from "./checkout-session.ts";
import {
  acquiredCommercialGenerationIdsFromHistory,
  findCheckoutReconciliationPending,
  listLicenseAcquisitions,
  recordCheckoutGenerationBinding,
  recordLicenseAcquisition,
  seedCommercialGenerationRegistryForTests,
} from "./commercial-generations/persistence.ts";
import { FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B } from "./commercial-generations/types.ts";
import { fulfillLicenseFromCheckout } from "./license-fulfillment.ts";
import {
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import { findGrantByEmail } from "./license-store.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const registry = [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B];
const organiseCap = organisationPlanCapability();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runLicenseVersionContractClosureCheck(): Promise<void> {
  const previous = {
    LICENSE_VERSION_MODEL_ACTIVE: process.env.LICENSE_VERSION_MODEL_ACTIVE,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_LIFETIME_PRICE_ID: process.env.STRIPE_LIFETIME_PRICE_ID,
    COMMERCIAL_GENERATION_PRICE_MAP: process.env.COMMERCIAL_GENERATION_PRICE_MAP,
    COMMERCIAL_GENERATION_CHECKOUT_ID: process.env.COMMERCIAL_GENERATION_CHECKOUT_ID,
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
  };
  let d1Handle: ReturnType<typeof openFreshLocalD1Adapter> | null = null;

  try {
    const migration = readFileSync(join(siteRoot, "migrations/0012_license_version_contract.sql"), "utf8");
    assert(migration.includes("version_model_active_at_bind"), "0012 adds binding evidence column");
    assert(migration.includes("checkout_reconciliation_pending"), "0012 adds reconciliation incidents");

    resetLicensePersistenceStoreForTests();
    d1Handle = openFreshLocalD1Adapter(siteRoot);
    setLicensePersistenceDatabaseForTests(d1Handle.adapter);
    await withLicensePersistence((document) => {
      document.commercialGenerations = [];
      document.commercialGenerationPrices = [];
      document.checkoutGenerationBindings = [];
      document.checkoutReconciliationPending = [];
      document.licenseAcquisitions = [];
    });

    const legacyBinding = {
      checkoutSessionId: "cs_legacy_pre_model",
      commercialGenerationId: null,
      priceId: "price_test_lifetime_gen",
      plan: "lifetime",
      boundAt: "2020-01-01T00:00:00.000Z",
      versionModelActiveAtBind: false,
    };
    const legacyCapsBefore = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      generationAccessMode: "legacy_unassigned",
      registry,
      enforcementActive: true,
    });
    const legacyCapsAfter = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      generationAccessMode: "legacy_unassigned",
      registry: [FIXTURE_COMMERCIAL_GENERATION_B, FIXTURE_COMMERCIAL_GENERATION],
      enforcementActive: true,
    });
    assert(legacyCapsBefore.includes(organiseCap), "recognized legacy keeps edition capabilities");
    assert(
      legacyCapsAfter.includes(organiseCap) && legacyCapsBefore.length === legacyCapsAfter.length,
      "registry reorder does not change legacy rights",
    );

    const recognized = classifyGrantVersionFromBinding({
      edition: "personal_lifetime",
      existing: undefined,
      boundGenerationId: null,
      binding: legacyBinding,
    });
    assert(recognized.kind === "recognized_pre_model_legacy", "pre-model binding evidence recognized");

    const incomplete = classifyGrantVersionFromBinding({
      edition: "personal_lifetime",
      existing: undefined,
      boundGenerationId: null,
      binding: {
        ...legacyBinding,
        checkoutSessionId: "cs_post_model_bad",
        versionModelActiveAtBind: true,
      },
    });
    assert(incomplete.kind === "post_model_incomplete", "post-model binding without version is incomplete");

    process.env.LICENSE_VERSION_MODEL_ACTIVE = "true";
    process.env.STRIPE_SECRET_KEY = stripeTestFixtureSecret("licenseversionclosure001");
    process.env.STRIPE_LIFETIME_PRICE_ID = "price_test_lifetime_gen";
    process.env.PAID_CHECKOUT_ENABLED = "true";
    process.env.COMMERCIAL_GENERATION_PRICE_MAP = "";
    delete process.env.COMMERCIAL_GENERATION_CHECKOUT_ID;

    let fetchCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("api.stripe.com/v1/checkout/sessions")) {
        fetchCount += 1;
        return new Response(JSON.stringify({ url: "https://checkout.stripe.com/test" }), { status: 200 });
      }
      if (url.includes("api.stripe.com/v1/prices/")) {
        return new Response(
          JSON.stringify({
            id: "price_test_lifetime_gen",
            unit_amount: 10000,
            currency: "eur",
            type: "one_time",
            livemode: false,
          }),
          { status: 200 },
        );
      }
      return originalFetch(input, init);
    };

    const blockedUrl = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "http://localhost:3000",
      returnTo: "public",
    });
    assert(blockedUrl === "", "model active without resolvable version blocks checkout before stripe");
    assert(fetchCount === 0, "zero stripe session creates when version binding fails");

    await seedCommercialGenerationRegistryForTests(registry, [
      {
        priceId: "price_test_lifetime_gen",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        product: "lifetime",
      },
    ]);

    const resolved = await validatePersonalCheckoutBeforeStripe({
      plan: "lifetime",
      priceId: "price_test_lifetime_gen",
    });
    assert(resolved.ok, "version resolves when registry and price map configured");

    fetchCount = 0;
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("api.stripe.com/v1/checkout/sessions")) {
        fetchCount += 1;
        return new Response(
          JSON.stringify({ id: "cs_bound_ok", url: "https://checkout.stripe.com/bound" }),
          { status: 200 },
        );
      }
      if (url.includes("api.stripe.com/v1/prices/")) {
        return new Response(
          JSON.stringify({
            id: "price_test_lifetime_gen",
            unit_amount: 10000,
            currency: "eur",
            type: "one_time",
            livemode: false,
          }),
          { status: 200 },
        );
      }
      return originalFetch(input, init);
    };

    const allowedUrl = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "http://localhost:3000",
      returnTo: "public",
    });
    assert(allowedUrl.startsWith("https://checkout.stripe.com/"), "checkout opens when version binding resolves");
    assert(fetchCount === 1, "stripe called once when binding valid");

    globalThis.fetch = originalFetch;

    await recordCheckoutGenerationBinding({
      checkoutSessionId: "cs_paid_no_version",
      commercialGenerationId: null,
      priceId: "price_test_lifetime_gen",
      plan: "lifetime",
      versionModelActiveAtBind: true,
    });
    const deferred = await fulfillLicenseFromCheckout(
      {
        sessionId: "cs_paid_no_version",
        email: "paid-no-version@example.com",
        customerId: "cus_paid_no_version",
        mode: "payment",
        edition: "personal_lifetime",
        priceId: "price_test_lifetime_gen",
      },
      { stripeEventId: "evt_paid_no_version" },
    );
    assert(deferred === null, "paid session without version does not grant");
    const pending = await findCheckoutReconciliationPending("cs_paid_no_version");
    assert(pending?.status === "open" && pending.reason === "version_unresolved", "payment persists open incident");

    await recordLicenseAcquisition({
      licenseId: "lic_cumulative",
      email: "cumulative@example.com",
      kind: "initial_purchase",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      checkoutSessionId: "cs_initial",
      edition: "personal_lifetime",
    });
    await recordLicenseAcquisition({
      licenseId: "lic_cumulative",
      email: "cumulative@example.com",
      kind: "upgrade",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
      checkoutSessionId: "cs_upgrade_pinned",
      edition: "personal_lifetime",
    });
    const acquisitions = await listLicenseAcquisitions("lic_cumulative");
    const cumulative = acquiredCommercialGenerationIdsFromHistory(acquisitions);
    assert(
      cumulative.includes(FIXTURE_COMMERCIAL_GENERATION.id) &&
        cumulative.includes(FIXTURE_COMMERCIAL_GENERATION_B.id),
      "upgrade appends without replacing original acquisition",
    );

    const registryWithUpgradeCap = [
      FIXTURE_COMMERCIAL_GENERATION,
      {
        ...FIXTURE_COMMERCIAL_GENERATION_B,
        requiredCapabilities: ["apply_bulk_organisation", "create_folder"],
      },
    ];
    const rights = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      acquiredCommercialGenerationIds: cumulative,
      generationAccessMode: "purchased_generation",
      registry: registryWithUpgradeCap,
      enforcementActive: true,
    });
    assert(rights.includes("create_folder"), "cumulative versions union capabilities within edition");

    await recordLicenseAcquisition({
      licenseId: "lic_cumulative",
      email: "cumulative@example.com",
      kind: "upgrade",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
      checkoutSessionId: "cs_upgrade_pinned",
      edition: "personal_lifetime",
    });
    assert(
      (await listLicenseAcquisitions("lic_cumulative")).length === 2,
      "duplicate upgrade acquisition is idempotent",
    );

    assert(
      validateGrantConfiguration({
        edition: "personal_lifetime",
        generationAccessMode: "purchased_generation",
        commercialGenerationId: null,
        validUntil: null,
        offlineUntil: null,
      }) === "grant_configuration_invalid",
      "incomplete purchased grant rejected",
    );

    const wrangler = readFileSync(join(siteRoot, "wrangler.jsonc"), "utf8");
    assert(!wrangler.includes('"COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED": "true"'), "enforcement flag unchanged");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "commercial checkout flag unchanged");
  } finally {
    globalThis.fetch = fetch;
    resetLicensePersistenceStoreForTests();
    setLicensePersistenceDatabaseForTests(null);
    d1Handle?.db.close();
    if (previous.COMMERCIAL_GENERATION_CHECKOUT_ID === undefined) {
      delete process.env.COMMERCIAL_GENERATION_CHECKOUT_ID;
    } else process.env.COMMERCIAL_GENERATION_CHECKOUT_ID = previous.COMMERCIAL_GENERATION_CHECKOUT_ID;
    if (previous.LICENSE_VERSION_MODEL_ACTIVE === undefined) delete process.env.LICENSE_VERSION_MODEL_ACTIVE;
    else process.env.LICENSE_VERSION_MODEL_ACTIVE = previous.LICENSE_VERSION_MODEL_ACTIVE;
    if (previous.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.STRIPE_SECRET_KEY;
    if (previous.STRIPE_LIFETIME_PRICE_ID === undefined) delete process.env.STRIPE_LIFETIME_PRICE_ID;
    else process.env.STRIPE_LIFETIME_PRICE_ID = previous.STRIPE_LIFETIME_PRICE_ID;
    if (previous.COMMERCIAL_GENERATION_PRICE_MAP === undefined) {
      delete process.env.COMMERCIAL_GENERATION_PRICE_MAP;
    } else process.env.COMMERCIAL_GENERATION_PRICE_MAP = previous.COMMERCIAL_GENERATION_PRICE_MAP;
    if (previous.PAID_CHECKOUT_ENABLED === undefined) delete process.env.PAID_CHECKOUT_ENABLED;
    else process.env.PAID_CHECKOUT_ENABLED = previous.PAID_CHECKOUT_ENABLED;
  }

  console.log("LICENSE-VERSION-CONTRACT-CLOSURE-005 check passed");
}

void runLicenseVersionContractClosureCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
