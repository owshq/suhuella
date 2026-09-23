import type { Metadata } from "next";
import { brand } from "@suhuella/brand";
import { getInstallerUrls } from "@/lib/downloads";
import { hasDownloadableInstaller } from "@/lib/installer-availability";
import { isPaidCheckoutPubliclyEnabled } from "@/lib/paid-checkout";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import {
  toPresentationBrand,
  type PublicPresentationBrand,
} from "@/lib/partners/presentation-brand";
import { presentationPageTitle } from "@/lib/partners/unconfigured-hostname-copy";
import {
  requestBrandServesApp,
  resolveRequestBrandFromHeaders,
} from "@/lib/partners/request-brand";
import { getReleaseManifest, manifestToInstallerUrls } from "@/lib/release-manifest";
import { headers } from "next/headers";

export async function suhuellaShellMetadata(): Promise<Metadata> {
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const locale = await getRequestLocale();

  if (!requestBrandServesApp(requestBrand)) {
    return {
      title: {
        absolute: presentationPageTitle({
          kind: requestBrand.kind,
          locale,
          partnerDisplayName: null,
          platformDisplayName: null,
        }),
      },
      robots: { index: false, follow: false },
    };
  }

  const name =
    requestBrand.kind === "partner" ? requestBrand.displayName : brand.displayName;
  return {
    title: { absolute: name },
    description:
      "Your knowledge, on this computer. Plan Mode, search, and review Plans without uploading documents.",
    appleWebApp: {
      capable: true,
      title: name,
      statusBarStyle: "default",
    },
    manifest: "/manifest.webmanifest",
  };
}

export async function suhuellaShellProps(): Promise<{
  release: Awaited<ReturnType<typeof getReleaseManifest>>;
  installerUrls: ReturnType<typeof getInstallerUrls>;
  paidCheckoutEnabled: boolean;
  desktopDownloadAvailable: boolean;
  presentationBrand: PublicPresentationBrand;
}> {
  const release = await getReleaseManifest();
  const installerUrls = release ? manifestToInstallerUrls(release) : getInstallerUrls();
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  return {
    release,
    installerUrls,
    paidCheckoutEnabled: isPaidCheckoutPubliclyEnabled(),
    desktopDownloadAvailable: hasDownloadableInstaller(release),
    presentationBrand: toPresentationBrand(requestBrand),
  };
}
