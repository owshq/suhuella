/**
 * Post-build bundle integrity (package:mac only).
 * Checks CFBundleIdentifier and adhoc/resigned codesign — not release validation.
 * Publish requires `npm run validate-release -- --platform mac` (Developer ID + notarization).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../../brands/select.mjs";
import { isDeveloperIdIdentity, resolveMacCodesignIdentity } from "./mac-signing.mjs";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const appPath = path.join(
  desktopRoot,
  ".build",
  brandId,
  "release",
  "mac-arm64",
  `${identity.desktopProductName}.app`,
);

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8" });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const plist = run("plutil", ["-extract", "CFBundleIdentifier", "raw", `${appPath}/Contents/Info.plist`]);
const bundleId = plist.stdout.trim();
if (bundleId !== identity.desktopAppId) {
  fail(`CFBundleIdentifier is ${bundleId || "(missing)"}, expected ${identity.desktopAppId}`);
}

const verify = run("codesign", ["--verify", "--deep", "--strict", appPath]);
if (verify.status !== 0) {
  fail(`codesign --verify --deep --strict FAILED\n${verify.stderr || verify.stdout}`);
}
console.log("OK   codesign --verify --deep --strict");

const display = run("codesign", ["-dv", "--verbose=4", appPath]);
const details = `${display.stderr}\n${display.stdout}`;
if (/Identifier=Electron\b/.test(details) && !/Identifier=com\.suhuella\.desktop/.test(details)) {
  fail("codesign Identifier is still Electron — bundle was not resigned");
}
if (!new RegExp(`Identifier=${identity.desktopAppId.replace(/\./g, "\\.")}`).test(details)) {
  console.warn(`WARN codesign Identifier did not print ${identity.desktopAppId}`);
  console.warn(details);
}

const assess = run("spctl", ["--assess", "--type", "execute", "-vv", appPath]);
const assessOut = `${assess.stderr}\n${assess.stdout}`;
console.log(assessOut.trim());

const signingIdentity = resolveMacCodesignIdentity();
if (isDeveloperIdIdentity(signingIdentity) && assess.status !== 0) {
  fail("spctl --assess FAILED for Developer ID build");
}
if (!isDeveloperIdIdentity(signingIdentity)) {
  console.log(
    "OK   codesign verify PASS; spctl cannot PASS until Developer ID + notarization (no identity on this machine)",
  );
} else if (assess.status === 0) {
  console.log("OK   spctl --assess");
}
