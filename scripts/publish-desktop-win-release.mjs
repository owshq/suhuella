/**
 * Windows desktop publish — manifest + download worker + site deploy.
 * Requires SuHuella-Setup-*.exe on GitHub Release v{version} (CI or manual upload).
 *
 *   npm run publish:desktop-win
 *   npm run publish:desktop-win -- --skip-deploy
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.GITHUB_REPO ?? "owshq/suhuella";
const SKIP_DEPLOY = process.argv.includes("--skip-deploy");
const WIN_ALIAS = "https://download.suhuella.com/latest/win";
const MAC_ALIAS = "https://download.suhuella.com/latest/mac";

const releaseJsonPath = path.join(root, "brands/suhuella/release.json");
const manifest = JSON.parse(readFileSync(releaseJsonPath, "utf8"));
const version = manifest.version?.trim();
const tag = version.startsWith("v") ? version : `v${version}`;
const winName = `SuHuella-Setup-${version}.exe`;

function resolveToken() {
  const fromEnv = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (fromEnv) return fromEnv;
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  return "";
}

const TOKEN = resolveToken();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ghApi(pathname) {
  if (!TOKEN) fail("GH_TOKEN or gh auth required.");
  return fetch(`https://api.github.com/repos/${REPO}${pathname}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

async function releaseAssets() {
  const res = await ghApi(`/releases/tags/${encodeURIComponent(tag)}`);
  if (!res.ok) fail(`Release ${tag} not found — run Windows CI build first.`);
  const release = await res.json();
  const assets = release.assets ?? [];
  const win = assets.find((a) => a.name === winName);
  const dmg = assets.find((a) => a.name === `SuHuella-${version}.dmg`);
  if (!win?.browser_download_url) fail(`Missing ${winName} on release ${tag}.`);
  return { winUrl: win.browser_download_url, macUrl: dmg?.browser_download_url ?? "" };
}

function updateReleaseManifest() {
  manifest.downloads ??= {};
  manifest.downloads.windows = { available: true, url: WIN_ALIAS };
  if (!manifest.downloads.mac?.url) {
    manifest.downloads.mac = { available: true, url: MAC_ALIAS };
  }
  writeFileSync(releaseJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${releaseJsonPath} → windows ${WIN_ALIAS}`);
}

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed (${result.status})`);
}

function deployDownloadWorker(macUrl, winUrl) {
  const wrangler = path.join(root, "site/node_modules/.bin/wrangler");
  const args = ["deploy", "--config", "workers/download-redirect/wrangler.jsonc", "--var", `WIN_LATEST_URL:${winUrl}`];
  if (macUrl) args.push("--var", `MAC_LATEST_URL:${macUrl}`);
  run(wrangler, args);
}

async function smoke() {
  run(process.execPath, ["scripts/smoke-desktop-download.mjs"], root);
}

async function main() {
  console.log(`Publishing Windows → GitHub Release ${tag}`);
  const { winUrl, macUrl } = await releaseAssets();
  console.log(`GitHub win asset (redirect only): ${winUrl}`);
  if (macUrl) console.log(`GitHub mac asset preserved: ${macUrl}`);

  updateReleaseManifest();
  deployDownloadWorker(macUrl, winUrl);

  if (!SKIP_DEPLOY) {
    run("npm", ["run", "cf:deploy"], root);
  } else {
    run("npm", ["run", "release:sync"], root);
  }

  await smoke();
  console.log("Windows desktop publish complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
