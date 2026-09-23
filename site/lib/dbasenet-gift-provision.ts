import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPartnerCheckoutSession } from "./partners/checkout.ts";
import { listPartnerCustomerLicenses } from "./partners/customer-licenses.ts";
import {
  createPartner,
  openPartnerPortalForVerifiedEmail,
  type CreatePartnerResult,
} from "./partners/service.ts";
import {
  createPartnerStoreFromDatabase,
  getPartnerStore,
  setPartnerStoreForTests,
  type PartnerStore,
} from "./partners/store.ts";
import { createPartnerStripeLedgerFromDatabase, setPartnerStripeLedgerForTests } from "./partners/stripe-ledger.ts";
import { grantAllowsPresentationBrand } from "./license-presentation.ts";
import { listDurableGrants, upsertStoredGrant } from "./license-store.ts";
import {
  findLocalD1SqlitePath,
  openFreshLocalD1Adapter,
  openIsolatedSqliteAdapter,
  type SqliteD1Adapter,
} from "./test/local-d1.ts";
import { setLicensePersistenceDatabaseForTests } from "./license-persistence/store.ts";

/** Ops smoke target — not invented in brand config. */
export const DBASENET_GIFT_OWNER_EMAIL = "info.linkeram@gmail.com";
export const DBASENET_GIFT_SLUG = "dbasenet";
export const DBASENET_GIFT_DISPLAY_NAME = "Dbasenet";
export const DBASENET_GIFT_PRIMARY_DOMAIN = "dbasenet.com";
export const DBASENET_GIFT_REASON = "Partner platform gift — Dbasenet brand (Ops manual)";

const PARTNER_MIGRATIONS = [
  "0007_partners.sql",
  "0008_partner_domain.sql",
  "0009_partner_application.sql",
  "0010_partner_stripe_ledger.sql",
] as const;

const platformActor = { kind: "platform" as const, email: "operations@suhuella.com" };

export type DbasenetGiftProvisionResult = {
  ok: true;
  reused: boolean;
  partnerId: string;
  brandId: string;
  entitlementOrigin: string;
  portalRole: string;
  onboardingPath: string;
  sqlitePath: string;
  customerLicenseId: string | null;
};

export function applyPartnerMigrationsToSqlite(sqlitePath: string, siteRoot: string): SqliteD1Adapter {
  const { db, adapter } = openIsolatedSqliteAdapter(sqlitePath);
  for (const file of PARTNER_MIGRATIONS) {
    db.exec(readFileSync(join(siteRoot, "migrations", file), "utf8"));
  }
  return adapter;
}

export function bindPartnerPersistence(adapter: SqliteD1Adapter): void {
  setPartnerStoreForTests(createPartnerStoreFromDatabase(adapter));
  setPartnerStripeLedgerForTests(createPartnerStripeLedgerFromDatabase(adapter));
}

/** Same SQLite file `npm run dev:cf` reads via wrangler local D1. */
export function bindLocalWranglerDevPersistence(siteRoot: string): {
  adapter: SqliteD1Adapter;
  sqlitePath: string;
} {
  const { adapter } = openFreshLocalD1Adapter(siteRoot);
  bindPartnerPersistence(adapter);
  setLicensePersistenceDatabaseForTests(adapter);
  return { adapter, sqlitePath: findLocalD1SqlitePath(siteRoot) };
}

async function findExistingDbasenet(): Promise<CreatePartnerResult | null> {
  const store = await getPartnerStore();
  const doc = await store.read();
  const partner = doc.partners.find((item) => item.slug === DBASENET_GIFT_SLUG);
  if (!partner) return null;
  const brand = doc.brands.find((item) => item.partnerId === partner.partnerId);
  const entitlement = doc.entitlements.find((item) => item.partnerId === partner.partnerId);
  if (!brand || !entitlement) return null;
  return {
    summary: {
      partner,
      brand,
      entitlement,
      domains: doc.domains.filter((d) => d.partnerId === partner.partnerId),
      members: doc.members.filter((m) => m.partnerId === partner.partnerId),
    },
    onboarding: {
      inviteId: "",
      email: partner.ownerEmail,
      path: "/partners/portal",
      token: "",
      expiresAt: "",
    },
  };
}

