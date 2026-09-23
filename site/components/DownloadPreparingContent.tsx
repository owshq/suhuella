"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SuhuellaWordmark } from "@/components/icons/SuhuellaWordmark";
import { SiteFooter } from "@/components/SiteFooter";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  buildDownloadPreparingPath,
  parseDownloadPreparingPlatform,
  type DesktopDownloadPlatform,
} from "@/lib/desktop-download-flow";
import { formatArtifactSize } from "@/lib/format-artifact-size";
import { visibleInstallers } from "@/lib/installer-availability";
import { formatAppVersion } from "@/lib/release";

type DownloadArtifactMeta = {
  url: string;
  filename?: string;
  size?: number;
  version?: string;
};

type DownloadPreparingContentProps = {
  embedded?: boolean;
  onClose?: () => void;
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function triggerInstallerDownload(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function platformInstallHint(
  platform: DesktopDownloadPlatform,
  t: ReturnType<typeof useLocale>["t"],
): string {
  return platform === "mac" ? t.downloadPreparing.installHintMac : t.downloadPreparing.installHintWindows;
}

export function DownloadPreparingContent({
  embedded = false,
  onClose,
}: DownloadPreparingContentProps) {
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const platform =
    parseDownloadPreparingPlatform(searchParams.get("platform")) ??
    ("mac" as DesktopDownloadPlatform);
  const version = formatAppVersion();
  const startedRef = useRef(false);
  const [artifact, setArtifact] = useState<DownloadArtifactMeta | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function startDownload() {
      try {
        const response = await fetch("/api/release", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          ok?: boolean;
          release?: {
            version?: string;
            mac?: string;
            windows?: string;
            downloads?: {
              mac?: { url?: string; filename?: string; size?: number };
              windows?: { url?: string; filename?: string; size?: number };
            };
          };
        };
        if (!data.ok || !data.release) return;

        const entry =
          platform === "mac" ? data.release.downloads?.mac : data.release.downloads?.windows;
        const shown = visibleInstallers(data.release);
        const url = platform === "mac" ? shown.mac : shown.windows;
        if (!url) return;

        const filename = entry?.filename?.trim() ?? "";
        const downloadUrl = `/api/desktop-download/${platform}`;
        setArtifact({
          url: downloadUrl,
          filename,
          size: entry?.size,
          version: data.release.version,
        });
        triggerInstallerDownload(downloadUrl);
        setDownloadStarted(true);
      } catch {
        // User can retry manually from this page.
      } finally {
        setPreparing(false);
      }
    }

    void startDownload();
  }, [platform]);

  const sizeLabel =
    artifact?.size && artifact.size > 0 ? formatArtifactSize(artifact.size, locale) : null;
  const installHint = platformInstallHint(platform, t);

  const body = (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-2xl"
    >
      <GlassCard
        className={`relative overflow-hidden border-white/80 bg-white/75 ${embedded ? "p-5 shadow-none" : "p-8 shadow-2xl shadow-blue-900/10 md:p-10"}`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_18%,transparent)] blur-3xl" />

        <motion.h1
          custom={0.1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
        >
          {t.downloadPreparing.title}
        </motion.h1>

        <motion.div
          custom={0.2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative mt-6 flex items-start justify-center gap-3 text-left"
        >
          {preparing ? (
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[var(--brand-accent)]" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {downloadStarted
                ? t.downloadPreparing.autoStarted
                : t.downloadPreparing.preparingStarted}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t.downloadPreparing.retryHint}</p>
          </div>
        </motion.div>

        <motion.div
          custom={0.3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative mt-6 flex flex-col items-center gap-3"
        >
          {artifact?.url ? (
            <button
              type="button"
              onClick={() => triggerInstallerDownload(artifact.url)}
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-accent)] px-6 py-3 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
            >
              {t.downloadPreparing.downloadAgain}
            </button>
          ) : (
            <Link
              href={buildDownloadPreparingPath(platform)}
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-accent)] px-6 py-3 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
            >
              {t.downloadPreparing.downloadAgain}
            </Link>
          )}
          <p className="text-center font-mono text-xs text-slate-400">
            {artifact?.version ? formatAppVersion(artifact.version) : version}
            {sizeLabel ? ` · ${sizeLabel}` : null}
            {artifact?.filename ? ` · ${artifact.filename}` : null}
          </p>
        </motion.div>

        <motion.div
          custom={0.4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative mt-8 rounded-2xl border border-white/70 bg-white/50 px-5 py-4 text-left"
        >
          <p className="text-sm font-semibold text-slate-900">{t.downloadPreparing.installTitle}</p>
          <ol className="mt-4 space-y-4">
            {t.downloadPreparing.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,white)] text-sm font-bold text-[var(--brand-accent)]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step}</p>
                  {index === 1 ? (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{installHint}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">{t.download.catalogUnsignedNote}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.download.trayNote}</p>
        </motion.div>

        <motion.div
          custom={0.5}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative mt-8 text-center"
        >
          <p className="text-sm font-semibold text-slate-900">{t.downloadPreparing.otherPlatformsTitle}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={buildDownloadPreparingPath("mac")}
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/60"
            >
              {t.downloadPreparing.platformMac}
            </Link>
            <Link
              href={buildDownloadPreparingPath("windows")}
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/60"
            >
              {t.downloadPreparing.platformWindows}
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/60"
            >
              {t.downloadPreparing.allDownloads}
            </Link>
          </div>
        </motion.div>

        <motion.div
          custom={0.55}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="relative mt-8 flex justify-center gap-3"
        >
          {embedded && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/60"
            >
              {t.downloadPreparing.openWeb}
            </button>
          ) : (
            <Link
              href="/home"
              className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/60"
            >
              {t.downloadPreparing.openWeb}
            </Link>
          )}
          <Link
            href="/license"
            className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/40 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white/60"
          >
            {t.download.viewPlans}
          </Link>
        </motion.div>
      </GlassCard>
    </motion.div>
  );

  if (embedded) {
    return <div className="py-1">{body}</div>;
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 pt-16 pb-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-slate-700 hover:text-slate-900">
          <SuhuellaWordmark
            glyphClassName="h-6 w-6"
            textClassName="text-sm font-semibold tracking-[-0.02em]"
          />
        </Link>
        <LanguageSwitcher inline />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-8">{body}</div>
      <div className="mt-auto pt-12">
        <SiteFooter />
      </div>
    </main>
  );
}
