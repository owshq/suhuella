"use client";

import { motion } from "framer-motion";
import { ArrowDownToLine } from "lucide-react";
import Link from "next/link";
import { AppleIcon } from "@/components/icons/AppleIcon";
import { WindowsIcon } from "@/components/icons/WindowsIcon";
import { useLocale } from "@/components/providers/LocaleProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Dictionary } from "@/lib/i18n/types";
import { STRIPE_CHECKOUT_URL } from "@/lib/stripe";

type DownloadSectionProps = {
  showPurchaseLink?: boolean;
  compact?: boolean;
  installerUrls?: {
    windows: string;
    mac: string;
  };
};

type Installer = {
  href: string;
  label: string;
  ext: string;
  icon: typeof WindowsIcon;
  external?: boolean;
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
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/60 bg-white/40 p-4 transition-all duration-300 hover:bg-white/60 hover:shadow-xl hover:shadow-blue-900/10 md:p-5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#0084FF] shadow-sm transition-colors group-hover:bg-[#0084FF] group-hover:text-white">
        <item.icon className="h-6 w-6" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-800 md:text-base">
            {item.label}
          </span>
          <span className="rounded-full bg-[#0084FF]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#0084FF]">
            {version}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          {item.label} {item.ext}
        </p>
      </div>

      <ArrowDownToLine className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-[#0084FF]" />
    </motion.a>
  );
}

function PurchaseLink({ t }: { t: Dictionary }) {
  return (
    <p className="mt-4 text-center text-xs text-zinc-600">
      {t.download.orBuy}{" "}
      <Link
        href="/"
        className="text-violet-400 underline-offset-2 transition-colors hover:text-violet-300 hover:underline"
      >
        suhuella.com
      </Link>
    </p>
  );
}

export function DownloadSection({
  showPurchaseLink = false,
  compact = false,
  installerUrls,
}: DownloadSectionProps) {
  const { t } = useLocale();

  const installers: Installer[] = installerUrls
    ? [
        {
          href: installerUrls.windows || "#",
          label: t.download.windows,
          ext: ".exe",
          icon: WindowsIcon,
        },
        {
          href: installerUrls.mac || "#",
          label: t.download.mac,
          ext: ".dmg",
          icon: AppleIcon,
        },
      ]
    : [
        {
          href: STRIPE_CHECKOUT_URL,
          label: t.download.windows,
          ext: ".exe",
          icon: WindowsIcon,
          external: true,
        },
        {
          href: STRIPE_CHECKOUT_URL,
          label: t.download.mac,
          ext: ".dmg",
          icon: AppleIcon,
          external: true,
        },
      ];

  const grid = (
    <div className={`grid md:grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
      {installers.map((item, index) => (
        <InstallerButton
          key={item.label}
          item={item}
          index={index}
          version={t.download.version}
        />
      ))}
    </div>
  );

  return (
    <section className={compact ? "w-full" : "mx-auto max-w-3xl px-6"}>
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
