"use client";

import { motion } from "framer-motion";
import { DownloadCtaButton } from "@/components/DownloadCtaButton";
import { SuhuellaLogo } from "@/components/icons/SuhuellaLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";
import { formatAppVersion } from "@/lib/release";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

type HeroSectionProps = {
  checkoutUrl: string;
};

export function HeroSection({ checkoutUrl }: HeroSectionProps) {
  const { locale, t } = useLocale();
  const { badge } = t.hero;
  const version = formatAppVersion();

  return (
    <section className="relative z-10 flex w-full flex-col items-start text-left">
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mb-6"
      >
        <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
            <SuhuellaLogo className="h-5 w-5 text-slate-900" />
            {badge.name}
          </span>

          <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />

          <span className="text-slate-500">{badge.latency}</span>

          <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />

          <span className="font-mono text-[11px] text-slate-500">
            {badge.memory}
          </span>

          <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />

          <span className="rounded-full bg-[#0084FF]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0084FF]">
            {version}
          </span>
        </span>
      </motion.div>

      <motion.h1
        custom={0.1}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="max-w-xl text-[2.25rem] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-900 md:text-5xl lg:text-[3.25rem]"
      >
        {t.hero.title}
      </motion.h1>

      <motion.p
        custom={0.2}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mt-6 max-w-lg text-base font-normal leading-relaxed text-slate-600 md:text-lg"
      >
        {t.hero.subtitle}
      </motion.p>

      <motion.div
        custom={0.35}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        className="mt-10 flex flex-wrap items-center gap-3"
      >
        <DownloadCtaButton locale={locale} checkoutUrl={checkoutUrl} />
        <LanguageSwitcher inline />
      </motion.div>
    </section>
  );
}
