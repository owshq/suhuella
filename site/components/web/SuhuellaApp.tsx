"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import "@suhuella/product/index.css";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { RouteOverlayShell } from "@/components/web/RouteOverlayShell";
import type { RouteOverlay } from "@/lib/route-overlay";
import type { ReleaseManifest } from "@/lib/release-manifest";

const SettingsWindow = dynamic(
  () =>
    import("@suhuella/product/windows/SettingsWindow").then((mod) => ({
      default: mod.SettingsWindow,
    })),
  { ssr: false, loading: () => <div data-suhuella-app className="h-dvh w-full bg-[var(--app-bg)]" /> },
);

type SuhuellaAppProps = {
  overlay: RouteOverlay | null;
  release: ReleaseManifest | null;
  installerUrls: { windows: string; mac: string };
  paidCheckoutEnabled: boolean;
  desktopDownloadAvailable: boolean;
};

function scheduleIdle(callback: () => void): () => void {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (typeof idle === "function") {
    const id = idle(callback);
    return () => {
      const cancel = (globalThis as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      cancel?.(id);
    };
  }
  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

export function SuhuellaApp({
  overlay,
  release,
  installerUrls,
  paidCheckoutEnabled,
  desktopDownloadAvailable,
}: SuhuellaAppProps) {
  const [hostReady, setHostReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = () => {
      void import("@suhuella/product/host/install-browser-host").then(({ installBrowserHost }) => {
        if (cancelled) return;
        installBrowserHost();
        setHostReady(true);
      });
    };

    if (overlay) {
      return scheduleIdle(boot);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [overlay]);

  return (
    <LocaleProvider>
      <RouteOverlayShell
        overlay={overlay}
        release={release}
        installerUrls={installerUrls}
        paidCheckoutEnabled={paidCheckoutEnabled}
        desktopDownloadAvailable={desktopDownloadAvailable}
      >
        {hostReady ? (
          <div
            data-suhuella-app
            className="h-dvh min-h-0 w-full overflow-hidden bg-[var(--app-bg)] text-[var(--app-fg)]"
          >
            <SettingsWindow />
          </div>
        ) : (
          <div data-suhuella-app className="h-dvh w-full bg-[var(--app-bg)]" />
        )}
      </RouteOverlayShell>
    </LocaleProvider>
  );
}
