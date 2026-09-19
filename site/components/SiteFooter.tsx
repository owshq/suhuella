"use client";

import { brand, supportMailto } from "@suhuella/brand";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";

export function SiteFooter() {
  const { t } = useLocale();

  return (
    <footer className="mt-auto w-full px-3 md:px-6">
      <div className="mx-auto max-w-6xl rounded-t-[1.35rem] bg-slate-900 px-4 py-5 text-white md:rounded-t-[1.75rem] md:px-8 md:py-7">
        <div className="flex flex-col items-center justify-between gap-4 text-sm sm:flex-row sm:gap-3">
          <p className="text-center text-white/90 sm:text-left">{t.footer.copyright}</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link
              href="/license"
              className="text-white/75 transition-colors hover:text-white"
            >
              License
            </Link>
            <Link
              href="/home"
              className="text-white/75 transition-colors hover:text-white"
            >
              Open {brand.displayName}
            </Link>
            <Link
              href="/privacy"
              className="text-white/75 transition-colors hover:text-white"
            >
              {t.footer.privacy}
            </Link>
            <Link
              href="/terms"
              className="text-white/75 transition-colors hover:text-white"
            >
              {t.footer.terms}
            </Link>
            <a
              href={supportMailto()}
              className="text-white/75 transition-colors hover:text-white"
            >
              {t.footer.support}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
