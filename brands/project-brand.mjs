import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot, resolveBrandId } from "./select.mjs";

/** Write brands/.build/entry.ts — required for @suhuella/brand. No native deps. */
export async function projectBrandEntry(brandId = resolveBrandId()) {
  const packageEntry = path.join(repoRoot, "brands/.build/entry.ts");
  const next = `export * from "../${brandId}/entry.ts";\n`;
  await mkdir(path.dirname(packageEntry), { recursive: true });
  try {
    if ((await readFile(packageEntry, "utf8")) === next) return packageEntry;
  } catch {
    // first projection
  }
  await writeFile(packageEntry, next);
  return packageEntry;
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const brandId = resolveBrandId();
  await projectBrandEntry(brandId);
  console.log(`[brand] projected ${brandId} @suhuella/brand entry`);
}
