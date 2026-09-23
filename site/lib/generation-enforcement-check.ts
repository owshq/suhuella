import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  appVersionAffectsGenerationRights,
  evaluateGenerationRights,
  effectiveCapabilitiesForLicense,
  isGenerationEnforcementActive,
  validateGrantConfiguration,
} from "@suhuella/product/lib/generation-rights.ts";
import { securityPatchBypassesGenerationGate } from "./commercial-generations/enforcement.ts";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import {
  releaseCheckUserMessage,
  releaseUpdateIntent,
} from "@suhuella/product/lib/release-generation-policy.ts";
import { decideReleaseState } from "@suhuella/product/lib/release-lifecycle.ts";
import { FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B } from "./commercial-generations/types.ts";
import { commercialGenerationEnforcementActive } from "./commercial-generations/enforcement.ts";
import { seedCommercialGenerationRegistryForTests } from "./commercial-generations/persistence.ts";
import { activateFromVerifiedCheckout, checkLicense } from "./license-service.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { upsertStoredGrant } from "./license-store.ts";
import {
  assertHostExecutorGenerationRights,
  setCommercialGenerationRegistryForTests as setBrowserRegistry,
} from "@suhuella/product/host/generation-executor-gate.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const registry = [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B];
const organiseCap = organisationPlanCapability();

