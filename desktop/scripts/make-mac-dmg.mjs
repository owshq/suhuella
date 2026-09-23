import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brandIdentity, resolveBrandId } from "../../brands/select.mjs";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandId = resolveBrandId();
const identity = brandIdentity(brandId);
const version = JSON.parse(readFileSync(path.join(desktopRoot, "package.json"), "utf8")).version;
const appPath = path.join(
  desktopRoot,
  ".build",
  brandId,
  "release",
  "mac-arm64",
  `${identity.desktopProductName}.app`,
);
const dest = path.join(
  desktopRoot,
  ".build",
  brandId,
  "release",
  `${identity.desktopProductName}-${version}.dmg`,
);
const stage = mkdtempSync(path.join(tmpdir(), "suhuella-dmg-"));

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) {
    rmSync(stage, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

run("ditto", [appPath, path.join(stage, `${identity.desktopProductName}.app`)]);
run("ln", ["-s", "/Applications", path.join(stage, "Applications")]);
run("hdiutil", [
  "create",
  "-volname",
  identity.desktopProductName,
  "-srcfolder",
  stage,
  "-ov",
  "-format",
  "UDZO",
  dest,
]);
rmSync(stage, { recursive: true, force: true });
console.log(`[dmg] ${dest}`);
