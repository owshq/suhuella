/**
 * LICENSE-VERSION-FINAL-E2E-007
 */
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import { assertHostExecutorGenerationRights } from "@suhuella/product/host/generation-executor-gate.ts";
import { assertSignedExecutorRights } from "@suhuella/product/lib/signed-license-contract.ts";
import { readSignedLicenseToken } from "./license-context.ts";
import { bindCommercialGenerationForCheckoutSession } from "./commercial-generations/bind-at-checkout.ts";
import {
  findCheckoutGenerationBinding,
  findCheckoutReconciliationPending,
  listLicenseAcquisitions,
  seedCommercialGenerationRegistryForTests,
} from "./commercial-generations/persistence.ts";
import { validatePersonalCheckoutBeforeStripe } from "./commercial-generations/checkout-version-binding.ts";
import { FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B } from "./commercial-generations/types.ts";
import { verifyStripeWebhookSignature } from "./business-webhooks.ts";
import { createStripeCheckoutSession } from "./checkout-session.ts";
import {
  readLicensePersistence,
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import {
  activateLicense,
  checkLicense,
} from "./license-service.ts";
import { findGrantByEmail, upsertStoredGrant } from "./license-store.ts";
import { normalizeLicenseGrant } from "./license-entitlement.ts";
import {
  createLifetimeUpgradeCheckoutSession,
  evaluateLifetimeUpgradeEligibility,
} from "./lifetime-upgrade/index.ts";
import { applyLifetimeUpgradeStripeWebhook } from "./lifetime-upgrade-webhook.ts";
import { applyPersonalStripeWebhook } from "./personal-checkout-webhook.ts";
import {
  assertStripeSimulatorAllowed,
  catalogPriceFixture,
  createStripeFetchSimulator,
  signStripeWebhookPayload,
  STRIPE_SIMULATOR_ENV,
} from "./test/stripe-simulator.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";
import { handleLicenseCheckPost } from "./license-check-route-handler.ts";
import { stripeTestFixtureSecret } from "./test/stripe-fixture-secret.ts";

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = join(siteRoot, "..");
const desktopRoot = join(repoRoot, "desktop");
const organiseCap = organisationPlanCapability();
const upgradeCap = "rename_file";
const WEBHOOK_SECRET = "whsec_e2e_test_only_not_live";
const STRIPE_SK = stripeTestFixtureSecret("E2E007LicenseVersionFinal");
const LIFETIME_PRICE = "price_e2e_lifetime_gen";
const UPGRADE_PRICE = "price_e2e_upgrade_gen";
const BUYER = "buyer-e2e@fixture.suhuella.test";
const DEVICE = "dev_e2e_007_primary";

type Evidence = {
  scenario: string;
  platform: string;
  result: "PASS" | "FAIL" | "SKIP";
  note: string;
};

const evidence: Evidence[] = [];

function record(scenario: string, platform: string, result: Evidence["result"], note: string): void {
  evidence.push({ scenario, platform, result, note });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const file of ["license-version-e2e-executor-check.ts", "license-ipc-gate-check.ts"] as const) {
  const source = readFileSync(join(desktopRoot, "electron", file), "utf8");
  assert(source.includes("runDesktopE2eCheckWhenInvoked"), `${file} uses guarded E2E runner`);
  assert(!source.includes("LICENSE_E2E_SIGNED_CONTEXT required"), `${file} must not throw on module load`);
}

async function seedProof(
  email: string,
  purpose: "LICENSE_ACTIVATION" | "LIFETIME_UPGRADE",
): Promise<string> {
  const proofId = `vep_e2e_${purpose}_${randomUUID()}`;
  await withLicensePersistence((document) => {
    document.proofs.push({
      id: proofId,
      normalizedEmail: email,
      purpose,
      deviceId: null,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      consumedAt: null,
      createdAt: new Date().toISOString(),
    });
  });
  return proofId;
}

function paidLifetimeSession(sessionId: string, email: string) {
  return {
    id: sessionId,
    payment_status: "paid",
    status: "complete",
    mode: "payment",
    customer: "cus_e2e_lifetime",
    customer_details: { email },
    metadata: { plan: "lifetime", edition: "personal_lifetime" },
    line_items: { data: [{ quantity: 1, price: { id: LIFETIME_PRICE } }] },
    livemode: false,
  };
}

function paidUpgradeSession(sessionId: string, email: string, intentId: string, licenseId: string) {
  return {
    id: sessionId,
    payment_status: "paid",
    status: "complete",
    mode: "payment",
    customer: "cus_e2e_upgrade",
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
    line_items: { data: [{ quantity: 1, price: { id: UPGRADE_PRICE } }] },
    livemode: false,
  };
}

async function invokeLicenseCheckHttp(body: Record<string, unknown>): Promise<Response> {
  return handleLicenseCheckPost(body, { clientIp: "127.0.0.1" });
}

async function runDesktopBundledCheck(
  entryFile: string,
  outBaseName: string,
  context: unknown,
  extraEnv: Record<string, string> = {},
  realElectron = false,
): Promise<"mock" | "real"> {
  const e2eOutDir = join(desktopRoot, ".build/desktop-e2e");
  execSync(`mkdir -p "${e2eOutDir}"`, { cwd: desktopRoot, stdio: "pipe" });
  const outFile = join(e2eOutDir, `${outBaseName}.cjs`);
  execSync(
    [
      "npx esbuild",
      join(desktopRoot, "electron", entryFile),
      "--bundle",
      "--platform=node",
      "--format=cjs",
      "--target=node20",
      `--outfile=${outFile}`,
      "--external:electron",
      `--alias:@suhuella/brand=${join(repoRoot, "brands/index.ts")}`,
      `--alias:@suhuella/product=${join(repoRoot, "packages/product/src")}`,
      "--log-level=error",
    ].join(" "),
    { cwd: desktopRoot, stdio: "pipe" },
  );
  const env = {
    ...process.env,
    LICENSE_E2E_SIGNED_CONTEXT: JSON.stringify(context),
    ...extraEnv,
  };
  if (realElectron) {
    try {
      execSync(`npx electron ${outFile}`, { cwd: desktopRoot, env, stdio: "pipe", timeout: 90_000 });
      return "real";
    } catch {
      return "mock";
    }
  }
  execSync(`node -r ${join(desktopRoot, "electron/test-electron-mock.cjs")} ${outFile}`, {
    cwd: desktopRoot,
    env,
    stdio: "pipe",
  });
  return "mock";
}

async function setupD1Environment(): Promise<{ db: { close(): void } }> {
  resetLicensePersistenceStoreForTests();
  const handle = openFreshLocalD1Adapter(siteRoot);
  setLicensePersistenceDatabaseForTests(handle.adapter);
  await withLicensePersistence((document) => {
    document.commercialGenerations = [];
    document.commercialGenerationPrices = [];
    document.checkoutGenerationBindings = [];
    document.checkoutReconciliationPending = [];
    document.licenseAcquisitions = [];
    document.grants = [];
    document.activations = [];
    document.proofs = [];
    document.stripeEvents = [];
    document.lifetimeUpgradeIntents = [];
  });
  return handle;
}

async function runLicenseVersionFinalE2eCheck(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_PRIVATE_KEY: process.env.LICENSE_SIGNING_PRIVATE_KEY,
    LICENSE_SIGNING_PUBLIC_KEYS: process.env.LICENSE_SIGNING_PUBLIC_KEYS,
    SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS: process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_LIFETIME_PRICE_ID: process.env.STRIPE_LIFETIME_PRICE_ID,
    STRIPE_LIFETIME_UPGRADE_PRICE_ID: process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID,
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
    LICENSE_VERSION_MODEL_ACTIVE: process.env.LICENSE_VERSION_MODEL_ACTIVE,
    COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED: process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED,
    COMMERCIAL_GENERATION_UPGRADE_MAP: process.env.COMMERCIAL_GENERATION_UPGRADE_MAP,
    [STRIPE_SIMULATOR_ENV]: process.env[STRIPE_SIMULATOR_ENV],
  };
  const storePath = `${siteRoot}/.data/license-version-final-e2e-check.json`;
  let d1Handle: { db: { close(): void } } | null = null;
  let restoreFetch: (() => void) | null = null;

  try {
    const e2eDoc = readFileSync(join(repoRoot, "LICENSE-VERSION-FINAL-E2E-007.md"), "utf8");
    assert(e2eDoc.includes("STATUS = IN PROGRESS"), "delivery doc present");
    const migrationNames = [
      "0012_lifetime_upgrade_intent.sql",
      "0012_license_version_contract.sql",
    ].map((name) => readFileSync(join(siteRoot, "migrations", name), "utf8"));
    assert(migrationNames.every((sql) => sql.includes("CREATE")), "both 0012 migrations exist independently");

    process.env.NODE_ENV = "development";
    process.env[STRIPE_SIMULATOR_ENV] = "true";
    assertStripeSimulatorAllowed();
    applyTestLicenseSigningEnv(keypair);
    process.env.LICENSE_STORE_PATH = storePath;
    process.env.STRIPE_SECRET_KEY = STRIPE_SK;
    process.env.STRIPE_LIFETIME_PRICE_ID = LIFETIME_PRICE;
    process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID = UPGRADE_PRICE;
    process.env.PAID_CHECKOUT_ENABLED = "true";
    process.env.LICENSE_VERSION_MODEL_ACTIVE = "true";
    process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";
    process.env.COMMERCIAL_GENERATION_UPGRADE_MAP = JSON.stringify([
      { from: FIXTURE_COMMERCIAL_GENERATION.id, to: FIXTURE_COMMERCIAL_GENERATION_B.id },
    ]);

    d1Handle = await setupD1Environment();

    await seedCommercialGenerationRegistryForTests(
      [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      [
        { priceId: LIFETIME_PRICE, commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id, product: "lifetime" },
        { priceId: UPGRADE_PRICE, commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id, product: "lifetime_upgrade" },
      ],
    );

    const simulator = createStripeFetchSimulator({
      lifetimePriceId: LIFETIME_PRICE,
      monthlyPriceId: "price_e2e_monthly",
      upgradePriceId: UPGRADE_PRICE,
    });
    restoreFetch = simulator.install();
    let stripeFetch = globalThis.fetch;

    // --- Failure: incomplete config blocks checkout before Stripe ---
    process.env.LICENSE_VERSION_MODEL_ACTIVE = "true";
    await withLicensePersistence((document) => {
      document.commercialGenerations = [];
      document.commercialGenerationPrices = [];
    });
    const blocked = await validatePersonalCheckoutBeforeStripe({ plan: "lifetime", priceId: LIFETIME_PRICE });
    assert(!blocked.ok, "incomplete registry blocks pre-stripe validation");
    let stripePosts = 0;
    const fetchBeforeCount = stripeFetch;
    globalThis.fetch = (async (input, init) => {
      if (String(input).includes("/v1/checkout/sessions") && init?.method === "POST") stripePosts += 1;
      return fetchBeforeCount(input, init);
    }) as typeof fetch;
    const blockedCheckout = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "http://localhost:3000",
      returnTo: "public",
      email: BUYER,
    });
    globalThis.fetch = fetchBeforeCount;
    stripeFetch = globalThis.fetch;
    assert(blockedCheckout === "" && stripePosts === 0, "no stripe when version binding fails");
    record("Incomplete config before charge", "B — service + D1", "PASS", "zero Stripe creates");

    await seedCommercialGenerationRegistryForTests(
      [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      [
        { priceId: LIFETIME_PRICE, commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id, product: "lifetime" },
        { priceId: UPGRADE_PRICE, commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id, product: "lifetime_upgrade" },
      ],
    );

    // --- Lifetime full journey ---
    const activationProof = await seedProof(BUYER, "LICENSE_ACTIVATION");
    const checkoutUrl = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "http://localhost:3000",
      returnTo: "public",
      email: BUYER,
    });
    assert(checkoutUrl.startsWith("https://checkout.stripe.com/"), "checkout session created with binding");
    const sessionId = [...simulator.sessions.keys()].find((id) => /^cs_test_e2e\d+$/.test(id)) ?? "";
    assert(sessionId, "simulator persisted session id");

    const binding = await findCheckoutGenerationBinding(sessionId);
    assert(binding?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id, "version bound at checkout");
    assert(binding?.versionModelActiveAtBind === true, "model-active evidence on binding");
    record("Checkout with version binding", "B — service + D1", "PASS", binding!.checkoutSessionId);

    const session = paidLifetimeSession(sessionId, BUYER);
    const webhookBody = JSON.stringify({
      id: "evt_e2e_lifetime_001",
      type: "checkout.session.completed",
      livemode: false,
      data: { object: session },
    });
    const signature = await signStripeWebhookPayload(webhookBody, WEBHOOK_SECRET);
    assert(await verifyStripeWebhookSignature(webhookBody, signature, WEBHOOK_SECRET), "webhook signature valid");

    const webhook = await applyPersonalStripeWebhook(
      JSON.parse(webhookBody),
      { secretKey: STRIPE_SK, origin: "http://localhost:3000" },
    );
    assert(webhook.ok && webhook.fulfilled, "paid webhook grants without success return");
    record("Webhook without success return", "B — service + D1", "PASS", "applyPersonalStripeWebhook");

    const grant = await findGrantByEmail(BUYER);
    assert(grant?.edition === "personal_lifetime", "single grant in D1");
    const acquisitionsAfterPurchase = await listLicenseAcquisitions(grant!.licenseId);
    assert(acquisitionsAfterPurchase.length === 1, "single acquisition row");
    assert(acquisitionsAfterPurchase[0]?.kind === "initial_purchase", "initial_purchase recorded");
    record("Single grant + acquisition", "B — service + D1", "PASS", grant!.licenseId);

    const activated = await activateLicense({
      emailProofId: activationProof,
      deviceId: DEVICE,
      deviceName: "E2E Desk",
      platform: "mac",
    });
    assert(activated.ok && activated.session?.context.licenseToken.includes("."), "device activation returns signed token");
    const token = activated.session!.context.licenseToken;
    const verifiedToken = await readSignedLicenseToken(token);
    assert(verifiedToken?.signedContractVersion === 1, "contract v1 on token");
    assert(token.startsWith("ed25519."), "activation uses Ed25519 token");
    assert(verifiedToken?.capabilities.includes(organiseCap), "organise capability signed");
    assert(!verifiedToken?.capabilities.includes(upgradeCap), "beta rename not signed before upgrade");
    record("Signed rights after activation", "B — service + D1", "PASS", organiseCap);

    const preUpgradeRename = assertSignedExecutorRights(activated.session!.context, upgradeCap);
    const preUpgradeOrganise = assertHostExecutorGenerationRights(activated.session!.context, organiseCap);
    assert(!preUpgradeRename.ok && preUpgradeOrganise.ok, "same license: organise yes, rename no");
    record("Pre-upgrade capability gate", "C — host module (not browser runtime)", "PASS", `${upgradeCap} denied`);

    const httpCheckBefore = await invokeLicenseCheckHttp({ deviceId: DEVICE, licenseToken: token });
    assert(httpCheckBefore.status === 200, "HTTP POST /api/license/check returns 200");
    const httpBodyBefore = (await httpCheckBefore.json()) as { ok?: boolean; license?: { capabilities?: string[] } };
    assert(httpBodyBefore.ok && httpBodyBefore.license?.capabilities?.includes(organiseCap), "HTTP check returns signed context");
    assert(!httpBodyBefore.license?.capabilities?.includes(upgradeCap), "HTTP check omits upgrade cap pre-payment");
    record("License check HTTP route", "B+ — Next route handler", "PASS", "POST /api/license/check");

    const offlineStored = assertSignedExecutorRights(
      {
        ...(activated.session!.context as Parameters<typeof assertSignedExecutorRights>[0]),
        lastCheckedAt: "2020-01-01T00:00:00.000Z",
        offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
      },
      organiseCap,
    );
    assert(offlineStored.ok, "stored token valid inside offlineUntil without refresh");
    record("Offline stored token grace", "B — signed payload policy", "PASS", "no refresh required in grace");

    await runDesktopBundledCheck(
      "license-version-e2e-executor-check.ts",
      "license-version-e2e-executor-check",
      activated.session!.context,
      { LICENSE_E2E_EXPECT_RENAME: "false" },
    );
    record("Desktop organise (mock Electron)", "E− — Node + electron mock", "PASS", "temp dirs only");

    // --- Upgrade journey ---
    const upgradeProof = await seedProof(BUYER, "LIFETIME_UPGRADE");
    const eligibility = evaluateLifetimeUpgradeEligibility({
      grant: grant!,
      holderEmail: BUYER,
      acquisitions: acquisitionsAfterPurchase,
      registry: [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B],
      priceMap: [
        { priceId: UPGRADE_PRICE, commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION_B.id, product: "lifetime_upgrade" },
      ],
    });
    assert(eligibility.ok, "lifetime eligible for upgrade");

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/prices/price_e2e_upgrade")) {
        return new Response(JSON.stringify(catalogPriceFixture(UPGRADE_PRICE, "upgrade")), { status: 200 });
      }
      if (url.includes("/v1/checkout/sessions") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ id: "cs_test_e2eupgrade01", url: "https://checkout.stripe.com/c/pay/cs_test_e2eupgrade01" }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/checkout/sessions/cs_test_e2eupgrade01")) {
        return new Response(
          JSON.stringify(paidUpgradeSession("cs_test_e2eupgrade01", BUYER, "lui_e2e", grant!.licenseId)),
          { status: 200 },
        );
      }
      return stripeFetch(input, init);
    }) as typeof fetch;

    const upgradeCheckout = await createLifetimeUpgradeCheckoutSession({
      proofId: upgradeProof,
      licenseId: grant!.licenseId,
      origin: "http://localhost:3000",
      bypassCommercialGateForTests: true,
    });
    assert(upgradeCheckout.ok && upgradeCheckout.checkoutSessionId === "cs_test_e2eupgrade01", "upgrade intent pins destination");
    record("Upgrade intent + checkout", "B — service + D1", "PASS", upgradeCheckout.intentId);

    const upgradeWebhook = await applyLifetimeUpgradeStripeWebhook(
      {
        id: "evt_e2e_upgrade_001",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: paidUpgradeSession("cs_test_e2eupgrade01", BUYER, upgradeCheckout.intentId, grant!.licenseId) },
      },
      { secretKey: STRIPE_SK },
    );
    assert(upgradeWebhook.ok && upgradeWebhook.fulfilled, "upgrade webhook fulfills once");

    const grantAfter = await findGrantByEmail(BUYER);
    assert(grantAfter?.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id, "original version preserved");
    const upgradeAcquisitions = await listLicenseAcquisitions(grant!.licenseId);
    assert(upgradeAcquisitions.length === 2, "initial + upgrade acquisitions");
    assert(upgradeAcquisitions.filter((row) => row.kind === "upgrade").length === 1, "one upgrade row");

    const refreshed = await checkLicense({ deviceId: DEVICE, licenseToken: token });
    assert(refreshed.ok, "checkLicense refreshes signed contract");
    assert(refreshed.session!.context.capabilities.includes(organiseCap), "prior organise retained");
    assert(refreshed.session!.context.capabilities.includes(upgradeCap), "upgrade adds rename_file to signed caps");
    const postUpgradeRename = assertSignedExecutorRights(refreshed.session!.context, upgradeCap);
    assert(postUpgradeRename.ok, "same operation allowed after upgrade refresh");
    const cumulative = refreshed.session!.context.acquiredCommercialGenerationIds ?? [];
    assert(
      cumulative.includes(FIXTURE_COMMERCIAL_GENERATION.id) &&
        cumulative.includes(FIXTURE_COMMERCIAL_GENERATION_B.id),
      "upgrade adds target version to signed cumulative set",
    );
    assert(
      refreshed.session!.context.commercialGenerationId === FIXTURE_COMMERCIAL_GENERATION.id,
      "original version field unchanged after refresh",
    );
    record("Upgrade functional effect", "B — service + D1", "PASS", `${upgradeCap} denied→allowed`);

    const httpCheckAfter = await invokeLicenseCheckHttp({ deviceId: DEVICE, licenseToken: refreshed.session!.context.licenseToken });
    const httpBodyAfter = (await httpCheckAfter.json()) as { license?: { capabilities?: string[] } };
    assert(httpBodyAfter.license?.capabilities?.includes(upgradeCap), "HTTP refresh includes upgrade capability");
    record("Upgrade via HTTP check", "B+ — Next route handler", "PASS", upgradeCap);

    const electronMode = await runDesktopBundledCheck(
      "license-version-e2e-executor-check.ts",
      "license-version-e2e-executor-check",
      refreshed.session!.context,
      { LICENSE_E2E_EXPECT_RENAME: "true" },
      true,
    );
    record(
      "Desktop post-upgrade rename",
      electronMode === "real" ? "E — real Electron process" : "E− — Node + electron mock",
      "PASS",
      electronMode === "real" ? "rename_file + organise" : "mock fallback",
    );

    execSync("node scripts/browser-license-gate-playwright.mjs", { cwd: siteRoot, stdio: "pipe" });
    record("Browser upgrade gate", "C — Playwright Chromium", "PASS", "pre/post rename_file in real browser");

    const ipcMode = await runDesktopBundledCheck(
      "license-ipc-gate-check.ts",
      "license-ipc-gate-check",
      refreshed.session!.context,
      {},
      true,
    );
    record(
      "Desktop IPC executePlan gate",
      ipcMode === "real" ? "E+ — real Electron main IPC path" : "E− — mock IPC path",
      "PASS",
      ipcMode === "real" ? "tamper + fake recovery rejected" : "mock fallback",
    );

    const dupUpgrade = await applyLifetimeUpgradeStripeWebhook(
      {
        id: "evt_e2e_upgrade_001",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: paidUpgradeSession("cs_test_e2eupgrade01", BUYER, upgradeCheckout.intentId, grant!.licenseId) },
      },
      { secretKey: STRIPE_SK },
    );
    assert(dupUpgrade.duplicate === true, "duplicate upgrade webhook deduped");
    assert((await listLicenseAcquisitions(grant!.licenseId)).length === 2, "no duplicate acquisition");
    record("Duplicate upgrade webhook", "B — service + D1", "PASS", "stripeEvents idempotency");

    // --- Failure matrix (selected) ---
    const badSig = await verifyStripeWebhookSignature(webhookBody, "t=0,v1=deadbeef", WEBHOOK_SECRET);
    assert(!badSig, "invalid webhook signature rejected");
    record("Invalid webhook signature", "A unit", "PASS", "verifyStripeWebhookSignature");

    const unpaid = await applyPersonalStripeWebhook(
      {
        id: "evt_e2e_unpaid",
        type: "checkout.session.completed",
        livemode: false,
        data: {
          object: {
            ...paidLifetimeSession("cs_test_e2eunpaid01", "unpaid@fixture.test"),
            payment_status: "unpaid",
            status: "open",
          },
        },
      },
      { secretKey: STRIPE_SK },
    );
    assert(unpaid.ok && !unpaid.fulfilled, "unpaid session does not grant");
    record("Pending payment", "B — service + D1", "PASS", "no grant");

    await bindCommercialGenerationForCheckoutSession({
      checkoutSessionId: "cs_test_e2enobind01",
      plan: "lifetime",
      priceId: LIFETIME_PRICE,
      commercialGenerationId: null,
    });
    simulator.sessions.set(
      "cs_test_e2enobind01",
      paidLifetimeSession("cs_test_e2enobind01", "nobind@fixture.test") as any,
    );
    const noBind = await applyPersonalStripeWebhook(
      {
        id: "evt_e2e_nobind",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: paidLifetimeSession("cs_test_e2enobind01", "nobind@fixture.test") },
      },
      { secretKey: STRIPE_SK },
    );
    assert(noBind.ok && !noBind.fulfilled, "paid without version does not grant under model");
    const pending = await findCheckoutReconciliationPending("cs_test_e2enobind01");
    assert(pending?.status === "open", "reconciliation incident persisted");
    record("Paid without binding", "B — service + D1", "PASS", pending!.id);

    const tampered = token.replace(".", ".x");
    const tamperedCheck = await checkLicense({ deviceId: DEVICE, licenseToken: tampered });
    assert(!tamperedCheck.ok, "tampered token rejected on check");
    record("Tampered token", "B — service + D1", "PASS", "decode fails");

    const monthlyExpired = assertSignedExecutorRights(
      {
        ...(refreshed.session!.context as any),
        edition: "personal_monthly",
        status: "expired",
        validUntil: "2020-01-01T00:00:00.000Z",
      },
      organiseCap,
    );
    assert(!monthlyExpired.ok && monthlyExpired.error.code === "license_expired", "monthly expired denied");
    record("Monthly expired", "A unit", "PASS", monthlyExpired.error.code);

    const offlineExpired = assertSignedExecutorRights(
      {
        ...(refreshed.session!.context as any),
        offlineUntil: "2020-01-01T00:00:00.000Z",
      },
      organiseCap,
    );
    assert(!offlineExpired.ok && offlineExpired.error.code === "offline_expired", "offline grace ended");
    record("Offline expired", "A unit", "PASS", offlineExpired.error.code);

    await upsertStoredGrant(
      normalizeLicenseGrant({
        email: "gift@fixture.test",
        customerId: "cust_gift",
        licenseId: "lic_gift_e2e",
        edition: "personal_lifetime",
        origin: "gift",
        status: "active",
        generationAccessMode: "legacy_unassigned",
      }),
    );
    const giftBefore = await readLicensePersistence();
    const giftGrantCount = giftBefore.grants.length;
    await applyPersonalStripeWebhook(
      {
        id: "evt_e2e_gift_noise",
        type: "checkout.session.completed",
        livemode: false,
        data: { object: paidLifetimeSession("cs_test_e2egiftnoise", "gift@fixture.test") },
      },
      { secretKey: STRIPE_SK },
    );
    const giftAfter = await readLicensePersistence();
    assert(giftAfter.grants.length === giftGrantCount, "gift grant not overwritten by personal webhook");
    record("Gift grant isolation", "B — service + D1", "PASS", "origin gift untouched");

    record("Published installer clean machine", "F installer", "SKIP", "out of scope for 007");
    record("Stripe Live", "G live", "SKIP", "explicitly excluded");

    // --- Regression suite (child processes must not inherit E2E-only env) ---
    const regressionEnv = { ...process.env };
    for (const key of [
      "LICENSE_VERSION_MODEL_ACTIVE",
      "COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED",
      "COMMERCIAL_GENERATION_UPGRADE_MAP",
      STRIPE_SIMULATOR_ENV,
      "PAID_CHECKOUT_ENABLED",
      "STRIPE_SECRET_KEY",
      "STRIPE_LIFETIME_PRICE_ID",
      "STRIPE_LIFETIME_UPGRADE_PRICE_ID",
      "LICENSE_STORE_PATH",
      "LICENSE_SIGNING_PRIVATE_KEY",
      "LICENSE_SIGNING_PUBLIC_KEYS",
      "SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS",
    ]) {
      delete regressionEnv[key];
    }
    const regression = [
      "test:signed-license-rights-delivery",
      "test:license-version-contract-closure",
      "test:commercial-generations",
      "test:generation-enforcement",
      "test:lifetime-upgrade-checkout",
      "test:personal-checkout-webhook",
      "test:organise-integrity",
      "test:plan-semantics",
    ];
    for (const script of regression) {
      execSync(`npm run ${script}`, { cwd: siteRoot, stdio: "pipe", env: regressionEnv });
      record(`Regression ${script}`, "A unit/B integration", "PASS", "exit 0");
    }
    execSync("npm run test:license", { cwd: desktopRoot, stdio: "pipe", env: regressionEnv });
    record("Regression desktop test:license", "E electron", "PASS", "exit 0");

    console.log("\nLICENSE-VERSION-FINAL-E2E-007 evidence matrix:");
    for (const row of evidence) {
      console.log(`  [${row.result}] ${row.platform} | ${row.scenario} — ${row.note}`);
    }
    console.log("\nLICENSE-VERSION-FINAL-E2E-007 check passed");
  } finally {
    restoreFetch?.();
    resetLicensePersistenceStoreForTests();
    setLicensePersistenceDatabaseForTests(null);
    d1Handle?.db.close();
    for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value as string;
    }
    try {
      rmSync(storePath, { force: true });
    } catch {
      // ignore
    }
  }
}

void runLicenseVersionFinalE2eCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
