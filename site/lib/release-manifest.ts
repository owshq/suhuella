import { brand } from "@suhuella/brand";
import bundledManifest from "../release.json";
import { getInstallerUrls, type InstallerUrls } from "@/lib/downloads";

export type ReleaseChannel = "stable" | "beta";

export type ReleaseDownloadTarget = {
  available: boolean;
  url: string | null;
  sha256?: string;
  filename?: string;
  size?: number;
};

export type ReleaseArchiveEntry = {
  version: string;
  channel: ReleaseChannel;
  minimumVersion: string;
  mandatory: boolean;
  notes: string;
  releaseDate: string;
  downloads: {
    web: ReleaseDownloadTarget;
    mac: ReleaseDownloadTarget;
    windows: ReleaseDownloadTarget;
  };
  windows: string;
  mac: string;
};

export type ReleaseManifest = ReleaseArchiveEntry & {
  archive?: ReleaseArchiveEntry[];
};

function downloadTarget(
  entry: unknown,
  legacyUrl: string,
): ReleaseDownloadTarget {
  if (entry && typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const urlRaw = record.url;
    const url =
      urlRaw === null || urlRaw === undefined
        ? null
        : typeof urlRaw === "string" && urlRaw.trim()
          ? urlRaw.trim()
          : null;
    const available = record.available === true || Boolean(url);
    const sha256 =
      typeof record.sha256 === "string" && /^[a-f0-9]{64}$/i.test(record.sha256.trim())
        ? record.sha256.trim().toLowerCase()
        : undefined;
    const filename =
      typeof record.filename === "string" && record.filename.trim()
        ? record.filename.trim()
        : undefined;
    const size =
      typeof record.size === "number" && Number.isFinite(record.size) && record.size > 0
        ? Math.trunc(record.size)
        : undefined;
    return {
      available,
      url,
      ...(sha256 ? { sha256 } : {}),
      ...(filename ? { filename } : {}),
      ...(size ? { size } : {}),
    };
  }
  const legacy = legacyUrl.trim();
  return { available: Boolean(legacy), url: legacy || null };
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function parseReleaseManifest(data: unknown): ReleaseManifest | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const version = typeof record.version === "string" ? record.version.trim() : "";
  const legacyWindows = typeof record.windows === "string" ? record.windows.trim() : "";
  const legacyMac = typeof record.mac === "string" ? record.mac.trim() : "";
  const downloadsRecord =
    record.downloads && typeof record.downloads === "object"
      ? (record.downloads as Record<string, unknown>)
      : null;
  const downloads = {
    web: downloadTarget(downloadsRecord?.web, ""),
    mac: downloadTarget(downloadsRecord?.mac, legacyMac),
    windows: downloadTarget(downloadsRecord?.windows, legacyWindows),
  };
  if (!downloadsRecord) {
    downloads.web.available = true;
  }
  const windows = downloads.windows.url ?? "";
  const mac = downloads.mac.url ?? "";
  const minimumVersion =
    typeof record.minimumVersion === "string" && record.minimumVersion.trim()
      ? record.minimumVersion.trim()
      : version;
  const releaseDate =
    typeof record.releaseDate === "string" ? record.releaseDate.trim() : "";

  if (!version) return null;
  if (windows && !isValidHttpsUrl(windows)) return null;
  if (mac && !isValidHttpsUrl(mac)) return null;

  const base: ReleaseManifest = {
    version,
    channel: record.channel === "beta" ? "beta" : "stable",
    minimumVersion,
    mandatory: record.mandatory === true,
    notes: typeof record.notes === "string" ? record.notes.trim() : "",
    releaseDate,
    downloads,
    windows,
    mac,
  };

  const archiveRaw = Array.isArray(record.archive) ? record.archive : [];
  const archive = archiveRaw
    .map((entry) => parseReleaseManifest(entry))
    .filter((entry): entry is ReleaseArchiveEntry => entry !== null);

  return archive.length > 0 ? { ...base, archive } : base;
}

export function manifestToInstallerUrls(
  manifest: ReleaseManifest,
): InstallerUrls {
  return {
    windows: manifest.windows,
    mac: manifest.mac,
  };
}

export { publicReleasePayload } from "./installer-availability.ts";

let cachedManifest: { value: ReleaseManifest; fetchedAt: number } | null = null;
const MANIFEST_CACHE_MS = 60_000;

function manifestFromLegacyEnv(): ReleaseManifest | null {
  const installers = getInstallerUrls();
  if (!installers.windows || !installers.mac) return null;

  // Leftover installer-env compatibility. Public version authority is BrandConfig.
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || brand.release.version;

  return {
    version,
    channel: "stable",
    minimumVersion: version,
    mandatory: false,
    notes: "",
    releaseDate: "",
    downloads: {
      web: { available: true, url: null },
      mac: { available: Boolean(installers.mac), url: installers.mac || null },
      windows: { available: Boolean(installers.windows), url: installers.windows || null },
    },
    windows: installers.windows,
    mac: installers.mac,
  };
}

function manifestFromBrand(): ReleaseManifest | null {
  return parseReleaseManifest(brand.release);
}

function manifestFromBundledFile(): ReleaseManifest | null {
  if (brand.id !== "suhuella") return manifestFromBrand();
  return parseReleaseManifest(bundledManifest) ?? manifestFromBrand();
}

async function manifestFromRemoteUrl(url: string): Promise<ReleaseManifest | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.error(`Release manifest fetch failed (${response.status})`);
      return null;
    }

    return parseReleaseManifest(await response.json());
  } catch (error) {
    console.error("Release manifest fetch error", error);
    return null;
  }
}

export async function getReleaseManifest(): Promise<ReleaseManifest | null> {
  const now = Date.now();
  if (cachedManifest && now - cachedManifest.fetchedAt < MANIFEST_CACHE_MS) {
    return cachedManifest.value;
  }

  const remoteUrl = brand.releaseRemoteEnabled ? process.env.RELEASE_MANIFEST_URL?.trim() : "";
  const remote = remoteUrl ? await manifestFromRemoteUrl(remoteUrl) : null;
  const bundled = manifestFromBundledFile();
  const legacy = manifestFromLegacyEnv();
  const manifest =
    [remote, bundled, legacy].find(
      (candidate) => candidate && (candidate.windows || candidate.mac),
    ) ??
    remote ??
    bundled ??
    legacy;

  if (manifest) {
    cachedManifest = { value: manifest, fetchedAt: now };
  }

  return manifest;
}
