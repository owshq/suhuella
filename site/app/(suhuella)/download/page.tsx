import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageTitle } from "@/lib/i18n/page-title";
import { SuhuellaDownloadOverlayPage } from "@/lib/suhuella-overlay-pages";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  return {
    title: { absolute: getPageTitle(locale, "download") },
    description: t.download.catalogSubtitle,
  };
}

export default SuhuellaDownloadOverlayPage;
