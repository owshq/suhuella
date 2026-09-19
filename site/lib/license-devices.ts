import type { LicenseActivation } from "./license-context";

/** Device snapshot for Desktop main. deviceId is for deactivate only — never shown in UI. */
export type LicenseDevicePublic = {
  deviceId: string;
  name: string;
  platform: string;
  lastSeen: string;
  current: boolean;
};

export function publicDevicesForLicense(
  activations: LicenseActivation[],
  licenseId: string,
  currentDeviceId: string,
): LicenseDevicePublic[] {
  return activations
    .filter((item) => item.licenseId === licenseId && item.status === "active")
    .map((item) => ({
      deviceId: item.deviceId,
      name: item.deviceName.trim() || "Unknown device",
      platform: item.platform.trim() || "unknown",
      lastSeen: item.lastSeen,
      current: item.deviceId === currentDeviceId,
    }))
    .sort((left, right) => {
      if (left.current !== right.current) return left.current ? -1 : 1;
      return right.lastSeen.localeCompare(left.lastSeen);
    });
}
