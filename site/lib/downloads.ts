export type InstallerUrls = {
  windows: string;
  mac: string;
};

function readServerInstallerUrl(value: string | undefined): string {
  const url = value?.trim() ?? "";
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Legacy fallback when release.json is unavailable.
 * Prefer RELEASE_MANIFEST_URL → site/release.json (see lib/release-manifest.ts).
 */
export function getInstallerUrls(): InstallerUrls {
  return {
    windows: readServerInstallerUrl(process.env.INSTALLER_WINDOWS_URL),
    mac: readServerInstallerUrl(process.env.INSTALLER_MAC_URL),
  };
}
