import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const brandUrl = pathToFileURL(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".build/entry.ts"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@suhuella/brand") {
    return { url: brandUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
