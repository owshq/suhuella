import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GB = 1024 ** 3;
export const MB = 1024 ** 2;

export const CURSOR_DB_WARN = 5 * GB;
export const CURSOR_DB_CRIT = 10 * GB;

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const home = os.homedir();
export const historyPath = path.join(root, ".cursor-health.json");

export const cursorSupport = path.join(home, "Library/Application Support/Cursor");
export const cursorGlobal = path.join(cursorSupport, "User/globalStorage");
export const workspaceStorage = path.join(cursorSupport, "User/workspaceStorage");
export const npmCache = path.join(home, ".npm");
export const playwrightCache = path.join(home, "Library/Caches/ms-playwright");
export const electronBuilderCache = path.join(home, "Library/Caches/electron-builder");

/** @typedef {"ok" | "warn" | "action"} HealthSeverity */

/**
 * @typedef {Object} HealthCheck
 * @property {string} id
 * @property {string} label
 * @property {"development" | "build"} domain
 * @property {HealthSeverity} severity
 * @property {string} observation
 * @property {string} [recommendation]
 * @property {string} [action]
 * @property {boolean} [failCi]
 */

const DB_SUFFIXES = ["state.vscdb", "state.vscdb-wal", "state.vscdb-shm"];
const GLOBAL_DB_FILES = [
  ...DB_SUFFIXES,
  "conversation-search.db",
  "conversation-search.db-wal",
  "conversation-search.db-shm",
];

/** @type {{ relative: string, warnBytes: number, group: "build" | "release" | "test" }[]} */
export const ARTIFACT_THRESHOLDS = [
  { relative: "site/.next", warnBytes: 2 * GB, group: "build" },
  { relative: ".next", warnBytes: 2 * GB, group: "build" },
  { relative: "desktop/.build", warnBytes: 2 * GB, group: "build" },
  { relative: "site/.build", warnBytes: 2 * GB, group: "build" },
  { relative: "brands/.build", warnBytes: 2 * GB, group: "build" },
  { relative: "desktop/release", warnBytes: 1 * GB, group: "release" },
  { relative: "playwright-report", warnBytes: 500 * MB, group: "test" },
  { relative: "site/playwright-report", warnBytes: 500 * MB, group: "test" },
  { relative: "test-results", warnBytes: 500 * MB, group: "test" },
  { relative: "site/test-results", warnBytes: 500 * MB, group: "test" },
];

export const DISK_PATHS = [
  { id: "suhuella", label: "suhuella (repo)", path: root },
  { id: "linkeram", label: "linkeram", path: path.join(home, "Documents/linkeram") },
];

/** @param {HealthSeverity} severity */
export function severityIcon(severity) {
  if (severity === "ok") return "✓";
  if (severity === "warn") return "⚠";
  return "✗";
}

/** @param {HealthCheck[]} checks */
export function healthScore(checks) {
  let score = 100;
  for (const check of checks) {
    if (check.severity === "warn") score -= 3;
    if (check.severity === "action") score -= 25;
  }
  return Math.max(0, score);
}

/** @param {HealthCheck[]} checks */
export function hasActionRequired(checks) {
  return checks.some((check) => check.severity === "action" && check.failCi !== false);
}

/** @param {HealthCheck[]} checks @param {boolean} ci */
export function exitCodeFor(checks, ci) {
  const blocking = checks.filter((check) => {
    if (check.severity !== "action") return false;
    if (ci && check.domain === "development") return false;
    return check.failCi !== false;
  });
  return blocking.length > 0 ? 1 : 0;
}

function fileSize(target) {
  try {
    return fs.statSync(target).size;
  } catch {
    return 0;
  }
}

