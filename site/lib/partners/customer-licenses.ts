import type { LicenseGrant } from "../license-context.ts";
import { listDurableGrants } from "../license-store.ts";
import { assertPartnerScope } from "./authz.ts";
import { getPartnerStore } from "./store.ts";
import type { PartnerActor } from "./types.ts";

export type PartnerCustomerLicenseRow = {
  licenseId: string;
  holderEmail: string;
  edition: string;
  origin: string;
  status: string;
  validUntil: string | null;
  paymentReference: string | null;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * End-customer licenses issued for this partner.
 * Platform Partner entitlement is not a row here.
 * Partner Stripe keys are never included.
 */
export async function listPartnerCustomerLicenses(
  actor: PartnerActor,
  input: { partnerId: string; cursor?: string | null; limit?: number },
): Promise<{ licenses: PartnerCustomerLicenseRow[]; nextCursor: string | null }> {
  assertPartnerScope(actor, input.partnerId);
  const store = await getPartnerStore();
  const doc = await store.read();
  const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
  if (!partner) return { licenses: [], nextCursor: null };

  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = input.cursor?.trim() || "";
  const grants = (await listDurableGrants())
    .filter((grant) => grant.issuedByOperator === input.partnerId)
    .sort((a, b) => a.licenseId.localeCompare(b.licenseId));
  const start = cursor ? grants.findIndex((grant) => grant.licenseId === cursor) + 1 : 0;
  const page = grants.slice(Math.max(start, 0), Math.max(start, 0) + limit + 1);
  const hasMore = page.length > limit;
  const visible = hasMore ? page.slice(0, limit) : page;
  return {
    licenses: visible.map(toRow),
    nextCursor: hasMore ? visible[visible.length - 1]?.licenseId ?? null : null,
  };
}

function toRow(grant: LicenseGrant): PartnerCustomerLicenseRow {
  return {
    licenseId: grant.licenseId,
    holderEmail: grant.email,
    edition: grant.edition,
    origin: grant.origin,
    status: grant.status,
    validUntil: grant.validUntil ?? grant.currentPeriodEnd ?? null,
    paymentReference: grant.origin === "stripe" ? grant.paymentReference ?? null : grant.paymentReference ?? null,
  };
}
