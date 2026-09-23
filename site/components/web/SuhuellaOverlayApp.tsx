"use client";

import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { RouteOverlayShell } from "@/components/web/RouteOverlayShell";
import { SuhuellaApp } from "@/components/web/SuhuellaApp";
import type { PublicPresentationBrand } from "@/lib/partners/presentation-brand-client";
import type { RouteOverlay } from "@/lib/route-overlay";
import type { ReleaseManifest } from "@/lib/release-manifest";

type SuhuellaOverlayAppProps = {
  overlay: RouteOverlay;
  release: ReleaseManifest | null;
  installerUrls: { windows: string; mac: string };
  paidCheckoutEnabled: boolean;
  desktopDownloadAvailable: boolean;
  presentationBrand: PublicPresentationBrand;
};

export function SuhuellaOverlayApp({
  overlay,
  release,
  installerUrls,
  paidCheckoutEnabled,
  desktopDownloadAvailable,
  presentationBrand,
}: SuhuellaOverlayAppProps) {
  // Publish before children render so Settings license CTAs see the gate on first paint.
  if (typeof window !== "undefined") {
    window.__suhuellaPaidCheckoutEnabled = paidCheckoutEnabled === true;
  }

  return (
    <LocaleProvider>
      <RouteOverlayShell
        overlay={overlay}
        release={release}
        installerUrls={installerUrls}
        paidCheckoutEnabled={paidCheckoutEnabled}
        desktopDownloadAvailable={desktopDownloadAvailable}
      >
        <SuhuellaApp presentationBrand={presentationBrand} />
      </RouteOverlayShell>
    </LocaleProvider>
  );
}
