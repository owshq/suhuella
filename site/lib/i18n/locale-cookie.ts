import type { Locale } from "./types";

export const LOCALE_COOKIE = "suhuella-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "es" || value === "en";
}
