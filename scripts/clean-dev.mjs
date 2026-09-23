#!/usr/bin/env node
/**
 * Remove regenerable project artifacts only.
 * Safe during active development: npm run clean:dev
 *
 * Does NOT touch global caches (npm, Playwright, Electron) — use clean:caches manually.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GB = 1024 ** 3;
const MB = 1024 ** 2;

const DEV_ARTIFACT_DIRS = [
  ".next",
  "site/.next",
  process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Caches", "suhuella", "site-next")
    : path.join(os.homedir(), ".cache", "suhuella", "site-next"),
  "site/out",
  "site/build",
  "site/.build",
  "brands/.build",
  "desktop/.build",
  "desktop/dist",
  "desktop/dist-electron",
  "desktop/out",
  "desktop/release",
  "coverage",
  "playwright-report",
  "test-results",
  "trace",
  "videos",
  "screenshots",
  "tmp",
  "site/playwright-report",
  "site/test-results",
  "site/trace",
  "site/videos",
  "site/screenshots",
  "desktop/playwright-report",
  "desktop/test-results",
];

function duBytes(target) {
  if (!fs.existsSync(target)) return null;
  const result = spawnSync("du", ["-sk", target], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const kb = Number.parseInt(result.stdout.trim().split(/\s+/)[0] ?? "", 10);
  return Number.isFinite(kb) ? kb * 1024 : null;
}

function formatBytes(bytes) {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

let removed = 0;
let freed = 0;

for (const relative of DEV_ARTIFACT_DIRS) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) continue;
  const bytes = duBytes(target);
  fs.rmSync(target, { recursive: true, force: true });
  removed += 1;
  if (bytes != null) freed += bytes;
  console.log(`removed ${relative}${bytes != null ? ` (${formatBytes(bytes)})` : ""}`);
}

if (removed === 0) {
  console.log("no dev artifacts to remove");
} else {
  console.log(`cleaned ${removed} folder(s), ~${formatBytes(freed)} recoverable`);
}
