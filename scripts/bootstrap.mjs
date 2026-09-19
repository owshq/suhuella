import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(relativeScript) {
  const result = spawnSync(process.execPath, [relativeScript], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Entry must exist before any package compiles @suhuella/brand.
run("brands/project-brand.mjs");
run("brands/project-site.mjs");
