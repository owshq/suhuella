"use client";

import { LegalArticle } from "@/components/LegalArticle";
import { useLocale } from "@/components/providers/LocaleProvider";

export function PrivacyPageContent() {
  const { t } = useLocale();

  return (
    <LegalArticle
      title={t.legal.privacyTitle}
      updated={t.legal.updated}
      paragraphs={t.legal.privacyParagraphs}
    />
  );
}
