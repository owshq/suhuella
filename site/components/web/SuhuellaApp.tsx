"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { useRequestBrand } from "@/components/RequestBrandProvider";
import {
  presentationBrandSupportsAppShell,
  type PublicPresentationBrand,
} from "@/lib/partners/presentation-brand-client";
import { AppBrandingProvider } from "@suhuella/product/components/AppBrandingContext";
import { brand } from "@suhuella/brand";

function AppBootScreen({ message }: { message: string }) {
  return (
    <div
      data-suhuella-app
      data-suhuella-boot
      className="flex h-dvh w-full items-center justify-center bg-[var(--app-bg)] text-[var(--app-fg)]"
    >
      <p className="text-sm opacity-70">{message}</p>
    </div>
  );
}

const SettingsWindow = dynamic(
  () =>
    import("@suhuella/product/windows/SettingsWindow").then((mod) => ({
      default: mod.SettingsWindow,
    })),
  { ssr: false, loading: () => <AppBootScreen message="Opening…" /> },
);

export function SuhuellaApp({
  presentationBrand,
  paidCheckoutEnabled,
}: {
  presentationBrand?: PublicPresentationBrand;
  paidCheckoutEnabled?: boolean;
} = {}) {
  // Settings lives on this shell, not only on the route overlay. Publish before
  // License reads the gate, including the first client render.
  if (typeof window !== "undefined" && paidCheckoutEnabled !== undefined) {
    window.__suhuellaPaidCheckoutEnabled = paidCheckoutEnabled === true;
  }
  const requestBrand = useRequestBrand();
  const brandContext = presentationBrand ?? requestBrand;
  const [hostReady, setHostReady] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  const shellBrand = presentationBrandSupportsAppShell(brandContext) ? brandContext : null;

  const businessOverrides = useMemo(() => {
    if (!shellBrand) return {};
    return {
      wordmark: shellBrand.displayName,
      logo: shellBrand.logoUrl,
      accentColor: shellBrand.accent,
      onAccentColor: shellBrand.onAccent,
    };
  }, [shellBrand]);

  const bootLabel = shellBrand?.displayName || brand.displayName;

  useEffect(() => {
    if (!shellBrand) return;
    let cancelled = false;
    void import("@suhuella/product/host/install-browser-host")
      .then(({ installBrowserHost }) => {
        if (cancelled) return;
        installBrowserHost();
        setHostReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setHostError(
          error instanceof Error
            ? error.message
            : `${bootLabel} could not start in this browser.`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [bootLabel, shellBrand]);

  useEffect(() => {
    if (shellBrand?.displayName) {
      document.title = shellBrand.displayName;
    }
  }, [shellBrand?.displayName]);

  if (!shellBrand) {
    return null;
  }

  return (
    <LocaleProvider>
      <AppBrandingProvider businessOverrides={businessOverrides}>
        {hostError ? (
          <AppBootScreen message={hostError} />
        ) : hostReady ? (
          <div
            data-suhuella-app
            data-brand-id={shellBrand.brandId ?? ""}
            data-brand-kind={shellBrand.kind}
            className="h-dvh min-h-0 w-full overflow-hidden bg-[var(--app-bg)] text-[var(--app-fg)]"
          >
            <SettingsWindow />
          </div>
        ) : (
          <AppBootScreen message={`Opening ${bootLabel}…`} />
        )}
      </AppBrandingProvider>
    </LocaleProvider>
  );
}
