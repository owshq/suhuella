import { brand } from "@suhuella/brand";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const emptyDownloads = {
  web: { available: true, url: null },
  mac: { available: false, url: null },
  windows: { available: false, url: null },
} as const;

const emptyManifest: ReleaseManifest = {
  version: "0.1.0-pre-rc",
  channel: "stable",
  minimumVersion: "0.1.0-pre-rc",
  mandatory: false,
  notes: "",
  releaseDate: "2026-09-19",
  downloads: emptyDownloads,
  windows: "",
  mac: "",
};

const macOnlyManifest: ReleaseManifest = {
  version: "0.1.0-pre-rc",
  channel: "stable",
  minimumVersion: "0.1.0-pre-rc",
  mandatory: false,
  notes: "",
  releaseDate: "2026-09-19",
  downloads: {
    web: { available: true, url: null },
    mac: { available: true, url: "https://downloads.example.com/SuHuella-0.1.0-pre-rc.dmg" },
    windows: { available: false, url: null },
  },
  windows: "",
  mac: "https://downloads.example.com/SuHuella-0.1.0-pre-rc.dmg",
};

const forbidden = [
  "complete your purchase to download",
  "completa la compra para descargar",
  "only after payment",
  "solo después de pagar",
  "signed and notarized",
  "firmado y notariado",
  "dbasenet",
];

export function runDesktopReleaseArtifactsCheck(): void {
  assert(brand.id === "suhuella", "this check is SuHuella only");
  assert(brand.displayName === "SuHuella", "display name is SuHuella");
  assert(brand.desktopProductName === "SuHuella", "desktop product name is SuHuella");
  assert(brand.desktopAppId === "com.suhuella.desktop", "desktop app id is SuHuella");
  assert(brand.desktopProtocol === "suhuella", "protocol is suhuella");
  assert(brand.release.version === "0.1.0-pre-rc", "release version is 0.1.0-pre-rc");
  assert(brand.release.minimumVersion === "0.1.0-pre-rc", "minimumVersion matches");
  assert(!brand.release.windows, "Windows URL stays empty until a Windows installer exists");

  const macUrl = brand.release.mac.trim();
  if (macUrl) {
    const parsed = new URL(macUrl);
    assert(parsed.protocol === "https:", "Mac URL must be https");
    assert(parsed.hostname !== "localhost", "Mac URL must not be localhost");
    const filename = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? "");
    assert(filename.includes("SuHuella"), "Mac filename includes SuHuella");
    assert(filename.includes("0.1.0-pre-rc"), "Mac filename includes 0.1.0-pre-rc");
    assert(filename.endsWith(".dmg"), "Mac filename ends with .dmg");
  }

  const emptyPayload = publicReleasePayload(emptyManifest);
  assert(!("mac" in emptyPayload), "/api/release omits mac without URL");
  assert(!("windows" in emptyPayload), "/api/release omits windows without URL");
  assert(emptyPayload.latest === emptyPayload.version, "/api/release latest aliases version");
  assert(emptyPayload.minimum === emptyPayload.minimumVersion, "/api/release minimum aliases minimumVersion");
  assert(emptyPayload.notes === "", "/api/release notes stay empty until published");
  assert(hasDownloadableInstaller(emptyManifest) === false, "empty URLs are not downloadable");

  const macPayload = publicReleasePayload(macOnlyManifest);
  assert(macPayload.mac === macOnlyManifest.mac, "/api/release exposes Mac URL when it exists");
  assert(!("windows" in macPayload), "/api/release does not expose Windows URL without artifact");

  const emptyRows = buildDownloadCatalogRows(emptyManifest);
  assert(emptyRows[1]?.status === "unavailable", "/download keeps Mac unavailable without URL");
  assert(emptyRows[1]?.action.kind === "none", "/download has no Mac button without URL");
  assert(emptyRows[2]?.status === "unavailable", "/download keeps Windows unavailable");
  assert(downloadCatalogHasActiveInstallers(emptyManifest) === false, "empty catalog has no active installers");

  const macRows = buildDownloadCatalogRows(macOnlyManifest);
  assert(macRows[1]?.status === "available", "/download shows Mac available with real URL");
  assert(macRows[1]?.action.kind === "link" && macRows[1].action.labelKey === "download", "Mac row is Download");
  assert(macRows[2]?.status === "unavailable", "/download keeps Windows unavailable with Mac-only URL");
  assert(macRows[2]?.action.kind === "none", "Windows has no download action");

  for (const locale of ["es", "en"] as const) {
    const t = getDictionary(locale).download;
    const copy = [
      t.catalogSubtitle,
      t.catalogSubtitleWithMac,
      t.stateMacTitle,
      t.stateMacAction,
      t.stateWindowsTitle,
      t.stateWindowsUnavailable,
      t.catalogUnsignedNote,
      t.activationNote,
    ]
      .join("\n")
      .toLowerCase();
    for (const phrase of forbidden) {
      assert(!copy.includes(phrase), `${locale} download copy avoids: ${phrase}`);
    }
    assert(copy.includes("suhuella"), `${locale} download copy names SuHuella`);
    assert(!copy.includes("dbasenet"), `${locale} download copy has no other brand`);
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const artifactName = `${brand.desktopProductName}-${brand.release.version}.dmg`;
  const artifactPath = path.join(repoRoot, "desktop/.build/suhuella/release", artifactName);
  if (existsSync(artifactPath)) {
    const size = statSync(artifactPath).size;
    assert(size > 0, "local Mac DMG is not empty");
    assert(artifactName.includes("SuHuella"), "artifact name includes SuHuella");
    assert(artifactName.includes("0.1.0-pre-rc"), "artifact name includes version");
    console.log(`local Mac DMG present: ${artifactName} (${size} bytes)`);
  } else {
    console.log(`local Mac DMG not present yet: ${artifactName}`);
  }

  console.log("DESKTOP-RELEASE-ARTIFACTS-001 check passed");
}

runDesktopReleaseArtifactsCheck();
