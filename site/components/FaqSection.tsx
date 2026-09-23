"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";

export function FaqSection({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();

  if (compact) {
    return (
      <section className="w-full pt-2">
        <h2 className="mb-3 text-base font-semibold tracking-tight text-slate-900">
          {t.faq.title}
        </h2>
        <div className="divide-y divide-slate-200/60 overflow-hidden rounded-xl border border-white/50 bg-white/40 backdrop-blur-sm">
          {t.faq.items.map((item) => (
            <details key={item.question} className="group px-3 py-2.5">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-2">
                  {item.question}
                  <span className="mt-0.5 shrink-0 text-xs font-normal text-slate-400 transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 pb-20 md:pb-28">
      <h2 className="text-center text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {t.faq.title}
      </h2>
      <GlassCard className="mt-8 p-0 md:mt-10">
        <div className="divide-y divide-slate-200/70">
          {t.faq.items.map((item) => (
            <div key={item.question} className="px-6 py-5 md:px-7 md:py-6">
              <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
