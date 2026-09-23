/**
 * SIGNED-LICENSE-RIGHTS-DELIVERY-006
 */
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSignedLicenseToken, parseLicenseToken } from "@suhuella/product/lib/license-token-crypto.ts";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import { assertHostExecutorGenerationRights } from "@suhuella/product/host/generation-executor-gate.ts";
import {
  SIGNED_LICENSE_CONTRACT_VERSION,
  assertSignedExecutorRights,
  commercialGenerationPolicyRevision,
  validateSignedLicensePayload,
} from "@suhuella/product/lib/signed-license-contract.ts";
import { buildSignedLicenseContext, readSignedLicenseToken } from "./license-context.ts";
import { FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B } from "./commercial-generations/types.ts";
import { seedCommercialGenerationRegistryForTests } from "./commercial-generations/persistence.ts";
import { activateFromVerifiedCheckout, checkLicense } from "./license-service.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { upsertStoredGrant } from "./license-store.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";
import { signEd25519LicenseTokenBody } from "./license-token-signing.ts";

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const organiseCap = organisationPlanCapability();
const upgradeCap = "rename_file";
const registry = [FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function textToBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function baseLicensePayload() {
  const now = new Date().toISOString();
  return {
    licenseId: "lic_signed_006",
    customerId: "cust_signed",
    email: "signed-006@example.com",
    edition: "personal_lifetime" as const,
    status: "active" as const,
    capabilities: [
      "recommend_folder",
      "create_folder",
      "rename_file",
      "move_file",
      "apply_bulk_organisation",
    ],
    enabledKnowledgeSources: ["local_folder"],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
    channel: "stable" as const,
    commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
    acquiredCommercialGenerationIds: [
      FIXTURE_COMMERCIAL_GENERATION.id,
      FIXTURE_COMMERCIAL_GENERATION_B.id,
    ],
    generationAccessMode: "purchased_generation" as const,
    generationEnforcementActive: true,
    policyRevision: commercialGenerationPolicyRevision(registry),
    signedContractVersion: SIGNED_LICENSE_CONTRACT_VERSION,
  };
}

async function runSignedLicenseRightsDeliveryCheck(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  const previous = {
    LICENSE_SIGNING_PRIVATE_KEY: process.env.LICENSE_SIGNING_PRIVATE_KEY,
    LICENSE_SIGNING_PUBLIC_KEYS: process.env.LICENSE_SIGNING_PUBLIC_KEYS,
    SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS: process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED: process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED,
    NODE_ENV: process.env.NODE_ENV,
  };
  const storePath = `${siteRoot}/.data/signed-license-rights-delivery-check.json`;

  try {
    process.env.NODE_ENV = "development";
    applyTestLicenseSigningEnv(keypair);
    process.env.LICENSE_STORE_PATH = storePath;
    delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;
    resetLicensePersistenceStoreForTests();

    const deliveryDoc = readFileSync(join(siteRoot, "../SIGNED-LICENSE-RIGHTS-DELIVERY-006.md"), "utf8");
    assert(deliveryDoc.includes("STATUS = IN PROGRESS"), "delivery doc tracks asymmetric signing work");

    const payload = baseLicensePayload();
    assert(validateSignedLicensePayload(payload).ok, "base payload validates");
    const signed = await buildSignedLicenseContext(payload);
    assert(signed.licenseToken.startsWith("ed25519."), "server signs with Ed25519 prefix");
    const verified = await readSignedLicenseToken(signed.licenseToken);
    assert(verified?.signedContractVersion === SIGNED_LICENSE_CONTRACT_VERSION, "contract version round-trips");
    assert(verified?.generationEnforcementActive === true, "enforcement bit signed");
    assert(verified?.policyRevision?.startsWith("gen_"), "policy revision signed");

    const parsed = parseLicenseToken(signed.licenseToken);
    assert(parsed?.algorithm === "ed25519", "parsed algorithm is ed25519");
    const tamperedBody = textToBase64Url(
      JSON.stringify({
        ...JSON.parse(Buffer.from(parsed!.body, "base64url").toString("utf8")),
        edition: "enterprise",
      }),
    );
    const tamperedToken = formatSignedLicenseToken("ed25519", tamperedBody, parsed!.signature);
    assert((await readSignedLicenseToken(tamperedToken)) === null, "altered payload rejected");

    const attacker = generateTestLicenseSigningKeypair();
    const forgedToken = signEd25519LicenseTokenBody(parsed!.body, attacker.privateKeyPkcs8Base64);
    assert((await readSignedLicenseToken(forgedToken)) === null, "forged signature from foreign key rejected");

    const executorAllowed = assertSignedExecutorRights(signed, organiseCap);
    assert(executorAllowed.ok, "signed organise capability allowed on host");
    const executorDenied = assertSignedExecutorRights(
      { ...signed, capabilities: signed.capabilities.filter((cap) => cap !== upgradeCap) },
      upgradeCap,
    );
    assert(!executorDenied.ok, "capability absent from signed payload is denied");

    process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";
    const flagOnly = assertSignedExecutorRights(
      {
        ...signed,
        generationEnforcementActive: false,
        capabilities: signed.capabilities.filter((cap) => cap !== organiseCap),
      },
      organiseCap,
    );
    assert(!flagOnly.ok, "local env flag does not grant capabilities without signed rights");
    delete process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED;

    const expired = assertSignedExecutorRights(
      { ...signed, status: "expired", validUntil: "2020-01-01T00:00:00.000Z" },
      organiseCap,
    );
    assert(expired.ok === false && expired.error.code === "license_expired", "expired monthly/lifetime denied");

    const offlineExpired = assertSignedExecutorRights(
      {
        ...signed,
        offlineUntil: "2020-01-01T00:00:00.000Z",
      },
      organiseCap,
    );
    assert(offlineExpired.error.code === "offline_expired", "offline limit enforced from signed dates");

    const offlineGrace = assertSignedExecutorRights(
      {
        ...signed,
        lastCheckedAt: "2020-01-01T00:00:00.000Z",
        offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
      },
      organiseCap,
    );
    assert(offlineGrace.ok, "stored token within offlineUntil works without refresh");

    const corruptDates = validateSignedLicensePayload({
      ...payload,
      offlineUntil: "not-a-date",
    });
    assert(!corruptDates.ok && corruptDates.reason === "corrupt_dates", "invalid dates rejected after verify");

    const policyTamper = validateSignedLicensePayload({
      ...payload,
      policyRevision: "gen_deadbeef",
      capabilities: [...payload.capabilities, "business_branding"],
    });
    assert(
      !policyTamper.ok && policyTamper.reason === "capabilities_exceed_edition",
      "manipulated policy/capabilities fail coherence check",
    );

    const legacyPayload = {
      licenseId: "lic_legacy_token",
      customerId: "cust_legacy",
      email: "legacy-token@example.com",
      edition: "personal_lifetime" as const,
      status: "active" as const,
      capabilities: payload.capabilities,
      enabledKnowledgeSources: ["local_folder"],
      deviceLimit: 1,
      activatedDevices: 1,
      validUntil: null,
      lastCheckedAt: payload.lastCheckedAt,
      offlineUntil: payload.offlineUntil,
      channel: "stable" as const,
      generationAccessMode: "legacy_unassigned" as const,
    };
    const legacyValidation = validateSignedLicensePayload(legacyPayload);
    assert(legacyValidation.ok && legacyValidation.legacyToken, "pre-006 token shape accepted");

    await seedCommercialGenerationRegistryForTests(registry, [
      {
        priceId: "price_test_lifetime_gen",
        commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
        product: "lifetime",
      },
    ]);
    await upsertStoredGrant({
      email: "signed-flow@example.com",
      customerId: "cust_flow",
      licenseId: "lic_signed_flow",
      edition: "personal_lifetime",
      origin: "stripe",
      status: "active",
      isPaid: true,
      commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
      generationAccessMode: "purchased_generation",
    });
    const activated = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_signed_flow",
        email: "signed-flow@example.com",
        customerId: "cust_flow",
        mode: "payment",
      },
      { deviceId: "dev_signed_flow", deviceName: "Desk" },
    );
    assert(activated.ok, "activation issues signed context");
    const token = activated.ok ? activated.session?.context.licenseToken ?? "" : "";
    const flowCaps = activated.ok ? activated.session?.context.capabilities ?? [] : [];
    assert(flowCaps.includes(organiseCap), "server signs effective capabilities from grant");
    assert(token.startsWith("ed25519."), "activation token uses Ed25519");

    const sameDevice = await checkLicense({
      deviceId: "dev_signed_flow",
      licenseToken: token,
    });
    assert(sameDevice.ok, "checkLicense refreshes signed rights for same device");

    const otherDevice = await checkLicense({
      deviceId: randomUUID(),
      licenseToken: token,
    });
    assert(otherDevice.ok === false && otherDevice.error === "device_limit", "other device rejected by server");

    const browserGate = assertHostExecutorGenerationRights(
      activated.ok ? activated.session?.context ?? null : null,
      organiseCap,
    );
    assert(browserGate.ok, "browser host gate reads signed capabilities");

    const licenseService = readFileSync(join(siteRoot, "lib/license-service.ts"), "utf8");
    const licenseStore = readFileSync(join(siteRoot, "../desktop/electron/license-store.ts"), "utf8");
    const licenseSignatureVerify = readFileSync(
      join(siteRoot, "../desktop/electron/license-signature-verify.ts"),
      "utf8",
    );
    const licenseRights = readFileSync(join(siteRoot, "../desktop/electron/license-rights.ts"), "utf8");
    assert(licenseService.includes("LICENSE_SIGNING_PRIVATE_KEY"), "server uses private signing key");
    assert(licenseSignatureVerify.includes("parseLicenseToken"), "desktop dual-verify parses license tokens");
    assert(
      licenseSignatureVerify.includes("legacy-hmac-online-attested"),
      "desktop HMAC grace without embedded secret",
    );
    assert(!licenseSignatureVerify.includes("SUHUELLA_LICENSE_VERIFY_SECRET"), "desktop does not embed HMAC secret");
    assert(licenseStore.includes("verifyLicenseSignature"), "license store delegates to signature verify");
    assert(licenseRights.includes("assertSignedExecutorRights"), "desktop executor uses signed contract");

    const wrangler = readFileSync(join(siteRoot, "wrangler.jsonc"), "utf8");
    assert(!wrangler.includes('"COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED": "true"'), "enforcement not activated");
  } finally {
    resetLicensePersistenceStoreForTests();
    for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      unlinkSync(storePath);
    } catch {
      // ignore
    }
  }

  console.log("SIGNED-LICENSE-RIGHTS-DELIVERY-006 check passed");
}

void runSignedLicenseRightsDeliveryCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
