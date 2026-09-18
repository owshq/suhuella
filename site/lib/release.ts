import type { Locale } from "@/lib/i18n/types";

/** Keep in sync with desktop/package.json when cutting releases. */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";

export function formatAppVersion(version = APP_VERSION): string {
  return version.startsWith("v") ? version : `v${version}`;
}

export function getHeroDownloadCta(locale: Locale, version = APP_VERSION): string {
  const label = formatAppVersion(version);
  return locale === "es" ? `Descargar ${label}` : `Download ${label}`;
}
