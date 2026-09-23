import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDownloadCatalogRows, downloadCatalogHasActiveInstallers } from "./download-catalog.ts";
import { getDictionary } from "./i18n/dictionary.ts";
import {
  overlayFromPathname,
  overlayHomePath,
  ROUTE_OVERLAY_PATHS,
} from "./route-overlay.ts";
import type { ReleaseManifest } from "./release-manifest.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const preRcManifest: ReleaseManifest = {
  version: "0.1.0-pre-rc",
  channel: "stable",
  minimumVersion: "0.1.0-pre-rc",
  mandatory: false,
  notes: "",
  releaseDate: "2026-09-19",
  downloads: {
    web: { available: true, url: null },
    mac: { available: false, url: null },
    windows: { available: false, url: null },
  },
  windows: "",
  mac: "",
};

const forbiddenPhrases = {
  es: [
    "solo después de pagar",
    "Completa la compra para descargar",
    "Confirmando tu pago",
    "Gracias por tu compra",
  ],
  en: [
    "only after you pay",
    "Complete your purchase to download",
    "Confirming your payment",
    "Thank you for your purchase",
  ],
};

function publicCopy(locale: "es" | "en"): string {
  const t = getDictionary(locale);
  return [
    t.hero.title,
    t.hero.subtitle,
    t.download.catalogTitle,
    t.download.catalogSubtitle,
    t.download.stateWebAvailable,
    t.download.stateDesktopUnavailable,
    t.success.modalNoPurchaseTitle,
    t.success.modalNoPurchaseDescription,
  ].join("\n");
}

function assertNoModalQueryInRepo(): void {
  const files = [
    join(process.cwd(), "components/web/RouteOverlayShell.tsx"),
    join(process.cwd(), "components/LicensePlansPage.tsx"),
    join(process.cwd(), "components/SuccessContent.tsx"),
    join(process.cwd(), "components/HeroSection.tsx"),
    join(process.cwd(), "lib/route-overlay.ts"),
    join(process.cwd(), "lib/suhuella-shell.tsx"),
    join(process.cwd(), "app/(suhuella)/page.tsx"),
    join(process.cwd(), "app/(suhuella)/home/page.tsx"),
    join(process.cwd(), "components/web/RouteOverlayFrame.tsx"),
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert(!source.includes("?modal="), `${file} must not use ?modal= query UX`);
    assert(!source.includes("/home?modal"), `${file} must not use /home?modal URLs`);
  }
}

