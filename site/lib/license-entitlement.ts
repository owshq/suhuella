import {
  capabilitiesForEdition,
  deviceLimitForEdition,
  parseLicenseEdition,
  parseLicenseOrigin,
  type GenerationAccessMode,
  type LicenseEdition,
  type LicenseGrant,
  type LicenseOrigin,
  type LicenseStatus,
} from "./license-context.ts";

export const GIFTED_ORIGINS = [
  "gift",
  "promo",
  "manual",
  "internal",
  "test",
  "partner",
  "education",
] as const;

export const PAID_ORIGINS = ["stripe", "business", "enterprise", "migration"] as const;

export const ADMIN_REVOCABLE_ORIGINS = [
  "gift",
  "promo",
  "manual",
  "internal",
  "test",
] as const;

export const LICENSE_ENTITLEMENT_STATUSES = [
  "free_local",
  "active",
  "past_due",
  "grace_period",
  "canceled_at_period_end",
  "expired",
  "refunded",
  "chargeback",
  "suspended_seat",
  "revoked_gift",
  "invalid",
] as const;

export type GiftedOrigin = (typeof GIFTED_ORIGINS)[number];
export type PaidOrigin = (typeof PAID_ORIGINS)[number];
export type AdminRevocableOrigin = (typeof ADMIN_REVOCABLE_ORIGINS)[number];
export type LicenseEntitlementStatus = (typeof LICENSE_ENTITLEMENT_STATUSES)[number];

export type ClassifiedLicense = {
  licenseId: string;
  customerId: string;
  email: string;
  edition: LicenseEdition;
  origin: LicenseOrigin;
  status: LicenseStatus;
  entitlementStatus: LicenseEntitlementStatus;
  isPaid: boolean;
  isGifted: boolean;
  isRevocableByAdmin: boolean;
  validUntil: string | null;
  currentPeriodEnd: string | null;
  paymentProvider: string | null;
  paymentReference: string | null;
  subscriptionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  deviceLimit: number;
  capabilities: string[];
};

const PAID_REVOKE_ERROR = "Paid licenses cannot be manually revoked.";
const NOT_REVOCABLE_ERROR = "This license is not admin-revocable.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseGenerationAccessMode(value: unknown): GenerationAccessMode | undefined {
  if (
    value === "legacy_unassigned" ||
    value === "purchased_generation" ||
    value === "active_subscription"
  ) {
    return value;
  }
  return undefined;
}

export function isGiftedOrigin(origin: LicenseOrigin): origin is GiftedOrigin {
  return (GIFTED_ORIGINS as readonly string[]).includes(origin);
}

export function isPaidOrigin(origin: LicenseOrigin): origin is PaidOrigin {
  return (PAID_ORIGINS as readonly string[]).includes(origin);
}

export function isAdminRevocableOrigin(
  origin: LicenseOrigin,
): origin is AdminRevocableOrigin {
  return (ADMIN_REVOCABLE_ORIGINS as readonly string[]).includes(origin);
}

export function inferIsPaid(origin: LicenseOrigin, explicit?: boolean): boolean {
  if (typeof explicit === "boolean") return explicit;
  return isPaidOrigin(origin);
}

export function inferIsGifted(origin: LicenseOrigin, isPaid: boolean): boolean {
  return isGiftedOrigin(origin) && !isPaid;
}

export function inferIsRevocableByAdmin(
  origin: LicenseOrigin,
  isPaid: boolean,
): boolean {
  return isAdminRevocableOrigin(origin) && isPaid === false;
}

export function validUntilForEdition(
  edition: LicenseEdition,
  validUntil?: string | null,
  currentPeriodEnd?: string | null,
): string | null {
  if (edition === "free" || edition === "personal_lifetime") return null;
  return currentPeriodEnd ?? validUntil ?? null;
}

export function desktopStatusForGrant(grant: Pick<LicenseGrant, "status" | "edition">): LicenseStatus {
  if (grant.status === "expired" || grant.status === "revoked") return grant.status;
  return "active";
}

export function entitlementStatusForGrant(grant: LicenseGrant): LicenseEntitlementStatus {
  if (grant.entitlementStatus) return grant.entitlementStatus;
  if (grant.edition === "free") return "free_local";
  if (grant.status === "expired") {
    if (grant.isPaid) return "expired";
    return "expired";
  }
  if (grant.status === "revoked") {
    if (grant.seatId) return "suspended_seat";
    if (inferIsGifted(grant.origin, inferIsPaid(grant.origin, grant.isPaid))) {
      return "revoked_gift";
    }
    return "invalid";
  }
  return "active";
}

export function classifyLicenseGrant(grant: LicenseGrant): ClassifiedLicense {
  const isPaid = inferIsPaid(grant.origin, grant.isPaid);
  const isGifted = inferIsGifted(grant.origin, isPaid);
  const isRevocableByAdmin = inferIsRevocableByAdmin(grant.origin, isPaid);
  const validUntil = validUntilForEdition(
    grant.edition,
    grant.validUntil,
    grant.currentPeriodEnd,
  );

  return {
    licenseId: grant.licenseId,
    customerId: grant.customerId,
    email: grant.email,
    edition: grant.edition,
    origin: grant.origin,
    status: desktopStatusForGrant(grant),
    entitlementStatus: entitlementStatusForGrant({ ...grant, isPaid, isGifted }),
    isPaid,
    isGifted,
    isRevocableByAdmin,
    validUntil,
    currentPeriodEnd: grant.currentPeriodEnd ?? validUntil,
    paymentProvider: grant.paymentProvider ?? (grant.origin === "stripe" ? "stripe" : null),
    paymentReference: grant.paymentReference ?? grant.checkoutSessionId ?? grant.invoiceId ?? null,
    subscriptionId: grant.subscriptionId ?? null,
    createdAt: grant.createdAt ?? null,
    updatedAt: grant.updatedAt ?? null,
    createdBy: grant.createdBy ?? null,
    revokedAt: grant.revokedAt ?? null,
    revokedBy: grant.revokedBy ?? null,
    revocationReason: grant.revocationReason ?? null,
    deviceLimit: deviceLimitForEdition(grant.edition, grant.deviceLimit),
    capabilities: capabilitiesForEdition(grant.edition),
  };
}

