"use client";

import { brand } from "@suhuella/brand";
import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { BrandMark } from "@/components/icons/BrandMark";
import { SuhuellaWordmark } from "@/components/icons/SuhuellaWordmark";
import { WindowsIcon } from "@/components/icons/WindowsIcon";
import { SiteFooter } from "@/components/SiteFooter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  buildAllDesktopCatalogRows,
  buildCurrentDesktopRows,
  filterCatalogRowsByPlatform,
  type DownloadCatalogRow,
} from "@/lib/download-catalog";
import {
  detectClientDownloadPlatform,
  type DesktopDownloadPlatform,
} from "@/lib/desktop-download-flow";
import type { ReleaseManifest } from "@/lib/release-manifest";

type DownloadCatalogContentProps = {
  release: ReleaseManifest | null;
  embedded?: boolean;
  onClose?: () => void;
};

function platformLabel(
  row: DownloadCatalogRow,
  labels: { web: string; mac: string; windows: string },
): string {
  if (row.platformKey === "web") return labels.web;
  if (row.platformKey === "mac") return labels.mac;
  return labels.windows;
}

function platformIcon(row: DownloadCatalogRow) {
  return row.platformKey === "mac" ? AppleIcon : WindowsIcon;
}

function CorporateDownloadButton({
  href,
  label,
  external,
  compact,
  inline,
}: {
  href: string;
  label: string;
  external?: boolean;
  compact?: boolean;
  inline?: boolean;
}) {
  const className = inline
    ? "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-on-accent)] shadow-sm transition hover:bg-[var(--brand-accent-hover)] sm:px-4 sm:py-2 sm:text-sm"
    : compact
      ? "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-on-accent)] shadow-sm transition hover:bg-[var(--brand-accent-hover)]"
      : "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--brand-on-accent)] transition hover:bg-[var(--brand-accent-hover)]";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        <ArrowDownToLine className="h-4 w-4 shrink-0" strokeWidth={2.25} />
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      <ArrowDownToLine className="h-4 w-4 shrink-0" strokeWidth={2.25} />
      {label}
    </Link>
  );
}

