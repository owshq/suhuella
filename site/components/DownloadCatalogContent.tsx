"use client";

import { brand } from "@suhuella/brand";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BrandMark } from "@/components/icons/BrandMark";
import { SuhuellaWordmark } from "@/components/icons/SuhuellaWordmark";
import { SiteFooter } from "@/components/SiteFooter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  buildDownloadCatalogRows,
  type DownloadCatalogRow,
} from "@/lib/download-catalog";
import { visibleInstallers } from "@/lib/installer-availability";
import type { ReleaseManifest } from "@/lib/release-manifest";

type DownloadCatalogContentProps = {
  release: ReleaseManifest | null;
  embedded?: boolean;
  onClose?: () => void;
};

function channelLabel(
  row: DownloadCatalogRow,
  labels: {
    preRc: string;
    stable: string;
    beta: string;
  },
): string {
  if (row.channelKey === "preRc") return labels.preRc;
  if (row.channelKey === "beta") return labels.beta;
  return labels.stable;
}

function platformLabel(
  row: DownloadCatalogRow,
  labels: { web: string; mac: string; windows: string },
): string {
  if (row.platformKey === "web") return labels.web;
  if (row.platformKey === "mac") return labels.mac;
  return labels.windows;
}

function statusLabel(
  row: DownloadCatalogRow,
  labels: { available: string; unavailable: string },
): string {
  return row.status === "available" ? labels.available : labels.unavailable;
}

function actionLabel(
  row: DownloadCatalogRow,
  labels: { open: string; download: string; none: string },
): string {
  if (row.action.kind === "none") return labels.none;
  return row.action.labelKey === "open" ? labels.open : labels.download;
}

