#!/usr/bin/env node
/**
 * Remove Playwright / test output that should not grow indefinitely.
 * Safe to run after a PASS: npm run clean:test-artifacts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ARTIFACT_DIRS = [
  "playwright-report",
  "test-results",
  "trace",
  "videos",
  "screenshots",
  "site/playwright-report",
  "site/test-results",
  "site/trace",
  "site/videos",
  "site/screenshots",
  "desktop/playwright-report",
  "desktop/test-results",
];

function rmrf(target) {
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

let removed = 0;
for (const relative of ARTIFACT_DIRS) {
  const target = path.join(root, relative);
  if (rmrf(target)) {
    console.log(`removed ${relative}`);
    removed += 1;
  }
}

if (removed === 0) {
  console.log("no test artifacts to remove");
} else {
  console.log(`cleaned ${removed} artifact folder(s)`);
}
