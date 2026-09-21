import { brand } from "@suhuella/brand";
import { deriveDisplayVersion } from "../../packages/product/src/lib/display-version.ts";
import type { Locale } from "@/lib/i18n/types";

/** Internal release version. Customer labels use formatAppVersion. */
export const APP_VERSION = brand.release.version;

export function formatAppVersion(version = APP_VERSION): string {
  const display = deriveDisplayVersion(version);
  return display.startsWith("v") ? display : `v${display}`;
}

export function getHeroDownloadCta(locale: Locale): string {
  return locale === "es" ? `Descargar ${brand.displayName}` : `Download ${brand.displayName}`;
}

export function getHeroOpenCta(locale: Locale): string {
  return locale === "es" ? `Abrir ${brand.displayName}` : `Open ${brand.displayName}`;
}
