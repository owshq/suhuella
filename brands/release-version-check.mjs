import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { brandReleasePath, repoRoot } from "./select.mjs";

const PRIMARY_BRAND = "suhuella";

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function wranglerVersion(relativePath) {
  const match = readText(relativePath).match(/"NEXT_PUBLIC_APP_VERSION":\s*"([^"]+)"/);
  return match?.[1]?.trim() ?? "";
}

function loadBrandReleaseVersion() {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./brands/node-register.mjs",
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--eval",
      "import { resolveBrand } from './brands/index.ts'; console.log(resolveBrand('suhuella').release.version);",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`${result.stderr || result.stdout || "BrandConfig load failed"}`.trim());
  }
  return result.stdout.trim();
}

const authority = readJson(`brands/${PRIMARY_BRAND}/release.json`);
const expected = typeof authority.version === "string" ? authority.version.trim() : "";

if (!expected) {
  console.error("Release blocked\n");
  console.error(`brands/${PRIMARY_BRAND}/release.json is missing version.`);
  process.exit(1);
}

const checks = [
  {
    label: "Desktop package version",
    path: "desktop/package.json",
    value: readJson("desktop/package.json").version?.trim() ?? "",
  },
  {
    label: "Site package version",
    path: "site/package.json",
    value: readJson("site/package.json").version?.trim() ?? "",
  },
  {
    label: "site/release.json",
    path: "site/release.json",
    value: readJson("site/release.json").version?.trim() ?? "",
  },
  {
    label: "Dbasenet release.json",
    path: "brands/dbasenet/release.json",
    value: readJson("brands/dbasenet/release.json").version?.trim() ?? "",
  },
  {
    label: "BrandConfig.release.version",
    path: "brands/suhuella/brand.ts → release.json",
    value: loadBrandReleaseVersion(),
  },
  {
    label: "site/wrangler NEXT_PUBLIC_APP_VERSION",
    path: "site/wrangler.jsonc",
    value: wranglerVersion("site/wrangler.jsonc"),
  },
  {
    label: "root wrangler NEXT_PUBLIC_APP_VERSION",
    path: "wrangler.jsonc",
    value: wranglerVersion("wrangler.jsonc"),
  },
];

const mismatches = checks.filter((check) => check.value !== expected);

if (mismatches.length > 0) {
  console.error("Release blocked\n");
  for (const check of mismatches) {
    console.error(`${check.label}:`);
    console.error(check.value || "(missing)");
    console.error("");
  }
  console.error("release.json:");
  console.error(expected);
  console.error("");
  console.error("Mismatch");
  console.error("");
  console.error("Fix: edit brands/suhuella/release.json, then run any build (npm run build)");
  process.exit(1);
}

console.log(`[release] version check passed — ${expected}`);
