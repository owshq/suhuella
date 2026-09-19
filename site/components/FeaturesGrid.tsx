"use client";

import { motion } from "framer-motion";
import { Briefcase, Cpu, Lock, ShieldCheck, Zap } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

const icons = [Lock, Zap, Briefcase] as const;

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

export function FeaturesGrid() {
  const { t } = useLocale();

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
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={container}
        className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
      >
        {t.features.items.map((feature, index) => {
          const Icon = icons[index] ?? Cpu;
          return (
            <motion.div key={feature.title} variants={item}>
              <GlassCard className="group relative h-full overflow-hidden p-6 transition-all duration-300 hover:bg-white/50 hover:shadow-2xl hover:shadow-blue-900/10 md:p-8">
                <div className="mb-5 inline-flex rounded-xl bg-[var(--brand-accent)] p-3 text-[var(--brand-on-accent)] shadow-lg shadow-[color-mix(in_srgb,var(--brand-accent)_30%,transparent)] transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 md:text-xl">
                  {feature.title}
                </h3>
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
