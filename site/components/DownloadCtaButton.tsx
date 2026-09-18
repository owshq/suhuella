"use client";

import { GlowButton } from "@/components/GlowButton";
import { getHeroDownloadCta } from "@/lib/release";
import type { Locale } from "@/lib/i18n/types";

type DownloadCtaButtonProps = {
  locale: Locale;
  checkoutUrl: string;
};

export function DownloadCtaButton({
  locale,
  checkoutUrl,
}: DownloadCtaButtonProps) {
  const label = getHeroDownloadCta(locale);

  if (!checkoutUrl) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-slate-400 px-8 py-3.5 text-base font-bold text-white md:px-10 md:py-4 md:text-lg"
        title="Checkout not configured"
      >
        {label}
      </span>
    );
  }

  return (
    <GlowButton href={checkoutUrl} target="_blank" rel="noopener noreferrer">
      {label}
    </GlowButton>
  );
}
