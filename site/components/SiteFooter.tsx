"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";

export function SiteFooter() {
  const { t } = useLocale();

  return (
    <footer className="mx-auto mt-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-col items-center justify-between gap-3 border-t border-white/50 pt-6 text-sm text-slate-600 sm:flex-row">
        <p>{t.footer.copyright}</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link
            href="/privacy"
            className="transition-colors hover:text-slate-900"
          >
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-slate-900">
            {t.footer.terms}
          </Link>
          <a
            href="mailto:support@suhuella.com"
            className="transition-colors hover:text-slate-900"
          >
            {t.footer.support}
          </a>
        </nav>
      </div>
    </footer>
  );
}
