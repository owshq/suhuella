import type { BrandConfig } from "../types.ts";
import { brandReleaseFromManifest } from "../release-manifest.ts";
import dbasenetRelease from "./release.json" with { type: "json" };

/** Birth identity for the Dbasenet Brand. Operator remains "self". */
export const dbasenetBrand = {
  id: "dbasenet",
  operatorId: "self",
  displayName: "Dbasenet",
  primaryDomain: "dbasenet.com",
  supportEmail: null,
  salesEmail: null,
  emails: null,
  theme: {
    accent: "#0B5F63",
    onAccent: "#FFFFFF",
  },
  paidCheckoutEnabled: false,
  releaseRemoteEnabled: false,
  logo: {
    publicSvg: "/dbasenet-logo.svg",
    publicPng: "/dbasenet-logo.png",
  },
  icon: {
    public192: "/dbasenet-icon-192.png",
    public256: "/dbasenet-icon-256.png",
    public512: "/dbasenet-icon-512.png",
  },
  desktopProductName: "Dbasenet",
  desktopAppId: "com.dbasenet.desktop",
  desktopProtocol: "dbasenet",
  pwa: {
    name: "Dbasenet",
    shortName: "Dbasenet",
    description: "Your knowledge, on this computer. Documents never leave this computer.",
    startUrl: "/home",
    backgroundColor: "#D7EEEA",
    themeColor: "#0B5F63",
    icons: [
      {
        src: "/dbasenet-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/dbasenet-icon-256.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/dbasenet-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
  },
  download: {
    macArtifactName: "${productName}-${version}.${ext}",
    windowsArtifactName: "${productName}-Setup-${version}.${ext}",
  },
  release: brandReleaseFromManifest(dbasenetRelease),
} satisfies BrandConfig;
