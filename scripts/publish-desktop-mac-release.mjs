/**
 * DESKTOP-RELEASE-HOSTING-001 — GitHub Release + download.suhuella.com + deploy.
 *
 * Pipeline rule: never delete or replace an existing GitHub asset.
 * A new build is uploaded under a unique name. release.json and the download alias
 * change only after the uploaded asset's size and SHA256 match the local file.
 *
 * Requires: GH_TOKEN or GITHUB_TOKEN with repo contents write.
 *
 *   GH_TOKEN=ghp_… node scripts/publish-desktop-mac-release.mjs
 *   node scripts/publish-desktop-mac-release.mjs --skip-deploy   # upload + manifest only
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchRemoteSha256,
  formatSha256Sidecar,
  sha256File,
} from "./release-artifact-sha256.mjs";
import { runBuildHealthGate } from "./build-health.mjs";
import { assertCommercialSigningEnabledForPublish } from "./commercial-signing.mjs";

runBuildHealthGate();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.GITHUB_REPO ?? "owshq/suhuella";
function resolveToken() {
  const fromEnv = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (fromEnv) return fromEnv;
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  return "";
}

const TOKEN = resolveToken();
const SKIP_DEPLOY = process.argv.includes("--skip-deploy");
const MAC_ALIAS = "https://download.suhuella.com/latest/mac";

const releaseJsonPath = path.join(root, "brands/suhuella/release.json");
const manifest = JSON.parse(readFileSync(releaseJsonPath, "utf8"));
const version = manifest.version?.trim();
const tag = version.startsWith("v") ? version : `v${version}`;
const dmgName = `SuHuella-${version}.dmg`;
const dmgPath = path.join(root, "desktop/.build/suhuella/release", dmgName);

/** Keep the previous asset. The new name includes the content hash. */
function uniqueReleaseAssetName(baseName, sha256) {
  const dot = baseName.lastIndexOf(".");
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : "";
  return `${stem}-${sha256.slice(0, 12).toLowerCase()}${ext}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ghApi(pathname, { method = "GET", body, headers = {} } = {}) {
  if (!TOKEN) fail("GH_TOKEN or GITHUB_TOKEN required for GitHub Release upload.");
  return fetch(`https://api.github.com/repos/${REPO}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...headers,
    },
    body,
  });
}

