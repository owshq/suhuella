"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DownloadCtaButton } from "@/components/DownloadCtaButton";
import { SuhuellaLogo } from "@/components/icons/SuhuellaLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";
import { brand } from "@suhuella/brand";
import { formatAppVersion, getHeroOpenCta } from "@/lib/release";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

type HeroSectionProps = {
  downloadHref?: string;
  downloadAvailable?: boolean;
  embedded?: boolean;
  onClose?: () => void;
};

export function HeroSection({
  downloadHref = "/download",
  downloadAvailable = false,
  embedded = false,
  onClose,
}: HeroSectionProps) {
  const { locale, t } = useLocale();
  const { badge } = t.hero;
  const version = formatAppVersion();

  return (
    <section className="relative z-10 flex w-full flex-col items-start text-left">
      <motion.div
        custom={0}
        initial={embedded ? false : "hidden"}
        animate="visible"
        variants={fadeUp}
        className={embedded ? "mb-3" : "mb-6"}
      >
        <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
            <SuhuellaLogo className="h-5 w-5 text-slate-900" />
            {badge.name}
          </span>

          <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />

          <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--brand-accent)]">
            {version}
          </span>
        </span>
      </motion.div>

      <motion.h1
        custom={0.1}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className={
          embedded
            ? "max-w-xl text-2xl font-semibold leading-[1.15] tracking-[-0.03em] text-slate-900"
            : "max-w-xl text-[2.25rem] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-900 md:text-5xl lg:text-[3.25rem]"
        }
      >
        {t.hero.title}
      </motion.h1>

      <motion.p
        custom={0.2}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className={
          embedded
            ? "mt-3 max-w-lg text-sm font-normal leading-relaxed text-slate-600"
            : "mt-6 max-w-lg text-base font-normal leading-relaxed text-slate-600 md:text-lg"
        }
      >
        {t.hero.subtitle}
      </motion.p>

      <motion.div
        custom={0.35}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className={embedded ? "mt-5 flex flex-wrap items-center gap-2" : "mt-10 flex flex-wrap items-center gap-3"}
      >
        {downloadAvailable ? <DownloadCtaButton locale={locale} href={downloadHref} /> : null}
        {embedded && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-col items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.55)] hover:bg-black"
          >
            <span>{getHeroOpenCta(locale)}</span>
            <span className="text-[11px] font-medium text-white/70">
              {locale === "es"
                ? `La misma ${brand.displayName}, en el navegador.`
                : `The same ${brand.displayName}, in the browser.`}
            </span>
          </button>
        ) : (
          <Link
            href="/home"
            className={
              downloadAvailable
                ? "inline-flex flex-col items-center justify-center rounded-full border border-white/70 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm hover:bg-white"
                : "inline-flex flex-col items-center justify-center rounded-full bg-slate-900 px-7 py-3.5 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.55)] hover:bg-black md:px-9 md:py-4 md:text-lg"
            }
          >
            <span>{getHeroOpenCta(locale)}</span>
            <span
              className={
                downloadAvailable
                  ? "text-[11px] font-medium text-slate-500"
                  : "text-[11px] font-medium text-white/70"
              }
            >
              {locale === "es"
                ? `La misma ${brand.displayName}, en el navegador.`
                : `The same ${brand.displayName}, in the browser.`}
            </span>
          </Link>
        )}
        <Link
          href="/license"
          className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm hover:bg-white"
        >
          {locale === "es" ? "Ver planes" : "View plans"}
        </Link>
        {!embedded ? <LanguageSwitcher inline /> : null}
      </motion.div>
    </section>
  );
}
