/**
 * Ensures compile-only / CI smoke flags cannot reach publish or package gates.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runPackageCheck(env) {
  const childEnv = { ...process.env, ...env };
  delete childEnv.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS;
  delete childEnv.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEY;
  delete childEnv.LICENSE_SIGNING_PUBLIC_KEYS;
  return spawnSync(process.execPath, ["scripts/package-check.mjs"], {
    cwd: path.join(root, "desktop"),
    env: childEnv,
    encoding: "utf8",
  });
}

function main() {
  const withoutKeys = runPackageCheck({ SUHUELLA_DESKTOP_COMPILE_ONLY: "1" });
  assert(
    withoutKeys.status !== 0,
    "package:check must fail without SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS even when SUHUELLA_DESKTOP_COMPILE_ONLY=1",
  );

  const withCiOnly = runPackageCheck({ SUHUELLA_DESKTOP_CI: "1" });
  assert(
    withCiOnly.status !== 0,
    "package:check must fail without license keys even when SUHUELLA_DESKTOP_CI=1",
  );

  const publishMac = readFileSync(path.join(root, "scripts/publish-desktop-mac-release.mjs"), "utf8");
  const publishWin = readFileSync(path.join(root, "scripts/publish-desktop-win-release.mjs"), "utf8");
  assert(!publishMac.includes("SUHUELLA_DESKTOP_COMPILE_ONLY"), "publish:desktop-mac must not honor compile-only");
  assert(!publishWin.includes("SUHUELLA_DESKTOP_COMPILE_ONLY"), "publish:desktop-win must not honor compile-only");
  assert(!publishMac.includes("SUHUELLA_DESKTOP_CI"), "publish:desktop-mac must not bypass via SUHUELLA_DESKTOP_CI");
  assert(!publishWin.includes("SUHUELLA_DESKTOP_CI"), "publish:desktop-win must not bypass via SUHUELLA_DESKTOP_CI");
  assert(
    publishMac.includes("assertProductionLicenseKeysForPublish"),
    "publish:desktop-mac must block ephemeral / mismatched license keys",
  );
  assert(
    publishWin.includes("assertProductionLicenseKeysForPublish"),
    "publish:desktop-win must block ephemeral / mismatched license keys",
  );

  const ephemeralPublish = spawnSync(
    process.execPath,
    ["-e", "process.env.SUHUELLA_LICENSE_KEYS_EPHEMERAL='1';process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS='test';import('./desktop/scripts/license-key-provenance.mjs').then(m=>m.assertProductionLicenseKeysForPublish('test'))"],
    { cwd: root, encoding: "utf8" },
  );
  assert(ephemeralPublish.status !== 0, "assertProductionLicenseKeysForPublish must fail when SUHUELLA_LICENSE_KEYS_EPHEMERAL=1");

  console.log("PRE-RC-PUBLISH-GUARD-001 check passed");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
