/**
 * Detect macOS commercial code-signing state (adhoc vs Developer ID, notarization).
 * codesign --verify passing with adhoc does NOT mean Developer ID or notarization.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 120_000 });
}

function signatureKind(details) {
  if (/Authority=Developer ID Application/.test(details)) return "developer-id";
  if (/Signature=adhoc/.test(details)) return "adhoc";
  if (/code object is not signed/.test(details)) return "none";
  return "unknown";
}

export function detectMacCodesignState(appPath, dmgPath = "") {
  const result = {
    app: "none",
    dmg: "none",
    developerId: false,
    notarized: false,
    stapled: false,
  };

  if (appPath && existsSync(appPath)) {
    const display = run("codesign", ["-dv", "--verbose=4", appPath]);
    const details = `${display.stderr}\n${display.stdout}`;
    result.app = signatureKind(details);
    result.developerId = result.app === "developer-id";
  }

  if (dmgPath && existsSync(dmgPath)) {
    const display = run("codesign", ["-dv", "--verbose=4", dmgPath]);
    const details = `${display.stderr}\n${display.stdout}`;
    result.dmg = signatureKind(details);
    if (result.dmg === "developer-id") result.developerId = true;
    const staple = run("xcrun", ["stapler", "validate", dmgPath]);
    result.stapled = staple.status === 0;
    result.notarized = result.stapled;
  }

  return result;
}