function IconDownloadButton({
  row,
  ariaLabel,
}: {
  row: DownloadCatalogRow;
  ariaLabel: string;
}) {
  if (row.action.kind !== "link") return null;

  const Icon = platformIcon(row);
  const className =
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/80 text-[var(--brand-accent)] shadow-sm transition hover:border-[color-mix(in_srgb,var(--brand-accent)_35%,white)] hover:bg-[var(--brand-accent)] hover:text-[var(--brand-on-accent)]";

  if (row.action.external) {
    return (
      <a
        href={row.action.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className={className}
      >
        <Icon className="h-4 w-4" />
      </a>
    );
  }

  return (
    <Link href={row.action.href} aria-label={ariaLabel} className={className}>
      <Icon className="h-4 w-4" />
    </Link>
  );
}

function CurrentReleaseCard({
  rows,
  compact,
  platformLabels,
  statusLabels,
  macActionLabel,
  windowsActionLabel,
}: {
  rows: DownloadCatalogRow[];
  compact: boolean;
  platformLabels: { mac: string; windows: string };
  statusLabels: { available: string; unavailable: string };
  macActionLabel: string;
  windowsActionLabel: string;
}) {
  if (rows.length === 0) return null;

  if (compact) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-start gap-3">
          <BrandMark className="h-10 w-10 shrink-0" size={40} aria-label={brand.displayName} />
          <div className="min-w-0 flex-1 space-y-2">
            {rows.map((row) => {
              const PlatformIcon = platformIcon(row);
              const label = row.platformKey === "mac" ? platformLabels.mac : platformLabels.windows;
              const actionLabel =
                row.platformKey === "mac" ? macActionLabel : windowsActionLabel;
              const available = row.status === "available" && row.action.kind === "link";

              return (
                <div
                  key={row.id}
                  className="flex min-w-0 items-center gap-2 py-0.5 sm:gap-2.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-accent)] shadow-sm">
                    <PlatformIcon className="h-3.5 w-3.5" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-800">
                    <span className="font-semibold text-slate-900">{label}</span>
                    <span className="text-slate-400"> · </span>
                    <span
                      className={`font-medium ${available ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {available ? statusLabels.available : statusLabels.unavailable}
                    </span>
                  </p>
                  {available ? (
                    <CorporateDownloadButton
                      href={row.action.href}
                      label={actionLabel}
                      external={row.action.external}
                      inline
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const PlatformIcon = platformIcon(row);
          const label = row.platformKey === "mac" ? platformLabels.mac : platformLabels.windows;
          const actionLabel = row.platformKey === "mac" ? macActionLabel : windowsActionLabel;
          const available = row.status === "available" && row.action.kind === "link";

          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 rounded-xl border border-white/50 bg-white/35 p-3"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--brand-accent)] shadow-sm">
                  <PlatformIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                  <p
                    className={`text-xs font-medium ${
                      available ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {available ? statusLabels.available : statusLabels.unavailable}
                  </p>
                </div>
              </div>
              {available ? (
                <CorporateDownloadButton
                  href={row.action.href}
                  label={actionLabel}
                  external={row.action.external}
                  compact={false}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function DownloadVersionsTable({
  rows,
  compact,
  title,
  platformLabels,
  statusLabels,
  actionLabels,
  tableLabels,
  latestLabel,
}: {
  rows: DownloadCatalogRow[];
  compact: boolean;
  title: string;
  platformLabels: { web: string; mac: string; windows: string };
  statusLabels: { available: string; unavailable: string };
  actionLabels: { download: string };
  tableLabels: {
    version: string;
    platform: string;
    size: string;
    date: string;
  };
  latestLabel: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className={compact ? "mt-3" : "mt-8"}>
      <h2
        className={
          compact
            ? "mb-2 text-sm font-semibold text-slate-900"
            : "mb-3 text-lg font-semibold text-slate-900"
        }
      >
        {title}
      </h2>
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/60 bg-white/30 text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
              <tr>
                <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{tableLabels.version}</th>
                <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{tableLabels.platform}</th>
                <th className="hidden px-3 py-2.5 font-semibold sm:table-cell sm:px-4 sm:py-3">
                  {tableLabels.size}
                </th>
                <th className="px-3 py-2.5 font-semibold sm:px-4 sm:py-3">{tableLabels.date}</th>
                <th className="px-3 py-2.5 text-right font-semibold sm:px-4 sm:py-3"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const available = row.status === "available" && row.action.kind === "link";
                const isCurrent = row.id.startsWith("current-");
                const ariaLabel = `${actionLabels.download} ${platformLabel(row, platformLabels)} ${row.version}`;

                return (
                  <tr key={row.id} className="border-b border-white/40 last:border-b-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-800 sm:px-4 sm:py-3 sm:text-sm">
                      {row.version}
                      {isCurrent ? (
                        <span className="ml-1.5 rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_12%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--brand-accent)]">
                          {latestLabel}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 sm:px-4 sm:py-3">
                      {platformLabel(row, platformLabels)}
                    </td>
                    <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-600 sm:table-cell sm:px-4 sm:py-3 sm:text-sm">
                      {row.sizeLabel}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 sm:px-4 sm:py-3">{row.dateLabel}</td>
                    <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">
                      {available ? (
                        <IconDownloadButton row={row} ariaLabel={ariaLabel} />
                      ) : (
                        <span className="text-xs text-slate-400">{statusLabels.unavailable}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

export function DownloadCatalogContent({
  release,
  embedded = false,
  onClose,
}: DownloadCatalogContentProps) {
  const { t } = useLocale();
  const [detectedPlatform, setDetectedPlatform] = useState<DesktopDownloadPlatform | null>(null);
  const currentRows = buildCurrentDesktopRows(release);
  const allDesktopRows = buildAllDesktopCatalogRows(release);

  useEffect(() => {
    setDetectedPlatform(detectClientDownloadPlatform());
  }, []);

  const visibleCurrentRows = useMemo(
    () => filterCatalogRowsByPlatform(currentRows, detectedPlatform),
    [currentRows, detectedPlatform],
  );
  const visibleTableRows = useMemo(
    () => filterCatalogRowsByPlatform(allDesktopRows, detectedPlatform),
    [allDesktopRows, detectedPlatform],
  );

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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {t.download.catalogTitle}
        </h1>
      ) : null}

      {embedded ? (
        <>
          <CurrentReleaseCard
            rows={visibleCurrentRows}
            compact
            platformLabels={platformLabels}
            statusLabels={statusLabels}
            macActionLabel={t.download.stateMacAction}
            windowsActionLabel={t.download.stateWindowsAction}
          />
          <DownloadVersionsTable
            rows={visibleTableRows}
            compact
            title={t.download.catalogTableTitle}
            platformLabels={platformLabels}
            statusLabels={statusLabels}
            actionLabels={actionLabels}
            tableLabels={{
              version: t.download.tableVersion,
              platform: t.download.tablePlatform,
              size: t.download.tableSize,
              date: t.download.tableDate,
            }}
            latestLabel={t.download.catalogLatestLabel}
          />
        </>
      ) : (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <GlassCard className="p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t.download.stateWebTitle}
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-700">
                {t.download.stateWebAvailable}
              </p>
              <div className="mt-4">{webAction}</div>
            </GlassCard>

            <div className="md:col-span-2">
              <CurrentReleaseCard
                rows={visibleCurrentRows}
                compact={false}
                platformLabels={platformLabels}
                statusLabels={statusLabels}
                macActionLabel={t.download.stateMacAction}
                windowsActionLabel={t.download.stateWindowsAction}
              />
            </div>
          </div>

          <DownloadVersionsTable
            rows={visibleTableRows}
            compact={false}
            title={t.download.catalogTableTitle}
            platformLabels={platformLabels}
            statusLabels={statusLabels}
            actionLabels={actionLabels}
            tableLabels={{
              version: t.download.tableVersion,
              platform: t.download.tablePlatform,
              size: t.download.tableSize,
              date: t.download.tableDate,
            }}
            latestLabel={t.download.catalogLatestLabel}
          />
        </>
      )}

      {!embedded ? (
        <div className="mt-8">
          <Link
            href={plansHref}
            className="text-sm font-semibold text-[var(--brand-accent)] underline-offset-2 hover:underline"
          >
            {t.download.viewPlans}
          </Link>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{catalogBody}</div>;
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