export function normalizeLicenseGrant(grant: LicenseGrant, now = new Date().toISOString()): LicenseGrant {
  const classified = classifyLicenseGrant(grant);
  return {
    ...grant,
    isPaid: classified.isPaid,
    isGifted: classified.isGifted,
    isRevocableByAdmin: classified.isRevocableByAdmin,
    validUntil: classified.validUntil,
    currentPeriodEnd: classified.currentPeriodEnd,
    entitlementStatus: classified.entitlementStatus,
    paymentProvider: classified.paymentProvider ?? undefined,
    updatedAt: grant.updatedAt ?? now,
    createdAt: grant.createdAt ?? now,
  };
}

export function parseLicenseGrant(value: unknown): LicenseGrant | null {
  if (!isRecord(value)) return null;
  const edition = parseLicenseEdition(value.edition);
  const origin = parseLicenseOrigin(value.origin) ?? "manual";
  if (!edition || typeof value.email !== "string" || typeof value.licenseId !== "string") {
    return null;
  }
  if (typeof value.customerId !== "string") return null;

  const grant: LicenseGrant = {
    email: value.email.trim().toLowerCase(),
    customerId: value.customerId,
    licenseId: value.licenseId,
    edition,
    origin,
    status: value.status === "revoked" || value.status === "expired" ? value.status : "active",
    deviceLimit: typeof value.deviceLimit === "number" ? value.deviceLimit : undefined,
    validUntil: typeof value.validUntil === "string" ? value.validUntil : null,
    currentPeriodEnd: typeof value.currentPeriodEnd === "string" ? value.currentPeriodEnd : undefined,
    organisationId: typeof value.organisationId === "string" ? value.organisationId : undefined,
    organisationName:
      typeof value.organisationName === "string" ? value.organisationName : undefined,
    seatId: typeof value.seatId === "string" ? value.seatId : undefined,
    memberRole:
      value.memberRole === "owner" || value.memberRole === "admin" || value.memberRole === "member"
        ? value.memberRole
        : undefined,
    channel: value.channel === "beta" ? "beta" : "stable",
    isPaid: typeof value.isPaid === "boolean" ? value.isPaid : undefined,
    isGifted: typeof value.isGifted === "boolean" ? value.isGifted : undefined,
    isRevocableByAdmin:
      typeof value.isRevocableByAdmin === "boolean" ? value.isRevocableByAdmin : undefined,
    paymentProvider: typeof value.paymentProvider === "string" ? value.paymentProvider : undefined,
    paymentReference: typeof value.paymentReference === "string" ? value.paymentReference : undefined,
    subscriptionId: typeof value.subscriptionId === "string" ? value.subscriptionId : undefined,
    checkoutSessionId: typeof value.checkoutSessionId === "string" ? value.checkoutSessionId : undefined,
    invoiceId: typeof value.invoiceId === "string" ? value.invoiceId : undefined,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
    createdBy: typeof value.createdBy === "string" ? value.createdBy : undefined,
    revokedAt: typeof value.revokedAt === "string" ? value.revokedAt : undefined,
    revokedBy: typeof value.revokedBy === "string" ? value.revokedBy : undefined,
    revocationReason: typeof value.revocationReason === "string" ? value.revocationReason : undefined,
    issuedByOperator: typeof value.issuedByOperator === "string" ? value.issuedByOperator : undefined,
    acceptedBrands: Array.isArray(value.acceptedBrands)
      ? value.acceptedBrands.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined,
    presentationBrandAtPurchase:
      typeof value.presentationBrandAtPurchase === "string" ? value.presentationBrandAtPurchase : undefined,
    entitlementStatus:
      typeof value.entitlementStatus === "string" &&
      (LICENSE_ENTITLEMENT_STATUSES as readonly string[]).includes(value.entitlementStatus)
        ? (value.entitlementStatus as LicenseEntitlementStatus)
        : undefined,
    commercialGenerationId:
      value.commercialGenerationId === null
        ? null
        : typeof value.commercialGenerationId === "string"
          ? value.commercialGenerationId
          : undefined,
    generationAccessMode: parseGenerationAccessMode(value.generationAccessMode),
  };
  return normalizeLicenseGrant(grant);
}

export function assertAdminCanRevokeLicense(grant: LicenseGrant): void {
  const classified = classifyLicenseGrant(grant);
  if (classified.isPaid) {
    throw new Error(PAID_REVOKE_ERROR);
  }
  if (!classified.isRevocableByAdmin) {
    throw new Error(NOT_REVOCABLE_ERROR);
  }
}

export function assertAdminCanMutateGift(grant: LicenseGrant, action: string): void {
  const classified = classifyLicenseGrant(grant);
  if (classified.isPaid) {
    throw new Error(PAID_REVOKE_ERROR);
  }
  if (!classified.isRevocableByAdmin) {
    throw new Error(`This license cannot be ${action} by admin.`);
  }
}

export function assertAdminCanRevokeOrganisation(isPaid: boolean): void {
  if (isPaid) {
    throw new Error(PAID_REVOKE_ERROR);
  }
}

export function paidRevokeError(): string {
  return PAID_REVOKE_ERROR;
}

export function notRevocableError(): string {
  return NOT_REVOCABLE_ERROR;
}
