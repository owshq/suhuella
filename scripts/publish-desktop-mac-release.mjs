/**
 * DESKTOP-RELEASE-HOSTING-001 — GitHub Release + download.suhuella.com + deploy.
 *
 * Requires: GH_TOKEN or GITHUB_TOKEN with repo contents write.
 *
 *   GH_TOKEN=ghp_… node scripts/publish-desktop-mac-release.mjs
 *   node scripts/publish-desktop-mac-release.mjs --skip-deploy   # upload + manifest only
 */
import { readFileSync, writeFileSync, createReadStream, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      body: `SuHuella ${version} — macOS DMG (unsigned pre-RC).`,
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

async function uploadDmg(release) {
  const existing = (release.assets ?? []).find((a) => a.name === dmgName);
  if (existing?.browser_download_url) {
    console.log(`Asset already on release: ${dmgName}`);
    return existing.browser_download_url;
  }

  if (!statSync(dmgPath).isFile()) {
    fail(`DMG missing: ${dmgPath}`);
  }

  const size = statSync(dmgPath).size;
  const fileBuffer = readFileSync(dmgPath);
  const uploadUrl = `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(dmgName)}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const text = await res.text();
    fail(`Upload DMG failed (${res.status}): ${text}`);
  }

  const asset = await res.json();
  return asset.browser_download_url;
}

function updateReleaseManifest() {
  manifest.downloads ??= {};
  manifest.downloads.mac = {
    available: true,
    url: MAC_ALIAS,
  };
  writeFileSync(releaseJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${releaseJsonPath} → mac ${MAC_ALIAS}`);
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
  console.log(`Publishing ${dmgName} → GitHub Release ${tag}`);

  const release = await getOrCreateRelease();
  const assetUrl = await uploadDmg(release);
  const winUrl = await existingWinAssetUrl(release);
  console.log(`GitHub asset (redirect target only): ${assetUrl}`);

  updateReleaseManifest();

  await deployDownloadWorker(assetUrl, winUrl);

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
