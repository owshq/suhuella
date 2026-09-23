import type { InstallerUrls } from "./downloads.ts";
import { publicReleaseAliases } from "../../packages/product/src/lib/release-lifecycle.ts";

export type VisibleInstallers = {
  windows?: string;
  mac?: string;
};

function httpsInstallerUrl(value: string | undefined): string | undefined {
  const url = value?.trim() ?? "";
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function visibleInstallers(
  urls?: Partial<InstallerUrls> | null,
): VisibleInstallers {
  const windows = httpsInstallerUrl(urls?.windows);
  const mac = httpsInstallerUrl(urls?.mac);
  return {
    ...(windows ? { windows } : {}),
    ...(mac ? { mac } : {}),
  };
}

export function hasDownloadableInstaller(urls?: Partial<InstallerUrls> | null): boolean {
  const shown = visibleInstallers(urls);
  return Boolean(shown.windows || shown.mac);
}

export function publicReleasePayload(release: {
  version: string;
  channel: "stable" | "beta";
  minimumVersion: string;
  mandatory: boolean;
  notes?: string;
  releaseDate?: string;
  downloads?: {
    web: { available: boolean; url?: string | null };
    mac: { available: boolean; url?: string | null };
    windows: { available: boolean; url?: string | null };
  };
  distribution?: {
    channel: string;
    commercialCodeSigning: {
      mac: {
        app: string;
        dmg: string;
        developerId: boolean;
        notarized: boolean;
        stapled: boolean;
      };
      windows: {
        authenticode: string;
      };
      osInstall?: {
        mac?: { gatekeeperWarningExpected: boolean; installPath: string };
        windows?: { smartScreenWarningExpected: boolean; installPath: string };
      };
      publishBlockedByCommercialCodeSigning?: boolean;
    };
  };
  windows: string;
  mac: string;
}) {
  const shown = visibleInstallers(release);
  return {
    ...publicReleaseAliases(release),
    ...(release.releaseDate ? { releaseDate: release.releaseDate } : {}),
    ...(release.downloads ? { downloads: release.downloads } : {}),
    ...(release.distribution ? { distribution: release.distribution } : {}),
    ...shown,
  };
}
