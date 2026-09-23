#!/usr/bin/env node
/**
 * Trim npm, Electron builder, and Playwright browser caches.
 *
 * MANUAL ONLY — never run automatically.
 * Next build/test will re-download hundreds of MB or several GB.
 *
 * Use only after health:dev warns and clean:dev did not help:
 *   npm run health:dev → WARN → npm run clean:dev → npm run health:dev → npm run clean:caches
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = os.homedir();
const CACHE_DIRS = [
  path.join(home, "Library/Caches/electron-builder"),
  path.join(home, "Library/Caches/ms-playwright"),
];

function rmrf(target) {
  if (!fs.existsSync(target)) {
    console.log(`skip (missing): ${target}`);
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`removed: ${target}`);
}

console.log("npm cache clean --force");
const npm = spawnSync("npm", ["cache", "clean", "--force"], { stdio: "inherit" });
if (npm.status !== 0) process.exit(npm.status ?? 1);

for (const dir of CACHE_DIRS) rmrf(dir);

console.log("dev caches trimmed");
