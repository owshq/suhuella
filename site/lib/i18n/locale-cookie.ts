import type { Locale } from "./types";

export const LOCALE_COOKIE = "suhuella-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "es" || value === "en";
}

export function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
}
