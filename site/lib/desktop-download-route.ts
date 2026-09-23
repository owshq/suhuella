import type { ReleaseManifest } from "./release-manifest.ts";
import {
  DOWNLOAD_DISTRIBUTION_MAC,
  DOWNLOAD_DISTRIBUTION_WIN,
  type DesktopDownloadPlatform,
} from "./desktop-download-flow.ts";

export type DesktopDownloadRouteResult =
  | { kind: "redirect"; location: string; status: 302 }
  | { kind: "not_found"; body: string };

const PLATFORM_ALIASES: Record<DesktopDownloadPlatform, string> = {
  mac: DOWNLOAD_DISTRIBUTION_MAC,
  windows: DOWNLOAD_DISTRIBUTION_WIN,
};

function normalizeHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://")) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Only distribution aliases from the frozen public API — never arbitrary redirect targets. */
export function isAuthorizedInstallerUrl(
  url: string,
  platform: DesktopDownloadPlatform,
): boolean {
  const normalized = normalizeHttpsUrl(url);
  const expected = normalizeHttpsUrl(PLATFORM_ALIASES[platform]);
  return Boolean(normalized && expected && normalized === expected);
}

export function parseDesktopDownloadPlatform(
  value: string,
): DesktopDownloadPlatform | null {
  if (value === "mac" || value === "windows") return value;
  return null;
}

/**
 * Resolve a public desktop download without fetching installer bytes.
 * 302 + Cache-Control: no-store — the alias target may change between releases;
 * matches download.suhuella.com worker behavior and avoids caching a stale hop.
 */
export function resolveDesktopDownloadRoute(
  platformParam: string,
  manifest: ReleaseManifest | null,
): DesktopDownloadRouteResult {
  const platform = parseDesktopDownloadPlatform(platformParam);
  if (!platform) {
    return { kind: "not_found", body: "Not found" };
  }

  const entry = manifest?.downloads[platform];
  const source = entry?.url?.trim() ?? "";
  if (!manifest || !entry?.available || !source) {
    return { kind: "not_found", body: "Installer not published yet." };
  }

  if (!isAuthorizedInstallerUrl(source, platform)) {
    return { kind: "not_found", body: "Installer unavailable." };
  }

  return { kind: "redirect", location: source, status: 302 };
}

export function desktopDownloadRouteResponse(result: DesktopDownloadRouteResult): Response {
  if (result.kind === "redirect") {
    return new Response(null, {
      status: result.status,
      headers: {
        Location: result.location,
        "cache-control": "no-store",
      },
    });
  }
  return new Response(result.body, { status: 404 });
}
