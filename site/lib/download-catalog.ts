import { brand } from "@suhuella/brand";
import { deriveDisplayVersion } from "../../packages/product/src/lib/display-version.ts";
import { visibleInstallers } from "./installer-availability.ts";
import type { ReleaseManifest } from "./release-manifest.ts";

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
};

export function catalogChannelKey(
  version: string,
  channel: ReleaseManifest["channel"],
): "preRc" | "stable" | "beta" {
  if (version.includes("pre-rc")) return "preRc";
  if (channel === "beta") return "beta";
  return "stable";
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

  const rows: DownloadCatalogRow[] = [
    {
      id: "web",
      version,
      channelKey,
      platformKey: "web",
      status: "available",
      action: { kind: "link", href: "/home", labelKey: "open" },
      dateLabel,
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
            href: shown.mac,
            labelKey: "download",
            external: true,
          },
          dateLabel,
        }
      : {
          id: "mac",
          version,
          channelKey,
          platformKey: "mac",
          status: "unavailable",
          action: { kind: "none" },
          dateLabel,
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
            href: shown.windows,
            labelKey: "download",
            external: true,
          },
          dateLabel,
        }
      : {
          id: "windows",
          version,
          channelKey,
          platformKey: "windows",
          status: "unavailable",
          action: { kind: "none" },
          dateLabel,
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
