#!/usr/bin/env node
/**
 * Build Health — release coherence (read-only checks).
 *
 * Single implementation used by:
 *   npm run health
 *   npm run health:ci
 *   brands/run-release-gate.mjs
 *   publish scripts (prepublish)
 *
 * Smoke stays separate — see docs/architecture/constitution/COMMAND-TAXONOMY.md:
 *   npm run smoke
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root, runNodeScript } from "./health-lib.mjs";

const isGate = process.argv.includes("--gate");
const npmSpawnOptions = {
  encoding: "utf8",
  env: process.env,
  shell: process.platform === "win32",
};
const gateIds = process.argv.includes("--ids")
  ? process.argv[process.argv.indexOf("--ids") + 1]?.split(",").map((id) => id.trim()).filter(Boolean)
  : null;

/** @typedef {"release-json" | "release-version" | "brand-config" | "release-lifecycle"} BuildHealthCheckId */

/**
 * @typedef {Object} BuildHealthCheckDef
 * @property {BuildHealthCheckId} id
 * @property {string} label
 * @property {() => import("./health-lib.mjs").HealthCheck} run
 */

/** Canonical Build Health check list — extend here only. */
export const BUILD_HEALTH_CHECKS = /** @type {BuildHealthCheckDef[]} */ ([
  { id: "release-json", label: "release.json", run: checkReleaseJson },
  {
    id: "release-version",
    label: "Package versions",
    run: () => runScriptCheck("release-version", "Package versions", "brands/release-version-check.mjs"),
  },
  {
    id: "brand-config",
    label: "BrandConfig",
    run: () => runScriptCheck("brand-config", "BrandConfig", "brands/brand-config-check.mjs"),
  },
  {
    id: "release-lifecycle",
    label: "Release lifecycle",
    run: () =>
      runNpmCheck("release-lifecycle", "Release lifecycle", ["run", "test:release-lifecycle", "--prefix", "desktop"]),
  },
]);

/**
 * @param {{ ids?: BuildHealthCheckId[] }} [options]
 * @returns {import("./health-lib.mjs").HealthCheck[]}
 */
export function runBuildHealth(options = {}) {
  const ids = options.ids ?? BUILD_HEALTH_CHECKS.map((check) => check.id);
  return BUILD_HEALTH_CHECKS.filter((check) => ids.includes(check.id)).map((check) => check.run());
}

/**
 * Run Build Health checks and exit non-zero on failure (for gates / prepublish).
 *
 * @param {{ ids?: BuildHealthCheckId[], stdio?: "inherit" | "pipe" }} [options]
 */
export function runBuildHealthGate(options = {}) {
  const ids = options.ids ?? BUILD_HEALTH_CHECKS.map((check) => check.id);
  const stdio = options.stdio ?? "inherit";

  for (const check of BUILD_HEALTH_CHECKS.filter((item) => ids.includes(item.id))) {
    const def = GATE_RUNNERS[check.id];
    if (!def) continue;
    const result = def();
    if (result.status !== 0) {
      if (stdio === "inherit") {
        process.exit(result.status ?? 1);
      }
      process.stderr.write(result.stderr || result.stdout || `${check.label} failed\n`);
      process.exit(result.status ?? 1);
    }
    if (stdio === "inherit" && result.stdout?.trim()) {
      process.stdout.write(`${result.stdout.trimEnd()}\n`);
    }
  }
}

/** Gate runners — same scripts as BUILD_HEALTH_CHECKS, exit-code only. */
const GATE_RUNNERS = {
  "release-json": () => {
    const check = checkReleaseJson();
    if (check.severity === "action") {
      return { status: 1, stdout: "", stderr: `${check.label}: ${check.observation}\n` };
    }
    return { status: 0, stdout: `${check.label}: ${check.observation}\n`, stderr: "" };
  },
  "release-version": () => runNodeScript("brands/release-version-check.mjs"),
  "brand-config": () => runNodeScript("brands/brand-config-check.mjs"),
  "release-lifecycle": () =>
    spawnSync("npm", ["run", "test:release-lifecycle", "--prefix", "desktop"], {
      cwd: root,
      ...npmSpawnOptions,
    }),
};

function runProcess(argv) {
  return spawnSync(process.execPath, argv, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
}

function checkReleaseJson() {
  const manifestPath = path.join(root, "brands/suhuella/release.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const version = typeof manifest.version === "string" ? manifest.version.trim() : "";
    if (!version) {
      return actionCheck("release-json", "release.json", "missing version", "Edit brands/suhuella/release.json");
    }
    const downloads = manifest.downloads ?? {};
    const mac = downloads.mac?.available ? "mac" : null;
    const win = downloads.windows?.available ? "win" : null;
    const platforms = [mac, win].filter(Boolean).join(", ") || "web only";
    return okCheck("release-json", "release.json", `${version} · ${platforms}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return actionCheck("release-json", "release.json", message, "Restore brands/suhuella/release.json");
  }
}

/** @param {string} id @param {string} label @param {string} observation @param {string} action */
function actionCheck(id, label, observation, action) {
  return {
    id,
    label,
    domain: "build",
    severity: "action",
    observation,
    action,
    failCi: true,
  };
}

/** @param {string} id @param {string} label @param {string} observation */
function okCheck(id, label, observation) {
  return {
    id,
    label,
    domain: "build",
    severity: "ok",
    observation,
    failCi: true,
  };
}

function meaningfulLine(output) {
  return (
    output
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !line.startsWith("(") &&
          !line.includes("trace-warnings") &&
          !line.includes("To eliminate this warning") &&
          !line.startsWith("node:") &&
          !line.startsWith("Reparsing as ES module"),
      )
      .at(-1) ?? ""
  );
}

function runNpmCheck(id, label, npmArgs) {
  const result = spawnSync("npm", npmArgs, { cwd: root, ...npmSpawnOptions });
  return result.status === 0
    ? okCheck(id, label, meaningfulLine(result.stderr || result.stdout || "").replace(/^\[.*?\]\s*/, "") || "passed")
    : actionCheck(id, label, meaningfulLine(result.stderr || result.stdout || "").slice(0, 160) || "check failed", actionFor(id));
}

function runScriptCheck(id, label, script) {
  const result = runNodeScript(script);
  return result.status === 0
    ? okCheck(id, label, meaningfulLine(result.stderr || result.stdout || "").replace(/^\[.*?\]\s*/, "") || "passed")
    : actionCheck(id, label, meaningfulLine(result.stderr || result.stdout || "").slice(0, 160) || "check failed", actionFor(id));
}

/** @param {string} id */
function actionFor(id) {
  if (id === "release-version") return "Run npm run test:release-version and align all version fields";
  if (id === "brand-config") return "Run npm run test:brand-config";
  if (id === "release-lifecycle") return "Run npm run test:release-lifecycle --prefix desktop";
  return "Fix build health check before publish";
}

if (isGate) {
  runBuildHealthGate({ ids: gateIds ?? undefined });
}
