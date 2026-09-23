import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { brand, siteOrigin } from "@suhuella/brand";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
import { toPresentationBrand } from "@/lib/partners/presentation-brand";
import { presentationPageTitle } from "@/lib/partners/unconfigured-hostname-copy";
import {
  requestBrandCssVars,
  requestBrandServesApp,
  resolveRequestBrandFromHeaders,
} from "@/lib/partners/request-brand";
import { RequestBrandProvider } from "@/components/RequestBrandProvider";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = getDictionary(locale);
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const servesApp = requestBrandServesApp(requestBrand);
  const displayName =
    requestBrand.kind === "partner"
      ? requestBrand.displayName
      : requestBrand.kind === "platform"
        ? requestBrand.displayName
        : presentationPageTitle({ kind: requestBrand.kind, locale });
  const iconUrl =
    servesApp && (requestBrand.faviconUrl || requestBrand.logoUrl)
      ? requestBrand.faviconUrl || requestBrand.logoUrl
      : null;
  const productIcon = brand.icon.public256;
  const neutralTitle = presentationPageTitle({ kind: requestBrand.kind, locale });
  const neutralDescription =
    locale === "es"
      ? "Este sitio no está disponible."
      : "This site is not available.";
  const pageTitle = servesApp
    ? requestBrand.kind === "partner"
      ? displayName
      : t.meta.title
    : neutralTitle;
  const pageDescription = servesApp
    ? requestBrand.kind === "partner"
      ? `${displayName} — your knowledge, on this computer.`
      : t.meta.description
    : neutralDescription;
  const titleDisplayName = servesApp ? displayName : neutralTitle;

  return {
    ...(servesApp ? { metadataBase: new URL(siteOrigin()) } : {}),
    title: {
      default: pageTitle,
      template: `%s — ${titleDisplayName}`,
    },
    description: pageDescription,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        ...(servesApp && iconUrl ? [{ url: iconUrl, sizes: "256x256" as const }] : []),
      ],
      shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
      apple: [
        {
          url: servesApp ? (iconUrl ?? productIcon) : "/favicon.ico",
          sizes: "512x512",
        },
      ],
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      ...(servesApp
        ? {
            url: siteOrigin(),
            siteName: displayName,
          }
        : {
            siteName: neutralTitle,
          }),
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: pageTitle,
      description: pageDescription,
    },
    robots: servesApp ? undefined : { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();
  const requestBrand = await resolveRequestBrandFromHeaders(await headers());
  const cssVars = requestBrandCssVars(requestBrand);
  const publicBrand = toPresentationBrand(requestBrand);
  const background =
    requestBrand.kind === "platform"
      ? brand.pwa.backgroundColor
      : requestBrand.kind === "partner"
        ? "#F8FAFC"
        : "#F1F5F9";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={cssVars as CSSProperties}
    >
      <body
        className="flex h-full min-h-full flex-col text-[#111827]"
        style={{ backgroundColor: background }}
      >
        <RequestBrandProvider value={publicBrand} cssVars={cssVars}>
          {children}
        </RequestBrandProvider>
      </body>
    </html>
  );
}
