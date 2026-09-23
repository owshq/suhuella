"use client";

import { motion } from "framer-motion";
import { Briefcase, Cpu, Monitor, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

const icons: LucideIcon[] = [Cpu, Sparkles, ShieldCheck, Monitor];

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function FeaturesGrid({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();

  if (compact) {
    return (
      <section className="w-full pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t.features.eyebrow}
        </p>
        <h2 className="mt-1.5 text-base font-semibold leading-snug tracking-tight text-slate-900">
          {t.features.title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{t.features.subtitle}</p>
        <div className="mt-3 grid gap-2">
          {t.features.items.map((feature, index) => {
            const Icon = icons[index] ?? Briefcase;
            const isPrimary = index === 0;

            return (
              <div
                key={feature.title}
                className={`flex gap-3 rounded-xl border px-3 py-2.5 backdrop-blur-sm ${
                  isPrimary
                    ? "border-[color-mix(in_srgb,var(--brand-accent)_35%,white)] bg-[color-mix(in_srgb,var(--brand-accent)_8%,white)]"
                    : "border-white/50 bg-white/40"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isPrimary
                      ? "bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-sm"
                      : "bg-white/80 text-[var(--brand-accent)]"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{feature.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 md:pb-28 md:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-12 text-center"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--brand-accent)] shadow-sm">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
          {t.features.eyebrow}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {t.features.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
          {t.features.subtitle}
        </p>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={container}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-4"
      >
        {t.features.items.map((feature, index) => {
          const Icon = icons[index] ?? Briefcase;
          return (
            <motion.div key={feature.title} variants={item}>
              <GlassCard className="group relative h-full overflow-hidden p-6 transition-all duration-300 hover:bg-white/50 hover:shadow-2xl hover:shadow-blue-900/10 md:p-8">
                <div className="mb-5 inline-flex rounded-xl bg-[var(--brand-accent)] p-3 text-[var(--brand-on-accent)] shadow-lg shadow-[color-mix(in_srgb,var(--brand-accent)_30%,transparent)] transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 md:text-xl">{feature.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
                  {feature.description}
                </p>
              </GlassCard>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
