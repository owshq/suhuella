import path from "node:path";
import {
  ARTIFACT_THRESHOLDS,
  CURSOR_DB_CRIT,
  CURSOR_DB_WARN,
  DISK_PATHS,
  collectMetrics,
  cursorDbBytes,
  formatBytes,
  loadHistory,
  offsetDateKey,
  printTrendBlock,
  saveHistory,
  snapshotForDate,
  snapshotNearDaysAgo,
} from "./health-lib.mjs";

/**
 * @param {{ ci?: boolean, metrics?: Record<string, number | null>, history?: ReturnType<typeof loadHistory> }} ctx
 * @returns {{ checks: import("./health-lib.mjs").HealthCheck[], metrics: Record<string, number | null> }}
 */
export function runDevelopmentHealth(ctx = {}) {
  const history = ctx.history ?? loadHistory();
  const metrics = ctx.metrics ?? collectMetrics();
  const ci = ctx.ci ?? false;
  /** @type {import("./health-lib.mjs").HealthCheck[]} */
  const checks = [];

  const dbBytes = metrics.cursorDb ?? cursorDbBytes();
  if (dbBytes == null) {
    checks.push({
      id: "cursor",
      label: "Cursor",
      domain: "development",
      severity: "ok",
      observation: ci ? "skipped in CI" : "Cursor not installed",
      failCi: false,
    });
  } else if (dbBytes >= CURSOR_DB_CRIT) {
    checks.push({
      id: "cursor",
      label: "Cursor",
      domain: "development",
      severity: "action",
      observation: formatBytes(dbBytes),
      action: "Workspace reset recommended. Close Cursor and prune workspaceStorage.",
      failCi: !ci,
    });
  } else if (dbBytes >= CURSOR_DB_WARN) {
    checks.push({
      id: "cursor",
      label: "Cursor",
      domain: "development",
      severity: "warn",
      observation: `${formatBytes(dbBytes)} — unusually large`,
      recommendation: "Review Cursor workspace storage before it grows further",
      failCi: false,
    });
  } else {
    checks.push({
      id: "cursor",
      label: "Cursor",
      domain: "development",
      severity: "ok",
      observation: formatBytes(dbBytes),
      failCi: false,
    });
  }

  const repoBytes = metrics["disk:suhuella"];
  checks.push({
    id: "disk",
    label: "Disk",
    domain: "development",
    severity: "ok",
    observation: repoBytes != null ? `repo ${formatBytes(repoBytes)}` : "repo size unavailable",
    failCi: false,
  });

  const artifactAlerts = [];
  for (const entry of ARTIFACT_THRESHOLDS) {
    const bytes = metrics[`artifact:${entry.relative}`];
    if (bytes != null && bytes > entry.warnBytes) {
      artifactAlerts.push({ ...entry, bytes });
    }
  }

  if (artifactAlerts.length === 0) {
    checks.push({
      id: "build-artifacts",
      label: "Build artifacts",
      domain: "development",
      severity: "ok",
      observation: "within thresholds",
      failCi: false,
    });
    checks.push({
      id: "release-artifacts",
      label: "Release artifacts",
      domain: "development",
      severity: "ok",
      observation: "within thresholds",
      failCi: false,
    });
    checks.push({
      id: "test-artifacts",
      label: "Test artifacts",
      domain: "development",
      severity: "ok",
      observation: "within thresholds",
      failCi: false,
    });
  } else {
    for (const group of ["build", "release", "test"]) {
      const alerts = artifactAlerts.filter((item) => item.group === group);
      const id = group === "build" ? "build-artifacts" : group === "release" ? "release-artifacts" : "test-artifacts";
      const label = group === "build" ? "Build artifacts" : group === "release" ? "Release artifacts" : "Test artifacts";
      if (alerts.length === 0) {
        checks.push({ id, label, domain: "development", severity: "ok", observation: "within thresholds", failCi: false });
        continue;
      }
      const largest = alerts.sort((a, b) => b.bytes - a.bytes)[0];
      checks.push({
        id,
        label,
        domain: "development",
        severity: "warn",
        observation: `${largest.relative} ${formatBytes(largest.bytes)}`,
        recommendation: "npm run clean:dev",
        failCi: false,
      });
    }
  }

  checks.push({
    id: "node-cache",
    label: "Node cache",
    domain: "development",
    severity: "ok",
    observation: formatBytes(metrics.npmCache),
    failCi: false,
  });

  checks.push({
    id: "playwright-cache",
    label: "Playwright cache",
    domain: "development",
    severity: "ok",
    observation: formatBytes(metrics.playwrightCache),
    failCi: false,
  });

  if (!ci) saveHistory(history, metrics);

  return {
    checks,
    metrics,
    history,
    trends: buildTrends(history, metrics),
  };
}

/** @param {ReturnType<typeof loadHistory>} history @param {Record<string, number | null>} metrics */
function buildTrends(history, metrics) {
  const baseline7d = snapshotNearDaysAgo(history.snapshots, 7);
  const yesterday = snapshotForDate(history.snapshots, offsetDateKey(1));
  return { baseline7d, yesterday };
}

/** @param {import("./health-lib.mjs").HealthCheck[]} checks @param {Record<string, number | null>} metrics @param {ReturnType<typeof buildTrends>} trends */
export function printDevelopmentDetails(checks, metrics, trends) {
  const cursor = checks.find((item) => item.id === "cursor");
  if (cursor && cursor.observation !== "skipped in CI") {
    console.log("\nCursor");
    console.log("──────");
    const dbBytes = metrics.cursorDb ?? 0;
    printTrendBlock(
      "Cursor state databases",
      dbBytes,
      trends.baseline7d?.metrics.cursorDb ?? null,
      "7 days ago",
    );
    console.log(`\nCursor (total)        ${formatBytes(metrics.cursorTotal)}`);
  }

  console.log("\nDisk");
  console.log("────");
  for (const { id, label } of DISK_PATHS) {
    console.log(`${label.padEnd(16)} ${formatBytes(metrics[`disk:${id}`])}`);
  }

  const artifactChecks = checks.filter((item) => item.id.endsWith("-artifacts") && item.severity === "warn");
  if (artifactChecks.length > 0) {
    console.log("\nArtifact detail");
    console.log("───────────────");
    for (const check of artifactChecks) {
      const relative = check.observation.split(" ")[0];
      const bytes = metrics[`artifact:${relative}`];
      if (bytes == null) continue;
      printTrendBlock(
        relative,
        bytes,
        trends.yesterday?.metrics[`artifact:${relative}`] ?? trends.baseline7d?.metrics[`artifact:${relative}`] ?? null,
        trends.yesterday ? "Yesterday" : "7 days ago",
      );
      console.log("");
    }
  }
}