export function duBytes(target) {
  if (!fs.existsSync(target)) return null;
  const result = spawnSync("du", ["-sk", target], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const kb = Number.parseInt(result.stdout.trim().split(/\s+/)[0] ?? "", 10);
  return Number.isFinite(kb) ? kb * 1024 : null;
}

export function formatBytes(bytes) {
  if (bytes == null) return "missing";
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatDelta(bytes) {
  if (bytes == null) return "—";
  const sign = bytes >= 0 ? "+" : "−";
  const abs = Math.abs(bytes);
  if (abs >= GB) return `${sign}${(abs / GB).toFixed(1)} GB`;
  if (abs >= MB) return `${sign}${Math.round(abs / MB)} MB`;
  return `${sign}${Math.max(1, Math.round(abs / 1024))} KB`;
}

export function cursorDbBytes() {
  if (!fs.existsSync(cursorGlobal)) return null;
  let total = 0;
  for (const name of GLOBAL_DB_FILES) {
    total += fileSize(path.join(cursorGlobal, name));
  }
  if (!fs.existsSync(workspaceStorage)) return total;

  for (const entry of fs.readdirSync(workspaceStorage, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const suffix of DB_SUFFIXES) {
      total += fileSize(path.join(workspaceStorage, entry.name, suffix));
    }
  }
  return total;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function offsetDateKey(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

/** @returns {{ snapshots: { date: string, metrics: Record<string, number | null> }[] }} */
export function loadHistory() {
  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    if (Array.isArray(parsed?.snapshots)) return parsed;
  } catch {
    // no history yet
  }
  return { snapshots: [] };
}

export function saveHistory(history, metrics) {
  const today = todayKey();
  const snapshots = history.snapshots.filter((entry) => entry.date !== today);
  snapshots.push({ date: today, metrics });
  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  while (snapshots.length > 60) snapshots.shift();
  fs.writeFileSync(historyPath, `${JSON.stringify({ snapshots }, null, 2)}\n`);
}

export function snapshotForDate(snapshots, dateKey) {
  return snapshots.find((entry) => entry.date === dateKey) ?? null;
}

export function snapshotNearDaysAgo(snapshots, daysAgo) {
  const target = offsetDateKey(daysAgo);
  let best = null;
  for (const entry of snapshots) {
    if (entry.date <= target && (!best || entry.date > best.date)) best = entry;
  }
  return best;
}

export function collectMetrics() {
  /** @type {Record<string, number | null>} */
  const metrics = {
    cursorDb: cursorDbBytes(),
    cursorTotal: duBytes(cursorSupport),
    npmCache: duBytes(npmCache),
    playwrightCache: duBytes(playwrightCache),
    electronBuilderCache: duBytes(electronBuilderCache),
  };

  for (const { id, path: target } of DISK_PATHS) {
    metrics[`disk:${id}`] = duBytes(target);
  }

  for (const { relative } of ARTIFACT_THRESHOLDS) {
    metrics[`artifact:${relative}`] = duBytes(path.join(root, relative));
  }

  return metrics;
}

export function printTrendBlock(title, current, previous, previousLabel) {
  console.log(title);
  console.log(`  Today             ${formatBytes(current)}`);
  if (previous == null) {
    console.log(`  ${previousLabel.padEnd(17)} —`);
    console.log(`  Growth            —`);
    return;
  }
  console.log(`  ${previousLabel.padEnd(17)} ${formatBytes(previous)}`);
  console.log(`  Growth            ${formatDelta(current - previous)}`);
}

/** @param {HealthCheck} check */
export function printCheckSummary(check) {
  const line = `${severityIcon(check.severity)} ${check.label}`;
  const detail = check.observation ? `  ${check.observation}` : "";
  console.log(`${line}${detail}`);
  if (check.severity === "warn" && check.recommendation) {
    console.log(`  Recommendation: ${check.recommendation}`);
  }
  if (check.severity === "action") {
    console.log("  Action required.");
    if (check.action) console.log(`  ${check.action}`);
  }
}

/** @param {string} script @param {string[]} [args] */
export function runNodeScript(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
}