export function DownloadCatalogContent({
  release,
  embedded = false,
  onClose,
}: DownloadCatalogContentProps) {
  const { t } = useLocale();
  const rows = buildDownloadCatalogRows(release);
  const installers = visibleInstallers(release);
  const version = release?.version ?? brand.release.version;
  const macAvailable = Boolean(installers.mac);
  const windowsAvailable = Boolean(installers.windows);
  const channelLabels = {
    preRc: t.download.channelPreRc,
    stable: t.download.channelStable,
    beta: t.download.channelBeta,
  };
  const platformLabels = {
    web: t.download.platformWeb,
    mac: t.download.platformMac,
    windows: t.download.platformWindows,
  };
  const statusLabels = {
    available: t.download.statusAvailable,
    unavailable: t.download.statusUnavailable,
  };
  const actionLabels = {
    open: t.download.actionOpen,
    download: t.download.actionDownload,
    none: t.download.actionNone,
  };
  const plansHref = "/license";
  const subtitle = macAvailable ? t.download.catalogSubtitleWithMac : t.download.catalogSubtitle;

  const webAction =
    embedded && onClose ? (
      <button
        type="button"
        onClick={onClose}
        className="inline-flex rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
      >
        {t.download.stateWebAction}
      </button>
    ) : (
      <Link
        href="/home"
        className="inline-flex rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
      >
        {t.download.stateWebAction}
      </Link>
    );

  const catalogBody = (
    <>
      {!embedded ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {t.download.catalogTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">{subtitle}</p>
        </>
      ) : (
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600">{subtitle}</p>
      )}

      {embedded ? (
        <GlassCard className="mt-4 p-5">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" aria-label={brand.displayName} />
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-[-0.02em] text-slate-900">{brand.displayName}</p>
              <p className="font-mono text-xs text-slate-500">{version}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            <li className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.download.stateWebTitle}</p>
                <p className="text-sm font-medium text-emerald-700">{t.download.stateWebAvailable}</p>
              </div>
              {webAction}
            </li>
            <li className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.download.stateMacTitle}</p>
                {macAvailable && installers.mac ? (
                  <p className="text-sm font-medium text-emerald-700">{t.download.stateMacAvailable}</p>
                ) : (
                  <p className="text-sm font-medium text-amber-700">{t.download.statusUnavailable}</p>
                )}
              </div>
              {macAvailable && installers.mac ? (
                <a
                  href={installers.mac}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
                >
                  {t.download.stateMacAction}
                </a>
              ) : null}
            </li>
            <li className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.download.stateWindowsTitle}</p>
                <p className="text-sm font-medium text-amber-700">{t.download.stateWindowsUnavailable}</p>
              </div>
            </li>
          </ul>
          {macAvailable ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{t.download.catalogUnsignedNote}</p>
          ) : null}
        </GlassCard>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <GlassCard className="p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.download.stateWebTitle}
            </p>
            <p className="mt-2 text-lg font-semibold text-emerald-700">{t.download.stateWebAvailable}</p>
            <div className="mt-4">{webAction}</div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.download.stateMacTitle}
            </p>
            {macAvailable && installers.mac ? (
              <>
                <p className="mt-2 text-lg font-semibold text-emerald-700">{t.download.stateMacAvailable}</p>
                <a
                  href={installers.mac}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
                >
                  {t.download.stateMacAction}
                </a>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{t.download.catalogUnsignedNote}</p>
              </>
            ) : (
              <p className="mt-2 text-lg font-semibold text-amber-700">{t.download.statusUnavailable}</p>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t.download.stateWindowsTitle}
            </p>
            {windowsAvailable && installers.windows ? (
              <>
                <p className="mt-2 text-lg font-semibold text-emerald-700">{t.download.statusAvailable}</p>
                <a
                  href={installers.windows}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]"
                >
                  {t.download.actionDownload}
                </a>
              </>
            ) : (
              <p className="mt-2 text-lg font-semibold text-amber-700">{t.download.stateWindowsUnavailable}</p>
            )}
          </GlassCard>
        </div>
      )}

      {!embedded ? (
        <GlassCard className="mt-8 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/60 bg-white/30 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t.download.tableVersion}</th>
                  <th className="px-4 py-3 font-semibold">{t.download.tableChannel}</th>
                  <th className="px-4 py-3 font-semibold">{t.download.tablePlatform}</th>
                  <th className="px-4 py-3 font-semibold">{t.download.tableStatus}</th>
                  <th className="px-4 py-3 font-semibold">{t.download.tableDate}</th>
                  <th className="px-4 py-3 font-semibold">{t.download.tableAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const action = actionLabel(row, actionLabels);
                  const actionCell =
                    row.action.kind === "link" ? (
                      row.action.external ? (
                        <a
                          href={row.action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[var(--brand-accent)] hover:underline"
                        >
                          {action}
                        </a>
                      ) : (
                        <Link href={row.action.href} className="font-semibold text-[var(--brand-accent)] hover:underline">
                          {action}
                        </Link>
                      )
                    ) : (
                      <span className="text-slate-400">{action}</span>
                    );

                  return (
                    <tr key={row.id} className="border-b border-white/40 last:border-b-0">
                      <td className="px-4 py-3 font-mono text-slate-800">{row.version}</td>
                      <td className="px-4 py-3 text-slate-700">{channelLabel(row, channelLabels)}</td>
                      <td className="px-4 py-3 text-slate-700">{platformLabel(row, platformLabels)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            row.status === "available"
                              ? "font-medium text-emerald-700"
                              : "font-medium text-amber-700"
                          }
                        >
                          {statusLabel(row, statusLabels)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.dateLabel}</td>
                      <td className="px-4 py-3">{actionCell}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      <p className={`max-w-2xl text-sm leading-relaxed text-slate-600 ${embedded ? "mt-4" : "mt-6"}`}>
        {t.download.activationNote}
      </p>

      <div className={embedded ? "mt-3" : "mt-4"}>
        <Link
          href={plansHref}
          className="text-sm font-semibold text-[var(--brand-accent)] underline-offset-2 hover:underline"
        >
          {t.download.viewPlans}
        </Link>
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-1">{catalogBody}</div>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 pt-16 pb-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-slate-700 hover:text-slate-900">
          <SuhuellaWordmark
            glyphClassName="h-6 w-6"
            textClassName="text-sm font-semibold tracking-[-0.02em]"
          />
        </Link>
        <LanguageSwitcher inline />
      </div>
      {catalogBody}
      <div className="mt-auto pt-12">
        <SiteFooter />
      </div>
    </main>
  );
}
