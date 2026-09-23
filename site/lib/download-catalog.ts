import { brand } from "@suhuella/brand";
import { deriveDisplayVersion } from "../../packages/product/src/lib/display-version.ts";
import { buildDownloadPreparingPath } from "./desktop-download-flow.ts";
import { visibleInstallers } from "./installer-availability.ts";
import type { ReleaseArchiveEntry, ReleaseManifest } from "./release-manifest.ts";

export type CatalogRowStatus = "available" | "unavailable";

export type CatalogRowAction =
  | { kind: "link"; href: string; labelKey: "open" | "download"; external?: boolean }
  | { kind: "none" };

export type DownloadCatalogRow = {
  id: string;
  version: string;
  channelKey: "preRc" | "stable" | "beta";
  platformKey: "web" | "mac" | "windows";
  status: CatalogRowStatus;
  action: CatalogRowAction;
  dateLabel: string;
  sizeLabel: string;
};

export function formatInstallerSize(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

function installerSizeLabel(release: ReleaseArchiveEntry, platform: "mac" | "windows"): string {
  const target = platform === "mac" ? release.downloads.mac : release.downloads.windows;
  return formatInstallerSize(target.size);
}

export function catalogChannelKey(
  version: string,
  channel: ReleaseManifest["channel"],
): "preRc" | "stable" | "beta" {
  if (version.includes("pre-rc")) return "preRc";
  if (channel === "beta") return "beta";
  return "stable";
}

function desktopDownloadAction(
  platform: "mac" | "windows",
  release: ReleaseArchiveEntry,
  archived: boolean,
): CatalogRowAction {
  const url = platform === "mac" ? release.mac : release.windows;
  if (archived && url) {
    return { kind: "link", href: url, labelKey: "download", external: true };
  }
  return {
    kind: "link",
    href: buildDownloadPreparingPath(platform),
    labelKey: "download",
    external: false,
  };
}

function desktopRowsFromRelease(
  release: ReleaseArchiveEntry,
  idPrefix: string,
): DownloadCatalogRow[] {
  const version = deriveDisplayVersion(release.version);
  const channelKey = catalogChannelKey(release.version, release.channel);
  const shown = visibleInstallers(release);
  const dateLabel = release.releaseDate || "—";
  const macSizeLabel = installerSizeLabel(release, "mac");
  const windowsSizeLabel = installerSizeLabel(release, "windows");
  const archived = idPrefix.startsWith("archive-");

  return [
    shown.mac
      ? {
          id: `${idPrefix}-mac`,
          version,
          channelKey,
          platformKey: "mac",
          status: "available",
          action: desktopDownloadAction("mac", release, archived),
          dateLabel,
          sizeLabel: macSizeLabel,
        }
      : {
          id: `${idPrefix}-mac`,
          version,
          channelKey,
          platformKey: "mac",
          status: "unavailable",
          action: { kind: "none" },
          dateLabel,
          sizeLabel: macSizeLabel,
        },
    shown.windows
      ? {
          id: `${idPrefix}-windows`,
          version,
          channelKey,
          platformKey: "windows",
          status: "available",
          action: desktopDownloadAction("windows", release, archived),
          dateLabel,
          sizeLabel: windowsSizeLabel,
        }
      : {
          id: `${idPrefix}-windows`,
          version,
          channelKey,
          platformKey: "windows",
          status: "unavailable",
          action: { kind: "none" },
          dateLabel,
          sizeLabel: windowsSizeLabel,
        },
  ];
}

/** Mac + Windows rows for the current public release. */
export function buildCurrentDesktopRows(
  release: ReleaseManifest | null,
): DownloadCatalogRow[] {
  if (!release) return [];
  return desktopRowsFromRelease(release, "current");
}

/** Older desktop builds — one row per platform per archived release. */
export function buildArchiveCatalogRows(
  release: ReleaseManifest | null,
): DownloadCatalogRow[] {
  if (!release?.archive?.length) return [];
  return release.archive.flatMap((entry, index) =>
    desktopRowsFromRelease(entry, `archive-${index}`),
  );
}

/** Current + archived desktop rows for the version table. */
export function buildAllDesktopCatalogRows(
  release: ReleaseManifest | null,
): DownloadCatalogRow[] {
  return [...buildCurrentDesktopRows(release), ...buildArchiveCatalogRows(release)];
}

export function releaseChannelLabel(
  release: ReleaseManifest | null,
  labels: { preRc: string; stable: string; beta: string },
): string {
  const version = release?.version ?? brand.release.version;
  const channel = release?.channel ?? brand.release.channel;
  const channelKey = catalogChannelKey(version, channel);
  if (channelKey === "preRc") return labels.preRc;
  if (channelKey === "beta") return labels.beta;
  return labels.stable;
}

export function filterCatalogRowsByPlatform(
  rows: DownloadCatalogRow[],
  platform: "mac" | "windows" | null,
): DownloadCatalogRow[] {
  if (!platform) return rows;
  return rows.filter((row) => row.platformKey === platform);
}

export function buildDownloadCatalogRows(
  release: ReleaseManifest | null,
): DownloadCatalogRow[] {
  const releaseVersion = release?.version ?? brand.release.version;
  const version = deriveDisplayVersion(releaseVersion);
  const channel = release?.channel ?? brand.release.channel;
  const channelKey = catalogChannelKey(releaseVersion, channel);
  const shown = visibleInstallers(release);
  const dateLabel = "—";

  const macSizeLabel = release ? installerSizeLabel(release, "mac") : "—";
  const windowsSizeLabel = release ? installerSizeLabel(release, "windows") : "—";

  const rows: DownloadCatalogRow[] = [
    {
      id: "web",
      version,
      channelKey,
      platformKey: "web",
      status: "available",
      action: { kind: "link", href: "/home", labelKey: "open" },
      dateLabel,
      sizeLabel: "—",
    },
  ];

  rows.push(
    shown.mac
      ? {
          id: "mac",
          version,
          channelKey,
          platformKey: "mac",
          status: "available",
          action: {
            kind: "link",
            href: buildDownloadPreparingPath("mac"),
            labelKey: "download",
            external: false,
          },
          dateLabel,
          sizeLabel: macSizeLabel,
        }
      : {
          id: "mac",
          version,
          channelKey,
          platformKey: "mac",
          status: "unavailable",
          action: { kind: "none" },
          dateLabel,
          sizeLabel: macSizeLabel,
        },
  );

  rows.push(
    shown.windows
      ? {
          id: "windows",
          version,
          channelKey,
          platformKey: "windows",
          status: "available",
          action: {
            kind: "link",
            href: buildDownloadPreparingPath("windows"),
            labelKey: "download",
            external: false,
          },
          dateLabel,
          sizeLabel: windowsSizeLabel,
        }
      : {
          id: "windows",
          version,
          channelKey,
          platformKey: "windows",
          status: "unavailable",
          action: { kind: "none" },
          dateLabel,
          sizeLabel: windowsSizeLabel,
        },
  );

  return rows;
}

export function downloadCatalogHasActiveInstallers(
  release: ReleaseManifest | null,
): boolean {
  const shown = visibleInstallers(release);
  return Boolean(shown.mac || shown.windows);
}
