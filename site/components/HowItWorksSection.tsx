"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HowItWorksSection() {
  const { t } = useLocale();

  return (
    <section className="mx-auto max-w-6xl px-6 pt-20 pb-10 md:pt-28 md:pb-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-12 text-center md:mb-14"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {t.howItWorks.title}
        </h2>
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
