import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DBASENET_GIFT_OWNER_EMAIL,
  DBASENET_GIFT_PRIMARY_DOMAIN,
  DBASENET_GIFT_SLUG,
  provisionDbasenetPartnerGift,
} from "./dbasenet-gift-provision.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { createMemoryPartnerStripeLedger, setPartnerStripeLedgerForTests } from "./partners/stripe-ledger.ts";
import { createMemoryPartnerStore, resetPartnerStoreForTests, setPartnerStoreForTests } from "./partners/store.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runDbasenetGiftProvisionCheck(): Promise<void> {
  const libRoot = join(fileURLToPath(import.meta.url), "..");
  const siteRoot = join(libRoot, "..");
  const repoRoot = join(siteRoot, "..");
  const licensePath = join(siteRoot, ".data/dbasenet-gift-provision-check-licenses.json");

  process.env.NODE_ENV = "development";
  process.env.LICENSE_SIGNING_SECRET = "dbasenet-gift-provision-check-secret";
  process.env.LICENSE_STORE_PATH = licensePath;
  process.env.PAID_CHECKOUT_ENABLED = "false";
  process.env.PARTNER_CHECKOUT_ENABLED = "false";

  try {
    unlinkSync(licensePath);
  } catch {
    // fresh
  }

  resetPartnerStoreForTests();
  resetLicensePersistenceStoreForTests();
  setPartnerStoreForTests(createMemoryPartnerStore());
  setPartnerStripeLedgerForTests(createMemoryPartnerStripeLedger());

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("stripe_must_not_be_called");
  };

  try {
    const first = await provisionDbasenetPartnerGift({ seedSampleCustomerLicense: true });
    assert(!first.reused, "first provision creates partner");
    assert(first.entitlementOrigin === "gift", "gift origin preserved");
    assert(first.portalRole === "partner_admin", "owner is partner admin");
    assert(first.customerLicenseId !== null, "sample customer license seeded");
    assert(fetchCalls === 0, "provision never calls Stripe");

    const second = await provisionDbasenetPartnerGift();
    assert(second.reused, "second provision is idempotent by slug");
    assert(second.partnerId === first.partnerId, "same partner id on reuse");

    const identity = JSON.parse(
      readFileSync(join(repoRoot, "brands/dbasenet/identity.json"), "utf8"),
    ) as { primaryDomain: string; emails: unknown };
    assert(identity.primaryDomain === DBASENET_GIFT_PRIMARY_DOMAIN, "brand identity domain matches");
    assert(identity.emails === null, "identity still has no invented owner email");

    assert(DBASENET_GIFT_SLUG === "dbasenet", "fixture slug is dbasenet");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("DBASENET-GIFT-PROVISION-001 check passed");
}

void runDbasenetGiftProvisionCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
