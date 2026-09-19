"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { DownloadSection } from "@/components/DownloadSection";
import { EmbeddingsSection } from "@/components/EmbeddingsSection";
import { FeaturesGrid } from "@/components/FeaturesGrid";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { PrivacySection } from "@/components/PrivacySection";
import { SiteFooter } from "@/components/SiteFooter";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { hasDownloadableInstaller } from "@/lib/installer-availability";

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
  const { t } = useLocale();
  const downloadAvailable = hasDownloadableInstaller(installerUrls);

  const body = (
    <div className={`relative overflow-x-clip text-slate-900 ${embedded ? "pb-4" : "min-h-screen"}`}>
      <div
        className={`mx-auto flex flex-col items-center justify-between ${
          embedded
            ? "max-w-xl gap-6"
            : "max-w-7xl gap-16 px-6 pt-24 lg:flex-row lg:items-start lg:pt-32"
        }`}
      >
        <div className={`w-full ${embedded ? "" : "pt-10 lg:w-5/12"}`}>
          <HeroSection downloadAvailable={downloadAvailable} onClose={onClose} embedded={embedded} />
        </div>

        <div className={`flex w-full flex-col items-center ${embedded ? "" : "lg:w-7/12"}`}>
          <motion.div
            initial={embedded ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: embedded ? 0.2 : 0.9, delay: embedded ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${embedded ? "" : "max-w-3xl"}`}
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

      <section className={`mx-auto max-w-3xl ${embedded ? "px-0 pb-6" : "px-6 pb-20 md:pb-28"}`}>
        <h2
          className={`text-center font-semibold tracking-tight text-slate-900 ${
            embedded ? "text-xl" : "text-3xl md:text-4xl"
          }`}
        >
          {t.faq.title}
        </h2>
        <GlassCard className={`p-0 ${embedded ? "mt-4" : "mt-8 md:mt-10"}`}>
          <div className="divide-y divide-slate-200/70">
            {t.faq.items.map((item) => (
              <div key={item.question} className={embedded ? "px-4 py-3" : "px-6 py-5 md:px-7 md:py-6"}>
                <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {!embedded ? <SiteFooter /> : null}
    </div>
  );

  return body;
}
