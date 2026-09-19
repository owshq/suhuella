import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { brand, brandCssVars, siteOrigin } from "@suhuella/brand";
import { getRequestLocale } from "@/lib/i18n/detect-locale-server";
import { getDictionary } from "@/lib/i18n/dictionary";
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

  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: t.meta.title,
      template: `%s — ${brand.displayName}`,
    },
    description: t.meta.description,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        { url: brand.icon.public256, sizes: "256x256", type: "image/png" },
        { url: "/suhuella-app-icon.svg", type: "image/svg+xml" },
      ],
      shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
      apple: [{ url: brand.icon.public512, sizes: "512x512", type: "image/png" }],
    },
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      url: siteOrigin(),
      siteName: brand.displayName,
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: brand.displayName,
      description: t.meta.description,
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={brandCssVars() as CSSProperties}
    >
      <body
        className="flex h-full min-h-full flex-col text-[#111827]"
        style={{ backgroundColor: brand.pwa.backgroundColor }}
      >
        {children}
      </body>
    </html>
  );
}
