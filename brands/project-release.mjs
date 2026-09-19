import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  brandMirrorFromAuthority,
  normalizeReleaseManifest,
  siteReleaseFromAuthority,
} from "./release-manifest-io.mjs";
import { brandReleasePath, repoRoot } from "./select.mjs";

const PRIMARY_BRAND = "suhuella";
const MIRROR_BRANDS = ["dbasenet"];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function patchPackageVersion(relativePath, version) {
  const filePath = path.join(repoRoot, relativePath);
  const pkg = await readJson(filePath);
  if (pkg.version === version) return false;
  pkg.version = version;
  await writeJson(filePath, pkg);
  return true;
}

async function patchWranglerVersion(relativePath, version) {
  const filePath = path.join(repoRoot, relativePath);
  const text = await readFile(filePath, "utf8");
  const next = text.replace(
    /"NEXT_PUBLIC_APP_VERSION":\s*"[^"]*"/,
    `"NEXT_PUBLIC_APP_VERSION": "${version}"`,
  );
  if (next === text) return false;
  await writeFile(filePath, next);
  return true;
}

const authorityPath = brandReleasePath(PRIMARY_BRAND);
const authority = await readJson(authorityPath);
const normalized = normalizeReleaseManifest(authority);
const version = normalized.version;
const updates = [];

const siteReleasePath = path.join(repoRoot, "site/release.json");
const siteManifest = siteReleaseFromAuthority(authority);
const existingSite = await readJson(siteReleasePath);
if (JSON.stringify(existingSite) !== JSON.stringify(siteManifest)) {
  await writeJson(siteReleasePath, siteManifest);
  updates.push("site/release.json");
}

for (const brandId of MIRROR_BRANDS) {
  const mirrorPath = brandReleasePath(brandId);
  const merged = brandMirrorFromAuthority(authority, brandId);
  const existing = await readJson(mirrorPath);
  if (JSON.stringify(existing) !== JSON.stringify(merged)) {
    await writeJson(mirrorPath, merged);
    updates.push(`brands/${brandId}/release.json`);
  }
}

if (await patchPackageVersion("desktop/package.json", version)) {
  updates.push("desktop/package.json");
}
if (await patchPackageVersion("site/package.json", version)) {
  updates.push("site/package.json");
}
if (await patchWranglerVersion("site/wrangler.jsonc", version)) {
  updates.push("site/wrangler.jsonc");
}
if (await patchWranglerVersion("wrangler.jsonc", version)) {
  updates.push("wrangler.jsonc");
}

if (updates.length === 0) {
  console.log(`[release] ${version} — mirrors already in sync`);
} else {
  console.log(`[release] ${version} — synced ${updates.join(", ")}`);
}
