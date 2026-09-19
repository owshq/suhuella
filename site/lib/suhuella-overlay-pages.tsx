import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageTitle } from "@/lib/i18n/page-title";
import { SuhuellaOverlayPage, suhuellaShellMetadata } from "@/lib/suhuella-shell";

export { suhuellaShellMetadata };

export async function generateLandingMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  return {
    title: { absolute: getPageTitle(locale, "home") },
    description: t.meta.description,
  };
}

export async function SuhuellaLandingPage() {
  return SuhuellaOverlayPage({ overlay: "landing" });
}

export async function SuhuellaLicenseOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "license" });
}

export async function SuhuellaDownloadOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "download" });
}

export async function SuhuellaSuccessOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "success" });
}
