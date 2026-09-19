"use client";

import { desktopProtocolUrl } from "@suhuella/brand";
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
import { GlassCard } from "@/components/ui/GlassCard";

type InstallerUrls = {
  windows: string;
  mac: string;
};

type VerificationError = "missing_session" | "invalid_session" | "payment_incomplete" | "server_error";

type LicenseSummary = {
  email?: string;
  edition?: string;
};

type VerificationState =
  | { status: "loading" }
  | { status: "verified"; installers: InstallerUrls; license: LicenseSummary | null }
  | { status: "error"; error: VerificationError | "checkout_unavailable" | "checkout_canceled" };

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

type SuccessContentProps = {
  plansHref?: string;
  embedded?: boolean;
  onClose?: () => void;
};

function hasInstallerUrls(installers: InstallerUrls): boolean {
  return Boolean(installers.windows || installers.mac);
}

export function SuccessContent({
  plansHref = "/license",
  embedded = false,
  onClose,
}: SuccessContentProps) {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const queryError = searchParams.get("error");
  const checkout = searchParams.get("checkout");
  const unavailablePlan = searchParams.get("plan");
  const fromDesktop = searchParams.get("from") === "desktop";
  const [state, setState] = useState<VerificationState>({ status: "loading" });

  useEffect(() => {
    if (checkout === "canceled") {
      setState({ status: "error", error: "checkout_canceled" });
      return;
    }
    if (queryError === "checkout_unavailable" || checkout === "unavailable") {
      setState({ status: "error", error: "checkout_unavailable" });
      return;
    }
    if (!sessionId) {
      setState({ status: "error", error: "missing_session" });
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
          | { ok: true; installers: InstallerUrls; license?: LicenseSummary | null }
          | { ok: false; error: VerificationError };

        if (cancelled) return;

        if (response.ok && data.ok) {
          setState({
            status: "verified",
            installers: data.installers,
            license: data.license ?? null,
          });
          return;
        }

        const error =
          data.ok === false && data.error ? data.error : "invalid_session";
        setState({ status: "error", error });
      } catch {
        if (!cancelled) {
          setState({ status: "error", error: "server_error" });
        }
      }
    }

    void verifyPayment(sessionId);

    return () => {
      cancelled = true;
    };
  }, [checkout, queryError, sessionId]);

  if (state.status === "loading") {
    if (embedded) {
      return <p className="py-6 text-center text-sm text-slate-600">{t.success.verifying}</p>;
    }
    return <PaymentVerificationLoader message={t.success.verifying} />;
  }

  if (state.status === "error") {
    const isCanceled = state.error === "checkout_canceled";
    const isMissingSession = state.error === "missing_session";
    const isUnavailable = state.error === "checkout_unavailable";
    const isIncomplete = state.error === "payment_incomplete";
    const unavailableCopy =
      unavailablePlan === "lifetime"
        ? t.success.lifetimeUnavailable
        : unavailablePlan === "monthly"
          ? t.success.monthlyUnavailable
          : t.success.planUnavailable;
    const title = isCanceled
      ? t.success.checkoutCanceled
      : isUnavailable
        ? unavailableCopy
        : isIncomplete
          ? t.success.paymentIncomplete
          : isMissingSession
            ? embedded
              ? t.success.modalNoPurchaseTitle
              : t.success.missingSessionTitle
            : t.success.invalidSessionTitle;
    const description = isCanceled
      ? t.success.checkoutCanceled
      : isUnavailable
        ? unavailableCopy
        : isIncomplete
          ? t.success.paymentIncomplete
          : isMissingSession
            ? embedded
              ? t.success.modalNoPurchaseDescription
              : t.success.missingSessionDescription
            : t.success.invalidSessionDescription;
    const backHref = fromDesktop
      ? `${desktopProtocolUrl("license/success")}?checkout=canceled`
      : embedded
        ? "/home"
        : plansHref;

    const errorBody = (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl"
        >
          <GlassCard className={`relative overflow-hidden border-white/80 bg-white/75 ${embedded ? "p-5 shadow-none" : "p-8 shadow-2xl shadow-rose-900/10 md:p-10"}`}>
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
              {title}
            </motion.h1>

            <motion.p
              custom={0.3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-4 text-center text-base leading-relaxed text-slate-600 md:text-lg"
            >
              {description}
            </motion.p>

            <motion.div
              custom={0.45}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-10 flex flex-col items-center gap-4"
            >
              {!isCanceled ? (
                <GlowButton href={plansHref} className="w-full max-w-sm text-center">
                  {t.success.viewPlans}
                </GlowButton>
              ) : null}

              {embedded && onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/80 hover:bg-white/60 hover:text-slate-900 hover:shadow-md"
                >
                  {t.success.continueInBrowser}
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/80 hover:bg-white/60 hover:text-slate-900 hover:shadow-md"
                >
                  {isCanceled ? (fromDesktop ? t.success.openApp : "License") : t.success.backHome}
                </Link>
              )}
            </motion.div>
          </GlassCard>
        </motion.div>
    );

    if (embedded) {
      return <div className="py-1">{errorBody}</div>;
    }

    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher inline />
        </div>
        {errorBody}
      </main>
    );
  }

  const installersReady = hasInstallerUrls(state.installers);

  const successBody = (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl"
      >
        <GlassCard className={`relative overflow-hidden border-white/80 bg-white/75 ${embedded ? "p-5 shadow-none" : "p-8 shadow-2xl shadow-emerald-900/10 md:p-10"}`}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_15%,transparent)] blur-3xl" />

          <motion.div
            custom={0.1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mb-6 flex justify-center"
          >
            <SuccessIcon className="h-14 w-14 text-emerald-500" />
          </motion.div>

          <motion.p
            custom={0.15}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative text-center text-sm font-semibold uppercase tracking-wider text-emerald-600"
          >
            {t.success.purchaseConfirmed}
          </motion.p>

          <motion.h1
            custom={0.2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-3 text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
          >
            {state.license ? t.success.purchaseConfirmed : installersReady ? t.success.title : t.success.downloadUnavailableTitle}
          </motion.h1>

          <motion.p
            custom={0.3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-4 text-center text-base leading-relaxed text-slate-600 md:text-lg"
          >
            {installersReady
              ? t.success.description
              : t.success.downloadUnavailableDescription}
          </motion.p>

          <motion.div
            custom={0.4}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-8 flex flex-col items-center gap-3"
          >
            <GlowButton
              href={
                sessionId
                  ? `${desktopProtocolUrl("license/success")}?session_id=${encodeURIComponent(sessionId)}`
                  : desktopProtocolUrl("license/success")
              }
              className="w-full max-w-sm text-center"
            >
              {t.success.openApp}
            </GlowButton>
            <Link
              href={
                sessionId
                  ? `/settings?prefs=license&checkout=success&session_id=${encodeURIComponent(sessionId)}`
                  : "/settings?prefs=license"
              }
              className="inline-flex w-full max-w-sm items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700"
            >
              {t.success.continueInBrowser}
            </Link>
            <p className="text-center text-sm text-slate-500">{t.success.alreadyInstalled}</p>
          </motion.div>

          {installersReady ? (
            <motion.div
              custom={0.42}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-8"
            >
              <DownloadSection
                compact
                installerUrls={state.installers}
                windowsLabel={t.success.downloadWindows}
                macLabel={t.success.downloadMac}
              />
            </motion.div>
          ) : (
            <motion.p
              custom={0.42}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-8 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-5 py-4 text-center text-sm leading-relaxed text-amber-900"
            >
              {t.success.installersPending}
            </motion.p>
          )}

          <motion.div
            custom={0.48}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-8 rounded-2xl border border-white/70 bg-white/50 px-5 py-4 text-left"
          >
            <p className="text-sm font-semibold text-slate-900">{t.success.installTitle}</p>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
              {t.success.installSteps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span className="text-[var(--brand-accent)]">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{t.success.unsignedNote}</p>
          </motion.div>

          <motion.p
            custom={0.52}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-6 text-center text-sm leading-relaxed text-slate-500"
          >
            {t.success.mvpWarning}
          </motion.p>

          <motion.p
            custom={0.55}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="relative mt-2 text-center text-sm text-slate-500"
          >
            {t.success.support}
          </motion.p>

          {!embedded ? (
            <motion.div
              custom={0.58}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="relative mt-8 flex justify-center"
            >
              <Link
                href="/home"
                className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/80 hover:bg-white/60 hover:text-slate-900 hover:shadow-md"
              >
                {t.success.backHome}
              </Link>
            </motion.div>
          ) : null}
        </GlassCard>
      </motion.div>
  );

  if (embedded) {
    return <div className="py-1">{successBody}</div>;
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher inline />
      </div>
      {successBody}
    </main>
  );
}
