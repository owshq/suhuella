import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const brandsRoot = path.dirname(fileURLToPath(import.meta.url));
const brandUrl = pathToFileURL(path.resolve(brandsRoot, ".build/entry.ts")).href;
const productRoot = path.resolve(brandsRoot, "../packages/product/src");
const siteRoot = path.resolve(brandsRoot, "../site");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    const base = path.join(siteRoot, rest);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
    for (const candidate of candidates) {
      try {
        statSync(candidate);
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      } catch {
        // try next candidate
      }
    }
    return { url: pathToFileURL(`${base}.ts`).href, shortCircuit: true };
  }
  if (specifier === "@suhuella/brand") {
    return { url: brandUrl, shortCircuit: true };
  }
  if (specifier === "@suhuella/product" || specifier.startsWith("@suhuella/product/")) {
    const rest = specifier === "@suhuella/product" ? "index.ts" : specifier.slice("@suhuella/product/".length);
    return { url: pathToFileURL(path.join(productRoot, rest)).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: `export default ${source}`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
