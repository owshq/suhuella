import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brand } from "@suhuella/brand";
import {
  buildDownloadCatalogRows,
  downloadCatalogHasActiveInstallers,
} from "./download-catalog.ts";
import { getDictionary } from "./i18n/dictionary.ts";
import { hasDownloadableInstaller, publicReleasePayload } from "./installer-availability.ts";
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

const manifestWithInstallers: ReleaseManifest = {
  version: "1.0.0",
  channel: "stable",
  minimumVersion: "1.0.0",
  mandatory: false,
  notes: "",
  releaseDate: "2026-09-19",
  downloads: {
    web: { available: true, url: null },
    mac: { available: true, url: "https://downloads.example.com/SuHuella.dmg" },
    windows: { available: true, url: "https://downloads.example.com/SuHuella-Setup.exe" },
  },
  windows: "https://downloads.example.com/SuHuella-Setup.exe",
  mac: "https://downloads.example.com/SuHuella.dmg",
};

const forbiddenCatalogPhrases = {
  es: [
    "solo después de pagar",
    "Completa la compra para descargar",
    "Tu pago se ha completado",
    "Pago confirmado",
  ],
  en: [
    "only after you pay",
    "Complete your purchase to download",
    "Your payment was successful",
    "Payment confirmed",
  ],
};

function catalogCopy(locale: "es" | "en"): string {
  const t = getDictionary(locale).download;
  return [
    t.catalogTitle,
    t.catalogSubtitle,
    t.catalogSubtitleWithMac,
    t.stateWebTitle,
    t.stateWebAvailable,
    t.stateWebAction,
    t.stateDesktopTitle,
    t.stateDesktopUnavailable,
    t.stateDesktopNoInstallers,
    t.stateMacTitle,
    t.stateMacAvailable,
    t.stateMacAction,
    t.stateWindowsTitle,
    t.stateWindowsUnavailable,
    t.catalogUnsignedNote,
    t.activationNote,
    t.viewPlans,
  ].join("\n");
}

export async function runDownloadPageSemanticsCheck(): Promise<void> {
  const rows = buildDownloadCatalogRows(preRcManifest);
  assert(rows.length === 3, "catalog lists web + mac + windows rows");
  assert(rows[0]?.platformKey === "web", "first row is web");
  assert(rows[0]?.status === "available", "web is available");
  assert(rows[0]?.action.kind === "link" && rows[0].action.href === "/home", "web opens /home");
  assert(rows[1]?.status === "unavailable", "mac unavailable without installer URL");
  assert(rows[2]?.status === "unavailable", "windows unavailable without installer URL");
  assert(rows[1]?.action.kind === "none", "mac has no download action");
  assert(rows[2]?.action.kind === "none", "windows has no download action");
  assert(
    downloadCatalogHasActiveInstallers(preRcManifest) === false,
    "pre-rc manifest has no active installers",
  );

  const macOnly: ReleaseManifest = {
    ...preRcManifest,
    mac: "https://downloads.example.com/SuHuella-0.1.0-pre-rc.dmg",
    downloads: {
      ...preRcManifest.downloads,
      mac: { available: true, url: "https://downloads.example.com/SuHuella-0.1.0-pre-rc.dmg" },
    },
  };
  const macOnlyRows = buildDownloadCatalogRows(macOnly);
  assert(macOnlyRows[1]?.status === "available", "mac available with URL only");
  assert(macOnlyRows[2]?.status === "unavailable", "windows stays unavailable without installer");
  assert(macOnlyRows[2]?.action.kind === "none", "windows has no action without installer");

  const withInstallers = buildDownloadCatalogRows(manifestWithInstallers);
  assert(withInstallers[1]?.status === "available", "mac available with URL");
  assert(withInstallers[2]?.status === "available", "windows available with URL");
  assert(
    withInstallers[1]?.action.kind === "link" && withInstallers[1].action.labelKey === "download",
    "mac row exposes download action",
  );
  assert(
    downloadCatalogHasActiveInstallers(manifestWithInstallers) === true,
    "manifest with URLs is downloadable",
  );

  const payload = publicReleasePayload(preRcManifest);
  assert(payload.version === "0.1.0-pre-rc", "release payload keeps version");
  assert(payload.latest === "0.1.0-pre-rc", "release payload latest aliases version");
  assert(payload.minimum === payload.minimumVersion, "release payload minimum aliases minimumVersion");
  assert(!("mac" in payload), "release payload omits mac without URL");
  assert(!("windows" in payload), "release payload omits windows without URL");
  assert(
    hasDownloadableInstaller(preRcManifest) === false,
    "pre-rc manifest is not downloadable",
  );

  for (const locale of ["es", "en"] as const) {
    const copy = catalogCopy(locale);
    for (const phrase of forbiddenCatalogPhrases[locale]) {
      assert(!copy.toLowerCase().includes(phrase.toLowerCase()), `${locale} catalog avoids: ${phrase}`);
    }
    assert(copy.includes(getDictionary(locale).download.stateWebAvailable), `${locale} shows web available`);
    assert(
      copy.includes(getDictionary(locale).download.stateDesktopUnavailable),
      `${locale} shows desktop unavailable`,
    );
  }

  assert(brand.release.version.length > 0, "brand release version exists");
  assert(brand.logo.publicSvg.length > 0, "brand logo path exists");
  assert(brand.displayName.length > 0, "brand display name exists");

  const catalogSource = readFileSync(join(process.cwd(), "components/DownloadCatalogContent.tsx"), "utf8");
  const overlayFrameSource = readFileSync(
    join(process.cwd(), "components/web/RouteOverlayFrame.tsx"),
    "utf8",
  );
  assert(
    catalogSource.includes("detectClientDownloadPlatform"),
    "download catalog filters rows by detected platform",
  );
  assert(catalogSource.includes("BrandMark"), "download catalog shows BrandConfig logo");
  assert(catalogSource.includes("SuhuellaWordmark"), "download page chrome uses brand wordmark");
  assert(overlayFrameSource.includes("brand.displayName"), "overlay frame shows BrandConfig name");
  assert(overlayFrameSource.includes("badgeChannel"), "overlay frame can show release channel");

  const siteLogo = readFileSync(join(process.cwd(), "components/icons/SuhuellaLogo.tsx"), "utf8");
  assert(siteLogo.includes("BrandMark"), "site logo uses BrandConfig mark");
  assert(!siteLogo.includes("viewBox"), "site logo is not a hardcoded glyph");
}

void runDownloadPageSemanticsCheck()
  .then(() => {
    console.log("DOWNLOAD-PAGE-SEMANTICS-001 check passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
