import { brand } from "@suhuella/brand";
import bundledManifest from "../release.json";
import { getInstallerUrls, type InstallerUrls } from "@/lib/downloads";

export type ReleaseChannel = "stable" | "beta";

export type ReleaseManifest = {
  version: string;
  channel: ReleaseChannel;
  minimumVersion: string;
  mandatory: boolean;
  windows: string;
  mac: string;
};

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
  const windows = typeof record.windows === "string" ? record.windows.trim() : "";
  const mac = typeof record.mac === "string" ? record.mac.trim() : "";
  const minimumVersion =
    typeof record.minimumVersion === "string" && record.minimumVersion.trim()
      ? record.minimumVersion.trim()
      : version;

  if (!version) return null;
  if (windows && !isValidHttpsUrl(windows)) return null;
  if (mac && !isValidHttpsUrl(mac)) return null;

  return {
    version,
    channel: record.channel === "beta" ? "beta" : "stable",
    minimumVersion,
    mandatory: record.mandatory === true,
    windows,
    mac,
  };
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
