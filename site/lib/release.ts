import { brand } from "@suhuella/brand";
import type { Locale } from "@/lib/i18n/types";

/** Public version follows BrandConfig / release metadata, not a stale Next env. */
export const APP_VERSION = brand.release.version;

export function formatAppVersion(version = APP_VERSION): string {
  return version.startsWith("v") ? version : `v${version}`;
}

export function getHeroDownloadCta(locale: Locale): string {
  return locale === "es" ? `Descargar ${brand.displayName}` : `Download ${brand.displayName}`;
}

export function getHeroOpenCta(locale: Locale): string {
  return locale === "es" ? `Abrir ${brand.displayName}` : `Open ${brand.displayName}`;
}
