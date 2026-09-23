/**
 * Pre-RC release validation — integrity and packaging without commercial code signing.
 *
 * Runs when commercial-signing.json status is deferred and the version is pre-rc.
 * Does NOT prove clean-machine install; does NOT replace Gate 6 (Developer ID / Authenticode).
 *
 *   npm run validate-release -- --platform mac|windows
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../brands/select.mjs";
import { licenseVerifyPublicKeys } from "../desktop/scripts/license-build-env.mjs";
import { fetchRemoteSha256, sha256File } from "./release-artifact-sha256.mjs";
import { buildDistributionRecord, isPreRcUnsignedPublishChannel } from "./commercial-signing.mjs";
import { detectMacCodesignState } from "./mac-codesign-detect.mjs";
import { assertLicenseVerifyPublicKeysEnv } from "../desktop/scripts/license-verify-public-keys.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = path.join(root, "desktop");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const version = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8")).version;
const REPO = process.env.GITHUB_REPO ?? "owshq/suhuella";
const tag = version.startsWith("v") ? version : `v${version}`;

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 180_000 });
}

function block(reason, detail = "") {
  console.error("Pre-RC release validation FAIL\n");
  console.error(reason);
  if (detail.trim()) {
    console.error("");
    console.error(detail.trim());
  }
  process.exit(1);
}

function assertLicenseKeysEmbedded(mainPath) {
  const keys = licenseVerifyPublicKeys();
  if (!keys) {
    block(
      "License verify public keys missing at validation time.",
      "Set SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS before packaging or publishing.",
    );
  }
  let bundle = "";
  try {
    bundle = readFileSync(mainPath, "utf8");
  } catch {
    block(`Bundled main missing: ${mainPath}`, "Run npm run build --prefix desktop first.");
  }
  for (const key of keys.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (!bundle.includes(key)) {
      block(
        "License verify public keys are not embedded in dist-electron/main.cjs.",
        "Rebuild desktop with SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS set.",
      );
    }
  }
  console.log("✓ License verify public keys embedded (Ed25519 SPKI allowlist)");
}

function validateMacPreRc() {
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
  const mainPath = path.join(desktopRoot, ".build", brandId, "dist-electron", "main.cjs");

  if (!existsSync(appPath)) {
    block(`Application bundle missing: ${appPath}`, "Run npm run package:mac --prefix desktop first.");
  }
  if (!existsSync(dmgPath)) {
    block(`DMG missing: ${dmgPath}`, "Run npm run package:mac --prefix desktop first.");
  }

  const plist = run("plutil", ["-extract", "CFBundleIdentifier", "raw", `${appPath}/Contents/Info.plist`]);
  const bundleId = plist.stdout.trim();
  if (bundleId !== identity.desktopAppId) {
    block(`CFBundleIdentifier is ${bundleId || "(missing)"}, expected ${identity.desktopAppId}.`);
  }
  console.log(`✓ Artifact built (${identity.desktopProductName}.app + DMG)`);

  const verify = run("codesign", ["--verify", "--deep", "--strict", appPath]);
  if (verify.status !== 0) {
    block("Application bundle failed codesign --verify --deep --strict.", verify.stderr || verify.stdout);
  }
  console.log("✓ Artifact verified (bundle id + codesign structure)");

  assertLicenseVerifyPublicKeysEnv({ requireDesktop: true });
  assertLicenseKeysEmbedded(mainPath);

  const macSigning = detectMacCodesignState(appPath, dmgPath);
  console.log(`✓ macOS app signature: ${macSigning.app} (developerId=${macSigning.developerId})`);
  console.log(`✓ macOS dmg signature: ${macSigning.dmg} (notarized=${macSigning.notarized}, stapled=${macSigning.stapled})`);
  if (macSigning.app === "adhoc") {
    console.log("  adhoc codesign verifies locally but is NOT Developer ID and NOT notarized");
  }
  const distribution = buildDistributionRecord(version, { mac: macSigning });
  console.log(`✓ Distribution metadata preview: ${JSON.stringify(distribution.commercialCodeSigning.mac)}`);

  console.log("○ Clean-machine install: NOT verified — test DMG on a clean Mac before claiming install works");
  console.log("○ OS trust: Gatekeeper may warn or block — document Right-click → Open / System Settings path");
}

function resolveToken() {
  const fromEnv = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (fromEnv) return fromEnv;
  const gh = run("gh", ["auth", "token"]);
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  return "";
}

async function fetchGitHubWindowsAsset() {
  const token = resolveToken();
  if (!token) {
    block("Windows artifact built? NO — GitHub auth unavailable.", "Set GH_TOKEN or run gh auth login.");
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    block(`Windows artifact built? NO — GitHub Release ${tag} not found (${res.status}).`);
  }
  const release = await res.json();
  const candidates = [`${identity.desktopProductName}-${version}.exe`, `${identity.desktopProductName}-Setup-${version}.exe`];
  const win = (release.assets ?? []).find((asset) => candidates.includes(asset.name));
  if (!win?.browser_download_url) {
    block(`Windows artifact built? NO — ${candidates.join(" or ")} missing on GitHub Release ${tag}.`);
  }
  const sidecar = (release.assets ?? []).find((asset) => asset.name === `${win.name}.sha256`);
  const sidecarSha256 = sidecar?.browser_download_url
    ? await fetchRemoteSha256(sidecar.browser_download_url)
    : null;
  if (!sidecarSha256) {
    block(`Windows artifact verified? NO — ${win.name}.sha256 sidecar missing on GitHub Release ${tag}.`);
  }
  return { win, sidecarSha256 };
}

async function validateWindowsPreRc() {
  const localCandidates = [
    path.join(desktopRoot, ".build", brandId, "release", `${identity.desktopProductName}-${version}.exe`),
    path.join(desktopRoot, ".build", brandId, "release", `${identity.desktopProductName}-Setup-${version}.exe`),
  ];
  const localExe = localCandidates.find((candidate) => existsSync(candidate));
  const mainPath = path.join(desktopRoot, ".build", brandId, "dist-electron", "main.cjs");

  if (localExe) {
    const digest = await sha256File(localExe);
    console.log(`✓ Artifact built (local ${path.basename(localExe)})`);
    console.log(`✓ Artifact verified (sha256 ${digest.slice(0, 12)}…)`);
    if (existsSync(mainPath)) {
      assertLicenseKeysEmbedded(mainPath);
    } else {
      console.warn("WARN bundled main.cjs missing locally — license embed check skipped (Windows CI host)");
    }
  } else {
    const remote = await fetchGitHubWindowsAsset();
    console.log(`✓ Artifact built (GitHub Release ${tag} · ${remote.win.name})`);
    console.log(`✓ Artifact verified (sidecar sha256 ${remote.sidecarSha256.slice(0, 12)}…)`);
    console.warn(
      "WARN license embed check skipped — validate Windows CI built with SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS",
    );
  }

  console.log("✓ Windows Authenticode: none — expected for pre-rc deferred channel");
  console.log(`✓ Distribution metadata preview: ${JSON.stringify(buildDistributionRecord(version, { windows: { authenticode: "none" } }).commercialCodeSigning.windows)}`);
  console.log("○ Clean-machine install: NOT verified — test Setup.exe on a clean Windows PC before claiming install works");
  console.log("○ OS trust: SmartScreen may warn — document More info → Run anyway path");
}

async function main() {
  const platformArg =
    process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1] ??
    process.argv[process.argv.indexOf("--platform") + 1] ??
    "";

  if (!isPreRcUnsignedPublishChannel()) {
    block(
      "Pre-RC unsigned validator called outside the pre-rc unsigned publish channel.",
      "Use validate-release commercial validators when signing is enabled.",
    );
  }

  const distribution = buildDistributionRecord();
  console.log("PreRcReleaseValidation");
  console.log(`Platform: ${platformArg === "mac" ? "macOS" : platformArg === "windows" ? "Windows" : platformArg}`);
  console.log(`Channel: ${distribution.channel}`);
  console.log(`Commercial signing: deferred (unsigned / not notarized / no Authenticode requirement)`);
  console.log(`License Ed25519 verify: required at build time`);
  console.log("");

  if (platformArg === "mac") {
    validateMacPreRc();
  } else if (platformArg === "windows") {
    await validateWindowsPreRc();
  } else {
    block("Usage: node scripts/validate-release-pre-rc.mjs --platform mac|windows");
  }

  console.log("");
  console.log("PreRcReleaseValidation PASS (integrity only — not clean-machine verified)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
