/**
 * DOWNLOAD-DELIVERY-001 — site alias redirects to authorized distribution URLs;
 * never proxies installer bytes through the Worker.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOWNLOAD_DISTRIBUTION_MAC,
  DOWNLOAD_DISTRIBUTION_WIN,
} from "./desktop-download-flow.ts";
import {
  desktopDownloadRouteResponse,
  isAuthorizedInstallerUrl,
  resolveDesktopDownloadRoute,
} from "./desktop-download-route.ts";
import type { ReleaseManifest } from "./release-manifest.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publishedManifest: ReleaseManifest = {
  version: "0.1.0-pre-rc",
  channel: "stable",
  minimumVersion: "0.1.0-pre-rc",
  mandatory: false,
  notes: "",
  releaseDate: "2026-09-19",
  downloads: {
    web: { available: true, url: null },
    mac: {
      available: true,
      url: DOWNLOAD_DISTRIBUTION_MAC,
      sha256: "2db738fe4f11f9c3983274080c0b3dc9c9cdf7340560cb46a3a9ea0849003c4d",
      filename: "SuHuella-0.1.0-pre-rc.dmg",
      size: 131533425,
    },
    windows: {
      available: true,
      url: DOWNLOAD_DISTRIBUTION_WIN,
      sha256: "5b0d1ba2aab4b48f817ea87fb8e58193dc21b09e55aabc66bf3e6bcac4ba234b",
      filename: "SuHuella-Setup-0.1.0-pre-rc.exe",
      size: 226177159,
    },
  },
  windows: DOWNLOAD_DISTRIBUTION_WIN,
  mac: DOWNLOAD_DISTRIBUTION_MAC,
};

const unavailableManifest: ReleaseManifest = {
  ...publishedManifest,
  downloads: {
    web: { available: true, url: null },
    mac: { available: false, url: null },
    windows: { available: false, url: null },
  },
  mac: "",
  windows: "",
};

const evilManifest: ReleaseManifest = {
  ...publishedManifest,
  downloads: {
    ...publishedManifest.downloads,
    windows: {
      available: true,
      url: "https://evil.example/installer.exe",
    },
  },
  windows: "https://evil.example/installer.exe",
};

// 1. Windows → authorized redirect
const win = resolveDesktopDownloadRoute("windows", publishedManifest);
assert(win.kind === "redirect" && win.location === DOWNLOAD_DISTRIBUTION_WIN, "Windows redirects to authorized alias");

// 2. Mac → authorized redirect
const mac = resolveDesktopDownloadRoute("mac", publishedManifest);
assert(mac.kind === "redirect" && mac.location === DOWNLOAD_DISTRIBUTION_MAC, "Mac redirects to authorized alias");

// 3. Handler does not proxy installer body
const routeSource = readFileSync(
  join(process.cwd(), "app/api/desktop-download/[platform]/route.ts"),
  "utf8",
);
const libSource = readFileSync(join(process.cwd(), "lib/desktop-download-route.ts"), "utf8");
for (const pattern of ["upstream.body", "arrayBuffer(", "createWriteStream", "pipeline("]) {
  assert(!routeSource.includes(pattern), `route must not proxy bytes (${pattern})`);
  assert(!libSource.includes(pattern), `lib must not proxy bytes (${pattern})`);
}
const redirectResponse = desktopDownloadRouteResponse(win);
assert(redirectResponse.status === 302, "redirect status is 302");
assert(redirectResponse.headers.get("location") === DOWNLOAD_DISTRIBUTION_WIN, "Location header set");
assert(redirectResponse.headers.get("cache-control") === "no-store", "redirect is not cached");
assert(redirectResponse.body === null, "redirect response has no body");

// 4. Invalid platform
const invalid = resolveDesktopDownloadRoute("linux", publishedManifest);
assert(invalid.kind === "not_found" && invalid.body === "Not found", "invalid platform rejected");

// 5. Missing artifact
const missing = resolveDesktopDownloadRoute("windows", unavailableManifest);
assert(missing.kind === "not_found" && missing.body.includes("not published"), "missing artifact is 404");

// 6. Arbitrary external URL rejected
const evil = resolveDesktopDownloadRoute("windows", evilManifest);
assert(evil.kind === "not_found" && evil.body === "Installer unavailable.", "arbitrary external URL rejected");
assert(!isAuthorizedInstallerUrl("https://evil.example/installer.exe", "windows"), "evil URL fails authorization");

// 7. No license gate — route has no auth/session checks
for (const token of ["license", "checkout", "cookie", "session", "Authorization"]) {
  assert(!routeSource.includes(token), `download route must not gate on ${token}`);
}

// 8. Resolution failure — no invented installer link
const nullManifest = resolveDesktopDownloadRoute("mac", null);
assert(nullManifest.kind === "not_found", "null manifest does not invent a link");

const preparing = readFileSync(join(process.cwd(), "components/DownloadPreparingContent.tsx"), "utf8");
assert(preparing.includes("/api/desktop-download/"), "preparing page uses site download alias");
assert(!preparing.includes("customerInstallerFilename"), "preparing does not rename the published artifact");

console.log("DOWNLOAD-DELIVERY-001 checks passed");
