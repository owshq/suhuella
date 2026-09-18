import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { TermsPageContent } from "@/components/TermsPageContent";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageTitle } from "@/lib/i18n/page-title";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);

  return {
    title: { absolute: getPageTitle(locale, "terms") },
    description: t.legal.termsParagraphs[0],
  };
}

export default function TermsPage() {
  return (
    <PageShell>
      <TermsPageContent />
    </PageShell>
  );
}
