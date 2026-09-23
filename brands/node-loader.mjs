import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const brandsRoot = path.dirname(fileURLToPath(import.meta.url));
const brandUrl = pathToFileURL(path.resolve(brandsRoot, ".build/entry.ts")).href;
const productRoot = path.resolve(brandsRoot, "../packages/product/src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@suhuella/brand") {
    return { url: brandUrl, shortCircuit: true };
  }
  if (specifier === "@suhuella/product" || specifier.startsWith("@suhuella/product/")) {
    const rest = specifier === "@suhuella/product" ? "index.ts" : specifier.slice("@suhuella/product/".length);
    return { url: pathToFileURL(path.join(productRoot, rest)).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
