/**
 * Release Validation — same contract for every platform.
 *
 *   npm run validate-release -- --platform mac
 *   npm run validate-release -- --platform windows
 *   npm run validate-release -- --platform linux
 *
 * Questions (identical on every OS):
 *   Artifact built?
 *   Artifact verified?
 *   Artifact signed?
 *   Artifact trusted by OS?
 *   Artifact installable?
 *
 * Publish must refuse if this fails. Platform scripts implement the checks.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCommercialSigningDeferred, printCommercialSigningSkipped } from "./commercial-signing.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const platformArg =
  process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1] ??
  process.argv[process.argv.indexOf("--platform") + 1] ??
  "";

const PLATFORM = {
  mac: { label: "macOS", script: path.join(root, "desktop/scripts/require-mac-release-signing.mjs") },
  windows: { label: "Windows", script: path.join(root, "scripts/validate-release-windows.mjs") },
  linux: { label: "Linux", script: null },
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!platformArg || !PLATFORM[platformArg]) {
  fail("Usage: npm run validate-release -- --platform mac|windows|linux");
}

const spec = PLATFORM[platformArg];

if (platformArg === "mac" || platformArg === "windows") {
  if (isCommercialSigningDeferred()) {
    printCommercialSigningSkipped(spec.label);
    process.exit(0);
  }
}

console.log("ReleaseValidation");
console.log(`Platform: ${spec.label}`);
console.log("");

if (!spec.script) {
  fail(`${spec.label} is not opened. No validator until that platform is in the release contract.`);
}

const result = spawnSync(process.execPath, [spec.script], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error("");
  console.error("ReleaseValidation FAIL — publish must stop.");
  process.exit(result.status ?? 1);
}

console.log("");
console.log("ReleaseValidation PASS");
