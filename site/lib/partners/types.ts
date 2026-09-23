export const PARTNER_STATUSES = ["pending", "active", "suspended", "revoked"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_MEMBER_ROLES = ["partner_admin", "partner_member"] as const;
export type PartnerMemberRole = (typeof PARTNER_MEMBER_ROLES)[number];

export const PARTNER_MEMBER_STATUSES = ["invited", "active", "suspended", "revoked"] as const;
export type PartnerMemberStatus = (typeof PARTNER_MEMBER_STATUSES)[number];

/** Ops may create these. stripe is reconciliation-only. */
export const PARTNER_ADMIN_CREATE_ORIGINS = ["gift", "manual", "internal", "test"] as const;
export type PartnerAdminCreateOrigin = (typeof PARTNER_ADMIN_CREATE_ORIGINS)[number];

export const PARTNER_ENTITLEMENT_ORIGINS = [
  ...PARTNER_ADMIN_CREATE_ORIGINS,
  "stripe",
] as const;
export type PartnerEntitlementOrigin = (typeof PARTNER_ENTITLEMENT_ORIGINS)[number];

export const PARTNER_DOMAIN_KINDS = ["primary", "ops", "alias"] as const;
export type PartnerDomainKind = (typeof PARTNER_DOMAIN_KINDS)[number];

export const PARTNER_DOMAIN_STATUSES = [
  "pending",
  "active",
  "failed",
  "suspended",
  "revoked",
] as const;
export type PartnerDomainStatus = (typeof PARTNER_DOMAIN_STATUSES)[number];

export type PartnerRecord = {
  partnerId: string;
  slug: string;
  displayName: string;
  status: PartnerStatus;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  notes: string | null;
};

export type PartnerMemberRecord = {
  memberId: string;
  partnerId: string;
  email: string;
  role: PartnerMemberRole;
  status: PartnerMemberStatus;
  invitedAt: string;
  acceptedAt: string | null;
};

export type PartnerBrandRecord = {
  brandId: string;
  partnerId: string;
  displayName: string;
  accent: string | null;
  onAccent: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  canonicalDomain: string | null;
  updatedAt: string;
};

export type PartnerDomainRecord = {
  domainId: string;
  partnerId: string;
  brandId: string;
  hostname: string;
  normalizedHostname: string;
  kind: PartnerDomainKind;
  status: PartnerDomainStatus;
  cloudflareCustomHostnameId: string | null;
  dnsTarget: string | null;
  validationErrors: string | null;
  verificationTokenHash: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartnerEntitlementRecord = {
  entitlementId: string;
  partnerId: string;
  status: PartnerStatus;
  origin: PartnerEntitlementOrigin;
  validUntil: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type PartnerOnboardingInviteRecord = {
  inviteId: string;
  partnerId: string;
  email: string;
  role: PartnerMemberRole;
  tokenHash: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type PartnerDocument = {
  version: 1;
  partners: PartnerRecord[];
  members: PartnerMemberRecord[];
  brands: PartnerBrandRecord[];
  domains: PartnerDomainRecord[];
  entitlements: PartnerEntitlementRecord[];
  invites: PartnerOnboardingInviteRecord[];
};

export type PlatformPartnerActor = {
  kind: "platform";
  email: string;
};

export type TenantPartnerActor = {
  kind: "partner";
  email: string;
  partnerId: string;
  role: PartnerMemberRole;
};

export type PartnerActor = PlatformPartnerActor | TenantPartnerActor;

export type PartnerDnsInstructions = {
  hostname: string;
  txtName: string;
  txtValueHint: string;
  cnameTarget: string;
  notes: string[];
};

export type PartnerSummary = {
  partner: PartnerRecord;
  brand: PartnerBrandRecord;
  entitlement: PartnerEntitlementRecord | null;
  domains: PartnerDomainRecord[];
  members: PartnerMemberRecord[];
};

export function emptyPartnerDocument(): PartnerDocument {
  return {
    version: 1,
    partners: [],
    members: [],
    brands: [],
    domains: [],
    entitlements: [],
    invites: [],
  };
}

export function isPartnerAdminCreateOrigin(
  value: string,
): value is PartnerAdminCreateOrigin {
  return (PARTNER_ADMIN_CREATE_ORIGINS as readonly string[]).includes(value);
}

export function isPartnerEntitlementOrigin(
  value: string,
): value is PartnerEntitlementOrigin {
  return (PARTNER_ENTITLEMENT_ORIGINS as readonly string[]).includes(value);
}
