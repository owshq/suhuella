import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commercialGenerationEnforcementActive,
  findCheckoutGenerationBinding,
  listLicenseAcquisitions,
  recordCheckoutGenerationBinding,
  seedCommercialGenerationRegistryForTests,
} from "./commercial-generations/index.ts";
import {
  FIXTURE_COMMERCIAL_GENERATION,
  FIXTURE_COMMERCIAL_GENERATION_B,
} from "./commercial-generations/types.ts";
import { fulfillLicenseFromCheckout } from "./license-fulfillment.ts";
import {
  readLicensePersistence,
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
} from "./license-persistence/store.ts";
import { parseLicenseGrant } from "./license-entitlement.ts";
import { readSignedLicenseToken as readTokenFromContext } from "./license-context.ts";
import { activateFromVerifiedCheckout, checkLicense } from "./license-service.ts";
import { findGrantByEmail, findGrantByLicenseId, upsertStoredGrant } from "./license-store.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

async function runCommercialGenerationsFoundationCheck(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_PRIVATE_KEY: process.env.LICENSE_SIGNING_PRIVATE_KEY,
    LICENSE_SIGNING_PUBLIC_KEYS: process.env.LICENSE_SIGNING_PUBLIC_KEYS,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    STRIPE_LIFETIME_PRICE_ID: process.env.STRIPE_LIFETIME_PRICE_ID,
    COMMERCIAL_GENERATION_PRICE_MAP: process.env.COMMERCIAL_GENERATION_PRICE_MAP,
    COMMERCIAL_GENERATION_CHECKOUT_ID: process.env.COMMERCIAL_GENERATION_CHECKOUT_ID,
    COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED: process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED,
    LICENSE_VERSION_MODEL_ACTIVE: process.env.LICENSE_VERSION_MODEL_ACTIVE,
  };
  const storePath = `${siteRoot}/.data/commercial-generations-foundation-check.json`;

  try {
    process.env.NODE_ENV = "development";
    applyTestLicenseSigningEnv(keypair);
    process.env.LICENSE_STORE_PATH = storePath;
    process.env.STRIPE_LIFETIME_PRICE_ID = "price_test_lifetime_gen";
    delete process.env.COMMERCIAL_GENERATION_CHECKOUT_ID;
    delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    delete process.env.LICENSE_VERSION_MODEL_ACTIVE;
    resetLicensePersistenceStoreForTests();

    const migration = readFileSync(join(siteRoot, "migrations/0011_commercial_generations.sql"), "utf8");
    assert(migration.includes("CREATE TABLE IF NOT EXISTS commercial_generation"), "0011 creates registry");
    assert(migration.includes("checkout_generation_binding"), "0011 binds checkout sessions");
    assert(migration.includes("license_acquisition"), "0011 records acquisition history");
    assert(!migration.includes("UPDATE license_grant"), "0011 does not retroactively assign generations");

    assert(commercialGenerationEnforcementActive() === false, "enforcement stays off by default");

    await seedCommercialGenerationRegistryForTests(
      [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      [
        {
          priceId: "price_test_lifetime_gen",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
          product: "lifetime",
        },
      ],
    );

    await recordCheckoutGenerationBinding({
      checkoutSessionId: "cs_test_gen_bound_lifetime",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      priceId: "price_test_lifetime_gen",
      plan: "lifetime",
    });

    const fulfilled = await fulfillLicenseFromCheckout({
      sessionId: "cs_test_gen_bound_lifetime",
      email: "gen-bound@example.com",
      customerId: "cus_gen_bound",
      mode: "payment",
      edition: "personal_lifetime",
      priceId: "price_test_lifetime_gen",
    });
    assert(fulfilled?.edition === "personal_lifetime", "bound checkout fulfills lifetime");
    const boundGrant = await findGrantByEmail("gen-bound@example.com");
    assert(
      boundGrant?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id,
      "lifetime grant stores server-bound generation",
    );
    assert(boundGrant?.generationAccessMode === "purchased_generation", "lifetime access mode is purchased_generation");
    const acquisitions = await listLicenseAcquisitions(boundGrant?.licenseId ?? "");
    assert(acquisitions.length === 1, "initial purchase recorded once");
    assert(
      acquisitions[0]?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id,
      "acquisition stores bound generation",
    );

    await seedCommercialGenerationRegistryForTests(
      [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      [
        {
          priceId: "price_test_lifetime_gen",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          product: "lifetime",
        },
      ],
    );
    const delayed = await fulfillLicenseFromCheckout(
      {
        sessionId: "cs_test_gen_bound_lifetime",
        email: "gen-bound@example.com",
        customerId: "cus_gen_bound",
        mode: "payment",
        edition: "personal_lifetime",
        priceId: "price_test_lifetime_gen",
      },
      { stripeEventId: "evt_delayed_after_registry_change" },
    );
    assert(delayed !== null, "delayed webhook still fulfills");
    const afterDelay = await findGrantByEmail("gen-bound@example.com");
    assert(
      afterDelay?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id,
      "delayed webhook keeps checkout-bound generation",
    );
    const acquisitionAfterDelay = await listLicenseAcquisitions(afterDelay?.licenseId ?? "");
    assert(acquisitionAfterDelay.length === 1, "delayed retry does not duplicate initial_purchase row");

    const duplicate = await fulfillLicenseFromCheckout(
      {
        sessionId: "cs_test_gen_bound_lifetime",
        email: "gen-bound@example.com",
        customerId: "cus_gen_bound",
        mode: "payment",
      },
      { stripeEventId: "evt_delayed_after_registry_change" },
    );
    assert(duplicate !== null, "duplicate stripe event still succeeds");
    assert(
      (await listLicenseAcquisitions(afterDelay?.licenseId ?? "")).length === 1,
      "duplicate stripe event does not duplicate acquisition",
    );

    const manipulated = await fulfillLicenseFromCheckout({
      sessionId: "cs_test_no_binding_metadata_only",
      email: "metadata-only@example.com",
      customerId: "cus_metadata",
      mode: "payment",
      edition: "personal_lifetime",
      priceId: "price_test_lifetime_gen",
    });
    assert(manipulated !== null, "checkout without binding still fulfills");
    const metadataGrant = await findGrantByEmail("metadata-only@example.com");
    assert(metadataGrant?.commercialGenerationId == null, "metadata alone does not assign generation");
    assert(
      metadataGrant?.generationAccessMode === "legacy_unassigned",
      "missing binding stays legacy_unassigned",
    );

    process.env.LICENSE_VERSION_MODEL_ACTIVE = "true";
    const postModel = await fulfillLicenseFromCheckout({
      sessionId: "cs_test_post_model_no_binding",
      email: "post-model@example.com",
      customerId: "cus_post_model",
      mode: "payment",
      edition: "personal_lifetime",
      priceId: "price_test_lifetime_gen",
    });
    assert(postModel === null, "post-model checkout without binding does not grant");
    const postModelGrant = await findGrantByEmail("post-model@example.com");
    assert(!postModelGrant, "post-model incomplete checkout leaves no grant");
    const { findCheckoutReconciliationPending } = await import("./commercial-generations/persistence.ts");
    const pending = await findCheckoutReconciliationPending("cs_test_post_model_no_binding");
    assert(pending?.status === "open", "post-model paid-without-binding persists reconciliation incident");
    delete process.env.LICENSE_VERSION_MODEL_ACTIVE;

    await upsertStoredGrant({
      email: "legacy@example.com",
      customerId: "cust_legacy",
      licenseId: "lic_legacy_no_gen",
      edition: "personal_lifetime",
      origin: "stripe",
      status: "active",
      isPaid: true,
    });
    const legacyActivated = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_test_legacy_replay",
        email: "legacy@example.com",
        customerId: "cust_legacy",
        mode: "payment",
      },
      { deviceId: "dev_legacy", deviceName: "Desk" },
    );
    assert(legacyActivated.ok === true, "legacy grant without generation still activates");
    const legacyToken = legacyActivated.ok ? legacyActivated.session?.context.licenseToken ?? "" : "";
    assert(
      legacyActivated.ok && legacyActivated.session?.context.commercialGenerationId === undefined,
      "legacy signed context omits generation fields",
    );
    resetLicensePersistenceStoreForTests();
    const legacyCheck = await checkLicense({ deviceId: "dev_legacy", licenseToken: legacyToken });
    assert(legacyCheck.ok === true, "legacy token verifies after restart");

    const monthlySession = {
      sessionId: "cs_test_monthly_gen",
      email: "monthly-expired@example.com",
      customerId: "cus_monthly_exp",
      mode: "subscription" as const,
      edition: "personal_monthly",
      currentPeriodEnd: "2020-01-01T00:00:00.000Z",
    };
    await recordCheckoutGenerationBinding({
      checkoutSessionId: monthlySession.sessionId,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      priceId: "price_test_monthly_gen",
      plan: "monthly",
    });
    await fulfillLicenseFromCheckout(monthlySession);
    const monthlyGrant = await findGrantByEmail("monthly-expired@example.com");
    assert(monthlyGrant?.edition === "personal_monthly", "monthly grant created");
    assert(monthlyGrant?.commercialGenerationId == null, "monthly grant does not pin purchased generation id");
    assert(
      monthlyGrant?.generationAccessMode === "active_subscription",
      "bound monthly uses active_subscription mode",
    );
    await upsertStoredGrant({
      ...monthlyGrant!,
      status: "expired",
      validUntil: "2020-01-01T00:00:00.000Z",
    });
    const monthlyActivated = await activateFromVerifiedCheckout(monthlySession, {
      deviceId: "dev_monthly_exp",
      deviceName: "Desk",
    });
    assert(monthlyActivated.ok === false && monthlyActivated.error === "expired", "expired monthly fails closed");

    const lifetimeActive = await upsertStoredGrant({
      email: "lifetime-active@example.com",
      customerId: "cust_lifetime_active",
      licenseId: "lic_lifetime_active",
      edition: "personal_lifetime",
      origin: "stripe",
      status: "active",
      isPaid: true,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
    });
    const lifetimeActivated = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_test_lifetime_active",
        email: lifetimeActive.email,
        customerId: lifetimeActive.customerId,
        mode: "payment",
      },
      { deviceId: "dev_lifetime_active", deviceName: "Desk" },
    );
    assert(lifetimeActivated.ok === true, "lifetime with generation still activates while active");

    const legacyPayload = {
      email: "compat@example.com",
      customerId: "cust_compat",
      licenseId: "lic_compat",
      edition: "personal_lifetime",
      origin: "gift",
      status: "active",
    };
    const parsedLegacy = parseLicenseGrant(legacyPayload);
    assert(parsedLegacy?.commercialGenerationId === undefined, "legacy grant parse keeps generation unset");
    assert(parsedLegacy?.generationAccessMode === undefined, "legacy grant parse keeps access mode unset");

    const oldStyleToken = await (async () => {
      const { buildSignedLicenseContext } = await import("./license-context.ts");
      const context = await buildSignedLicenseContext(
        {
          licenseId: "lic_old_token",
          customerId: "cust_old",
          email: "oldtoken@example.com",
          edition: "personal_lifetime",
          status: "active",
          deviceLimit: 1,
          activatedDevices: 0,
          validUntil: null,
          lastCheckedAt: new Date().toISOString(),
          offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
          channel: "stable",
        },
      );
      return context.licenseToken;
    })();
    const readLegacy = await readTokenFromContext(oldStyleToken);
    assert(readLegacy?.licenseId === "lic_old_token", "previous signed tokens remain readable");
    assert(readLegacy?.commercialGenerationId === undefined, "previous tokens omit generation fields");

    resetLicensePersistenceStoreForTests();
    await seedCommercialGenerationRegistryForTests([FIXTURE_COMMERCIAL_GENERATION], [
      {
        priceId: "price_test_lifetime_gen",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        product: "lifetime",
      },
    ]);
    await recordCheckoutGenerationBinding({
      checkoutSessionId: "cs_test_file_reopen",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      priceId: "price_test_lifetime_gen",
      plan: "lifetime",
    });
    const beforeRestart = await readLicensePersistence();
    assert(
      beforeRestart.checkoutGenerationBindings?.some(
        (row) => row.checkoutSessionId === "cs_test_file_reopen",
      ),
      "file store persists checkout binding",
    );
    resetLicensePersistenceStoreForTests();
    const afterRestart = await readLicensePersistence();
    assert(
      afterRestart.checkoutGenerationBindings?.some(
        (row) => row.checkoutSessionId === "cs_test_file_reopen",
      ),
      "file store survives isolate restart",
    );

    process.env.COMMERCIAL_GENERATION_PRICE_MAP = JSON.stringify([
      {
        priceId: "price_d1_lifetime_fixture",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        product: "lifetime",
      },
    ]);
    const { db, adapter } = openFreshLocalD1Adapter(siteRoot);
    setLicensePersistenceDatabaseForTests(adapter);
    await seedCommercialGenerationRegistryForTests([FIXTURE_COMMERCIAL_GENERATION], [
      {
        priceId: "price_d1_lifetime_fixture",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        product: "lifetime",
      },
    ]);
    await recordCheckoutGenerationBinding({
      checkoutSessionId: "cs_test_d1_reopen",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      priceId: "price_d1_lifetime_fixture",
      plan: "lifetime",
    });
    const d1Before = await findCheckoutGenerationBinding("cs_test_d1_reopen");
    assert(d1Before?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id, "local D1 writes binding");
    db.close();
    resetLicensePersistenceStoreForTests();
    const { adapter: adapterB } = openFreshLocalD1Adapter(siteRoot);
    setLicensePersistenceDatabaseForTests(adapterB);
    const d1After = await findCheckoutGenerationBinding("cs_test_d1_reopen");
    assert(d1After?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id, "local D1 survives reopen");

    const wrangler = readFileSync(join(siteRoot, "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "remote personal checkout stays off");
    assert(
      !wrangler.includes("COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED"),
      "remote enforcement flag not deployed",
    );
  } finally {
    resetLicensePersistenceStoreForTests();
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.LICENSE_SIGNING_PRIVATE_KEY === undefined) delete process.env.LICENSE_SIGNING_PRIVATE_KEY;
    else process.env.LICENSE_SIGNING_PRIVATE_KEY = previous.LICENSE_SIGNING_PRIVATE_KEY;
    if (previous.LICENSE_SIGNING_PUBLIC_KEYS === undefined) delete process.env.LICENSE_SIGNING_PUBLIC_KEYS;
    else process.env.LICENSE_SIGNING_PUBLIC_KEYS = previous.LICENSE_SIGNING_PUBLIC_KEYS;
    if (previous.LICENSE_SIGNING_SECRET === undefined) delete process.env.LICENSE_SIGNING_SECRET;
    else process.env.LICENSE_SIGNING_SECRET = previous.LICENSE_SIGNING_SECRET;
    if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
    if (previous.STRIPE_LIFETIME_PRICE_ID === undefined) delete process.env.STRIPE_LIFETIME_PRICE_ID;
    else process.env.STRIPE_LIFETIME_PRICE_ID = previous.STRIPE_LIFETIME_PRICE_ID;
    if (previous.COMMERCIAL_GENERATION_PRICE_MAP === undefined) {
      delete process.env.COMMERCIAL_GENERATION_PRICE_MAP;
    } else process.env.COMMERCIAL_GENERATION_PRICE_MAP = previous.COMMERCIAL_GENERATION_PRICE_MAP;
    if (previous.COMMERCIAL_GENERATION_CHECKOUT_ID === undefined) {
      delete process.env.COMMERCIAL_GENERATION_CHECKOUT_ID;
    } else process.env.COMMERCIAL_GENERATION_CHECKOUT_ID = previous.COMMERCIAL_GENERATION_CHECKOUT_ID;
    if (previous.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED === undefined) {
      delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    } else {
      process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED =
        previous.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    }
    if (previous.LICENSE_VERSION_MODEL_ACTIVE === undefined) {
      delete process.env.LICENSE_VERSION_MODEL_ACTIVE;
    } else {
      process.env.LICENSE_VERSION_MODEL_ACTIVE = previous.LICENSE_VERSION_MODEL_ACTIVE;
    }
    try {
      unlinkSync(storePath);
    } catch {
      // disposable fixture
    }
  }

  console.log("COMMERCIAL-GENERATIONS-FOUNDATION-002 check passed");
}

void runCommercialGenerationsFoundationCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
