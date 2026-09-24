"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { brand } from "@suhuella/brand";
import { RouteOverlayFrame } from "@/components/web/RouteOverlayFrame";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  overlayFromPathname,
  overlayHomePath,
  type RouteOverlay,
} from "@/lib/route-overlay";
import { releaseChannelLabel } from "@/lib/download-catalog";
import type { ReleaseManifest } from "@/lib/release-manifest";

const LandingContent = dynamic(
  () => import("@/components/LandingContent").then((mod) => ({ default: mod.LandingContent })),
  { ssr: false },
);
const LicensePlansPage = dynamic(
  () => import("@/components/LicensePlansPage").then((mod) => ({ default: mod.LicensePlansPage })),
  { ssr: false },
);
const DownloadCatalogContent = dynamic(
  () =>
    import("@/components/DownloadCatalogContent").then((mod) => ({
      default: mod.DownloadCatalogContent,
    })),
  { ssr: false },
);
const SuccessContent = dynamic(
  () => import("@/components/SuccessContent").then((mod) => ({ default: mod.SuccessContent })),
  { ssr: false },
);
const DownloadPreparingContent = dynamic(
  () =>
    import("@/components/DownloadPreparingContent").then((mod) => ({
      default: mod.DownloadPreparingContent,
    })),
  { ssr: false },
);

type RouteOverlayShellProps = {
  children: ReactNode;
  overlay: RouteOverlay | null;
  release: ReleaseManifest | null;
  installerUrls: { windows: string; mac: string };
  paidCheckoutEnabled: boolean;
  businessCheckoutEnabled: boolean;
  desktopDownloadAvailable: boolean;
};

function overlayLabel(overlay: RouteOverlay, locale: "es" | "en"): string {
  if (overlay === "landing") return brand.displayName;
  if (overlay === "license") return locale === "es" ? "Planes y licencias" : "Plans and licenses";
  if (overlay === "download") {
    return locale === "es" ? `Descargas de ${brand.displayName}` : `${brand.displayName} downloads`;
  }
  if (overlay === "downloadPreparing") {
    return locale === "es" ? "Preparando descarga" : "Preparing download";
  }
  return locale === "es" ? "Estado de la compra" : "Purchase status";
}

export function RouteOverlayShell({
  children,
  overlay: initialOverlay,
  release,
  installerUrls,
  paidCheckoutEnabled,
  businessCheckoutEnabled,
  desktopDownloadAvailable,
}: RouteOverlayShellProps) {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const overlay = overlayFromPathname(pathname) ?? initialOverlay;
  const downloadBadgeChannel =
    overlay === "download"
      ? releaseChannelLabel(release, {
          preRc: t.download.channelPreRc,
          stable: t.download.channelStable,
          beta: t.download.channelBeta,
        })
      : undefined;

  const closeOverlay = useCallback(() => {
    window.location.assign(overlayHomePath());
  }, []);

  useEffect(() => {
    if (!overlay) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlay, closeOverlay]);

  return (
    <>
      {children}
      {overlay ? (
        <RouteOverlayFrame
          ariaLabel={overlayLabel(overlay, locale)}
          onClose={closeOverlay}
          badgeChannel={downloadBadgeChannel}
        >
          {overlay === "landing" ? (
            <LandingContent embedded installerUrls={installerUrls} onClose={closeOverlay} />
          ) : null}
          {overlay === "license" ? (
            <Suspense fallback={null}>
              <LicensePlansPage
                embedded
                desktopDownloadAvailable={desktopDownloadAvailable}
                paidCheckoutEnabled={paidCheckoutEnabled}
                businessCheckoutEnabled={businessCheckoutEnabled}
                onClose={closeOverlay}
              />
            </Suspense>
          ) : null}
          {overlay === "download" ? (
            <DownloadCatalogContent embedded release={release} onClose={closeOverlay} />
          ) : null}
          {overlay === "downloadPreparing" ? (
            <Suspense fallback={null}>
              <DownloadPreparingContent embedded onClose={closeOverlay} />
            </Suspense>
          ) : null}
          {overlay === "success" ? (
            <Suspense fallback={null}>
              <SuccessContent embedded plansHref="/license" onClose={closeOverlay} />
            </Suspense>
          ) : null}
        </RouteOverlayFrame>
      ) : null}
    </>
  );
}
