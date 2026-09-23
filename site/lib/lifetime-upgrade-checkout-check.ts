import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIXTURE_COMMERCIAL_GENERATION,
  FIXTURE_COMMERCIAL_GENERATION_B,
} from "./commercial-generations/types.ts";
import { seedCommercialGenerationRegistryForTests } from "./commercial-generations/persistence.ts";
import {
  evaluateLifetimeUpgradeCheckout,
  lifetimeUpgradeCheckoutBlocked,
} from "./lifetime-upgrade-audit.ts";
import {
  createLifetimeUpgradeCheckoutSession,
  evaluateLifetimeUpgradeEligibility,
  findLifetimeUpgradeIntentBySessionId,
  fulfillLifetimeUpgradeFromCheckout,
} from "./lifetime-upgrade/index.ts";
import { normalizeLicenseGrant } from "./license-entitlement.ts";
import {
  readLicensePersistence,
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import { listLicenseAcquisitions } from "./commercial-generations/persistence.ts";
import { buildSignedLicenseContext } from "./license-context.ts";
import { checkLicense } from "./license-service.ts";
import {
  applyLifetimeUpgradeStripeWebhook,
  isLifetimeUpgradeCheckoutEvent,
} from "./lifetime-upgrade-webhook.ts";
import { isPersonalCheckoutEvent } from "./personal-checkout-webhook.ts";
import { findGrantByEmail, findGrantByLicenseId, upsertStoredGrant } from "./license-store.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";
import { STRIPE_CATALOG, lifetimeUpgradeSaleEnabled } from "./stripe-catalog.ts";
import { isPaidCheckoutPubliclyEnabled } from "./paid-checkout.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function upgradePrice() {
  return {
    id: "price_test_upgrade",
    livemode: false,
    currency: "eur",
    unit_amount: 500,
    type: "one_time",
    recurring: null,
  };
}

function paidUpgradeSession(id: string, email: string, intentId: string, licenseId: string) {
  return {
    id,
    payment_status: "paid",
    status: "complete",
    mode: "payment",
    customer: "cus_upgrade",
    customer_details: { email },
    metadata: {
      plan: "lifetime_upgrade",
      productType: "lifetime_upgrade",
      edition: "personal_lifetime",
      intentId,
      licenseId,
      sourceGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      targetGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
    },
    line_items: { data: [{ quantity: 1, price: { id: "price_test_upgrade" } }] },
  };
}

async function seedEligibleLifetimeGrant(email: string, licenseId: string): Promise<void> {
  await upsertStoredGrant(
    normalizeLicenseGrant({
      email,
      customerId: "cus_eligible_lifetime",
      licenseId,
      edition: "personal_lifetime",
      origin: "stripe",
      status: "active",
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
      isPaid: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    }),
  );
}

