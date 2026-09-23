#!/usr/bin/env node
/**
 * Provision Dbasenet partner gift into wrangler local D1 (same store as `npm run dev:cf`).
 * Brand and DNS are configured manually in /partners/portal after OTP sign-in.
 *
 * Usage: npm run provision:dbasenet-gift:local-dev --prefix site
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(siteRoot, "..");
const logPath = join(repoRoot, "DBASENET-GIFT-PROVISION-001-EXEC.log");

process.env.NODE_ENV = "development";
process.env.SUHUELLA_DEV_OPENNEXT = "1";
process.env.LICENSE_SIGNING_SECRET =
  process.env.LICENSE_SIGNING_SECRET?.trim() || "dbasenet-gift-provision-dev-secret";
process.env.PAID_CHECKOUT_ENABLED = "false";
process.env.PARTNER_CHECKOUT_ENABLED = "false";

mkdirSync(join(siteRoot, ".data"), { recursive: true });

const {
  provisionDbasenetPartnerGiftLocalDev,
  DBASENET_GIFT_OWNER_EMAIL,
  DBASENET_GIFT_SLUG,
} = await import("../lib/dbasenet-gift-provision.ts");

let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  fetchCalls += 1;
  throw new Error("stripe_must_not_be_called");
};

try {
  const result = await provisionDbasenetPartnerGiftLocalDev(siteRoot);

  const lines = [
    `# DBASENET-GIFT-PROVISION-001 (local dev D1)`,
    `executed_at=${new Date().toISOString()}`,
    `environment=wrangler_local_d1`,
    `stripe_calls=${fetchCalls}`,
    `owner_email=${DBASENET_GIFT_OWNER_EMAIL}`,
    `slug=${DBASENET_GIFT_SLUG}`,
    `reused=${result.reused}`,
    `partner_id=${result.partnerId}`,
    `brand_id=${result.brandId}`,
    `entitlement_origin=${result.entitlementOrigin}`,
    `portal_role=${result.portalRole}`,
    `primary_domain_recorded=false`,
    `sqlite_path=${result.sqlitePath}`,
    `dev_command=npm run dev:cf --prefix site`,
    `portal_path=/partners/portal`,
    `checkout_flags=PAID_CHECKOUT_ENABLED:false,PARTNER_CHECKOUT_ENABLED:false`,
    `status=PASS`,
  ];
  writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");

  console.log("Dbasenet partner gift provisioned into wrangler local D1.");
  console.log(`  owner: ${DBASENET_GIFT_OWNER_EMAIL}`);
  console.log(`  partner_id: ${result.partnerId}`);
  console.log(`  brand_id: ${result.brandId}`);
  console.log(`  sqlite: ${result.sqlitePath}`);
  console.log(`  log: ${logPath}`);
  console.log("");
  console.log("Next:");
  console.log("  1. npm run dev:cf --prefix site");
  console.log("  2. Open http://localhost:3000/partners/portal");
  console.log(`  3. Sign in as ${DBASENET_GIFT_OWNER_EMAIL} (OTP in terminal: [dev] Your SuHuella verification code…)`);
  console.log("  4. Configure brand + hostname (e.g. dbasenet.com) in the panel");
} finally {
  globalThis.fetch = originalFetch;
}
