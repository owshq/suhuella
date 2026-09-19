import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getPageTitle } from "@/lib/i18n/page-title";
import { SuhuellaLicenseOverlayPage } from "@/lib/suhuella-overlay-pages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: { absolute: getPageTitle(locale, "license") },
  };
}

export default SuhuellaLicenseOverlayPage;
