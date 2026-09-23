"use client";

import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

export function PrivacySection({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();

  if (compact) {
    return (
      <section className="w-full pt-1">
        <div className="flex items-start gap-2.5 rounded-xl border border-white/50 bg-white/40 px-3 py-2.5 backdrop-blur-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-accent)]" strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{t.privacy.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t.privacy.description}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <GlassCard className="relative overflow-hidden p-8 md:p-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] blur-3xl" />

          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-8">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-lg shadow-[color-mix(in_srgb,var(--brand-accent)_25%,transparent)]">
              <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
            </div>

            <div className="flex-1">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-[var(--brand-accent)]">
                <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                {t.privacy.eyebrow}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                {t.privacy.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
                {t.privacy.description}
              </p>
              <Link
                href="/privacy"
                className="mt-4 inline-block text-sm font-semibold text-[var(--brand-accent)] transition-colors hover:text-slate-900"
              >
                {t.footer.privacy}
              </Link>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </section>
  );
}