/**
 * Manual Ops-equivalent gift provision. No Stripe calls. Idempotent by slug.
 */
export async function provisionDbasenetPartnerGift(input: {
  store?: PartnerStore;
  seedSampleCustomerLicense?: boolean;
  /** When false, brand/DNS are configured manually in the partner panel. */
  recordPrimaryDomain?: boolean;
} = {}): Promise<DbasenetGiftProvisionResult> {
  if (input.store) setPartnerStoreForTests(input.store);
  const recordPrimaryDomain = input.recordPrimaryDomain ?? true;

  let created: CreatePartnerResult;
  let reused = false;
  const existing = await findExistingDbasenet();
  if (existing) {
    created = existing;
    reused = true;
  } else {
    created = await createPartner(platformActor, {
      slug: DBASENET_GIFT_SLUG,
      displayName: DBASENET_GIFT_DISPLAY_NAME,
      ownerEmail: DBASENET_GIFT_OWNER_EMAIL,
      origin: "gift",
      reason: DBASENET_GIFT_REASON,
      ...(recordPrimaryDomain ? { primaryDomain: DBASENET_GIFT_PRIMARY_DOMAIN } : {}),
    });
  }

  const portal = await openPartnerPortalForVerifiedEmail(DBASENET_GIFT_OWNER_EMAIL);
  if (!portal.ok) {
    throw new Error(`portal_login_failed:${portal.error ?? "unknown"}`);
  }

  const checkout = await createPartnerCheckoutSession({
    email: DBASENET_GIFT_OWNER_EMAIL,
    origin: "https://suhuella.com",
    testUnlock: true,
  });
  if (checkout.ok || checkout.error !== "already_covered") {
    throw new Error(`expected_already_covered got ${checkout.ok ? "checkout_url" : checkout.error}`);
  }

  let customerLicenseId: string | null = null;
  if (input.seedSampleCustomerLicense) {
    customerLicenseId = "lic_dbasenet_customer_smoke";
    await upsertStoredGrant({
      email: "customer-smoke@dbasenet.test",
      customerId: "cus_dbasenet_smoke",
      licenseId: customerLicenseId,
      edition: "personal_lifetime",
      origin: "gift",
      status: "active",
      issuedByOperator: created.summary.partner.partnerId,
      acceptedBrands: ["suhuella", "dbasenet"],
      isPaid: false,
    });
    const listed = await listPartnerCustomerLicenses(
      { kind: "partner_admin", email: DBASENET_GIFT_OWNER_EMAIL, partnerId: created.summary.partner.partnerId },
      { partnerId: created.summary.partner.partnerId },
    );
    if (!listed.licenses.some((item) => item.licenseId === customerLicenseId)) {
      throw new Error("customer_license_not_visible_in_portal");
    }
    const row = (await listDurableGrants()).find((g) => g.licenseId === customerLicenseId);
    if (!row || !grantAllowsPresentationBrand(row, "dbasenet")) {
      throw new Error("customer_license_does_not_activate_dbasenet");
    }
  }

  return {
    ok: true,
    reused,
    partnerId: created.summary.partner.partnerId,
    brandId: created.summary.brand.brandId,
    entitlementOrigin: created.summary.entitlement?.origin ?? "gift",
    portalRole: portal.role,
    onboardingPath: "/partners/portal",
    sqlitePath: "",
    customerLicenseId,
  };
}

/** Writes into wrangler local D1 so `npm run dev:cf` can sign in at /partners/portal. */
export async function provisionDbasenetPartnerGiftLocalDev(siteRoot: string): Promise<
  DbasenetGiftProvisionResult & { sqlitePath: string }
> {
  const { sqlitePath } = bindLocalWranglerDevPersistence(siteRoot);
  const result = await provisionDbasenetPartnerGift({
    recordPrimaryDomain: false,
    seedSampleCustomerLicense: false,
  });
  return { ...result, sqlitePath };
}
