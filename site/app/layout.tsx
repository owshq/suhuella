import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    metadataBase: new URL("https://suhuella.com"),
    title: {
      default: t.meta.title,
      template: `%s — SuHuella`,
    },
    description: t.meta.description,
    icons: {
      icon: [{ url: "/suhuella-logo.svg", type: "image/svg+xml" }],
      apple: [{ url: "/suhuella-logo.png", type: "image/png" }],
    },
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      url: "https://suhuella.com",
      siteName: "SuHuella",
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "SuHuella",
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
    >
      <body className="flex min-h-full flex-col bg-[#A7D8F9] text-[#111827]">
        {children}
      </body>
    </html>
  );
}