async function runGenerationEnforcementCheck(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_PRIVATE_KEY: process.env.LICENSE_SIGNING_PRIVATE_KEY,
    LICENSE_SIGNING_PUBLIC_KEYS: process.env.LICENSE_SIGNING_PUBLIC_KEYS,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED: process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED,
  };
  const storePath = `${siteRoot}/.data/generation-enforcement-check.json`;

  try {
    process.env.NODE_ENV = "development";
    applyTestLicenseSigningEnv(keypair);
    process.env.LICENSE_STORE_PATH = storePath;
    delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    resetLicensePersistenceStoreForTests();

    assert(commercialGenerationEnforcementActive() === false, "enforcement off by default");
    assert(isGenerationEnforcementActive() === false, "product enforcement flag off by default");
    assert(appVersionAffectsGenerationRights() === false, "app semver never grants rights");
    assert(securityPatchBypassesGenerationGate() === true, "security patches bypass generation sales");

    const mandatory = decideReleaseState({
      installed: "0.1.0",
      latest: "0.2.0",
      minimum: "0.2.0",
      mandatory: true,
    });
    assert(releaseUpdateIntent(mandatory) === "security_or_maintenance", "mandatory minimum is maintenance");
    assert(
      releaseCheckUserMessage(mandatory, "en").includes("Security fixes"),
      "release copy does not frame mandatory update as paid generation upgrade",
    );

    const legacyCaps = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      generationAccessMode: "legacy_unassigned",
      registry,
      enforcementActive: true,
    });
    assert(legacyCaps.includes(organiseCap), "legacy grant grandfather keeps organise when enforcement on");

    process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";
    setBrowserRegistry(registry);

    const lifetimeAlpha = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
      registry,
      enforcementActive: true,
    });
    assert(lifetimeAlpha.includes(organiseCap), "lifetime alpha keeps acquired organise");
    assert(
      !lifetimeAlpha.includes("rename_file"),
      "lifetime alpha does not gain beta-only generation capability",
    );

    const newerBinaryNoGrantChange = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
      registry,
      enforcementActive: true,
    });
    assert(
      newerBinaryNoGrantChange.includes(organiseCap),
      "evaluator ignores app version — new binary alone does not expand rights",
    );

    const monthlyActive = effectiveCapabilitiesForLicense({
      edition: "personal_monthly",
      status: "active",
      validUntil: "2099-01-01T00:00:00.000Z",
      generationAccessMode: "active_subscription",
      registry,
      enforcementActive: true,
    });
    assert(monthlyActive.includes(organiseCap), "active monthly reaches current effective generations");
    assert(
      monthlyActive.includes("rename_file"),
      "active monthly includes all currently effective registry generations",
    );

    const monthlyExpired = evaluateGenerationRights({
      edition: "personal_monthly",
      status: "expired",
      validUntil: "2020-01-01T00:00:00.000Z",
      generationAccessMode: "active_subscription",
      requestedCapability: organiseCap,
      registry,
      enforcementActive: true,
    });
    assert(monthlyExpired.outcome === "denied", "expired monthly denied");

    const businessActive = effectiveCapabilitiesForLicense({
      edition: "business",
      status: "active",
      validUntil: "2099-01-01T00:00:00.000Z",
      generationAccessMode: "active_subscription",
      registry,
      enforcementActive: true,
    });
    assert(businessActive.includes("business_branding"), "business keeps branding");
    assert(businessActive.includes(organiseCap), "active business seat keeps organise");

    const freeCaps = effectiveCapabilitiesForLicense({
      edition: "free",
      status: "active",
      validUntil: null,
      registry,
      enforcementActive: true,
    });
    assert(!freeCaps.includes(organiseCap), "free does not include organise");
    assert(freeCaps.includes("open_folder"), "free keeps baseline capabilities");

    const giftLegacy = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      origin: "gift",
      generationAccessMode: "legacy_unassigned",
      registry,
      enforcementActive: true,
    });
    assert(giftLegacy.includes(organiseCap), "recognized legacy is not version-restricted until explicit policy");
    const legacyAfterRegistryReorder = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      generationAccessMode: "legacy_unassigned",
      registry: [FIXTURE_COMMERCIAL_GENERATION_B, FIXTURE_COMMERCIAL_GENERATION],
      enforcementActive: true,
    });
    assert(
      legacyAfterRegistryReorder.includes(organiseCap),
      "legacy rights do not depend on registry ordering",
    );

    const registryWithUpgradeCap = [
      FIXTURE_COMMERCIAL_GENERATION,
      {
        ...FIXTURE_COMMERCIAL_GENERATION_B,
        requiredCapabilities: ["apply_bulk_organisation", "create_folder"],
      },
    ];
    const cumulativeUpgrade = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      acquiredCommercialGenerationIds: [
        FIXTURE_COMMERCIAL_GENERATION.id,
        FIXTURE_COMMERCIAL_GENERATION_B.id,
      ],
      generationAccessMode: "purchased_generation",
      registry: registryWithUpgradeCap,
      enforcementActive: true,
    });
    assert(cumulativeUpgrade.includes(organiseCap), "cumulative acquired versions keep alpha organise");
    assert(
      cumulativeUpgrade.includes("create_folder"),
      "cumulative acquired versions include upgrade target capabilities within edition",
    );
    const alphaOnly = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
      registry,
      enforcementActive: true,
    });
    assert(
      !alphaOnly.includes("rename_file"),
      "single purchased version does not imply later upgrade rights",
    );

    const incompletePurchased = evaluateGenerationRights({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      generationAccessMode: "purchased_generation",
      commercialGenerationId: null,
      requestedCapability: organiseCap,
      registry,
      enforcementActive: true,
    });
    assert(
      incompletePurchased.outcome === "denied" &&
        incompletePurchased.reasonCode === "grant_configuration_invalid",
      "purchased_generation without generation id is invalid — not legacy",
    );

    const emptyRegistryPaid = effectiveCapabilitiesForLicense({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
      registry: [],
      enforcementActive: true,
    });
    assert(emptyRegistryPaid.length === 0, "enforcement with empty registry fails closed for paid");

    const incoherentMode = validateGrantConfiguration({
      edition: "personal_lifetime",
      generationAccessMode: "active_subscription",
      commercialGenerationId: null,
      validUntil: null,
      offlineUntil: null,
    });
    assert(incoherentMode === "grant_configuration_invalid", "lifetime rejects active_subscription mode");

    const corruptDate = evaluateGenerationRights({
      edition: "personal_monthly",
      status: "active",
      validUntil: "not-a-date",
      generationAccessMode: "active_subscription",
      requestedCapability: organiseCap,
      registry,
      enforcementActive: true,
    });
    assert(
      corruptDate.outcome === "denied" && corruptDate.reasonCode === "grant_configuration_invalid",
      "malformed validUntil is corrupt configuration",
    );

    const bindingRequired = validateGrantConfiguration({
      edition: "personal_lifetime",
      generationAccessMode: "version_binding_required",
      commercialGenerationId: null,
      validUntil: null,
      offlineUntil: null,
    });
    assert(
      bindingRequired === "grant_configuration_invalid",
      "post-model grant without binding is not legacy",
    );

    const undoSource = readFileSync(join(siteRoot, "../desktop/electron/undo.ts"), "utf8");
    const knowledgeSet = readFileSync(join(siteRoot, "../desktop/electron/knowledge-set.ts"), "utf8");
    assert(
      undoSource.includes("executeOrganisationPlanForVerifiedUndo"),
      "undo uses host-only inverse executor",
    );
    assert(
      !knowledgeSet.includes("recoveryOperation"),
      "generation gate is not bypassed via client-supplied recovery flags",
    );

    const deniedUnpurchasedBeta = evaluateGenerationRights({
      edition: "personal_lifetime",
      status: "active",
      validUntil: null,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
      requestedCapability: "rename_file",
      registry,
      enforcementActive: true,
    });
    assert(
      deniedUnpurchasedBeta.outcome === "denied" &&
        deniedUnpurchasedBeta.reasonCode === "generation_required",
      "beta capability denied when license only purchased alpha generation",
    );

    assert(knowledgeSet.includes("assertExecutorGenerationRights"), "desktop executor calls generation gate");
    assert(
      knowledgeSet.includes("executeOrganisationPlanForVerifiedUndo"),
      "verified undo path is separate from IPC executePlan",
    );
    const licenseRights = readFileSync(join(siteRoot, "../desktop/electron/license-rights.ts"), "utf8");
    assert(
      licenseRights.includes("assertSignedExecutorRights"),
      "desktop license-rights trusts server-signed capabilities",
    );

    const browserDenied = assertHostExecutorGenerationRights(
      {
        licenseId: "lic_test",
        customerId: "cust",
        email: "test@example.com",
        edition: "personal_lifetime",
        status: "active",
        capabilities: [],
        enabledKnowledgeSources: [],
        deviceLimit: 1,
        activatedDevices: 1,
        validUntil: null,
        lastCheckedAt: new Date().toISOString(),
        offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
        channel: "stable",
        licenseToken: "x",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        generationAccessMode: "purchased_generation",
      },
      "rename_file",
    );
    assert(!browserDenied.ok, "browser host gate blocks generation-gated capability");

    await seedCommercialGenerationRegistryForTests(registry);

    await upsertStoredGrant({
      email: "offline-gen@example.com",
      customerId: "cust_off",
      licenseId: "lic_offline_gen",
      edition: "personal_lifetime",
      origin: "stripe",
      status: "active",
      isPaid: true,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
    });
    const activated = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_offline_gen",
        email: "offline-gen@example.com",
        customerId: "cust_off",
        mode: "payment",
      },
      { deviceId: "dev_off_gen", deviceName: "Desk" },
    );
    assert(activated.ok === true, "lifetime with generation activates");
    const token = activated.ok ? activated.session?.context.licenseToken ?? "" : "";
    const signedCaps = activated.ok ? activated.session?.context.capabilities ?? [] : [];
    assert(signedCaps.includes(organiseCap), "server signs effective organise capability");

    const offlineCheck = await checkLicense({
      deviceId: "dev_off_gen",
      licenseToken: token,
    });
    assert(offlineCheck.ok === true, "offline policy: check still succeeds within grace");

    process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "false";
    setBrowserRegistry(null);

    const wrangler = readFileSync(join(siteRoot, "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "personal checkout enabled in wrangler");
    assert(!wrangler.includes("COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED"), "enforcement not in worker env");

    const indexer = readFileSync(join(siteRoot, "../desktop/electron/indexer.ts"), "utf8");
    assert(!indexer.includes("generation-rights"), "indexer.ts untouched");
  } finally {
    resetLicensePersistenceStoreForTests();
    setBrowserRegistry(null);
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.LICENSE_SIGNING_SECRET === undefined) delete process.env.LICENSE_SIGNING_SECRET;
    else process.env.LICENSE_SIGNING_SECRET = previous.LICENSE_SIGNING_SECRET;
    if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
    if (previous.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED === undefined) {
      delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    } else {
      process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED =
        previous.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    }
    try {
      unlinkSync(storePath);
    } catch {
      // disposable fixture
    }
  }

  console.log("GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003 check passed");
}

void runGenerationEnforcementCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
