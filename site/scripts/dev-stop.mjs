import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nextLockPaths, resolveNextDistDir, stopSiteDevProcesses } from "./dev-process.mjs";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ports = [Number(process.env.PORT || 3000), 3001];
const nextDistDir = resolveNextDistDir({ siteDir });

const stopped = stopSiteDevProcesses(siteDir, ports);

for (const lockPath of [
  ...nextLockPaths(nextDistDir),
  path.join(siteDir, ".next", "dev", "lock"),
  path.join(siteDir, ".next", "dev", "lock.json"),
]) {
  if (existsSync(lockPath)) {
    rmSync(lockPath, { force: true });
    console.log(`[dev:stop] removed ${path.relative(siteDir, lockPath)}`);
  }
}

if (stopped) {
  console.log(`[dev:stop] stopped ${stopped} SuHuella site dev process(es)`);
} else {
  console.log("[dev:stop] no SuHuella site dev process found");
}
