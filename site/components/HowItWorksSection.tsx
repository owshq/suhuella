"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HowItWorksPitch({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();

  if (compact) {
    return (
      <section className="w-full pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t.howItWorks.eyebrow}
        </p>
        <h2 className="mt-1.5 text-base font-semibold leading-snug tracking-tight text-slate-900">
          {t.howItWorks.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t.howItWorks.subtitle}</p>
      </section>
    );
  }

  return (
    <div className="mb-12 text-center md:mb-14">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t.howItWorks.eyebrow}
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {t.howItWorks.title}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
        {t.howItWorks.subtitle}
      </p>
    </div>
  );
}

export function HowItWorksSection({
  compact = false,
  hideTitle = false,
}: {
  compact?: boolean;
  hideTitle?: boolean;
}) {
  const { t } = useLocale();

  if (compact) {
    return (
      <section className="mx-auto w-full px-0 pt-2 pb-2">
        {!hideTitle ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t.howItWorks.eyebrow}
            </p>
            <h2 className="mb-1 mt-1.5 text-base font-semibold leading-snug tracking-tight text-slate-900">
              {t.howItWorks.title}
            </h2>
            <p className="mb-3 text-sm leading-relaxed text-slate-600">{t.howItWorks.subtitle}</p>
          </>
        ) : null}
        <ol className="space-y-2">
          {t.howItWorks.steps.map((step) => (
            <li
              key={step.number}
              className="flex gap-3 rounded-xl border border-white/50 bg-white/35 px-3 py-2.5 backdrop-blur-sm"
            >
              <span className="shrink-0 font-mono text-[10px] font-bold leading-5 text-[var(--brand-accent)]">
                {step.number}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-10 md:pt-28 md:pb-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <HowItWorksPitch />
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        variants={container}
        className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
      >
        {t.howItWorks.steps.map((step) => (
          <motion.div key={step.number} variants={item}>
            <GlassCard className="h-full p-6 md:p-7">
              <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--brand-accent)]">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                {step.description}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
