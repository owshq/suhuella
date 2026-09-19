"use client";

import { motion } from "framer-motion";
import { ArrowDownToLine } from "lucide-react";
import Link from "next/link";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { WindowsIcon } from "@/components/icons/WindowsIcon";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Dictionary } from "@/lib/i18n/types";
import { hasDownloadableInstaller, visibleInstallers } from "@/lib/installer-availability";
import { formatAppVersion } from "@/lib/release";

type DownloadSectionProps = {
  checkoutUrl?: string;
  showPurchaseLink?: boolean;
  compact?: boolean;
  installerUrls?: {
    windows: string;
    mac: string;
  };
  windowsLabel?: string;
  macLabel?: string;
};

type Installer = {
  href: string;
  label: string;
  ext: string;
  icon: typeof WindowsIcon;
  external?: boolean;
  disabled?: boolean;
  unavailableLabel: string;
};

function InstallerButton({
  item,
  index,
  version,
}: {
  item: Installer;
  index: number;
  version: string;
}) {
  const className =
    "group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/60 bg-white/40 p-4 transition-all duration-300 hover:bg-white/60 hover:shadow-xl hover:shadow-blue-900/10 md:p-5";

  const content = (
    <>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--brand-accent)] shadow-sm transition-colors group-hover:bg-[var(--brand-accent)] group-hover:text-[var(--brand-on-accent)]">
        <item.icon className="h-6 w-6" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-800 md:text-base">
            {item.label}
          </span>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--brand-accent)]">
            {version}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          {item.disabled ? item.unavailableLabel : `${item.label} ${item.ext}`}
        </p>
      </div>

      <ArrowDownToLine className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-[var(--brand-accent)]" />
    </>
  );

  if (item.disabled || !item.href || item.href === "#") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1, duration: 0.5 }}
        aria-disabled="true"
        className={`${className} pointer-events-none opacity-60`}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.a
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {content}
    </motion.a>
  );
}

function PurchaseLink({ t }: { t: Dictionary }) {
  return (
    <p className="mt-4 text-center text-sm text-slate-600">
      <Link
        href="/license"
        className="font-semibold text-[var(--brand-accent)] underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
      >
        {t.download.orBuy}
      </Link>
    </p>
  );
}

export function DownloadSection({
  checkoutUrl = "",
  showPurchaseLink = false,
  compact = false,
  installerUrls,
  windowsLabel,
  macLabel,
}: DownloadSectionProps) {
  const { t } = useLocale();
  const version = formatAppVersion();
  const shown = visibleInstallers(installerUrls);

  const installers: Installer[] = [
    ...(shown.windows
      ? [
          {
            href: shown.windows,
            label: windowsLabel ?? t.download.windows,
            ext: ".exe",
            icon: WindowsIcon,
            external: true,
            unavailableLabel: t.download.unavailable,
          } satisfies Installer,
        ]
      : []),
    ...(shown.mac
      ? [
          {
            href: shown.mac,
            label: macLabel ?? t.download.mac,
            ext: ".dmg",
            icon: AppleIcon,
            external: true,
            unavailableLabel: t.download.unavailable,
          } satisfies Installer,
        ]
      : []),
  ];

  if (!hasDownloadableInstaller(shown) && !checkoutUrl) {
    return (
      <section
        id="descarga"
        className={`rounded-2xl ${compact ? "w-full scroll-mt-28" : "mx-auto max-w-3xl scroll-mt-28 px-6"}`}
      >
        <p className="rounded-2xl border border-white/60 bg-white/50 px-4 py-3 text-center text-sm leading-relaxed text-slate-600">
          {t.download.comingSoon}
        </p>
        {showPurchaseLink ? <PurchaseLink t={t} /> : null}
      </section>
    );
  }

  const grid = (
    <div className={`grid md:grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
      {installers.map((item, index) => (
        <InstallerButton
          key={item.label}
          item={item}
          index={index}
          version={version}
        />
      ))}
    </div>
  );

  return (
    <section
      id="descarga"
      className={`rounded-2xl transition-shadow duration-300 ${compact ? "w-full scroll-mt-28" : "mx-auto max-w-3xl scroll-mt-28 px-6"}`}
    >
      {!compact && (
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {t.download.title}
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-600 md:text-base">
            {t.download.subtitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {t.download.trayNote}
          </p>
        </div>
      )}

      {compact ? (
        grid
      ) : (
        <GlassCard className="relative p-4 md:p-6">
          {grid}
          {showPurchaseLink && <PurchaseLink t={t} />}
        </GlassCard>
      )}

      {compact && showPurchaseLink && <PurchaseLink t={t} />}
    </section>
  );
}
