/**
 * Verify a published desktop installer matches release.json (artifact contract).
 *
 * Checks: version, filename, SHA256, size.
 *
 *   node scripts/verify-desktop-artifact.mjs --platform mac
 *   node scripts/verify-desktop-artifact.mjs --platform windows
 */
import { createWriteStream, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { sha256File } from "./release-artifact-sha256.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = (process.env.PRODUCTION_ORIGIN ?? "https://suhuella.com").replace(/\/+$/, "");
const DOWNLOAD = (process.env.DOWNLOAD_ORIGIN ?? "https://download.suhuella.com").replace(/\/+$/, "");

const platformArg = process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1]
  ?? process.argv[process.argv.indexOf("--platform") + 1]
  ?? "mac";

if (platformArg !== "mac" && platformArg !== "windows") {
  console.error("Usage: node scripts/verify-desktop-artifact.mjs --platform mac|windows");
  process.exit(1);
}

function ok(label) {
  console.log(`OK   ${label}`);
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? "");
  } catch {
    return "";
  }
}

const aliasPath = platformArg === "mac" ? "/latest/mac" : "/latest/win";
const manifestPath = path.join(root, "brands/suhuella/release.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entry = manifest.downloads?.[platformArg];
const expectedVersion = manifest.version?.trim() ?? "";
const expectedSha256 = entry?.sha256?.trim()?.toLowerCase() ?? "";
const expectedFilename = entry?.filename?.trim() ?? "";
const expectedSize = typeof entry?.size === "number" ? Math.trunc(entry.size) : 0;

if (!expectedVersion) fail("release.json is missing version.");
if (!entry?.available || !entry?.url) fail(`${platformArg} installer is not marked available in release.json`);
if (!expectedSha256) fail(`${platformArg} installer is missing sha256 — republish with SHA256 pipeline.`);
if (!expectedFilename) fail(`${platformArg} installer is missing filename in release.json.`);
if (!expectedSize) fail(`${platformArg} installer is missing size in release.json.`);

ok(`manifest version ${expectedVersion}`);
ok(`manifest filename ${expectedFilename}`);
ok(`manifest sha256 present`);
ok(`manifest size ${expectedSize} bytes`);

const redirectRes = await fetch(`${DOWNLOAD}${aliasPath}`, { redirect: "manual" });
if (redirectRes.status !== 302 && redirectRes.status !== 301) {
  fail(`redirect expected 302, got ${redirectRes.status}`);
}

const downloadUrl = redirectRes.headers.get("location") ?? "";
if (!downloadUrl) fail("redirect target missing");

const remoteFilename = filenameFromUrl(downloadUrl);
if (remoteFilename !== expectedFilename) {
  fail(`filename mismatch — manifest ${expectedFilename}, redirect ${remoteFilename || "(empty)"}`);
}
ok(`redirect filename ${remoteFilename}`);

const tempDir = await mkdtemp(path.join(os.tmpdir(), "suhuella-verify-"));
const artifactPath = path.join(tempDir, expectedFilename);

try {
  console.log(`Downloading ${downloadUrl}`);
  const res = await fetch(downloadUrl);
  if (!res.ok || !res.body) fail(`download failed (${res.status})`);
  await pipeline(res.body, createWriteStream(artifactPath));

  const actualSize = statSync(artifactPath).size;
  if (actualSize !== expectedSize) {
    fail(`size mismatch — manifest ${expectedSize}, downloaded ${actualSize}`);
  }
  ok(`downloaded size ${actualSize} bytes`);

  const actualSha256 = await sha256File(artifactPath);
  if (actualSha256 !== expectedSha256) {
    fail(`sha256 mismatch — manifest ${expectedSha256}, artifact ${actualSha256}`);
  }
  ok(`sha256 matches manifest`);

  const releaseRes = await fetch(`${ORIGIN}/api/release`);
  if (releaseRes.ok) {
    const payload = await releaseRes.json();
    const apiRelease = payload.release;
    if (apiRelease?.version !== expectedVersion) {
      fail(`/api/release version ${apiRelease?.version ?? "(missing)"} ≠ manifest ${expectedVersion}`);
    }
    ok(`/api/release version ${expectedVersion}`);

    const apiEntry = apiRelease?.downloads?.[platformArg];
    if (apiEntry?.sha256?.toLowerCase() !== expectedSha256) {
      fail("/api/release sha256 ≠ manifest");
    }
    if (apiEntry?.filename !== expectedFilename) {
      fail("/api/release filename ≠ manifest");
    }
    if (apiEntry?.size !== expectedSize) {
      fail("/api/release size ≠ manifest");
    }
    ok("/api/release artifact metadata matches manifest");
  } else {
    console.log(`WARN /api/release unavailable (${releaseRes.status}) — skipped live API check`);
  }

  console.log(`${platformArg} artifact verified (version, filename, sha256, size).`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
