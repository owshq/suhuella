/**
 * Web download UX routes — user-facing preparation page on suhuella.com.
 *
 * Stable public distribution API (docs, support, scripts, updaters):
 *   https://download.suhuella.com/latest/mac
 *   https://download.suhuella.com/latest/win
 *
 * The website consumes those aliases internally; users stay on suhuella.com.
 */
export const DOWNLOAD_DISTRIBUTION_MAC = "https://download.suhuella.com/latest/mac";
export const DOWNLOAD_DISTRIBUTION_WIN = "https://download.suhuella.com/latest/win";

export type DesktopDownloadPlatform = "mac" | "windows";

export function buildDownloadPreparingPath(platform: DesktopDownloadPlatform): string {
  return `/download/preparing?platform=${platform}`;
}

/** @deprecated Use buildDownloadPreparingPath */
export const buildDownloadSuccessPath = buildDownloadPreparingPath;

/** Approximate client OS for download CTA — honest, never overclaims. */
export function detectClientDownloadPlatform(): DesktopDownloadPlatform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod|Android/i.test(ua)) return null;
  if (/Win/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  return null;
}

export function buildPrimaryDownloadHref(): string {
  const platform = detectClientDownloadPlatform();
  if (platform) return buildDownloadPreparingPath(platform);
  return "/download";
}

export function parseDownloadPreparingPlatform(
  value: string | null | undefined,
): DesktopDownloadPlatform | null {
  if (value === "mac" || value === "windows") return value;
  return null;
}

/** @deprecated Use parseDownloadPreparingPlatform */
export const parseDownloadSuccessPlatform = parseDownloadPreparingPlatform;
