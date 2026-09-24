/**
 * Stripe Live checkout smoke — production probes without completing payment.
 *
 * Validates gates, session creation (Personal), page availability (Business/Partner),
 * webhook signature rejection, and closed products.
 *
 *   node scripts/smoke-stripe-live-checkout.mjs
 *   PRODUCTION_ORIGIN=https://suhuella.com node scripts/smoke-stripe-live-checkout.mjs
 *
 * Full E2E (paid → webhook → D1 grant → activate) still requires human checkout once per product.
 */

const origin = (process.env.PRODUCTION_ORIGIN ?? "https://suhuella.com").replace(/\/+$/, "");

/** @typedef {{ label: string; ok: boolean; detail: string }} ProbeResult */

/** @type {ProbeResult[]} */
const results = [];

function record(label, ok, detail) {
  results.push({ label, ok, detail });
  const prefix = ok ? "OK  " : "FAIL";
  console.log(`${prefix} ${label} — ${detail}`);
}

function absoluteLocation(location) {
  if (!location) return "";
  if (location.startsWith("http")) return location;
  return `${origin}${location.startsWith("/") ? location : `/${location}`}`;
}

async function get(path, opts = {}) {
  const url = `${origin}${path}`;
  return fetch(url, { redirect: "manual", ...opts });
}

async function postJson(path, body, headers = {}) {
  const url = `${origin}${path}`;
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

async function probePersonalCheckout(plan) {
  const response = await get(`/checkout/${plan}`);
  const location = response.headers.get("location") ?? "";
  const abs = absoluteLocation(location);

  if (response.status !== 302) {
    record(`Personal ${plan} redirect`, false, `expected 302, got ${response.status}`);
    return;
  }
  if (!abs.includes("checkout.stripe.com")) {
    record(`Personal ${plan} Stripe host`, false, `location=${location || "none"}`);
    return;
  }
  if (!abs.includes("cs_live_")) {
    record(
      `Personal ${plan} live session`,
      false,
      `Stripe URL missing cs_live_ (test mode or misconfigured key?) — ${abs.slice(0, 80)}…`,
    );
    return;
  }
  record(`Personal ${plan} checkout`, true, `302 → cs_live_ session`);
}

async function probeBusinessPage() {
  const response = await get("/checkout/business");
  const html = response.ok ? await response.text() : "";
  const ok =
    response.status === 200 &&
    (html.includes("Business") || html.includes("business") || html.includes("plaza"));
  record(
    "Business checkout page",
    ok,
    ok ? "200 with business copy" : `status=${response.status}, body=${html.slice(0, 60)}…`,
  );
}

async function probePartnersProgram() {
  const response = await get("/partners");
  const html = response.ok ? await response.text() : "";
  const ok = response.status === 200 && html.toLowerCase().includes("partner");
  record(
    "Partner program page",
    ok,
    ok ? "200 public program" : `status=${response.status}`,
  );
}

async function probeWebhookRejectsUnsigned() {
  const response = await postJson("/api/stripe/webhook", {});
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ok = response.status === 400 && body?.error === "invalid_signature";
  record(
    "Webhook unsigned POST",
    ok,
    ok ? "400 invalid_signature" : `status=${response.status} error=${body?.error ?? "none"}`,
  );
}

async function probeBusinessApiGate() {
  const response = await postJson("/api/business/checkout", {
    seats: 25,
    organisationName: "Smoke Org",
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ok =
    response.status === 401 &&
    (body?.error === "unauthorized" || body?.ok === false);
  record(
    "Business checkout API (no proof)",
    ok,
    ok ? "401 unauthorized (gate open, proof required)" : `status=${response.status} error=${body?.error}`,
  );
}

async function probePartnerCheckoutGate() {
  const response = await postJson("/api/partners/checkout", {});
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ok =
    response.status === 401 &&
    (body?.error === "unauthorized" || body?.ok === false);
  record(
    "Partner checkout API (no session)",
    ok,
    ok ? "401 unauthorized (gate open, applicant session required)" : `status=${response.status} error=${body?.error}`,
  );
}

async function probeLifetimeUpgradeClosed() {
  const response = await postJson("/api/lifetime-upgrade/checkout", {
    proofId: "proof_smoke",
    licenseId: "lic_smoke",
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ok = response.status === 403 && body?.error === "checkout_closed";
  record(
    "Lifetime Upgrade closed",
    ok,
    ok ? "403 checkout_closed" : `status=${response.status} error=${body?.error}`,
  );
}

async function probePanGuard() {
  const response = await get("/checkout/monthly?card[number]=4242424242424242");
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ok = response.status === 400 && body?.error === "card_data_not_accepted";
  record(
    "PAN guard (personal GET)",
    ok,
    ok ? "400 card_data_not_accepted" : `status=${response.status}`,
  );
}

async function probeVerifySessionForged() {
  const response = await get("/api/verify-session?session_id=cs_live_forged_smoke");
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const ok = response.status === 400 && body?.error === "invalid_session";
  record(
    "Verify-session forged id",
    ok,
    ok ? "400 invalid_session" : `status=${response.status} error=${body?.error}`,
  );
}

async function main() {
  console.log(`Stripe Live checkout smoke — ${origin}\n`);

  await probePersonalCheckout("monthly");
  await probePersonalCheckout("lifetime");
  await probeBusinessPage();
  await probePartnersProgram();
  await probeWebhookRejectsUnsigned();
  await probeBusinessApiGate();
  await probePartnerCheckoutGate();
  await probeLifetimeUpgradeClosed();
  await probePanGuard();
  await probeVerifySessionForged();

  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length) {
    console.error(`Stripe Live checkout smoke FAILED (${failed.length}/${results.length} probes)`);
    console.error("");
    console.error("Human E2E still required after probes pass:");
    console.error("  1. Monthly — pay once → webhook → activate-from-checkout on Web/Desktop");
    console.error("  2. Lifetime — pay once → grant D1 → activate");
    console.error("  3. Business — email proof → checkout → org in D1 → reconcile if needed");
    console.error("  4. Partner — apply → checkout → portal entitlement");
    console.error("  5. Dashboard acct_1TSg2hAAPiPo60kj — webhook URL + 8 events + Prices");
    process.exit(1);
  }

  console.log(`Stripe Live checkout smoke PASS (${results.length}/${results.length} probes)`);
  console.log("");
  console.log("Automated probes OK. Remaining human steps (one paid checkout each):");
  console.log("  • Monthly + Lifetime: complete Stripe → return URL → license active");
  console.log("  • Business: OTP proof → seats checkout → org visible in settings");
  console.log("  • Partner: /partners apply → checkout → /partners/portal");
  console.log("  • Confirm webhook deliveries 2xx in Stripe Dashboard (acct_1TSg2hAAPiPo60kj)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
