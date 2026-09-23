/**
 * afterPack: complete ad-hoc (or Developer ID) sign without Apple timestamp.
 * electron-builder's default ad-hoc path uses --timestamp per helper and hangs.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

function resolveIdentity() {
  const fromEnv = (process.env.CSC_NAME || process.env.MAC_CODESIGN_IDENTITY || "").trim();
  if (fromEnv) return fromEnv;
  const listed = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
    timeout: 8000,
  });
  const match = listed.stdout?.match(/Developer ID Application: "([^"]+)"/);
  return match?.[1] ?? "-";
}

exports.default = async function signMacApp(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const identifier = context.packager.appInfo.id;
  const entitlements = path.join(context.packager.projectDir, "build", "entitlements.mac.plist");
  const identity = resolveIdentity();

  const args = [
    "--force",
    "--deep",
    "--sign",
    identity,
    "--identifier",
    identifier,
    "--entitlements",
    entitlements,
    "--options",
    "runtime",
    appPath,
  ];

  console.log(`[sign] codesign ${identity} ${appPath}`);
  const result = spawnSync("codesign", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`codesign failed (${result.status})`);
  }
};
