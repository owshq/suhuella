import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BRAND_IDS = ["suhuella", "dbasenet"];

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveBrandId(raw = process.env.BRAND) {
  const requested = raw?.trim() ?? "";
  if (!requested) return "suhuella";
  if (BRAND_IDS.includes(requested)) return requested;
  throw new Error(`Unknown brand "${requested}". Set BRAND to one of: ${BRAND_IDS.join(", ")}.`);
}

export function brandIdentity(id = resolveBrandId()) {
  return JSON.parse(readFileSync(path.join(repoRoot, "brands", id, "identity.json"), "utf8"));
}

export function brandEntry(id = resolveBrandId()) {
  return path.join(repoRoot, "brands", id, "entry.ts");
}

/** Generated package entry consumed by npm, bundlers, and TypeScript (never committed). */
export function brandPackageEntry() {
  return path.join(repoRoot, "brands/.build/entry.ts");
}

export function brandPublicDir(id = resolveBrandId()) {
  return path.join(repoRoot, "brands", id, "assets", "public");
}

export function brandDesktopAssetDir(id = resolveBrandId()) {
  return path.join(repoRoot, "brands", id, "assets", "desktop");
}

export function brandReleasePath(id = resolveBrandId()) {
  return path.join(repoRoot, "brands", id, "release.json");
}

export function brandDeploymentPath(id = resolveBrandId()) {
  return path.join(repoRoot, "brands", id, "deployment.json");
}
