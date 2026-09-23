"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DownloadSection } from "@/components/DownloadSection";
import { EmbeddingsSection } from "@/components/EmbeddingsSection";
import { FaqSection } from "@/components/FaqSection";
import { FeaturesGrid } from "@/components/FeaturesGrid";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksPitch, HowItWorksSection } from "@/components/HowItWorksSection";
import { PrivacySection } from "@/components/PrivacySection";
import { SiteFooter } from "@/components/SiteFooter";
import { useLocale } from "@/components/providers/LocaleProvider";
import { hasDownloadableInstaller } from "@/lib/installer-availability";
import { getHeroOpenCta } from "@/lib/release";

const AppMockup = dynamic(
  () => import("@/components/AppMockup").then((mod) => ({ default: mod.AppMockup })),
  {
    ssr: false,
    loading: () => <div className="aspect-[16/10] w-full rounded-2xl bg-white/35" />,
  },
);

type LandingContentProps = {
  installerUrls?: {
    windows: string;
    mac: string;
  };
  embedded?: boolean;
  onClose?: () => void;
};

export function LandingContent({ installerUrls, embedded = false, onClose }: LandingContentProps) {
  const { locale } = useLocale();
  const downloadAvailable = hasDownloadableInstaller(installerUrls);
  const openLabel = getHeroOpenCta(locale);

  const body = embedded ? (
    <div className="relative overflow-x-clip pb-4 text-slate-900">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <HeroSection downloadAvailable={downloadAvailable} embedded />
        {downloadAvailable ? <DownloadSection compact installerUrls={installerUrls} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={openLabel}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.55)] transition hover:bg-black"
            >
              <ArrowRight className="h-5 w-5" strokeWidth={2.25} />
            </button>
          ) : null}
          <Link
            href="/license"
            className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm hover:bg-white"
          >
            {locale === "es" ? "Ver planes" : "View plans"}
          </Link>
        </div>
        <HowItWorksPitch compact />
        <AppMockup />
        <HowItWorksSection compact hideTitle />
        <FeaturesGrid compact />
        <PrivacySection compact />
        <FaqSection compact />
      </div>
    </div>
  ) : (
    <div className="relative min-h-screen overflow-x-clip text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-6 pt-24 lg:flex-row lg:items-start lg:pt-32">
        <div className="w-full pt-10 lg:w-5/12">
          <HeroSection downloadAvailable={downloadAvailable} />
        </div>

        <div className="flex w-full flex-col items-center lg:w-7/12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl"
          >
            <AppMockup />
            <div className="mt-2 w-full md:mt-3">
              <DownloadSection compact installerUrls={installerUrls} />
            </div>
          </motion.div>
        </div>
      </div>

      <HowItWorksSection />

      <EmbeddingsSection />

      <PrivacySection />

      <FeaturesGrid />

      <FaqSection />

      <SiteFooter />
    </div>
  );

  return body;
}
