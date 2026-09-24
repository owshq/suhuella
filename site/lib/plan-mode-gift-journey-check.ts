/**
 * Plan Mode gift journey — production SPKI, gift grant (no Stripe), temp-file executor.
 * Evidence for pre-rc desktop smoke; does not replace Live Stripe checkout smoke.
 */
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { organisationPlanCapability } from "@suhuella/product/lib/generation-capabilities.ts";
import { assertSignedExecutorRights } from "@suhuella/product/lib/signed-license-contract.ts";
import { resolvePlanComposerScope } from "@suhuella/product/lib/plan-composer-scope.ts";
import { PLAN_PROMPT_ACTIONS } from "@suhuella/product/lib/organise-copy.ts";
import type { IndexedLocationSummary, SearchHit } from "@suhuella/product/types.ts";
import { readSignedLicenseToken } from "./license-context.ts";
import { FIXTURE_COMMERCIAL_GENERATION } from "./commercial-generations/types.ts";
import { seedCommercialGenerationRegistryForTests } from "./commercial-generations/persistence.ts";
import {
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import { activateLicense } from "./license-service.ts";
import { normalizeLicenseGrant } from "./license-entitlement.ts";
import { upsertStoredGrant } from "./license-store.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";

const siteRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = join(siteRoot, "..");
const desktopRoot = join(repoRoot, "desktop");
const brandBuildRoot = join(desktopRoot, ".build", "suhuella");
const organiseCap = organisationPlanCapability();
const GIFT_EMAIL = "gift-journey@smoke.suhuella.test";
const DEVICE = "dev_plan_gift_journey";

type Step = {
  step: string;
  result: "PASS" | "FAIL" | "SKIP";
  detail?: string;
  scopeItems?: number;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requireProductionKeys(): { fingerprint?: string } {
  const privateKey = process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim();
  const publicKeys = process.env.LICENSE_SIGNING_PUBLIC_KEYS?.trim();
  const verifyKeys = process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim();
  assert(privateKey && publicKeys && verifyKeys, "LICENSE_SIGNING_* and SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS required");
  assert(publicKeys === verifyKeys, "desktop verify keys must match Worker signing public key");
  delete process.env.LICENSE_SIGNING_SECRET;
  return { fingerprint: process.env.LICENSE_PRODUCTION_FINGERPRINT?.trim() || undefined };
}

async function seedProof(email: string): Promise<string> {
  const proofId = `vep_gift_journey_${randomUUID()}`;
  await withLicensePersistence((document) => {
    document.proofs.push({
      id: proofId,
      normalizedEmail: email,
      purpose: "LICENSE_ACTIVATION",
      deviceId: null,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      consumedAt: null,
      createdAt: new Date().toISOString(),
    });
  });
  return proofId;
}

function runDesktopExecutor(context: unknown): void {
  const e2eOutDir = join(desktopRoot, ".build/desktop-e2e");
  mkdirSync(e2eOutDir, { recursive: true });
  const outFile = join(e2eOutDir, "plan-mode-gift-journey-executor.cjs");
  execSync(
    [
      "npx esbuild",
      join(desktopRoot, "electron/license-version-e2e-executor-check.ts"),
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
  execSync(`node -r ${join(desktopRoot, "electron/test-electron-mock.cjs")} ${outFile}`, {
    cwd: desktopRoot,
    env: {
      ...process.env,
      LICENSE_E2E_SIGNED_CONTEXT: JSON.stringify(context),
      LICENSE_E2E_EXPECT_RENAME: "false",
    },
    stdio: "pipe",
  });
}

const demoHits: SearchHit[] = [
  {
    id: "src_dev_demo:invoices/factura-enero.pdf",
    kind: "file",
    title: "factura-enero.pdf",
    subtitle: "dev-data",
    path: "src_dev_demo:invoices/factura-enero.pdf",
    folderPath: "invoices",
    extension: "pdf",
    documentFilter: "pdf",
    lastSeenAt: null,
    matchedOn: ["filename"],
    sourceName: "dev-data",
  },
  {
    id: "src_dev_demo:notes/nota-reunion.txt",
    kind: "file",
    title: "nota-reunion.txt",
    subtitle: "dev-data",
    path: "src_dev_demo:notes/nota-reunion.txt",
    folderPath: "notes",
    extension: "txt",
    documentFilter: null,
    lastSeenAt: null,
    matchedOn: ["filename"],
    sourceName: "dev-data",
  },
  {
    id: "src_dev_demo:IMG_0042.JPG",
    kind: "file",
    title: "IMG_0042.JPG",
    subtitle: "dev-data",
    path: "src_dev_demo:IMG_0042.JPG",
    folderPath: "",
    extension: "jpg",
    documentFilter: null,
    lastSeenAt: null,
    matchedOn: ["filename"],
    sourceName: "dev-data",
  },
];

const indexedDevData: IndexedLocationSummary[] = [
  {
    path: "src_dev_demo",
    name: "dev-data",
    lastIndexed: null,
    folderCount: 2,
    fileCount: demoHits.length,
    status: "ready",
    usefulness: "useful",
    exists: true,
  },
];

function demoSearch(query: string): SearchHit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  return demoHits.filter((hit) => {
    const hay = `${hit.title} ${hit.subtitle ?? ""} ${hit.path ?? ""} ${hit.extension ?? ""}`.toLowerCase();
    return tokens.every((token) => hay.includes(token));
  });
}

async function runPreparePlanActionChecks(steps: Step[]): Promise<void> {
  for (const action of PLAN_PROMPT_ACTIONS) {
    const scope = await resolvePlanComposerScope(
      action.prompt,
      async (query) => demoSearch(query),
      {
        suggested: [],
        indexed: indexedDevData,
        host: "browser",
        platform: "darwin",
      },
    );
    const ok =
      action.id === "group-by-category"
        ? scope.items.length > 0 && scope.documentHintIds.includes("invoice")
        : scope.items.length > 0 && !scope.strictSourceDocumentPending;
    steps.push({
      step: `prepare-plan-action:${action.id}`,
      result: ok ? "PASS" : "FAIL",
      scopeItems: scope.items.length,
      detail: action.label,
    });
    assert(ok, `Prepare Plan action "${action.label}" resolved scope (${scope.items.length} items)`);
  }
}

export async function runPlanModeGiftJourneyCheck(): Promise<void> {
  const steps: Step[] = [];
  const keyInfo = requireProductionKeys();

  const d1Handle = openFreshLocalD1Adapter(siteRoot);
  resetLicensePersistenceStoreForTests();
  setLicensePersistenceDatabaseForTests(d1Handle.adapter);
  await seedCommercialGenerationRegistryForTests([FIXTURE_COMMERCIAL_GENERATION]);

  try {
    process.env.NODE_ENV = "development";
    process.env.COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED = "true";

    await upsertStoredGrant(
      normalizeLicenseGrant({
        email: GIFT_EMAIL,
        customerId: "cust_gift_journey",
        licenseId: "lic_gift_journey_smoke",
        edition: "personal_lifetime",
        origin: "gift",
        status: "active",
        generationAccessMode: "legacy_unassigned",
      }),
    );
    steps.push({ step: "gift-grant-created", result: "PASS", detail: "origin=gift, no Stripe" });

    const proofId = await seedProof(GIFT_EMAIL);
    const activated = await activateLicense({
      emailProofId: proofId,
      deviceId: DEVICE,
      deviceName: "Plan Mode smoke",
      platform: process.platform === "win32" ? "windows" : "mac",
    });
    assert(activated.ok && activated.session?.context.licenseToken.startsWith("ed25519."), "gift activation returns Ed25519 token");
    const verified = await readSignedLicenseToken(activated.session!.context.licenseToken);
    assert(verified?.capabilities.includes(organiseCap), "organise capability signed on gift activation");
    steps.push({
      step: "gift-license-activation",
      result: "PASS",
      detail: `SPKI ${keyInfo.fingerprint ?? "production"}`,
    });

    const organiseRights = assertSignedExecutorRights(activated.session!.context, organiseCap);
    assert(organiseRights.ok, "organise rights gate passes before Plan executor");
    steps.push({ step: "organise-rights-gate", result: "PASS" });

    runDesktopExecutor(activated.session!.context);
    steps.push({ step: "desktop-plan-executor-temp-files", result: "PASS", detail: "move on temp dirs, no delete_file" });

    await runPreparePlanActionChecks(steps);

    const report = {
      updatedAt: new Date().toISOString(),
      journey: "plan-mode-gift-temp-files",
      giftEmail: GIFT_EMAIL,
      licenseId: "lic_gift_journey_smoke",
      spctlNote: "Mac spctl EXPECTED_UNSIGNED_REJECTION does not block pre-rc — separate smoke-pre-rc-desktop",
      stripeNote: "Does not replace Live Stripe checkout smoke",
      steps,
      operatorChecklistRemaining: [
        "Install exact candidate bytes on clean machine",
        "Activate Operations gift against production Worker (same SPKI as embedded build)",
        "Plan Mode: confirm move/rename/undo on real indexed folder",
      ],
    };

    mkdirSync(brandBuildRoot, { recursive: true });
    const reportPath = join(brandBuildRoot, "PLAN-MODE-GIFT-JOURNEY.json");
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Evidence: ${reportPath}`);
    console.log("plan-mode-gift-journey-check PASS");
  } finally {
    d1Handle.db.close();
  }
}

void runPlanModeGiftJourneyCheck().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
