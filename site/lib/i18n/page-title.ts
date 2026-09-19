import { brand } from "@suhuella/brand";
import { getDictionary } from "./dictionary";
import type { Locale } from "./types";

export type PageId = "home" | "privacy" | "terms" | "download" | "license";

export function getPageIdFromPathname(pathname: string): PageId {
  if (pathname.startsWith("/privacy") || pathname.startsWith("/privacidad")) {
    return "privacy";
  }
  if (pathname.startsWith("/terms") || pathname.startsWith("/terminos")) {
    return "terms";
  }
  if (pathname === "/license" || pathname.startsWith("/license?")) {
    return "license";
  }
  if (
    pathname.startsWith("/download") ||
    pathname.startsWith("/license/success") ||
    pathname.startsWith("/success") ||
    pathname.startsWith("/descarga-exitosa")
  ) {
    return "download";
  }
  return "home";
}

export function getPageTitle(locale: Locale, page: PageId): string {
  const t = getDictionary(locale);

  if (page === "home") {
    return t.meta.title;
  }

  if (page === "privacy") {
    return `${t.legal.privacyTitle} — ${brand.displayName}`;
  }

  if (page === "terms") {
    return `${t.legal.termsTitle} — ${brand.displayName}`;
  }

  if (page === "license") {
    return `${t.pageTitles.license} — ${brand.displayName}`;
  }

  return `${t.pageTitles.download} — ${brand.displayName}`;
}
