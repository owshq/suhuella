import { spawnSync } from "node:child_process";

/**
 * Resolve the macOS codesign identity.
 * Developer ID Application when installed or CSC_NAME is set.
 * Otherwise "-" (complete ad-hoc sign) so codesign --verify can pass.
 * identity: null is forbidden — it leaves Identifier=Electron and a broken seal.
 */
export function resolveMacCodesignIdentity() {
  const fromEnv = (process.env.CSC_NAME || process.env.MAC_CODESIGN_IDENTITY || "").trim();
  if (fromEnv) return fromEnv;

  const listed = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
    timeout: 8000,
  });
  const match = listed.stdout?.match(/Developer ID Application: [^\n]+/);
  if (match) {
    const quoted = match[0].match(/"([^"]+)"/);
    return quoted?.[1] ?? match[0];
  }

  return "-";
}

export function isDeveloperIdIdentity(identity) {
  return Boolean(identity) && identity !== "-" && identity !== "null";
}

export function canNotarize() {
  return Boolean(
    process.env.APPLE_ID &&
      process.env.APPLE_APP_SPECIFIC_PASSWORD &&
      process.env.APPLE_TEAM_ID,
  );
}