export async function runRouteOverlayCheck(): Promise<void> {
  assert(overlayFromPathname("/home") === null, "/home has no overlay");
  assert(overlayFromPathname("/") === "landing", "/ opens landing overlay");
  assert(overlayFromPathname("/license") === "license", "/license opens plans overlay");
  assert(overlayFromPathname("/download") === "download", "/download opens downloads overlay");
  assert(
    overlayFromPathname("/download/preparing") === "downloadPreparing",
    "/download/preparing opens download preparing overlay",
  );
  assert(
    overlayFromPathname("/download/success") === "downloadPreparing",
    "/download/success legacy path opens download preparing overlay",
  );
  assert(overlayFromPathname("/license/success") === "success", "/license/success opens success overlay");
  assert(overlayFromPathname("/success") === "success", "/success opens success overlay");
  assert(overlayHomePath() === "/home", "closing overlay returns to /home");

  assert(ROUTE_OVERLAY_PATHS.landing === "/", "landing path is /");
  assert(ROUTE_OVERLAY_PATHS.license === "/license", "license path is /license");
  assert(ROUTE_OVERLAY_PATHS.download === "/download", "download path is /download");
  assert(
    ROUTE_OVERLAY_PATHS.downloadPreparing === "/download/preparing",
    "download preparing path is /download/preparing",
  );

  const rows = buildDownloadCatalogRows(preRcManifest);
  assert(rows[0]?.action.kind === "link" && rows[0].action.href === "/home", "web opens home");
  assert(rows[1]?.status === "unavailable", "desktop mac unavailable");
  assert(!downloadCatalogHasActiveInstallers(preRcManifest), "no installers in pre-rc");

  for (const locale of ["es", "en"] as const) {
    const copy = publicCopy(locale);
    for (const phrase of forbiddenPhrases[locale]) {
      assert(!copy.toLowerCase().includes(phrase.toLowerCase()), `${locale} avoids: ${phrase}`);
    }
    assert(copy.includes(getDictionary(locale).download.stateWebAvailable), `${locale} mentions web`);
  }

  assertNoModalQueryInRepo();

  const licensePage = readFileSync(join(process.cwd(), "app/(suhuella)/license/page.tsx"), "utf8");
  assert(licensePage.includes("SuhuellaLicenseOverlayPage"), "license route uses app shell overlay page");

  const landingPage = readFileSync(join(process.cwd(), "app/(suhuella)/page.tsx"), "utf8");
  assert(landingPage.includes("SuhuellaLandingPage"), "root route uses app shell landing overlay");

  const settingsWindow = readFileSync(join(process.cwd(), "../packages/product/src/windows/SettingsWindow.tsx"), "utf8");
  assert(settingsWindow.includes("openSettings('general')"), "IdentityCard opens Settings General");
  assert(!settingsWindow.includes("openSettings(isFree"), "IdentityCard does not open License by default");
  assert(!settingsWindow.includes("SuhuellaWordmark"), "app sidebar does not repeat the brand wordmark");

  const licensePanel = readFileSync(join(process.cwd(), "../packages/product/src/components/LicenseStatusPanel.tsx"), "utf8");
  assert(licensePanel.includes("t.revokeAction"), "paid license can be revoked on this computer");

  const general = readFileSync(join(process.cwd(), "../packages/product/src/components/PreferencesPanel.tsx"), "utf8");
  assert(general.includes("setLocale(option)"), "Settings General can change language");

  const overlayFrame = readFileSync(join(process.cwd(), "components/web/RouteOverlayFrame.tsx"), "utf8");
  assert(overlayFrame.includes("AnimatedMeshBackground"), "overlay reuses landing mesh background");
  assert(overlayFrame.includes("landing-surface"), "overlay uses landing surface color");
  assert(overlayFrame.includes("<LanguageSwitcher inline />"), "language switcher lives inside overlay content");
  assert(overlayFrame.includes('aria-label="Close"'), "close sits beside the language switcher");
  assert(!overlayFrame.includes("SuhuellaWordmark"), "overlay chrome uses the version badge, not a second wordmark");
  assert(!overlayFrame.includes("fixed top-5 right-5"), "close is not viewport-fixed away from the island");
  assert(!overlayFrame.includes("border-b border-slate-200 bg-white px-4 py-3"), "no white chrome header bar");
  assert(overlayFrame.includes("h-[min(56dvh,32rem)]"), "overlay is a little taller than half the screen");
  assert(overlayFrame.includes("w-[min(40rem,calc(100vw-1.5rem))]"), "overlay is a little wider than the compact island");

  const overlayShell = readFileSync(join(process.cwd(), "components/web/RouteOverlayShell.tsx"), "utf8");
  assert(overlayShell.includes("brand.displayName"), "overlay labels use BrandConfig name");

  const overlayPages = readFileSync(join(process.cwd(), "lib/suhuella-overlay-pages.tsx"), "utf8");
  assert(overlayPages.includes("SuhuellaOverlayApp"), "overlay routes share the app-backed popup shell");
  assert(!overlayPages.includes("suhuella-shell\""), "overlay pages do not import the shell module directly");
  assert(
    !overlayPages.includes("@/components/web/SuhuellaApp"),
    "overlay pages mount the browser app through SuhuellaOverlayApp",
  );
  assert(!overlayPages.includes("SettingsWindow"), "overlay routes do not import SettingsWindow");

  const productApp = readFileSync(join(process.cwd(), "components/web/SuhuellaApp.tsx"), "utf8");
  assert(productApp.includes("SettingsWindow"), "product app mounts SettingsWindow");
  assert(!productApp.includes("RouteOverlayShell"), "product app does not mount overlay catalog");

  const overlayApp = readFileSync(join(process.cwd(), "components/web/SuhuellaOverlayApp.tsx"), "utf8");
  assert(overlayApp.includes("RouteOverlayShell"), "overlay app mounts route overlay");
  assert(overlayApp.includes("<SuhuellaApp />"), "welcome, download, and success popups sit on the browser app");
  assert(
    !overlayApp.includes('className="h-dvh w-full bg-[var(--app-bg)]"'),
    "overlay routes do not use an empty grey backdrop",
  );
  assert(!overlayApp.includes("SettingsWindow"), "overlay app reaches the product window through SuhuellaApp");
  assert(!overlayApp.includes("install-browser-host"), "overlay app boots the product host through SuhuellaApp");
}

void runRouteOverlayCheck()
  .then(() => {
    console.log("APP-MODAL-SHELL-001 route overlay check passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
