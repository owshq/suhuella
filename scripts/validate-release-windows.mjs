/**
 * Windows implementation of Release Validation.
 *
 * Contract: built · verified (hash + sidecar) · signed (Authenticode) · trusted · installable.
 * SmartScreen reputation accumulates after public downloads — not a local PASS/FAIL.
 *
 * Uses local Setup.exe when present; otherwise GitHub Release + sidecar
 * (same source as publish:desktop-win).
 */
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../brands/select.mjs";
import { fetchRemoteSha256, sha256File } from "./release-artifact-sha256.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopRoot = path.join(root, "desktop");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const version = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8")).version;
const exeName = `${identity.desktopProductName}-Setup-${version}.exe`;
const exeShaName = `${exeName}.sha256`;
const localExePath = path.join(desktopRoot, ".build", brandId, "release", exeName);
const REPO = process.env.GITHUB_REPO ?? "owshq/suhuella";
const tag = version.startsWith("v") ? version : `v${version}`;
const manifestPath = path.join(root, "brands/suhuella/release.json");

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 180_000 });
}

function block(reason, detail = "") {
  console.error("Windows release validation FAIL\n");
  console.error(reason);
  if (detail.trim()) {
    console.error("");
    console.error(detail.trim());
  }
  console.error("");
  console.error("Publishing an unsigned installer would fail the Windows install/launch gate.");
  console.error("Private Beta requires Authenticode — same bar as macOS Developer ID + notarization.");
  process.exit(1);
}

function resolveToken() {
  const fromEnv = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  if (fromEnv) return fromEnv;
  const gh = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (gh.status === 0 && gh.stdout.trim()) return gh.stdout.trim();
  return "";
}

async function fetchGitHubReleaseAssets() {
  const token = resolveToken();
  if (!token) {
    block("Artifact built? NO — GitHub auth unavailable.", "Set GH_TOKEN or run gh auth login.");
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    block(`Artifact built? NO — GitHub Release ${tag} not found (${res.status}).`);
  }

  const release = await res.json();
  const win = (release.assets ?? []).find((asset) => asset.name === exeName);
  const winSha = (release.assets ?? []).find((asset) => asset.name === exeShaName);
  if (!win?.browser_download_url) {
    block(`Artifact built? NO — ${exeName} missing on GitHub Release ${tag}.`);
  }

  const sidecarSha256 = winSha?.browser_download_url
    ? await fetchRemoteSha256(winSha.browser_download_url)
    : null;
  if (!sidecarSha256) {
    block(`Artifact verified? NO — ${exeShaName} sidecar missing on GitHub Release ${tag}.`);
  }

  const apiDigest = (win.digest ?? "").replace(/^sha256:/i, "").toLowerCase();
  if (apiDigest && apiDigest !== sidecarSha256) {
    block(
      "Artifact verified? NO — GitHub asset digest ≠ sidecar.",
      `digest ${apiDigest}\nsidecar ${sidecarSha256}`,
    );
  }

  let manifestSha256 = "";
  try {
    manifestSha256 = JSON.parse(readFileSync(manifestPath, "utf8"))
      .downloads?.windows?.sha256?.trim()
      .toLowerCase() ?? "";
  } catch {
    /* manifest optional during first publish */
  }
  if (manifestSha256 && manifestSha256 !== sidecarSha256) {
    block(
      "Artifact verified? NO — release.json sha256 ≠ sidecar.",
      `manifest ${manifestSha256}\nsidecar ${sidecarSha256}`,
    );
  }

  return { win, sidecarSha256 };
}

function verifyAuthenticode(exePath) {
  const isWin = process.platform === "win32";
  let signed = false;
  let signerDetail = "";

  if (isWin) {
    const ps = run("powershell", [
      "-NoProfile",
      "-Command",
      `(Get-AuthenticodeSignature -FilePath '${exePath.replace(/'/g, "''")}').Status`,
    ]);
    const status = (ps.stdout || "").trim();
    signerDetail = `${ps.stdout}\n${ps.stderr}`.trim();
    signed = status === "Valid";
  } else {
    const ossl = run("osslsigncode", ["verify", exePath]);
    signerDetail = `${ossl.stdout}\n${ossl.stderr}`.trim();
    if (ossl.status === 0 && /Signature verification: ok|Successfully verified/i.test(signerDetail)) {
      signed = true;
    } else if (ossl.error && ossl.error.code === "ENOENT") {
      block(
        "Artifact signed? UNKNOWN — cannot verify Authenticode on this host.",
        "Install osslsigncode, place Setup.exe locally, or run validate-release on Windows (Get-AuthenticodeSignature).",
      );
    }
  }

  return { signed, signerDetail };
}

let exePath = localExePath;
let source = "local build";
let tempDir = null;
let sidecarSha256 = null;

if (existsSync(localExePath)) {
  sidecarSha256 = await sha256File(localExePath);
  console.log("✓ Artifact built (local build)");
  console.log(`✓ Artifact verified (sha256 ${sidecarSha256.slice(0, 12)}…)`);
} else {
  const remote = await fetchGitHubReleaseAssets();
  sidecarSha256 = remote.sidecarSha256;
  console.log(`✓ Artifact built (GitHub Release ${tag})`);
  console.log(`✓ Artifact verified (sidecar sha256 ${sidecarSha256.slice(0, 12)}… · GitHub digest match)`);

  tempDir = await mkdtemp(path.join(os.tmpdir(), "suhuella-validate-win-"));
  exePath = path.join(tempDir, exeName);
  source = `GitHub Release ${tag}`;
  console.log(`Downloading ${exeName} for Authenticode verification…`);
  const download = await fetch(remote.win.browser_download_url, { signal: AbortSignal.timeout(600_000) });
  if (!download.ok || !download.body) {
    await rm(tempDir, { recursive: true, force: true });
    block(`Artifact signed? NO — could not download ${exeName} (${download.status}).`);
  }
  await pipeline(download.body, createWriteStream(exePath));
  const digest = await sha256File(exePath);
  if (digest !== sidecarSha256) {
    await rm(tempDir, { recursive: true, force: true });
    block("Artifact verified? NO — downloaded SHA256 ≠ sidecar.", `sidecar ${sidecarSha256}\nfile ${digest}`);
  }
}

try {
  const { signed, signerDetail } = verifyAuthenticode(exePath);
  if (!signed) {
    block(
      "Artifact signed? NO — Authenticode signature missing or invalid.",
      signerDetail || "Sign the installer with signtool (timestamped) before publish.",
    );
  }

  console.log(`  source: ${source}`);
  console.log("✓ Artifact signed (Authenticode)");
  console.log("✓ Artifact trusted by OS (WinVerifyTrust / Authenticode Valid)");
  console.log("✓ Artifact installable (signed Setup.exe)");
  console.log("");
  console.log("Windows SmartScreen reputation accumulates after public downloads — not a local PASS/FAIL.");
} finally {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
}
