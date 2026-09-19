import type { Metadata } from "next";
import { brand } from "@suhuella/brand";
import { SuhuellaApp } from "@/components/web/SuhuellaApp";
import { getInstallerUrls } from "@/lib/downloads";
import { hasDownloadableInstaller } from "@/lib/installer-availability";
import { isPaidCheckoutPubliclyEnabled } from "@/lib/paid-checkout";
import { getReleaseManifest, manifestToInstallerUrls } from "@/lib/release-manifest";
import type { RouteOverlay } from "@/lib/route-overlay";

export const suhuellaShellMetadata: Metadata = {
  title: { absolute: brand.displayName },
  description:
    "Your knowledge, on this computer. Organise, search, and review Plans without uploading documents.",
  appleWebApp: {
    capable: true,
    title: brand.displayName,
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
};

async function shellProps() {
  const release = await getReleaseManifest();
  const installerUrls = release ? manifestToInstallerUrls(release) : getInstallerUrls();
  return {
    release,
    installerUrls,
    paidCheckoutEnabled: isPaidCheckoutPubliclyEnabled(),
    desktopDownloadAvailable: hasDownloadableInstaller(release),
  };
}

export async function SuhuellaShellPage() {
  const props = await shellProps();
  return <SuhuellaApp overlay={null} {...props} />;
}

export async function SuhuellaOverlayPage({ overlay }: { overlay: RouteOverlay }) {
  const props = await shellProps();
  return <SuhuellaApp overlay={overlay} {...props} />;
}
