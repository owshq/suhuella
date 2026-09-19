import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { repoRoot, resolveBrandId } from "./select.mjs";

/** Write brands/.build/entry.ts — required for @suhuella/brand. No native deps. */
export async function projectBrandEntry(brandId = resolveBrandId()) {
  const packageEntry = path.join(repoRoot, "brands/.build/entry.ts");
  await mkdir(path.dirname(packageEntry), { recursive: true });
  await writeFile(packageEntry, `export * from "../${brandId}/entry.ts";\n`);
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
