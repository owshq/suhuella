export type InstallerUrls = {
  windows: string;
  mac: string;
};

export function getInstallerUrls(): InstallerUrls {
  return {
    windows: process.env.INSTALLER_WINDOWS_URL?.trim() || "",
    mac: process.env.INSTALLER_MAC_URL?.trim() || "",
  };
}
