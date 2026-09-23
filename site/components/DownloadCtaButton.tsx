"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { DownloadIcon } from "@/components/icons/DownloadIcon";
import { buildPrimaryDownloadHref } from "@/lib/desktop-download-flow";
import { getHeroDownloadCta } from "@/lib/release";
import type { Locale } from "@/lib/i18n/types";

type DownloadCtaButtonProps = {
  locale: Locale;
  href?: string;
};

const buttonClassName =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-slate-900 px-7 py-3.5 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.55)] transition-all duration-300 hover:bg-black hover:shadow-[0_14px_28px_-12px_rgba(15,23,42,0.7)] md:px-9 md:py-4 md:text-lg";

const iconClassName =
  "h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-y-0.5 md:h-[1.125rem] md:w-[1.125rem]";

export function DownloadCtaButton({
  locale,
  href,
}: DownloadCtaButtonProps) {
  const label = getHeroDownloadCta(locale);
  const resolvedHref = useMemo(() => href ?? buildPrimaryDownloadHref(), [href]);

  return (
    <motion.a
      href={resolvedHref}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={buttonClassName}
    >
      <DownloadIcon className={iconClassName} />
      {label}
    </motion.a>
  );
}
