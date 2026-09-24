/**
 * Prepare a pre-rc desktop installer candidate (does NOT publish or update release.json aliases).
 *
 *   node scripts/prepare-desktop-candidate.mjs --platform mac
 *   node scripts/prepare-desktop-candidate.mjs --platform mac --from-dev-vars
 *
 * Windows: run on windows-latest CI (workflow_dispatch) — this script validates GitHub assets only.
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../brands/select.mjs";
import { sha256File, formatSha256Sidecar } from "./release-artifact-sha256.mjs";
import { detectMacCodesignState } from "./mac-codesign-detect.mjs";
import { buildDistributionRecord } from "./commercial-signing.mjs";
import { assertLicenseVerifyPublicKeysEnv } from "../desktop/scripts/license-verify-public-keys.mjs";
import {
  describeLicenseKeyProvenance,
  formatLicenseKeyProvenanceSummary,
} from "../desktop/scripts/license-key-provenance.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = path.join(root, "desktop");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const version = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8")).version;
const platform =
  process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1] ??
  process.argv[process.argv.indexOf("--platform") + 1] ??
  "";
const fromDevVars = process.argv.includes("--from-dev-vars");
const skipPackage = process.argv.includes("--skip-package");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed (${result.status})`);
}

function loadVerifyKeysFromDevVars(force = false) {
  if (!force && process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim()) return;
  const devVarsPath = path.join(root, "site/.dev.vars");
  let content = "";
  try {
    content = readFileSync(devVarsPath, "utf8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("LICENSE_SIGNING_PUBLIC_KEYS=")) {
      const value = trimmed.slice("LICENSE_SIGNING_PUBLIC_KEYS=".length).trim();
      if (value) {
        process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = value;
        console.log("[candidate] SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS loaded from site/.dev.vars LICENSE_SIGNING_PUBLIC_KEYS");
      }
    }
  }
}

async function prepareMac() {
  if (process.platform !== "darwin") fail("Mac candidate must be built on macOS (npm run package:mac --prefix desktop).");

  if (fromDevVars) loadVerifyKeysFromDevVars(true);
  else {
    const keypairPath = path.join(desktopRoot, ".build", brandId, "LICENSE-PRODUCTION-KEYPAIR.json");
    try {
      const keypair = JSON.parse(readFileSync(keypairPath, "utf8"));
      if (keypair.publicKeySpkiBase64?.trim()) {
        process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64.trim();
        console.log(`[candidate] SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS loaded from ${keypairPath}`);
      }
    } catch {
      // optional — operator may set env explicitly
    }
  }
  assertLicenseVerifyPublicKeysEnv({ requireDesktop: true });

  if (!skipPackage) {
    run("npm", ["run", "package:mac"], desktopRoot);
  }

  run(process.execPath, ["scripts/validate-release.mjs", "--platform", "mac"], root);

  const dmgPath = path.join(
    desktopRoot,
    ".build",
    brandId,
    "release",
    `${identity.desktopProductName}-${version}.dmg`,
  );
  const appPath = path.join(
    desktopRoot,
    ".build",
    brandId,
    "release",
    "mac-arm64",
    `${identity.desktopProductName}.app`,
  );
  const sha256 = await sha256File(dmgPath);
  const size = statSync(dmgPath).size;
  const macSigning = detectMacCodesignState(appPath, dmgPath);
  const sidecarPath = `${dmgPath}.sha256`;
  writeFileSync(sidecarPath, formatSha256Sidecar(sha256, path.basename(dmgPath)), "utf8");

  const licenseKeys = describeLicenseKeyProvenance();
  const report = {
    status: "candidate-ready-not-published",
    platform: "mac",
    version,
    file: dmgPath,
    filename: path.basename(dmgPath),
    size,
    sha256,
    sidecar: sidecarPath,
    distribution: buildDistributionRecord(version, { mac: macSigning }),
    licenseKeys,
    validation: licenseKeys.productionCompatible
      ? "PreRcReleaseValidation PASS — partial technical validation (production SPKI)"
      : "PreRcReleaseValidation PASS — partial technical validation only (not production license compatible)",
    notes: [
      "Not published — release.json / download aliases unchanged",
      "PreRcReleaseValidation PASS = integrity + embed, not install/launch/Plan Mode approval",
      licenseKeys.ephemeral
        ? "Ephemeral license keys — cannot activate against production Worker"
        : licenseKeys.productionCompatible
          ? "Production SPKI embedded — ready for gift/test activation smoke before publish"
          : "License keys present but not confirmed production-compatible",
      "Gatekeeper/SmartScreen warnings are expected and do not block pre-rc publish",
    ],
  };

  const reportPath = path.join(desktopRoot, ".build", brandId, "CANDIDATE-mac.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("");
  console.log("Mac candidate prepared (NOT published)");
  console.log(`File: ${dmgPath}`);
  console.log(`Size: ${size} bytes`);
  console.log(`SHA256: ${sha256}`);
  console.log(`Sidecar: ${sidecarPath}`);
  console.log(`Report: ${reportPath}`);
}

async function prepareWindowsValidateOnly() {
  run(process.execPath, ["scripts/validate-release.mjs", "--platform", "windows"], root);
  console.log("");
  console.log("Windows candidate validation complete (artifact must come from windows-latest CI package:win).");
  console.log(formatLicenseKeyProvenanceSummary(describeLicenseKeyProvenance()));
  console.log("PreRcReleaseValidation = partial technical validation — SmartScreen warning expected, not a gate");
}

async function main() {
  if (platform === "mac") {
    await prepareMac();
    return;
  }
  if (platform === "windows") {
    await prepareWindowsValidateOnly();
    return;
  }
  fail("Usage: node scripts/prepare-desktop-candidate.mjs --platform mac|windows [--from-dev-vars] [--skip-package]");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
