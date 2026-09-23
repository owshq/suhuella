/**
 * Builds signed fixture payloads for browser-license-gate-playwright.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import { buildSignedLicenseContext } from "./license-context.ts";
import { FIXTURE_COMMERCIAL_GENERATION, FIXTURE_COMMERCIAL_GENERATION_B } from "./commercial-generations/types.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const organiseCap = organisationPlanCapability();
const upgradeCap = "rename_file";

async function main(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  applyTestLicenseSigningEnv(keypair);
  const now = new Date().toISOString();
  const offlineUntil = new Date(Date.now() + 86_400_000).toISOString();

  const preUpgrade = await buildSignedLicenseContext({
    licenseId: "lic_browser_gate_pre",
    customerId: "cust_browser_gate",
    email: "browser-gate@fixture.test",
    edition: "personal_lifetime",
    status: "active",
    capabilities: ["create_folder", "move_file", organiseCap],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil,
    channel: "stable",
    commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
    acquiredCommercialGenerationIds: [FIXTURE_COMMERCIAL_GENERATION.id],
    generationAccessMode: "purchased_generation",
    generationEnforcementActive: true,
  });

  const postUpgrade = await buildSignedLicenseContext({
    licenseId: "lic_browser_gate_pre",
    customerId: "cust_browser_gate",
    email: "browser-gate@fixture.test",
    edition: "personal_lifetime",
    status: "active",
    capabilities: ["create_folder", "rename_file", "move_file", organiseCap],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil,
    channel: "stable",
    commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
    acquiredCommercialGenerationIds: [FIXTURE_COMMERCIAL_GENERATION.id, FIXTURE_COMMERCIAL_GENERATION_B.id],
    generationAccessMode: "purchased_generation",
    generationEnforcementActive: true,
  });

  const payload = {
    publicKeySpkiBase64: keypair.publicKeySpkiBase64,
    cases: [
      { id: "pre-organise", capability: organiseCap, expectOk: true, context: preUpgrade },
      { id: "pre-rename", capability: upgradeCap, expectOk: false, context: preUpgrade },
      { id: "post-organise", capability: organiseCap, expectOk: true, context: postUpgrade },
      { id: "post-rename", capability: upgradeCap, expectOk: true, context: postUpgrade },
    ],
  };

  const outDir = join(siteRoot, ".data/browser-license-gate");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "fixture.json"), `${JSON.stringify(payload)}\n`, "utf8");
  console.log(join(outDir, "fixture.json"));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
