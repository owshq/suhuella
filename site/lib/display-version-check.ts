import { readFileSync } from "node:fs";
import { join } from "node:path";
import { brand } from "@suhuella/brand";
import {
  deriveDisplayVersion,
  displayVersionFromRelease,
} from "../../packages/product/src/lib/display-version.ts";
import { buildDownloadCatalogRows } from "./download-catalog.ts";
import { getDictionary } from "./i18n/dictionary.ts";
import { publicReleasePayload } from "./installer-availability.ts";
import { formatAppVersion } from "./release.ts";
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

function catalogManifest(version: string): ReleaseManifest {
  return { ...preRcManifest, version, minimumVersion: version };
}

export async function runDisplayVersionCheck(): Promise<void> {
  assert(deriveDisplayVersion("0.1.0-pre-rc") === "0.1.0", "pre-rc displays as 0.1.0");
  assert(deriveDisplayVersion("0.1.0-rc1") === "0.1.0", "rc1 displays as 0.1.0");
  assert(deriveDisplayVersion("0.1.0-rc12") === "0.1.0", "rcN displays as 0.1.0");
  assert(deriveDisplayVersion("0.1.0") === "0.1.0", "final 0.1.0 stays 0.1.0");
  assert(deriveDisplayVersion("0.1.0-alpha") === "0.1.0-alpha", "alpha prerelease is kept");
  assert(deriveDisplayVersion("0.1.0-beta.1") === "0.1.0-beta.1", "beta prerelease is kept");
  assert(deriveDisplayVersion("0.1.0-rc") === "0.1.0-rc", "rc without a number is kept");
  assert(deriveDisplayVersion(" 0.1.0-pre-rc ") === "0.1.0", "suffix strip trims the version");

  assert(
    displayVersionFromRelease({ version: "0.1.0-pre-rc", displayVersion: "0.2.0" }) === "0.2.0",
    "an existing displayVersion wins",
  );
  assert(
    displayVersionFromRelease({ version: "0.1.0-pre-rc", displayVersion: "  " }) === "0.1.0",
    "blank displayVersion falls back to derivation",
  );
  assert(
    displayVersionFromRelease({ version: "0.1.0-rc1" }) === "0.1.0",
    "missing displayVersion derives from the internal version",
  );

  const releaseJson = readFileSync(join(process.cwd(), "../brands/suhuella/release.json"), "utf8");
  assert(!releaseJson.includes("displayVersion"), "release.json has no displayVersion field");
  assert(JSON.parse(releaseJson).version === "0.1.0-pre-rc", "release.json version stays internal");
  assert(brand.release.version === "0.1.0-pre-rc", "BrandConfig release version stays internal");
  assert(
    displayVersionFromRelease(brand.release) === "0.1.0",
    "current internal 0.1.0-pre-rc displays as 0.1.0",
  );
  assert(formatAppVersion() === "v0.1.0", "website version badge shows v0.1.0");
  assert(formatAppVersion("0.1.0-rc1") === "v0.1.0", "formatted rc1 is v0.1.0");
  assert(formatAppVersion("0.1.0") === "v0.1.0", "formatted final version stays v0.1.0");
  assert(formatAppVersion("0.1.0-alpha") === "v0.1.0-alpha", "formatted alpha is not stripped");

  const payload = publicReleasePayload(preRcManifest);
  assert(payload.version === "0.1.0-pre-rc", "/api/release keeps the internal version");
  assert(payload.latest === "0.1.0-pre-rc", "/api/release latest stays internal for update checks");

  const preRcRows = buildDownloadCatalogRows(preRcManifest);
  assert(preRcRows.every((row) => row.version === "0.1.0"), "download catalog shows 0.1.0");
  assert(preRcRows.every((row) => row.channelKey === "preRc"), "pre-rc stays an internal catalog key");

  const rcRows = buildDownloadCatalogRows(catalogManifest("0.1.0-rc1"));
  assert(rcRows.every((row) => row.version === "0.1.0"), "rc1 catalog version displays as 0.1.0");
  assert(rcRows.every((row) => row.channelKey === "stable"), "rc1 does not invent a pre-rc channel");

  const finalRows = buildDownloadCatalogRows(catalogManifest("0.1.0"));
  assert(finalRows.every((row) => row.version === "0.1.0"), "final catalog version stays 0.1.0");

  for (const locale of ["es", "en"] as const) {
    const download = getDictionary(locale).download;
    const copy = [
      download.catalogTitle,
      download.catalogSubtitle,
      download.catalogSubtitleWithMac,
      download.stateDesktopUnavailable,
      download.catalogUnsignedNote,
      download.channelPreRc,
      download.channelStable,
      download.channelBeta,
      getDictionary(locale).hero.title,
    ].join("\n");
    assert(!/pre-rc/i.test(copy), `${locale} customer copy does not say pre-rc`);
    assert(!/\brc\d+/i.test(copy), `${locale} customer copy does not say rcN`);
    assert(download.channelPreRc === "Beta", `${locale} pre-rc channel label is Beta, not a version suffix`);
  }

  const repoRoot = join(process.cwd(), "..");
  const about = readFileSync(join(repoRoot, "desktop/electron/main.ts"), "utf8");
  assert(
    about.includes("applicationVersion: deriveDisplayVersion(app.getVersion())"),
    "macOS About shows the display version",
  );
  assert(
    about.includes("deriveDisplayVersion(app.getVersion())"),
    "desktop About dialog shows the display version",
  );
  const releaseCheck = readFileSync(join(repoRoot, "desktop/electron/release-check.ts"), "utf8");
  assert(releaseCheck.includes("const installed = app.getVersion()"), "update checks keep the internal version");
  assert(!releaseCheck.includes("deriveDisplayVersion"), "update checks do not use the display version");

  const preferences = readFileSync(
    join(repoRoot, "packages/product/src/components/PreferencesPanel.tsx"),
    "utf8",
  );
  assert(preferences.includes("shownVersion(appInfo.version)"), "About and Support show the display version");
  assert(
    preferences.includes("deriveDisplayVersion(decision.latest)"),
    "update copy shown to the user uses the display version",
  );
}

void runDisplayVersionCheck()
  .then(() => {
    console.log("DISPLAY-VERSION check passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
