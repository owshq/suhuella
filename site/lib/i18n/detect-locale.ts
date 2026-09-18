import type { Locale } from "./types";

const SPANISH_TIMEZONES = new Set([
  "Europe/Madrid",
  "Atlantic/Canary",
  "Africa/Ceuta",
]);

export function detectDeviceLocale(): Locale {
  if (typeof window === "undefined") return "es";

  const languages =
    navigator.languages?.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const lang of languages) {
    const normalized = lang.toLowerCase();
    if (normalized.startsWith("es")) return "es";
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (SPANISH_TIMEZONES.has(timezone)) return "es";
  } catch {
    // Ignore timezone detection errors
  }

  return "en";
}