async function getOrCreateRelease() {
  let res = await ghApi(`/releases/tags/${encodeURIComponent(tag)}`);
  if (res.ok) {
    return res.json();
  }
  res = await ghApi("/releases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: tag,
      name: version,
      body: `SuHuella ${version} — macOS DMG.`,
      draft: false,
      prerelease: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`Create release failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function uploadReleaseAsset(releaseId, fileName, buffer, contentType = "application/octet-stream") {
  const uploadUrl = `https://uploads.github.com/repos/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`Upload ${fileName} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function refreshRelease(releaseId) {
  const res = await ghApi(`/releases/${releaseId}`);
  if (!res.ok) {
    const text = await res.text();
    fail(`Refresh release failed (${res.status}): ${text}`);
  }
  return res.json();
}

function assetByName(release, name) {
  return (release.assets ?? []).find((asset) => asset.name === name) ?? null;
}

async function verifiedAsset(release, assetName, sidecarName, localSha256, localSize) {
  const asset = assetByName(release, assetName);
  if (!asset?.browser_download_url) return null;
  if (asset.size !== localSize) {
    fail(`Existing ${assetName} size is ${asset.size}, expected ${localSize}. Left it untouched.`);
  }
  const sidecar = assetByName(release, sidecarName);
  if (!sidecar?.browser_download_url) {
    fail(`Existing ${assetName} has no sidecar ${sidecarName}. Left both untouched.`);
  }
  const remoteSha256 = await fetchRemoteSha256(sidecar.browser_download_url);
  if (remoteSha256 !== localSha256) {
    fail(`Existing ${assetName} sidecar is ${remoteSha256 ?? "unreadable"}, expected ${localSha256}. Left it untouched.`);
  }
  return asset.browser_download_url;
}

async function uploadNewMacAsset(release, localSha256, localSize) {
  const assetName = uniqueReleaseAssetName(dmgName, localSha256);
  const sidecarName = `${assetName}.sha256`;
  if (assetByName(release, assetName) || assetByName(release, sidecarName)) {
    const url = await verifiedAsset(release, assetName, sidecarName, localSha256, localSize);
    if (!url) fail(`Could not reuse ${assetName}. No existing asset was deleted.`);
    console.log(`Reusing verified asset: ${assetName}`);
    return { url, filename: assetName };
  }

  const fileBuffer = readFileSync(dmgPath);
  if (fileBuffer.byteLength !== localSize) {
    fail(`Local DMG size changed during publish (${fileBuffer.byteLength} != ${localSize}).`);
  }
  console.log(`Uploading new asset ${assetName} (${localSize} bytes)`);
  console.log(`SHA256: ${localSha256}`);
  console.log(`Previous ${dmgName} stays on the release.`);
  await uploadReleaseAsset(release.id, assetName, fileBuffer);
  const shaBuffer = Buffer.from(formatSha256Sidecar(localSha256, assetName), "utf8");
  await uploadReleaseAsset(release.id, sidecarName, shaBuffer, "text/plain");

  const refreshed = await refreshRelease(release.id);
  const url = await verifiedAsset(refreshed, assetName, sidecarName, localSha256, localSize);
  if (!url) fail(`Upload of ${assetName} could not be verified. release.json was not updated.`);
  return { url, filename: assetName };
}

function updateReleaseManifest(localSha256, localSize, filename) {
  manifest.downloads ??= {};
  manifest.downloads.mac = {
    available: true,
    url: MAC_ALIAS,
    sha256: localSha256,
    filename,
    size: localSize,
  };
  writeFileSync(releaseJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${releaseJsonPath} → mac ${MAC_ALIAS}`);
  console.log(`Manifest filename: ${filename}`);
  console.log(`Manifest SHA256: ${localSha256}`);
  console.log(`Manifest size: ${localSize} bytes`);
}

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    fail(`${cmd} ${args.join(" ")} failed (${result.status})`);
  }
}

async function existingWinAssetUrl(release) {
  const win = (release.assets ?? []).find((a) => a.name.startsWith("SuHuella-Setup-"));
  return win?.browser_download_url ?? "";
}

async function deployDownloadWorker(macUrl, winUrl = "") {
  const wrangler = path.join(root, "site/node_modules/.bin/wrangler");
  const args = ["deploy", "--config", "workers/download-redirect/wrangler.jsonc", "--var", `MAC_LATEST_URL:${macUrl}`];
  if (winUrl) args.push("--var", `WIN_LATEST_URL:${winUrl}`);
  run(wrangler, args);
}

async function smoke() {
  run(process.execPath, ["scripts/smoke-desktop-download.mjs"], root);
}

async function main() {
  assertCommercialSigningEnabledForPublish();
  console.log(`Publishing ${dmgName} → GitHub Release ${tag}`);

  run(process.execPath, ["scripts/validate-release.mjs", "--platform", "mac"]);

  const localSha256 = await sha256File(dmgPath);
  const localSize = statSync(dmgPath).size;
  console.log(`Local SHA256: ${localSha256}`);
  console.log(`Local size: ${localSize} bytes`);

  const release = await getOrCreateRelease();
  const published = await uploadNewMacAsset(release, localSha256, localSize);
  const winUrl = await existingWinAssetUrl(release);
  console.log(`GitHub asset (redirect target only): ${published.url}`);

  updateReleaseManifest(localSha256, localSize, published.filename);

  await deployDownloadWorker(published.url, winUrl);

  if (!SKIP_DEPLOY) {
    run("npm", ["run", "cf:deploy"], root);
  } else {
    run("npm", ["run", "release:sync"], root);
    console.log("Skipped site deploy — run npm run cf:deploy when ready.");
  }

  await smoke();
  console.log("DESKTOP-RELEASE-HOSTING-001 publish complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
