/**
 * macOS implementation of Release Validation.
 * Called by `npm run validate-release -- --platform mac`.
 * Same checks Gatekeeper uses — do not upload until all PASS.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../../brands/select.mjs";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const version = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8")).version;
const appPath = path.join(
  desktopRoot,
  ".build",
  brandId,
  "release",
  "mac-arm64",
  `${identity.desktopProductName}.app`,
);
const dmgPath = path.join(
  desktopRoot,
  ".build",
  brandId,
  "release",
  `${identity.desktopProductName}-${version}.dmg`,
);

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 120000 });
}

function block(reason, detail = "") {
  console.error("macOS release validation FAIL\n");
  console.error(reason);
  if (detail.trim()) {
    console.error("");
    console.error(detail.trim());
  }
  console.error("");
  console.error("Publishing an unsigned or unnotarized DMG would fail the install/launch gate.");
  process.exit(1);
}

if (!existsSync(appPath)) {
  block(`Application bundle missing: ${appPath}`, "Run npm run package:mac --prefix desktop first.");
}
if (!existsSync(dmgPath)) {
  block(`DMG missing: ${dmgPath}`, "Run npm run package:mac --prefix desktop first.");
}

const verify = run("codesign", ["--verify", "--deep", "--strict", appPath]);
if (verify.status !== 0) {
  block(
    "Application bundle failed codesign --verify --deep --strict.",
    verify.stderr || verify.stdout,
  );
}

const display = run("codesign", ["-dv", "--verbose=4", appPath]);
const appDetails = `${display.stderr}\n${display.stdout}`;

if (/Signature=adhoc/.test(appDetails)) {
  block(
    "Application is not signed with a valid Developer ID Application identity.",
    "Install the Developer ID Application certificate and set CSC_NAME, then re-run package:mac.",
  );
}

if (!/Authority=Developer ID Application/.test(appDetails)) {
  block(
    "Application is not signed with a valid Developer ID Application identity.",
    appDetails.trim(),
  );
}

if (/TeamIdentifier=not set/.test(appDetails) || !/TeamIdentifier=[A-Z0-9]+/.test(appDetails)) {
  block("Application has no TeamIdentifier.", appDetails.trim());
}

const expectedId = identity.desktopAppId;
const idPattern = new RegExp(`Identifier=${expectedId.replace(/\./g, "\\.")}\\b`);
if (!idPattern.test(appDetails)) {
  block(
    `Application Identifier is not ${expectedId}.`,
    appDetails.trim(),
  );
}

const assess = run("spctl", ["--assess", "--type", "execute", "-vv", appPath]);
if (assess.status !== 0) {
  block(
    "Application is not accepted by Gatekeeper (spctl --assess failed).",
    `${assess.stderr}\n${assess.stdout}`,
  );
}

const dmgDisplay = run("codesign", ["-dv", "--verbose=4", dmgPath]);
const dmgDetails = `${dmgDisplay.stderr}\n${dmgDisplay.stdout}`;
if (dmgDisplay.status !== 0 || !/Authority=Developer ID Application/.test(dmgDetails)) {
  block(
    "DMG is not signed with a valid Developer ID Application identity.",
    "Re-run package:mac after installing the certificate (seal-mac-dmg signs the DMG).",
  );
}

const staple = run("xcrun", ["stapler", "validate", dmgPath]);
if (staple.status !== 0) {
  block(
    "DMG notarization ticket is missing or invalid (stapler validate failed).",
    staple.stderr || staple.stdout,
  );
}

console.log("✓ Artifact built");
console.log(`✓ Artifact verified (Identifier=${expectedId})`);
console.log("✓ Artifact signed (Developer ID Application + TeamIdentifier)");
console.log("✓ Artifact trusted by OS (codesign --verify · spctl --assess · stapler)");
console.log("✓ Artifact installable (signed + notarized DMG)");
