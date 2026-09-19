import type { BrandConfig } from "../types.ts";

/** Current SuHuella commercial identity. Persistent IDs must stay exactly these values. */
export const suhuellaBrand = {
  id: "suhuella",
  operatorId: "self",
  displayName: "SuHuella",
  primaryDomain: "suhuella.com",
  supportEmail: "support@suhuella.com",
  salesEmail: "sales@suhuella.com",
  emails: {
    licenses: "licenses@suhuella.com",
    support: "support@suhuella.com",
    sales: "sales@suhuella.com",
    partners: "partners@suhuella.com",
    billing: "billing@suhuella.com",
    privacy: "privacy@suhuella.com",
    security: "security@suhuella.com",
    operations: "operations@suhuella.com",
  },
  theme: {
    accent: "#0084FF",
    onAccent: "#FFFFFF",
  },
  paidCheckoutEnabled: true,
  releaseRemoteEnabled: true,
  logo: {
    publicSvg: "/suhuella-logo.svg",
    publicPng: "/suhuella-logo.png",
  },
  icon: {
    public256: "/suhuella-icon-256.png",
    public512: "/suhuella-icon-512.png",
  },
  desktopProductName: "SuHuella",
  desktopAppId: "com.suhuella.desktop",
  desktopProtocol: "suhuella",
  pwa: {
    name: "SuHuella",
    shortName: "SuHuella",
    description: "Your knowledge, on this computer. Documents never leave this computer.",
    startUrl: "/home",
    backgroundColor: "#A7D8F9",
    themeColor: "#A7D8F9",
    icons: [
      {
        src: "/suhuella-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/suhuella-icon-256.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/suhuella-logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  },
  download: {
    macArtifactName: "${productName}-${version}.${ext}",
    windowsArtifactName: "${productName}-Setup-${version}.${ext}",
  },
  release: {
    version: "0.1.0-pre-rc",
    channel: "stable",
    minimumVersion: "0.1.0-pre-rc",
    mandatory: false,
    windows: "",
    mac: "",
  },
} as const satisfies BrandConfig;
