"use client";

import { motion } from "framer-motion";
import { AppMockup } from "@/components/AppMockup";
import { DownloadSection } from "@/components/DownloadSection";
import { FeaturesGrid } from "@/components/FeaturesGrid";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { PrivacySection } from "@/components/PrivacySection";
import { SiteFooter } from "@/components/SiteFooter";

type LandingContentProps = {
  checkoutUrl: string;
};

export function LandingContent({ checkoutUrl }: LandingContentProps) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-6 pt-24 lg:flex-row lg:items-start lg:pt-32">
        <div className="w-full pt-10 lg:w-5/12">
          <HeroSection checkoutUrl={checkoutUrl} />
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
              <DownloadSection compact checkoutUrl={checkoutUrl} />
            </div>
          </motion.div>
        </div>
      </div>

      <HowItWorksSection />

      <PrivacySection />

      <FeaturesGrid />

      <SiteFooter />
    </div>
  );
}
