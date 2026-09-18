import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { PrivacyPageContent } from "@/components/PrivacyPageContent";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageTitle } from "@/lib/i18n/page-title";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);

  return {
    title: { absolute: getPageTitle(locale, "privacy") },
    description: t.legal.privacyParagraphs[0],
  };
}

export default function PrivacyPage() {
  return (
    <PageShell>
      <PrivacyPageContent />
    </PageShell>
  );
}
