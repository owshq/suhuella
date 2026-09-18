"use client";

import { LegalArticle } from "@/components/LegalArticle";
import { useLocale } from "@/components/providers/LocaleProvider";

export function TermsPageContent() {
  const { t } = useLocale();

  return (
    <LegalArticle
      title={t.legal.termsTitle}
      updated={t.legal.updated}
      paragraphs={t.legal.termsParagraphs}
    />
  );
}
