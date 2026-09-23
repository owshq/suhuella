import type { Metadata } from "next";
import { UnconfiguredHostnameScreen } from "@/components/web/UnconfiguredHostnameScreen";
import { SuhuellaOverlayApp } from "@/components/web/SuhuellaOverlayApp";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getPageTitle } from "@/lib/i18n/page-title";
import { presentationPageTitle } from "@/lib/partners/unconfigured-hostname-copy";
import {
  requestBrandServesApp,
  resolveRequestBrandFromHeaders,
} from "@/lib/partners/request-brand";
import { suhuellaShellProps } from "@/lib/suhuella-shell-props";
import type { RouteOverlay } from "@/lib/route-overlay";
import { headers } from "next/headers";

export async function generateLandingMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());

  if (!requestBrandServesApp(requestBrand)) {
    return {
      title: {
        absolute: presentationPageTitle({
          kind: requestBrand.kind,
          locale,
        }),
      },
      robots: { index: false, follow: false },
    };
  }

  if (requestBrand.kind === "partner") {
    return {
      title: { absolute: requestBrand.displayName },
      description: `${requestBrand.displayName} — your knowledge, on this computer.`,
    };
  }
  return {
    title: { absolute: getPageTitle(locale, "home") },
    description: t.meta.description,
  };
}

async function SuhuellaOverlayPage({ overlay }: { overlay: RouteOverlay }) {
  const props = await suhuellaShellProps();
  if (!props.presentationBrand.servesApp) {
    return (
      <UnconfiguredHostnameScreen
        hostname={props.presentationBrand.hostname}
        kind={props.presentationBrand.kind}
        domainStatus={props.presentationBrand.domainStatus}
      />
    );
  }
  return <SuhuellaOverlayApp overlay={overlay} {...props} />;
}

export async function SuhuellaLandingPage() {
  return SuhuellaOverlayPage({ overlay: "landing" });
}

export async function SuhuellaLicenseOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "license" });
}

export async function SuhuellaDownloadOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "download" });
}

export async function SuhuellaDownloadPreparingOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "downloadPreparing" });
}

export async function SuhuellaSuccessOverlayPage() {
  return SuhuellaOverlayPage({ overlay: "success" });
}
