#!/usr/bin/env node
/**
 * Health — unified operator check (development + build coherence).
 *
 *   npm run health              # weekly local routine
 *   npm run health:ci           # CI: build checks only block
 *
 * Health reports state. It never modifies the project.
 * See docs/architecture/constitution/health.md and COMMAND-TAXONOMY.md.
 * Smoke (published release) is separate: npm run smoke
 */
import { runBuildHealth } from "./build-health.mjs";
import { printDevelopmentDetails, runDevelopmentHealth } from "./health-development.mjs";
import {
  exitCodeFor,
  hasActionRequired,
  healthScore,
  printCheckSummary,
  severityIcon,
} from "./health-lib.mjs";

const ci = process.argv.includes("--ci");

function printSection(title, checks) {
  const score = healthScore(checks);
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
  console.log(`${score} / 100\n`);
  for (const check of checks) {
    printCheckSummary(check);
  }
}

function printPhilosophy() {
  console.log("Health → Observation → Severity → Recommendation → (Action)");
}

function printRoutine(blocking) {
  console.log("\nRoutine");
  console.log("───────");
  console.log("Weekly: npm run health");
  if (!blocking) {
    console.log("Status: no action required.");
    return;
  }
  console.log("If warned:  npm run clean:dev → npm run health");
  console.log("If still growing: npm run clean:caches  (manual — re-downloads tools)");
  console.log("After deploy: npm run smoke  (separate — not health)");
  console.log("Cursor DB critical: explicit workspace reset only.");
}

function main() {
  const development = ci
    ? { checks: [], metrics: {}, trends: { baseline7d: null, yesterday: null } }
    : runDevelopmentHealth({ ci });
  const buildChecks = runBuildHealth();
  const allChecks = [...development.checks, ...buildChecks];
  const blocking = hasActionRequired(allChecks.filter((check) => !ci || check.domain === "build"));

  console.log("Health");
  console.log("──────");
  console.log(`${healthScore(allChecks)} / 100\n`);
  printPhilosophy();

  if (!ci) {
    printSection("Development Health", development.checks);
    printDevelopmentDetails(development.checks, development.metrics, development.trends);
  } else {
    console.log("\nDevelopment Health — skipped in CI");
  }

  printSection("Build Health", buildChecks);

  console.log("\nSummary");
  console.log("───────");
  console.log(`${healthScore(allChecks)} / 100`);
  for (const check of allChecks) {
    if (check.severity === "ok" && !ci && check.domain === "development") continue;
    console.log(`${severityIcon(check.severity)} ${check.label}${check.observation ? ` — ${check.observation}` : ""}`);
  }

  printRoutine(blocking);
  process.exit(exitCodeFor(allChecks, ci));
}

main();
