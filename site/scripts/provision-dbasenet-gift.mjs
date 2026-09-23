#!/usr/bin/env node
/**
 * Manual Ops-equivalent: provision Dbasenet partner gift locally (D1 schema on SQLite).
 * No Stripe, no remote D1, no flag changes.
 *
 * Usage: npm run provision:dbasenet-gift --prefix site
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(siteRoot, "..");
const sqlitePath = join(siteRoot, ".data/dbasenet-gift-provision.sqlite");
const logPath = join(repoRoot, "DBASENET-GIFT-PROVISION-001-EXEC.log");

process.env.NODE_ENV = "development";
process.env.LICENSE_SIGNING_SECRET =
  process.env.LICENSE_SIGNING_SECRET?.trim() || "dbasenet-gift-provision-dev-secret";
process.env.LICENSE_STORE_PATH =
  process.env.LICENSE_STORE_PATH?.trim() || join(siteRoot, ".data/dbasenet-gift-provision-licenses.json");
process.env.PAID_CHECKOUT_ENABLED = "false";
process.env.PARTNER_CHECKOUT_ENABLED = "false";

mkdirSync(join(siteRoot, ".data"), { recursive: true });

const {
  applyPartnerMigrationsToSqlite,
  bindPartnerPersistence,
  provisionDbasenetPartnerGift,
  DBASENET_GIFT_OWNER_EMAIL,
  DBASENET_GIFT_PRIMARY_DOMAIN,
  DBASENET_GIFT_SLUG,
} = await import("../lib/dbasenet-gift-provision.ts");
const { resetLicensePersistenceStoreForTests } = await import("../lib/license-persistence/store.ts");
const { resetPartnerStoreForTests } = await import("../lib/partners/store.ts");

resetPartnerStoreForTests();
resetLicensePersistenceStoreForTests();

const adapter = applyPartnerMigrationsToSqlite(sqlitePath, siteRoot);
bindPartnerPersistence(adapter);

let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  fetchCalls += 1;
  throw new Error("stripe_must_not_be_called");
};

try {
  const result = await provisionDbasenetPartnerGift({ seedSampleCustomerLicense: true });
  result.sqlitePath = sqlitePath;

  const lines = [
    `# DBASENET-GIFT-PROVISION-001`,
    `executed_at=${new Date().toISOString()}`,
    `environment=local_sqlite`,
    `stripe_calls=${fetchCalls}`,
    `owner_email=${DBASENET_GIFT_OWNER_EMAIL}`,
    `slug=${DBASENET_GIFT_SLUG}`,
    `primary_domain=${DBASENET_GIFT_PRIMARY_DOMAIN}`,
    `reused=${result.reused}`,
    `partner_id=${result.partnerId}`,
    `brand_id=${result.brandId}`,
    `entitlement_origin=${result.entitlementOrigin}`,
    `portal_role=${result.portalRole}`,
    `customer_license_id=${result.customerLicenseId ?? "none"}`,
    `sqlite_path=${sqlitePath}`,
    `checkout_flags=PAID_CHECKOUT_ENABLED:false,PARTNER_CHECKOUT_ENABLED:false`,
    `status=PASS`,
  ];
  writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");

  console.log("Dbasenet partner gift provisioned (local manual Ops equivalent).");
  console.log(`  owner: ${DBASENET_GIFT_OWNER_EMAIL}`);
  console.log(`  partner_id: ${result.partnerId}`);
  console.log(`  brand_id: ${result.brandId}`);
  console.log(`  sqlite: ${sqlitePath}`);
  console.log(`  log: ${logPath}`);
} finally {
  globalThis.fetch = originalFetch;
}