async function seedVerifiedProof(email: string): Promise<string> {
  const proofId = `vep_upgrade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await withLicensePersistence((document) => {
    document.proofs.push({
      id: proofId,
      normalizedEmail: email,
      purpose: "LIFETIME_UPGRADE",
      deviceId: null,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      consumedAt: null,
      createdAt: new Date().toISOString(),
    });
  });
  return proofId;
}

async function runLifetimeUpgradeCheckoutCheck(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_PRIVATE_KEY: process.env.LICENSE_SIGNING_PRIVATE_KEY,
    LICENSE_SIGNING_PUBLIC_KEYS: process.env.LICENSE_SIGNING_PUBLIC_KEYS,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_LIFETIME_UPGRADE_PRICE_ID: process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID,
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
    COMMERCIAL_GENERATION_UPGRADE_MAP: process.env.COMMERCIAL_GENERATION_UPGRADE_MAP,
    COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED: process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED,
  };
  const storePath = `${siteRoot}/.data/lifetime-upgrade-checkout-check.json`;
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  try {
    process.env.NODE_ENV = "development";
    applyTestLicenseSigningEnv(keypair);
    process.env.LICENSE_STORE_PATH = storePath;
    const { stripeTestFixtureSecret } = await import("./test/stripe-fixture-secret.ts");
    process.env.STRIPE_SECRET_KEY = stripeTestFixtureSecret("UpgradeCheckout004");
    process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID = "price_test_upgrade";
    process.env.PAID_CHECKOUT_ENABLED = "false";
    delete process.env.COMMERCIAL_GENERATION_UPGRADE_MAP;
    delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    resetLicensePersistenceStoreForTests();

    const migration = readFileSync(join(siteRoot, "migrations/0012_lifetime_upgrade_intent.sql"), "utf8");
    assert(migration.includes("lifetime_upgrade_intent"), "0012 creates upgrade intent table");
    assert(!migration.includes("UPDATE license_grant"), "0012 does not mutate grants");

    assert(lifetimeUpgradeSaleEnabled() === false, "upgrade sale switch stays off");
    assert(STRIPE_CATALOG.lifetime_upgrade.checkoutEnabled === false, "upgrade catalog stays off");
    assert(lifetimeUpgradeCheckoutBlocked() === true, "upgrade guard closed");
    assert(isPaidCheckoutPubliclyEnabled() === false, "paid checkout flag off");

    const closedDecision = evaluateLifetimeUpgradeCheckout();
    assert(!closedDecision.allowed, "upgrade audit closed by default");
    assert(closedDecision.reasons.includes("sale_switch_off"), "sale switch blocks upgrade");
    assert(closedDecision.reasons.includes("catalog_disabled"), "catalog blocks upgrade");

    fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      throw new Error("stripe must not be called while closed");
    }) as typeof fetch;

    const closedCheckout = await createLifetimeUpgradeCheckoutSession({
      proofId: "ignored",
      licenseId: "lic_any",
      origin: "http://localhost:3000",
    });
    assert(!closedCheckout.ok && closedCheckout.error === "checkout_closed", "closed gate skips stripe");
    assert(fetchCount === 0, "no stripe session while flags closed");

    globalThis.fetch = originalFetch;
    resetLicensePersistenceStoreForTests();

    await seedCommercialGenerationRegistryForTests(
      [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      [
        {
          priceId: "price_test_upgrade",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          product: "lifetime_upgrade",
        },
      ],
    );
    process.env.COMMERCIAL_GENERATION_UPGRADE_MAP = JSON.stringify([
      { from: FIXTURE_COMMERCIAL_GENERATION.id, to: FIXTURE_COMMERCIAL_GENERATION_B.id },
    ]);

    const eligibleEmail = "lifetime-upgrade@example.com";
    const licenseId = "lic_upgrade_eligible";
    await seedEligibleLifetimeGrant(eligibleEmail, licenseId);

    const wrongHolder = evaluateLifetimeUpgradeEligibility({
      grant: (await findGrantByLicenseId(licenseId))!,
      holderEmail: "other@example.com",
      acquisitions: [],
      registry: [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      priceMap: [
        {
          priceId: "price_test_upgrade",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          product: "lifetime_upgrade",
        },
      ],
    });
    assert(!wrongHolder.ok && wrongHolder.error === "wrong_holder", "wrong holder rejected");

    await upsertStoredGrant(
      normalizeLicenseGrant({
        email: "monthly@example.com",
        customerId: "cus_monthly",
        licenseId: "lic_monthly",
        edition: "personal_monthly",
        origin: "stripe",
        status: "active",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        generationAccessMode: "active_subscription",
      }),
    );
    const monthly = evaluateLifetimeUpgradeEligibility({
      grant: (await findGrantByLicenseId("lic_monthly"))!,
      holderEmail: "monthly@example.com",
      acquisitions: [],
      registry: [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      priceMap: [
        {
          priceId: "price_test_upgrade",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          product: "lifetime_upgrade",
        },
      ],
    });
    assert(!monthly.ok && monthly.error === "not_lifetime", "monthly not eligible");

    await upsertStoredGrant(
      normalizeLicenseGrant({
        email: "legacy@example.com",
        customerId: "cus_legacy",
        licenseId: "lic_legacy",
        edition: "personal_lifetime",
        origin: "gift",
        status: "active",
        generationAccessMode: "legacy_unassigned",
      }),
    );
    const legacy = evaluateLifetimeUpgradeEligibility({
      grant: (await findGrantByLicenseId("lic_legacy"))!,
      holderEmail: "legacy@example.com",
      acquisitions: [],
      registry: [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      priceMap: [
        {
          priceId: "price_test_upgrade",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          product: "lifetime_upgrade",
        },
      ],
    });
    assert(!legacy.ok && legacy.error === "legacy_unassigned", "legacy lifetime not invented eligible");

    await upsertStoredGrant(
      normalizeLicenseGrant({
        email: "already@example.com",
        customerId: "cus_already",
        licenseId: "lic_already",
        edition: "personal_lifetime",
        origin: "stripe",
        status: "active",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
        generationAccessMode: "purchased_generation",
      }),
    );
    const alreadyAcquisitions = [
      {
        id: "lacq_already",
        licenseId: "lic_already",
        normalizedEmail: "already@example.com",
        kind: "upgrade" as const,
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
        checkoutSessionId: "cs_prior_upgrade",
        stripeEventId: "evt_prior",
        edition: "personal_lifetime" as const,
        acquiredAt: "2024-06-01T00:00:00.000Z",
      },
    ];
    const already = evaluateLifetimeUpgradeEligibility({
      grant: (await findGrantByLicenseId("lic_already"))!,
      holderEmail: "already@example.com",
      acquisitions: alreadyAcquisitions,
      registry: [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      priceMap: [
        {
          priceId: "price_test_upgrade",
          commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          product: "lifetime_upgrade",
        },
      ],
      now: new Date("2035-01-01T00:00:00.000Z"),
    });
    assert(!already.ok && already.error === "generation_already_acquired", "target generation already owned");

    const proofId = await seedVerifiedProof(eligibleEmail);
    fetchCount = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchCount += 1;
      const url = String(input);
      if (url.includes("/v1/prices/price_test_upgrade")) {
        return new Response(JSON.stringify(upgradePrice()), { status: 200 });
      }
      if (url.includes("/v1/checkout/sessions") && !url.includes("cs_test_upgrade")) {
        return new Response(
          JSON.stringify({
            id: "cs_test_upgradeopen",
            url: "https://checkout.stripe.com/c/pay/cs_test_upgradeopen",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/checkout/sessions/cs_test_upgradeopen")) {
        return new Response(
          JSON.stringify(
            paidUpgradeSession("cs_test_upgradeopen", eligibleEmail, "lui_pending", licenseId),
          ),
          { status: 200 },
        );
      }
      if (url.includes("/v1/checkout/sessions/cs_test_upgradeunpaid")) {
        return new Response(
          JSON.stringify({
            ...paidUpgradeSession("cs_test_upgradeunpaid", eligibleEmail, "lui_unpaid", licenseId),
            payment_status: "unpaid",
            status: "open",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/checkout/sessions/cs_test_upgradewrong")) {
        return new Response(
          JSON.stringify({
            ...paidUpgradeSession("cs_test_upgradewrong", eligibleEmail, "lui_wrong", licenseId),
            line_items: { data: [{ quantity: 1, price: { id: "price_test_wrong" } }] },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/checkout/sessions/cs_test_upgradedup")) {
        return new Response(
          JSON.stringify(
            paidUpgradeSession("cs_test_upgradedup", eligibleEmail, "lui_dup", licenseId),
          ),
          { status: 200 },
        );
      }
      if (url.includes("/v1/prices/price_test_wrong")) {
        return new Response(
          JSON.stringify({
            id: "price_test_wrong",
            livemode: false,
            currency: "eur",
            unit_amount: 999,
            type: "one_time",
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: "unexpected" }), { status: 404 });
    }) as typeof fetch;

    const opened = await createLifetimeUpgradeCheckoutSession({
      proofId,
      licenseId,
      origin: "http://localhost:3000",
      bypassCommercialGateForTests: true,
    });
    assert(opened.ok, "test bypass opens checkout for eligible holder");
    assert(fetchCount >= 2, "stripe price + session called when bypass open");
    assert(opened.checkoutSessionId === "cs_test_upgradeopen", "session id persisted on intent");

    const inProgress = await createLifetimeUpgradeCheckoutSession({
      proofId: await seedVerifiedProof(eligibleEmail),
      licenseId,
      origin: "http://localhost:3000",
      bypassCommercialGateForTests: true,
    });
    assert(!inProgress.ok && inProgress.error === "checkout_in_progress", "concurrent checkout blocked");

    const unpaid = await fulfillLifetimeUpgradeFromCheckout({
      sessionId: "cs_test_upgradeunpaid",
      secretKey: process.env.STRIPE_SECRET_KEY!,
    });
    assert(!unpaid.ok && unpaid.error === "payment_incomplete", "pending payment not fulfilled");

    const wrongPrice = await fulfillLifetimeUpgradeFromCheckout({
      sessionId: "cs_test_upgradewrong",
      secretKey: process.env.STRIPE_SECRET_KEY!,
    });
    assert(!wrongPrice.ok && wrongPrice.error === "invalid_session", "wrong price rejected");

    const fulfilled = await fulfillLifetimeUpgradeFromCheckout({
      sessionId: "cs_test_upgradeopen",
      secretKey: process.env.STRIPE_SECRET_KEY!,
      stripeEventId: "evt_upgrade_001",
    });
    assert(fulfilled.ok && fulfilled.fulfilled === true, "paid webhook fulfills upgrade");

    const grant = await findGrantByEmail(eligibleEmail);
    assert(
      grant?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id,
      "grant keeps original purchased version after upgrade",
    );
    assert(grant?.edition === "personal_lifetime", "edition stays lifetime");
    assert(grant?.origin === "stripe", "origin preserved");
    assert(grant?.licenseId === licenseId, "license id preserved");

    const acquisitions = await listLicenseAcquisitions(licenseId);
    assert(acquisitions.some((row) => row.kind === "upgrade"), "upgrade acquisition recorded");
    assert(
      !acquisitions.some((row) => row.kind === "initial_purchase"),
      "upgrade does not invent initial_purchase",
    );

    const duplicateWebhook = await applyLifetimeUpgradeStripeWebhook(
      {
        id: "evt_upgrade_001",
        type: "checkout.session.completed",
        data: {
          object: paidUpgradeSession("cs_test_upgradeopen", eligibleEmail, "lui_pending", licenseId),
        },
      },
      { secretKey: process.env.STRIPE_SECRET_KEY! },
    );
    assert(duplicateWebhook.ok && duplicateWebhook.duplicate === true, "duplicate stripe event deduped");
    assert((await listLicenseAcquisitions(licenseId)).length === 1, "duplicate event does not duplicate acquisition");

    const upgradedGrant = await findGrantByEmail(eligibleEmail);
    assert(upgradedGrant, "upgraded grant exists");
    await withLicensePersistence((document) => {
      document.activations.push({
        licenseId: upgradedGrant!.licenseId,
        deviceId: "dev_upgrade_rights",
        deviceName: "Test Mac",
        platform: "mac",
        appVersion: "0.1.0",
        activatedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        status: "active",
      });
    });
    const cumulativeIds = (await import("./commercial-generations/persistence.ts"))
      .cumulativeCommercialGenerationIds({
        grantCommercialGenerationId: upgradedGrant!.commercialGenerationId,
        acquisitions,
      });
    assert(
      cumulativeIds.includes(FIXTURE_COMMERCIAL_GENERATION.id) &&
        cumulativeIds.includes(FIXTURE_COMMERCIAL_GENERATION_B.id),
      "cumulative acquired versions include original and upgrade target",
    );
    const signed = await buildSignedLicenseContext(
      {
        licenseId: upgradedGrant!.licenseId,
        customerId: upgradedGrant!.customerId,
        email: upgradedGrant!.email,
        edition: upgradedGrant!.edition,
        status: upgradedGrant!.status,
        deviceLimit: 1,
        activatedDevices: 1,
        validUntil: null,
        lastCheckedAt: new Date().toISOString(),
        offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
        channel: "stable",
        commercialGenerationId: upgradedGrant!.commercialGenerationId,
        acquiredCommercialGenerationIds: cumulativeIds,
        generationAccessMode: upgradedGrant!.generationAccessMode,
      },
    );
    const checked = await checkLicense({
      deviceId: "dev_upgrade_rights",
      licenseToken: signed.licenseToken,
    });
    assert(checked.ok, "web/desktop checkLicense reads upgraded generation");
    assert(
      checked.ok &&
        checked.session?.context.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id,
      "signed contract keeps original purchased version id",
    );

    assert(
      isPersonalCheckoutEvent({
        id: "evt_u",
        type: "checkout.session.completed",
        data: { object: { metadata: { plan: "lifetime_upgrade", productType: "lifetime_upgrade" } } },
      }) === false,
      "personal webhook ignores upgrade",
    );
    assert(
      isLifetimeUpgradeCheckoutEvent({
        id: "evt_u",
        type: "checkout.session.completed",
        data: { object: { metadata: { plan: "lifetime_upgrade", productType: "lifetime_upgrade" } } },
      }),
      "upgrade webhook recognizes upgrade metadata",
    );

    await withLicensePersistence(async (document) => {
      if (!document.checkoutGenerationBindings) document.checkoutGenerationBindings = [];
      document.checkoutGenerationBindings.push({
        checkoutSessionId: "cs_test_upgradedup",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
        priceId: "price_test_upgrade",
        plan: "lifetime_upgrade",
        boundAt: new Date().toISOString(),
      });
      document.lifetimeUpgradeIntents?.push({
        id: "lui_second_pay",
        licenseId,
        normalizedEmail: eligibleEmail,
        sourceGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        targetGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
        checkoutSessionId: "cs_test_upgradedup",
        idempotencyKey: `${licenseId}:gen_fixture_beta:second`,
        status: "checkout_created",
        incidentNote: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const secondPay = await fulfillLifetimeUpgradeFromCheckout({
      sessionId: "cs_test_upgradedup",
      secretKey: process.env.STRIPE_SECRET_KEY!,
      stripeEventId: "evt_second_pay",
    });
    assert(secondPay.ok && secondPay.paymentRecorded === true, "second confirmed payment recorded as incident");
    const dupIntent = await findLifetimeUpgradeIntentBySessionId("cs_test_upgradedup");
    assert(dupIntent?.status === "duplicate_payment", "duplicate payment intent flagged");
    assert((await listLicenseAcquisitions(licenseId)).length === 1, "no duplicate rights on double pay");

    resetLicensePersistenceStoreForTests();
    const { db, adapter } = openFreshLocalD1Adapter(siteRoot);
    setLicensePersistenceDatabaseForTests(adapter);
    await withLicensePersistence((document) => {
      document.lifetimeUpgradeIntents = [
        {
          id: "lui_d1",
          licenseId: "lic_d1_upgrade",
          normalizedEmail: "d1-upgrade@example.com",
          sourceGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
          targetGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id,
          checkoutSessionId: "cs_test_d1upgrade",
          idempotencyKey: "lic_d1_upgrade:gen_fixture_beta",
          status: "checkout_created",
          incidentNote: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    });
    const afterWrite = await readLicensePersistence();
    assert((afterWrite.lifetimeUpgradeIntents ?? []).length === 1, "intent written to local D1");
    db.close();
    resetLicensePersistenceStoreForTests();
    const { adapter: adapterB } = openFreshLocalD1Adapter(siteRoot);
    setLicensePersistenceDatabaseForTests(adapterB);
    const afterReopen = await readLicensePersistence();
    assert(
      (afterReopen.lifetimeUpgradeIntents ?? []).some((row) => row.id === "lui_d1"),
      "upgrade intent survives local D1 reopen",
    );

    globalThis.fetch = originalFetch;
    console.log("lifetime-upgrade-checkout-check: PASS");
  } finally {
    globalThis.fetch = originalFetch;
    resetLicensePersistenceStoreForTests();
    setLicensePersistenceDatabaseForTests(null);
    for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      unlinkSync(storePath);
    } catch {
      /* optional cleanup */
    }
  }
}

runLifetimeUpgradeCheckoutCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
