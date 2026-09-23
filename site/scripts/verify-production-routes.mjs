const origin = (process.env.PRODUCTION_ORIGIN ?? "https://suhuella.com").replace(/\/+$/, "");

const routes = [
  { path: "/", expectStatus: 200, mustInclude: ["data-suhuella-app"] },
  { path: "/download", expectStatus: 200, mustInclude: ["data-suhuella-app"] },
  { path: "/license", expectStatus: 200, mustInclude: ["data-suhuella-app"] },
  { path: "/home", expectStatus: 200, mustInclude: ["data-suhuella-app"] },
  { path: "/search", expectStatus: 200 },
  { path: "/sources", expectStatus: 200 },
  { path: "/plan-mode", expectStatus: 200 },
  { path: "/organise", expectStatus: 308, redirectTo: `${origin}/plan-mode` },
  { path: "/activity", expectStatus: 200 },
  { path: "/settings", expectStatus: 200 },
  { path: "/partners", expectStatus: 200, mustInclude: ["Partner"] },
  { path: "/partners/portal", expectStatus: 200 },
  { path: "/app", expectStatus: 308, redirectTo: `${origin}/home` },
];

let failed = false;

for (const route of routes) {
  const url = `${origin}${route.path}`;
  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  const normalizedLocation = location.startsWith("http")
    ? location
    : `${origin}${location.startsWith("/") ? location : `/${location}`}`;

  let ok = response.status === route.expectStatus;
  const html = response.ok ? await response.text() : "";

  if (route.redirectTo) {
    ok =
      ok &&
      normalizedLocation.replace(/\/+$/, "") === route.redirectTo.replace(/\/+$/, "");
  }

  if (route.mustInclude) {
    ok = ok && route.mustInclude.every((part) => html.includes(part));
  }

  if (!ok) {
    failed = true;
    console.error(
      `FAIL ${url} → ${response.status} (location: ${location || "none"}), expected ${route.expectStatus}`,
    );
  } else {
    console.log(`OK   ${url} → ${response.status}`);
  }
}

const apiPosts = [
  { path: "/api/license/email-code/request", body: {} },
  { path: "/api/license/email-code/verify", body: {} },
];

for (const route of apiPosts) {
  const url = `${origin}${route.path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(route.body),
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const htmlFallback = contentType.includes("text/html") || response.status === 404;
  if (htmlFallback) {
    failed = true;
    console.error(`FAIL ${url} → ${response.status} HTML/404 fallback`);
  } else if (response.status < 400 || response.status >= 600) {
    failed = true;
    console.error(`FAIL ${url} → ${response.status}, expected application 4xx for empty JSON`);
  } else {
    console.log(`OK   POST ${url} → ${response.status}`);
  }
}

const forbiddenPhrases = [
  "solo después de pagar",
  "Completa la compra para descargar",
  "Confirmando tu pago",
  "Gracias por tu compra",
  "only after you pay",
  "Complete your purchase to download",
];

const downloadUrl = `${origin}/download`;
const downloadResponse = await fetch(downloadUrl, { redirect: "manual" });
const downloadHtml = downloadResponse.ok ? await downloadResponse.text() : "";

if (downloadResponse.status !== 200) {
  failed = true;
  console.error(`FAIL ${downloadUrl} → ${downloadResponse.status}, expected 200`);
} else {
  console.log(`OK   ${downloadUrl} → 200`);
  for (const phrase of forbiddenPhrases) {
    if (downloadHtml.toLowerCase().includes(phrase.toLowerCase())) {
      failed = true;
      console.error(`FAIL ${downloadUrl} contains forbidden phrase: ${phrase}`);
    }
  }
  if (downloadHtml.includes("?modal=")) {
    failed = true;
    console.error(`FAIL ${downloadUrl} exposes ?modal= query UX`);
  }
}

const verifyUrl = `${origin}/api/verify-session?session_id=cs_test_forged`;
const verifyResponse = await fetch(verifyUrl, { redirect: "manual" });
let verifyBody = null;
try {
  verifyBody = await verifyResponse.json();
} catch {
  verifyBody = null;
}

if (verifyResponse.status !== 400 || verifyBody?.error !== "invalid_session") {
  failed = true;
  console.error(
    `FAIL ${verifyUrl} → ${verifyResponse.status} ${verifyBody?.error ?? "no json"}, expected 400 invalid_session`,
  );
} else {
  console.log(`OK   ${verifyUrl} → 400 invalid_session`);
}

if (failed) {
  console.error("\nProduction route verification failed.");
  process.exit(1);
}

console.log("\nProduction route verification passed.");
