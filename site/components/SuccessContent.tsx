"use client";

import { motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DownloadSection } from "@/components/DownloadSection";
import { GlowButton } from "@/components/GlowButton";
import { SuccessIcon } from "@/components/icons/SuccessIcon";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PaymentVerificationLoader } from "@/components/PaymentVerificationLoader";
import { useLocale } from "@/components/providers/LocaleProvider";
import { STRIPE_CHECKOUT_URL } from "@/lib/stripe";
import { GlassCard } from "@/components/ui/GlassCard";

type InstallerUrls = {
  windows: string;
  mac: string;
};

type VerificationState =
  | { status: "loading" }
  | { status: "verified"; installers: InstallerUrls }
  | { status: "unauthorized" };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function SuccessContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [state, setState] = useState<VerificationState>({ status: "loading" });

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "unauthorized" });
      return;
    }

    let cancelled = false;

    async function verifyPayment(id: string) {
      try {
        const response = await fetch(
          `/api/verify-session?session_id=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );

        const data = (await response.json()) as
          | { ok: true; installers: InstallerUrls }
          | { ok: false; error: string };

        if (cancelled) return;

        if (response.ok && data.ok) {
          setState({ status: "verified", installers: data.installers });
          return;
        }

        setState({ status: "unauthorized" });
      } catch {
        if (!cancelled) {
          setState({ status: "unauthorized" });
        }
      }
    }

    void verifyPayment(sessionId);

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.status === "loading") {
    return <PaymentVerificationLoader message={t.success.verifying} />;
  }

  if (state.status === "unauthorized") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher inline />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl"
        >
          <GlassCard className="relative overflow-hidden border-white/80 bg-white/75 p-8 shadow-2xl shadow-rose-900/10 md:p-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-400/15 blur-3xl" />

            <motion.div
              custom={0.1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mb-6 flex justify-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50/80 text-rose-500 shadow-sm">
                <ShieldX className="h-7 w-7" strokeWidth={1.75} />
              </div>
            </motion.div>

            <motion.h1
              custom={0.2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
              {t.success.unauthorizedTitle}
            </motion.h1>

            <motion.p
              custom={0.3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-4 text-center text-base leading-relaxed text-slate-600 md:text-lg"
            >
              {t.success.unauthorizedDescription}
            </motion.p>

            <motion.div
              custom={0.45}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-10 flex flex-col items-center gap-4"
            >
              <GlowButton
                href={STRIPE_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full max-w-sm text-center"
              >
                {t.success.retryPurchase}
              </GlowButton>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/80 hover:bg-white/60 hover:text-slate-900 hover:shadow-md"
              >
                {t.success.backHome}
              </Link>
            </motion.div>
          </GlassCard>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher inline />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl"
      >
        <GlassCard className="relative overflow-hidden border-white/80 bg-white/75 p-8 shadow-2xl shadow-emerald-900/10 md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[#0084FF]/15 blur-3xl" />

          <motion.div
            custom={0.1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mb-6 flex justify-center"
          >
            <SuccessIcon className="h-14 w-14 text-emerald-500" />
          </motion.div>

          <motion.h1
            custom={0.2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
            {t.success.title}
          </motion.h1>

          <motion.p
            custom={0.3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-4 text-center text-base leading-relaxed text-slate-600 md:text-lg"
          >
            {t.success.description}
          </motion.p>

          <motion.p
            custom={0.35}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-3 text-center text-sm leading-relaxed text-slate-600 md:text-base"
          >
            {t.success.trayNote}
          </motion.p>

          <motion.div
            custom={0.45}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-10"
          >
            <DownloadSection compact installerUrls={state.installers} />
          </motion.div>

          <motion.p
            custom={0.5}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-6 text-center text-sm leading-relaxed text-slate-500"
          >
            {t.success.mvpWarning}
          </motion.p>

          <motion.p
            custom={0.52}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-2 text-center text-sm text-slate-500"
          >
            {t.success.support}
          </motion.p>

          <motion.div
            custom={0.55}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-8 flex justify-center"
          >
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/80 hover:bg-white/60 hover:text-slate-900 hover:shadow-md"
            >
              {t.success.backHome}
            </Link>
          </motion.div>
        </GlassCard>
      </motion.div>
    </main>
  );
}
