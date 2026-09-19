"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import type { Locale } from "@/lib/i18n/types";

const options: Locale[] = ["es", "en"];

type LanguageSwitcherProps = {
  inline?: boolean;
};

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={
        inline
          ? "flex items-center gap-0.5 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-sm"
          : "fixed top-5 right-5 z-50 flex items-center gap-0.5 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-sm"
      }
    >
      {options.map((option) => {
        const active = locale === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-all duration-200 ${
              active
                ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)] shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
            aria-pressed={active}
            aria-label={option === "es" ? "Español" : "English"}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
