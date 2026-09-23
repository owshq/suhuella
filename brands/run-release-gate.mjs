import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBuildHealthGate } from "../scripts/build-health.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(relativeScript) {
  const result = spawnSync(process.execPath, [relativeScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("brands/project-release.mjs");
if (process.env.SUHUELLA_DESKTOP_CI === "1") {
  console.log("[release] desktop CI — skipping site/wrangler version matrix check");
  process.exit(0);
}
runBuildHealthGate({ ids: ["release-version"] });
