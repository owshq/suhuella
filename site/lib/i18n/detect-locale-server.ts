import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./locale-cookie";
import type { Locale } from "./types";

function localeFromAcceptLanguage(value: string | null): Locale | null {
  if (!value) return null;

  for (const part of value.split(",")) {
    const language = part.split(";")[0]?.trim().toLowerCase();
    if (!language) continue;
    if (language.startsWith("es")) return "es";
    if (language.startsWith("en")) return "en";
  }

  return null;
}

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  return localeFromAcceptLanguage(headerStore.get("accept-language")) ?? "es";
}
