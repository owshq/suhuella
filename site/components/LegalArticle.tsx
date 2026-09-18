"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SuhuellaLogo } from "@/components/icons/SuhuellaLogo";
import { GlassCard } from "@/components/ui/GlassCard";

type LegalArticleProps = {
  title: string;
  updated: string;
  paragraphs: string[];
};

export function LegalArticle({ title, updated, paragraphs }: LegalArticleProps) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <div className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
        >
          <SuhuellaLogo className="h-6 w-6" />
            SuHuella
        </Link>
        <LanguageSwitcher inline />
      </div>

      <GlassCard className="p-8 md:p-10">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {updated}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {title}
        </h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600 md:text-base">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </GlassCard>

      <SiteFooter />
    </main>
  );
}
