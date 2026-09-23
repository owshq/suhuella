/**
 * Sign + notarize + staple the shipping DMG when Developer ID credentials exist.
 * No-op for local adhoc builds (publish must still refuse those).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../../brands/select.mjs";
import {
  canNotarize,
  isDeveloperIdIdentity,
  resolveMacCodesignIdentity,
} from "./mac-signing.mjs";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const version = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8")).version;
const dmgPath = path.join(
  desktopRoot,
  ".build",
  brandId,
  "release",
  `${identity.desktopProductName}-${version}.dmg`,
);

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`${cmd} ${args.join(" ")} failed (${result.status})`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(dmgPath)) {
  console.error(`DMG missing: ${dmgPath}`);
  process.exit(1);
}

const signingIdentity = resolveMacCodesignIdentity();
if (!isDeveloperIdIdentity(signingIdentity)) {
  console.log("[dmg] skip seal — no Developer ID (local adhoc only; publish will refuse)");
  process.exit(0);
}

console.log(`[dmg] codesign ${signingIdentity} ${dmgPath}`);
run("codesign", ["--force", "--sign", signingIdentity, dmgPath]);

if (!canNotarize()) {
  console.log(
    "[dmg] skip notarize — need APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID",
  );
  process.exit(0);
}

console.log(`[dmg] notarytool submit ${dmgPath}`);
run("xcrun", [
  "notarytool",
  "submit",
  dmgPath,
  "--apple-id",
  process.env.APPLE_ID,
  "--password",
  process.env.APPLE_APP_SPECIFIC_PASSWORD,
  "--team-id",
  process.env.APPLE_TEAM_ID,
  "--wait",
]);

console.log(`[dmg] stapler staple ${dmgPath}`);
run("xcrun", ["stapler", "staple", dmgPath]);
run("xcrun", ["stapler", "validate", dmgPath]);
console.log("[dmg] sealed (signed + notarized + stapled)");
