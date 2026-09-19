"use client";

import { motion } from "framer-motion";
import { Cpu, FileText, Folder, HardDrive, Info, Layers, Timer } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

const statIcons = [Cpu, HardDrive, Timer] as const;

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function EmbeddingsSection() {
  const { t } = useLocale();
  const { embeddings } = t;

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-20 md:pt-14 md:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mb-8 text-center md:mb-10"
      >
        <div className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/50 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm md:text-sm">
          <Layers className="h-4 w-4 shrink-0 text-[var(--brand-accent)]" strokeWidth={2} />
          {embeddings.models}
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {embeddings.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
          {embeddings.subtitle}
        </p>
      </motion.div>

      <GlassCard className="overflow-hidden p-0 md:p-0">
        <div className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full bg-indigo-400/10 blur-3xl" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={container}
          className="relative"
        >
          <motion.div variants={item} className="grid lg:grid-cols-[minmax(0,1fr)_220px]">
            <SuggestionsPreview
              fileName={t.mockup.fileName}
              saveAsHint={t.mockup.saveAsHint}
              suggestions={t.mockup.suggestions}
              matchLabel={t.mockup.matchLabel}
            />

            <StatsBlock stats={embeddings.stats} statsNote={embeddings.statsNote} />
          </motion.div>
        </motion.div>
      </GlassCard>
    </section>
  );
}

type StatsBlockProps = {
  stats: Array<{ value: string; label: string }>;
  statsNote: { title: string; description: string };
};

function StatsBlock({ stats, statsNote }: StatsBlockProps) {
  return (
    <div className="relative border-t border-white/35 bg-white/15 px-4 py-4 lg:border-t-0 lg:border-l lg:px-5 lg:py-5">
      <div className="absolute right-3 top-3 z-10 lg:right-4 lg:top-4">
        <button
          type="button"
          aria-label={statsNote.title}
          className="group relative flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/50 hover:text-[var(--brand-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand-accent)_40%,transparent)]"
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2.25} />

          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-56 rounded-xl border border-white/60 bg-white/95 p-3 text-left opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:w-64"
          >
            <span className="block text-xs font-semibold text-slate-800">
              {statsNote.title}
            </span>
            <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
              {statsNote.description}
            </span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4 lg:pt-1">
        {stats.map((stat, index) => {
          const Icon = statIcons[index] ?? Cpu;
          return (
            <div key={stat.label} className="text-center lg:text-left">
              <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] text-[var(--brand-accent)] lg:mx-0">
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <p className="text-base font-bold tracking-tight text-slate-900">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs font-medium leading-snug text-slate-500">
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SuggestionsPreviewProps = {
  fileName: string;
  saveAsHint: string;
  suggestions: Array<{ path: string; match: number }>;
  matchLabel: string;
};

function SuggestionsPreview({
  fileName,
  saveAsHint,
  suggestions,
  matchLabel,
}: SuggestionsPreviewProps) {
  return (
    <div aria-hidden className="relative min-w-0 px-4 py-4 md:px-5 md:py-5">
      <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-white/40 bg-white/25 px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60">
          <FileText className="h-4 w-4 text-rose-500" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-slate-700 md:text-xs">
            {fileName}
          </p>
          <p className="text-[10px] text-slate-400">{saveAsHint}</p>
        </div>
      </div>

      <div className="relative">
        <ul
          className="space-y-0.5 [mask-image:linear-gradient(to_bottom,black_75%,transparent_100%)]"
          style={{ maxHeight: "11.5rem" }}
        >
          {suggestions.map((folder, index) => {
            const isTopMatch = index === 0;

            return (
              <li
                key={folder.path}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 md:gap-3 md:px-2.5 md:py-2 ${
                  isTopMatch ? "bg-[color-mix(in_srgb,var(--brand-accent)_8%,transparent)]" : "hover:bg-white/20"
                }`}
              >
                <span
                  className={`h-8 w-0.5 shrink-0 rounded-full ${
                    isTopMatch ? "bg-[var(--brand-accent)]" : "bg-transparent"
                  }`}
                  aria-hidden
                />

                <Folder
                  className={`h-4 w-4 shrink-0 ${
                    isTopMatch ? "text-[var(--brand-accent)]" : "text-slate-400"
                  }`}
                  fill={isTopMatch ? "var(--brand-accent)" : "none"}
                  strokeWidth={2}
                />

                <span
                  className={`min-w-0 flex-1 truncate text-[11px] font-medium md:text-xs ${
                    isTopMatch ? "text-slate-900" : "text-slate-600"
                  }`}
                >
                  {folder.path}
                </span>

                <div className="hidden w-16 shrink-0 sm:block">
                  <div className="h-1 overflow-hidden rounded-full bg-white/40">
                    <div
                      className={`h-full rounded-full ${
                        isTopMatch
                          ? "bg-gradient-to-r from-[var(--brand-accent)] to-[color-mix(in_srgb,var(--brand-accent)_50%,white)]"
                          : "bg-slate-300/80"
                      }`}
                      style={{ width: `${folder.match}%` }}
                    />
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold md:text-[10px] ${
                    isTopMatch
                      ? "bg-[color-mix(in_srgb,var(--brand-accent)_15%,transparent)] text-[var(--brand-accent)]"
                      : "text-slate-500"
                  }`}
                >
                  {folder.match}%{matchLabel ? ` ${matchLabel}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
