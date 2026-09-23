"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatedMeshBackground } from "@/components/AnimatedMeshBackground";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SuhuellaLogo } from "@/components/icons/SuhuellaLogo";
import { useLocale } from "@/components/providers/LocaleProvider";
import { brand } from "@suhuella/brand";
import { formatAppVersion } from "@/lib/release";

type RouteOverlayFrameProps = {
  ariaLabel: string;
  onClose: () => void;
  badgeChannel?: string;
  children: ReactNode;
};

export function RouteOverlayFrame({
  ariaLabel,
  onClose,
  badgeChannel,
  children,
}: RouteOverlayFrameProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { t } = useLocale();
  const version = formatAppVersion();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={dialogRef}
      data-route-overlay
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 outline-none sm:p-4"
    >
      <button
        type="button"
        aria-label="Close overlay"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
      />

      <div className="route-overlay-island landing-surface relative z-10 flex h-[min(56dvh,32rem)] w-[min(40rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/50 text-slate-900 shadow-2xl [color-scheme:light]">
        <AnimatedMeshBackground landing contained />
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 text-slate-900 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-900"
            >
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                <SuhuellaLogo className="h-4 w-4 shrink-0 text-slate-900" />
                {t.hero.badge.name || brand.displayName}
              </span>
              <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />
              <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-accent)_10%,transparent)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--brand-accent)]">
                {version}
              </span>
              {badgeChannel ? (
                <>
                  <span className="hidden h-3 w-px bg-slate-300 sm:block" aria-hidden />
                  <span className="text-[10px] font-medium text-slate-500">{badgeChannel}</span>
                </>
              ) : null}
            </Link>
            <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher inline />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/80 text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-950"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
