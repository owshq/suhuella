/**
 * Smoke: /api/release installers + download.suhuella.com redirects.
 */
const ORIGIN = (process.env.PRODUCTION_ORIGIN ?? "https://suhuella.com").replace(/\/+$/, "");
const DOWNLOAD = (process.env.DOWNLOAD_ORIGIN ?? "https://download.suhuella.com").replace(/\/+$/, "");

let failed = false;

function ok(label) {
  console.log(`OK   ${label}`);
}

function bad(label, detail) {
  failed = true;
  console.error(`FAIL ${label} — ${detail}`);
}

async function checkRedirect(aliasPath, label) {
  const res = await fetch(`${DOWNLOAD}${aliasPath}`, { redirect: "manual" });
  if (res.status !== 302 && res.status !== 301) {
    bad(`${label} redirect`, `expected 302, got ${res.status}`);
    return;
  }
  const location = res.headers.get("location") ?? "";
  if (!location.includes("github.com") && !location.includes("objects.githubusercontent.com")) {
    bad(`${label} target`, location || "empty");
  } else {
    ok(`${label} → ${location.slice(0, 72)}…`);
  }
}

const releaseRes = await fetch(`${ORIGIN}/api/release`);
let release = null;
if (!releaseRes.ok) {
  bad("/api/release", String(releaseRes.status));
} else {
  release = (await releaseRes.json()).release;
  for (const [platform, key] of [
    ["mac", "mac"],
    ["windows", "windows"],
  ]) {
    const entry = release?.downloads?.[key];
    if (entry?.available) {
      if (!entry.url?.startsWith("https://download.suhuella.com/")) {
        bad(`/api/release ${platform}.url`, entry.url ?? "missing");
      } else {
        ok(`/api/release ${platform} → ${entry.url}`);
      }
    }
  }
}

if (release?.downloads?.mac?.available) {
  await checkRedirect("/latest/mac", "Mac");
}
if (release?.downloads?.windows?.available) {
  await checkRedirect("/latest/win", "Windows");
}

const downloadPage = await fetch(`${ORIGIN}/download`);
if (!downloadPage.ok) {
  bad("/download", String(downloadPage.status));
} else {
  const html = await downloadPage.text();
  if (html.includes("desktopDownloadAvailable\":false")) {
    bad("/download", "desktop still marked unavailable");
  } else {
    ok("/download installers available");
  }
}

if (failed) process.exit(1);
console.log("Desktop download smoke passed.");
