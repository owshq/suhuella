/**
 * electron-builder afterSign hook. No-op unless Developer ID + notarize env are set.
 */
const path = require("node:path");
const { existsSync } = require("node:fs");

exports.default = async function notarizeMac(context) {
  if (context.electronPlatformName !== "darwin") return;

  const identity = process.env.CSC_NAME || process.env.MAC_CODESIGN_IDENTITY || "";
  const canNotarize = Boolean(
    process.env.APPLE_ID &&
      process.env.APPLE_APP_SPECIFIC_PASSWORD &&
      process.env.APPLE_TEAM_ID &&
      identity &&
      identity !== "-",
  );
  if (!canNotarize) {
    console.log(
      "[sign] skip notarize — need CSC_NAME (Developer ID) + APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID",
    );
    return;
  }

  const { notarize } = require("@electron/notarize");
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  if (!existsSync(appPath)) {
    throw new Error(`Notarize: missing ${appPath}`);
  }

  console.log(`[sign] notarizing ${appPath}`);
  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
