/**
 * Smoke: /api/release installers + download.suhuella.com redirects + SHA256 manifest.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRemoteSha256 } from "./release-artifact-sha256.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.PRODUCTION_ORIGIN ?? "https://suhuella.com").replace(/\/+$/, "");
const DOWNLOAD = (process.env.DOWNLOAD_ORIGIN ?? "https://download.suhuella.com").replace(/\/+$/, "");

let failed = false;

function ok(label) {
  console.log(`OK   ${label}`);
}

function bad(label, detail) {
  failed = true;
  console.error(`FAIL ${label} — ${detail}`);
}

async function checkRedirect(aliasPath, label) {
  const res = await fetch(`${DOWNLOAD}${aliasPath}`, { redirect: "manual" });
  if (res.status !== 302 && res.status !== 301) {
    bad(`${label} redirect`, `expected 302, got ${res.status}`);
    return null;
  }
  const location = res.headers.get("location") ?? "";
  if (!location.includes("github.com") && !location.includes("objects.githubusercontent.com")) {
    bad(`${label} target`, location || "empty");
  } else {
    ok(`${label} → ${location.slice(0, 72)}…`);
  }
  return location;
}

async function checkSha256Sidecar(releaseUrl, manifestSha256, label) {
  if (!manifestSha256) {
    bad(`${label} sha256`, "missing in release manifest");
    return;
  }

  const sidecarUrl = releaseUrl.replace(/\.dmg(\?.*)?$/i, ".dmg.sha256$1").replace(/\.exe(\?.*)?$/i, ".exe.sha256$1");
  const remoteSha256 = await fetchRemoteSha256(sidecarUrl);
  if (!remoteSha256) {
    bad(`${label} sha256 sidecar`, sidecarUrl);
    return;
  }
  if (remoteSha256 !== manifestSha256.toLowerCase()) {
    bad(`${label} sha256 match`, `manifest ${manifestSha256} ≠ sidecar ${remoteSha256}`);
    return;
  }
  ok(`${label} sha256 matches sidecar`);
}

const releaseRes = await fetch(`${ORIGIN}/api/release`);
let release = null;
if (!releaseRes.ok) {
  bad("/api/release", String(releaseRes.status));
} else {
  release = (await releaseRes.json()).release;
  for (const [platform, key] of [
    ["mac", "mac"],
    ["windows", "windows"],
  ]) {
    const entry = release?.downloads?.[key];
    if (entry?.available) {
      if (!entry.url?.startsWith("https://download.suhuella.com/")) {
        bad(`/api/release ${platform}.url`, entry.url ?? "missing");
      } else {
        ok(`/api/release ${platform} → ${entry.url}`);
      }
      if (entry.sha256) {
        ok(`/api/release ${platform} sha256 present`);
      } else {
        bad(`/api/release ${platform} sha256`, "missing — republish with SHA256 pipeline");
      }
      if (entry.filename) {
        ok(`/api/release ${platform} filename present`);
      } else {
        bad(`/api/release ${platform} filename`, "missing");
      }
      if (entry.size) {
        ok(`/api/release ${platform} size present (${entry.size} bytes)`);
      } else {
        bad(`/api/release ${platform} size`, "missing");
      }
    }
  }
}

const localManifest = JSON.parse(await readFile(path.join(root, "brands/suhuella/release.json"), "utf8"));

if (release?.downloads?.mac?.available) {
  const redirect = await checkRedirect("/latest/mac", "Mac");
  if (redirect && localManifest.downloads?.mac?.sha256) {
    await checkSha256Sidecar(redirect, localManifest.downloads.mac.sha256, "Mac");
  }
}
if (release?.downloads?.windows?.available) {
  const redirect = await checkRedirect("/latest/win", "Windows");
  if (redirect && localManifest.downloads?.windows?.sha256) {
    await checkSha256Sidecar(redirect, localManifest.downloads.windows.sha256, "Windows");
  }
}

const downloadPage = await fetch(`${ORIGIN}/download`);
if (!downloadPage.ok) {
  bad("/download", String(downloadPage.status));
} else {
  ok("/download page available");
}

const preparingPage = await fetch(`${ORIGIN}/download/preparing?platform=mac`);
if (!preparingPage.ok) {
  bad("/download/preparing", String(preparingPage.status));
} else {
  ok("/download/preparing page available");
}

const distributionRoot = await fetch(`${DOWNLOAD}/`);
if (!distributionRoot.ok) {
  bad("download.suhuella.com root", String(distributionRoot.status));
} else {
  const body = await distributionRoot.text();
  if (!body.includes("/latest/mac")) {
    bad("download.suhuella.com root", "missing /latest/mac alias");
  } else {
    ok("download.suhuella.com public distribution API");
  }
}

if (failed) process.exit(1);
console.log("Desktop download smoke passed.");
