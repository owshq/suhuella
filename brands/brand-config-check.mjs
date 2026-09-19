import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projected = spawnSync(process.execPath, ["brands/project-site.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (projected.status !== 0) {
  process.exit(projected.status ?? 1);
}

const check = spawnSync(
  process.execPath,
  [
    "--import",
    "./brands/node-register.mjs",
    "--experimental-strip-types",
    "--disable-warning=ExperimentalWarning",
    "brands/brand-config-check.ts",
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);
process.exit(check.status ?? 1);
