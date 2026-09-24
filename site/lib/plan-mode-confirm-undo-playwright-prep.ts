/**
 * Signed gift license fixture for Plan Mode confirm/undo Playwright (localhost dev-data VFS).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import { buildSignedLicenseContext } from "./license-context.ts";
import { FIXTURE_COMMERCIAL_GENERATION } from "./commercial-generations/types.ts";
import { seedCommercialGenerationRegistryForTests } from "./commercial-generations/persistence.ts";

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = join(siteRoot, "..");
const outDir = join(siteRoot, ".data/plan-mode-confirm-undo");
const keyPath = join(repoRoot, "desktop/.build/suhuella/LICENSE-PRODUCTION-KEYPAIR.json");
const organiseCap = organisationPlanCapability();

function loadProductionKeys(): { fingerprint: string } {
  if (process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim() && process.env.LICENSE_SIGNING_PUBLIC_KEYS?.trim()) {
    return { fingerprint: process.env.LICENSE_PRODUCTION_FINGERPRINT ?? "env" };
  }
  if (!existsSync(keyPath)) {
    throw new Error(`Missing ${keyPath} — run provision-license-ed25519-production.mjs --write-local`);
  }
  const keypair = JSON.parse(readFileSync(keyPath, "utf8"));
  process.env.LICENSE_SIGNING_PRIVATE_KEY = keypair.privateKeyPkcs8Base64;
  process.env.LICENSE_SIGNING_PUBLIC_KEYS = keypair.publicKeySpkiBase64;
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64;
  delete process.env.LICENSE_SIGNING_SECRET;
  return { fingerprint: keypair.fingerprint };
}

async function main(): Promise<void> {
  const { fingerprint } = loadProductionKeys();
  Object.assign(process.env, { NODE_ENV: "development" });
  process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";
  await seedCommercialGenerationRegistryForTests([FIXTURE_COMMERCIAL_GENERATION]);

  const now = new Date().toISOString();
  const license = await buildSignedLicenseContext({
    licenseId: "lic_playwright_gift_confirm_undo",
    customerId: "cust_playwright_gift",
    email: "gift-playwright@smoke.suhuella.test",
    edition: "personal_lifetime",
    status: "active",
    capabilities: ["create_folder", "move_file", "rename_file", organiseCap],
    deviceLimit: 2,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil: new Date(Date.now() + 86_400_000).toISOString(),
    channel: "stable",
    commercialGenerationId: FIXTURE_COMMERCIAL_GENERATION.id,
    acquiredCommercialGenerationIds: [FIXTURE_COMMERCIAL_GENERATION.id],
    generationAccessMode: "purchased_generation",
    generationEnforcementActive: true,
  });

  mkdirSync(outDir, { recursive: true });
  const fixture = {
    fingerprint,
    license,
    permissions: { allowFolderChanges: true, allowNotifications: true, allowDiagnostics: true },
  };
  writeFileSync(join(outDir, "fixture.json"), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(join(outDir, "fixture.json"));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
