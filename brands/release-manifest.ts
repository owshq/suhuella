import type { BrandConfig } from "./types.ts";

export type DownloadTargetManifest = {
  available: boolean;
  url: string | null;
};

/** Operator-editable release manifest (`brands/<id>/release.json`). */
export type BrandReleaseManifest = {
  brandId?: string;
  version: string;
  channel: string;
  minimumVersion: string;
  mandatory: boolean;
  releaseDate?: string;
  notes?: string;
  downloads?: {
    web?: Partial<DownloadTargetManifest>;
    mac?: Partial<DownloadTargetManifest>;
    windows?: Partial<DownloadTargetManifest>;
  };
  /** Legacy flat URLs — still read when downloads.* is absent. */
  mac?: string;
  windows?: string;
};

function installerUrl(
  entry: Partial<DownloadTargetManifest> | undefined,
  legacy: string | undefined,
): string {
  const fromDownloads =
    typeof entry?.url === "string" ? entry.url.trim() : entry?.url === null ? "" : "";
  if (fromDownloads) return fromDownloads;
  return typeof legacy === "string" ? legacy.trim() : "";
}

/** Map manifest JSON into BrandConfig.release — no duplicate version strings in brand.ts. */
export function brandReleaseFromManifest(manifest: BrandReleaseManifest): BrandConfig["release"] {
  const channel = manifest.channel === "beta" ? "beta" : "stable";
  return {
    version: manifest.version.trim(),
    channel,
    minimumVersion: manifest.minimumVersion.trim(),
    mandatory: Boolean(manifest.mandatory),
    windows: installerUrl(manifest.downloads?.windows, manifest.windows),
    mac: installerUrl(manifest.downloads?.mac, manifest.mac),
  };
}
