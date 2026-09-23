import { assertPartnerScope, assertPlatformActor, PartnerAuthzError, rejectClientBrandId } from "./authz.ts";
import {
  dnsInstructionsFor,
  isPlatformPublicHostname,
  isReservedPlatformHostname,
  normalizeHostname,
  opsHostnameForPrimary,
} from "./domains.ts";
import { PartnerError } from "./errors.ts";
import {
  createOnboardingToken,
  createPartnerBrandId,
  createPartnerDomainId,
  createPartnerEntitlementId,
  createPartnerId,
  createPartnerInviteId,
  createPartnerMemberId,
  hashToken,
  nowIso,
} from "./ids.ts";
import { getPartnerStore, PartnerStoreUnavailableError } from "./store.ts";
import {
  isPartnerAdminCreateOrigin,
  type PartnerActor,
  type PartnerAdminCreateOrigin,
  type PartnerBrandRecord,
  type PartnerDnsInstructions,
  type PartnerDocument,
  type PartnerDomainKind,
  type PartnerDomainRecord,
  type PartnerEntitlementOrigin,
  type PartnerEntitlementRecord,
  type PartnerMemberRecord,
  type PartnerMemberRole,
  type PartnerRecord,
  type PartnerSummary,
} from "./types.ts";

export { PartnerError } from "./errors.ts";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ONBOARDING_PATH = "/partners/onboarding";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function requireEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) throw new PartnerError("A valid email is required.");
  return normalized;
}

function requireSlug(raw: string): string {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (!slug || slug.length < 2) throw new PartnerError("Partner slug is required.");
  if (slug === "suhuella") throw new PartnerError("slug suhuella is reserved.");
  return slug;
}

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 8) throw new PartnerError("Reason must be at least 8 characters.");
  return trimmed;
}

async function mutate(
  fn: (doc: PartnerDocument) => Promise<void> | void,
): Promise<PartnerDocument> {
  const store = await getPartnerStore();
  try {
    const doc = await store.read();
    await fn(doc);
    await store.write(doc);
    return doc;
  } catch (error) {
    if (error instanceof PartnerStoreUnavailableError) {
      throw new PartnerError("Partner service temporarily unavailable.", 503);
    }
    throw error;
  }
}

function summaryFrom(doc: PartnerDocument, partnerId: string): PartnerSummary {
  const partner = doc.partners.find((item) => item.partnerId === partnerId);
  if (!partner) throw new PartnerError("Partner not found.", 404);
  const brand = doc.brands.find((item) => item.partnerId === partnerId);
  if (!brand) throw new PartnerError("Partner brand missing.", 500);
  const entitlement =
    doc.entitlements
      .filter((item) => item.partnerId === partnerId)
      .sort((a, b) => {
        const rank = (status: string) =>
          status === "active" ? 0 : status === "pending" ? 1 : status === "suspended" ? 2 : 3;
        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;
        return b.createdAt.localeCompare(a.createdAt);
      })[0] ?? null;
  return {
    partner,
    brand,
    entitlement,
    domains: doc.domains.filter((item) => item.partnerId === partnerId),
    members: doc.members.filter((item) => item.partnerId === partnerId),
  };
}

export type CreatePartnerInput = {
  slug: string;
  displayName: string;
  ownerEmail: string;
  origin: PartnerAdminCreateOrigin;
  reason: string;
  validUntil?: string | null;
  notes?: string | null;
  /** Optional primary public hostname to register as pending. */
  primaryDomain?: string | null;
};

export type CreatePartnerResult = {
  summary: PartnerSummary;
  onboarding: {
    inviteId: string;
    email: string;
    /** One-time absolute path + token. Never persist this after return. */
    path: string;
    token: string;
    expiresAt: string;
  };
};

export async function createPartner(
  actor: PartnerActor,
  input: CreatePartnerInput,
): Promise<CreatePartnerResult> {
  assertPlatformActor(actor);
  rejectClientBrandId((input as { brandId?: unknown }).brandId);

  if (!isPartnerAdminCreateOrigin(input.origin)) {
    throw new PartnerError(
      "Operations can only create partner entitlements as gift, manual, internal, or test. stripe is reconciliation-only.",
    );
  }

  const slug = requireSlug(input.slug);
  const ownerEmail = requireEmail(input.ownerEmail);
  const reason = requireReason(input.reason);
  const displayName = input.displayName.trim();
  if (!displayName) throw new PartnerError("displayName is required.");

  const now = nowIso();
  const partnerId = createPartnerId();
  const brandId = createPartnerBrandId(slug);
  const entitlementId = createPartnerEntitlementId();
  const memberId = createPartnerMemberId();
  const inviteId = createPartnerInviteId();
  const token = createOnboardingToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  let primaryDomainToken: string | null = null;
  let primaryHostname: string | null = null;
  if (input.primaryDomain) {
    primaryHostname = normalizeHostname(input.primaryDomain);
    if (!primaryHostname) throw new PartnerError("primaryDomain is not a valid hostname.");
    primaryDomainToken = createOnboardingToken();
  }

  await mutate(async (doc) => {
    if (doc.partners.some((item) => item.slug === slug)) {
      throw new PartnerError("Partner slug already exists.");
    }
    if (doc.brands.some((item) => item.brandId === brandId)) {
      throw new PartnerError("brand_id already exists.");
    }
    if (primaryHostname && doc.domains.some((item) => item.hostname === primaryHostname)) {
      throw new PartnerError("Domain is already associated with a partner.");
    }

    const partner: PartnerRecord = {
      partnerId,
      slug,
      displayName,
      status: "pending",
      ownerEmail,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.email,
      notes: input.notes?.trim() || reason,
    };
    const brand: PartnerBrandRecord = {
      brandId,
      partnerId,
      displayName,
      accent: null,
      onAccent: null,
      logoUrl: null,
      faviconUrl: null,
      canonicalDomain: primaryHostname,
      updatedAt: now,
    };
    const entitlement: PartnerEntitlementRecord = {
      entitlementId,
      partnerId,
      status: "pending",
      origin: input.origin,
      validUntil: input.validUntil ?? null,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.email,
      revokedAt: null,
      revokeReason: null,
    };
    const owner: PartnerMemberRecord = {
      memberId,
      partnerId,
      email: ownerEmail,
      role: "partner_admin",
      status: "invited",
      invitedAt: now,
      acceptedAt: null,
    };

    doc.partners.push(partner);
    doc.brands.push(brand);
    doc.entitlements.push(entitlement);
    doc.members.push(owner);
    doc.invites.push({
      inviteId,
      partnerId,
      email: ownerEmail,
      role: "partner_admin",
      tokenHash,
      expiresAt,
      consumedAt: null,
      createdAt: now,
      createdBy: actor.email,
    });

    if (primaryHostname && primaryDomainToken) {
      if (isReservedPlatformHostname(primaryHostname)) {
        throw new PartnerError("That hostname is reserved by the platform.");
      }
      doc.domains.push({
        domainId: createPartnerDomainId(),
        partnerId,
        brandId,
        hostname: primaryHostname,
        normalizedHostname: primaryHostname,
        kind: "primary",
        status: "pending",
        cloudflareCustomHostnameId: null,
        dnsTarget: null,
        validationErrors: null,
        verificationTokenHash: await hashToken(primaryDomainToken),
        verifiedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  const store = await getPartnerStore();
  const summary = summaryFrom(await store.read(), partnerId);
  return {
    summary,
    onboarding: {
      inviteId,
      email: ownerEmail,
      path: `${ONBOARDING_PATH}/${token}`,
      token,
      expiresAt,
    },
  };
}

/** Stripe annual Partner license reconciliation only — never call from Ops forms. */
export async function recordStripePartnerEntitlement(
  actor: PartnerActor,
  input: {
    partnerId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    validUntil: string | null;
  },
): Promise<PartnerSummary> {
  assertPlatformActor(actor);
  if (!input.stripeSubscriptionId.trim() || !input.stripeCustomerId.trim()) {
    throw new PartnerError("Stripe subscription and customer ids are required.");
  }
  const now = nowIso();
  const subscriptionId = input.stripeSubscriptionId.trim();
  const customerId = input.stripeCustomerId.trim();
  await mutate((doc) => {
    const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
    if (!partner) throw new PartnerError("Partner not found.", 404);
    if (partner.status === "revoked") throw new PartnerError("Partner is revoked.", 409);
    const sameSubscription = doc.entitlements.find(
      (item) => item.origin === "stripe" && item.stripeSubscriptionId === subscriptionId,
    );
    if (sameSubscription) {
      if (sameSubscription.partnerId !== input.partnerId) {
        throw new PartnerError("Stripe subscription is already linked to another partner.", 409);
      }
      sameSubscription.status = "active";
      sameSubscription.validUntil = input.validUntil;
      sameSubscription.stripeCustomerId = customerId;
      sameSubscription.updatedAt = now;
      partner.status = "active";
      partner.updatedAt = now;
      return;
    }
    const otherActiveStripe = doc.entitlements.find(
      (item) =>
        item.partnerId === input.partnerId &&
        item.origin === "stripe" &&
        item.status === "active" &&
        item.stripeSubscriptionId !== subscriptionId,
    );
    if (otherActiveStripe) {
      throw new PartnerError("Partner already has an active Stripe entitlement.", 409);
    }
    doc.entitlements.push({
      entitlementId: createPartnerEntitlementId(),
      partnerId: input.partnerId,
      status: "active",
      origin: "stripe",
      validUntil: input.validUntil,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      createdAt: now,
      updatedAt: now,
      createdBy: "stripe_reconciliation",
      revokedAt: null,
      revokeReason: null,
    });
    partner.status = "active";
    partner.updatedAt = now;
  });
  const store = await getPartnerStore();
  return summaryFrom(await store.read(), input.partnerId);
}

export async function createOnboardingInvite(
  actor: PartnerActor,
  input: {
    partnerId: string;
    email: string;
    role?: PartnerMemberRole;
    reason: string;
  },
): Promise<{ inviteId: string; path: string; token: string; expiresAt: string; email: string }> {
  assertPlatformActor(actor);
  requireReason(input.reason);
  const email = requireEmail(input.email);
  const role = input.role ?? "partner_admin";
  const token = createOnboardingToken();
  const tokenHash = await hashToken(token);
  const inviteId = createPartnerInviteId();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const now = nowIso();

  await mutate((doc) => {
    const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
    if (!partner) throw new PartnerError("Partner not found.", 404);
    if (partner.status === "revoked") throw new PartnerError("Partner is revoked.", 409);
    doc.invites.push({
      inviteId,
      partnerId: input.partnerId,
      email,
      role,
      tokenHash,
      expiresAt,
      consumedAt: null,
      createdAt: now,
      createdBy: actor.email,
    });
  });

  return {
    inviteId,
    email,
    path: `${ONBOARDING_PATH}/${token}`,
    token,
    expiresAt,
  };
}

export async function acceptOnboardingInvite(input: {
  token: string;
  verifiedEmail: string;
}): Promise<PartnerSummary> {
  const email = requireEmail(input.verifiedEmail);
  const tokenHash = await hashToken(input.token.trim());
  const now = nowIso();

  let partnerId = "";
  await mutate((doc) => {
    const invite = doc.invites.find((item) => item.tokenHash === tokenHash);
    if (!invite) throw new PartnerError("Invite not found or already used.", 404);
    if (invite.consumedAt) throw new PartnerError("Invite already consumed.", 409);
    if (Date.parse(invite.expiresAt) < Date.now()) {
      throw new PartnerError("Invite expired.", 410);
    }
    if (invite.email !== email) {
      throw new PartnerError("Verified email does not match the invite.", 403);
    }
    // Role is always taken from the invite row — never from the browser.
    const assignedRole = invite.role;
    const partner = doc.partners.find((item) => item.partnerId === invite.partnerId);
    if (!partner || partner.status === "revoked") {
      throw new PartnerError("Partner is not available.", 409);
    }
    if (partner.status === "suspended") {
      throw new PartnerError("Partner is suspended.", 409);
    }

    invite.consumedAt = now;
    partnerId = partner.partnerId;

    let member = doc.members.find(
      (item) => item.partnerId === partner.partnerId && item.email === email,
    );
    if (!member) {
      member = {
        memberId: createPartnerMemberId(),
        partnerId: partner.partnerId,
        email,
        role: assignedRole,
        status: "active",
        invitedAt: invite.createdAt,
        acceptedAt: now,
      };
      doc.members.push(member);
    } else {
      member.status = "active";
      member.role = assignedRole;
      member.acceptedAt = now;
    }

    if (partner.status === "pending") {
      partner.status = "active";
      partner.updatedAt = now;
    }
    const entitlement = doc.entitlements
      .filter((item) => item.partnerId === partner.partnerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (entitlement && entitlement.status === "pending") {
      entitlement.status = "active";
      entitlement.updatedAt = now;
    }
  });

  const store = await getPartnerStore();
  return summaryFrom(await store.read(), partnerId);
}

export type OnboardingInvitePreview = {
  inviteId: string;
  email: string;
  role: PartnerMemberRole;
  partnerDisplayName: string;
  expiresAt: string;
  status: "open" | "consumed" | "expired" | "revoked";
};

/** Safe preview for the public onboarding page. Never returns the raw token. */
export async function peekOnboardingInvite(token: string): Promise<OnboardingInvitePreview> {
  const tokenHash = await hashToken(token.trim());
  const store = await getPartnerStore();
  const doc = await store.read();
  const invite = doc.invites.find((item) => item.tokenHash === tokenHash);
  if (!invite) throw new PartnerError("Invite not found.", 404);
  const partner = doc.partners.find((item) => item.partnerId === invite.partnerId);
  if (!partner || partner.status === "revoked") {
    return {
      inviteId: invite.inviteId,
      email: invite.email,
      role: invite.role,
      partnerDisplayName: partner?.displayName ?? "Partner",
      expiresAt: invite.expiresAt,
      status: "revoked",
    };
  }
  if (invite.consumedAt) {
    return {
      inviteId: invite.inviteId,
      email: invite.email,
      role: invite.role,
      partnerDisplayName: partner.displayName,
      expiresAt: invite.expiresAt,
      status: "consumed",
    };
  }
  if (Date.parse(invite.expiresAt) < Date.now()) {
    return {
      inviteId: invite.inviteId,
      email: invite.email,
      role: invite.role,
      partnerDisplayName: partner.displayName,
      expiresAt: invite.expiresAt,
      status: "expired",
    };
  }
  return {
    inviteId: invite.inviteId,
    email: invite.email,
    role: invite.role,
    partnerDisplayName: partner.displayName,
    expiresAt: invite.expiresAt,
    status: "open",
  };
}

export async function hasOpenPartnerInviteForEmail(email: string): Promise<boolean> {
  const normalized = requireEmail(email);
  const store = await getPartnerStore();
  const doc = await store.read();
  const now = Date.now();
  return doc.invites.some(
    (invite) =>
      invite.email === normalized &&
      !invite.consumedAt &&
      Date.parse(invite.expiresAt) > now &&
      doc.partners.some(
        (partner) =>
          partner.partnerId === invite.partnerId &&
          partner.status !== "revoked" &&
          partner.status !== "suspended",
      ),
  );
}

export async function resolvePartnerActorFromEmail(
  email: string,
  platformEmails: readonly string[],
): Promise<PartnerActor | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (platformEmails.map((item) => item.toLowerCase()).includes(normalized)) {
    return { kind: "platform", email: normalized };
  }
  const store = await getPartnerStore();
  const doc = await store.read();
  const member = doc.members.find(
    (item) => item.email === normalized && item.status === "active",
  );
  if (!member) return null;
  const partner = doc.partners.find((item) => item.partnerId === member.partnerId);
  if (!partner || partner.status === "revoked") return null;
  return {
    kind: "partner",
    email: normalized,
    partnerId: member.partnerId,
    role: member.role,
  };
}

export async function registerPartnerDomain(
  actor: PartnerActor,
  input: {
    partnerId: string;
    hostname: string;
    kind?: PartnerDomainKind;
  },
): Promise<{ domain: PartnerDomainRecord; dns: PartnerDnsInstructions; verificationToken?: string }> {
  const { registerPartnerCustomDomain } = await import("./custom-domains.ts");
  const view = await registerPartnerCustomDomain(actor, input);
  return { domain: view.domain, dns: view.dns };
}

/** Test-only: insert an active domain row without Cloudflare. */
export async function seedPartnerDomainForTests(input: {
  partnerId: string;
  brandId: string;
  hostname: string;
  kind?: PartnerDomainKind;
  accent?: string | null;
  displayName?: string;
}): Promise<PartnerDomainRecord> {
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new PartnerError("Invalid hostname.");
  const now = nowIso();
  let domain: PartnerDomainRecord | null = null;

  await mutate(async (doc) => {
    const brand = doc.brands.find((item) => item.partnerId === input.partnerId);
    if (!brand) throw new PartnerError("Partner brand missing.", 500);
    if (input.displayName !== undefined) {
      brand.displayName = input.displayName;
      const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
      if (partner) {
        partner.displayName = input.displayName;
        partner.updatedAt = now;
      }
      brand.updatedAt = now;
    }
    if (input.accent !== undefined) {
      brand.accent = input.accent;
      brand.updatedAt = now;
    }
    const kind = input.kind ?? "primary";
    domain = {
      domainId: createPartnerDomainId(),
      partnerId: input.partnerId,
      brandId: input.brandId,
      hostname,
      normalizedHostname: hostname,
      kind,
      status: "active",
      cloudflareCustomHostnameId: null,
      dnsTarget: null,
      validationErrors: null,
      verificationTokenHash: null,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    doc.domains.push(domain);
    const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
    if (partner) {
      partner.status = "active";
      partner.updatedAt = now;
    }
    if (kind === "primary" && !brand.canonicalDomain) {
      brand.canonicalDomain = hostname;
      brand.updatedAt = now;
    }
  });

  if (!domain) throw new PartnerError("Failed to seed domain.", 500);
  return domain;
}

async function registerPartnerDomainLocal(
  actor: PartnerActor,
  input: {
    partnerId: string;
    hostname: string;
    kind?: PartnerDomainKind;
  },
): Promise<{ domain: PartnerDomainRecord; dns: PartnerDnsInstructions; verificationToken: string }> {
  assertPartnerScope(actor, input.partnerId, "partner_admin");
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new PartnerError("Invalid hostname.");
  if (isReservedPlatformHostname(hostname)) {
    throw new PartnerError("That hostname is reserved by the platform.");
  }
  const kind = input.kind ?? "primary";
  const verificationToken = createOnboardingToken();
  const verificationTokenHash = await hashToken(verificationToken);
  const now = nowIso();
  let domain: PartnerDomainRecord | null = null;

  await mutate(async (doc) => {
    const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
    if (!partner) throw new PartnerError("Partner not found.", 404);
    if (partner.status === "revoked" || partner.status === "suspended") {
      throw new PartnerError("Partner cannot register domains in this state.", 409);
    }
    if (
      doc.domains.some(
        (item) =>
          (item.normalizedHostname === hostname || item.hostname === hostname) &&
          item.status !== "revoked",
      )
    ) {
      throw new PartnerError("Domain is already associated with a partner.");
    }
    const brand = doc.brands.find((item) => item.partnerId === input.partnerId);
    if (!brand) throw new PartnerError("Partner brand missing.", 500);
    domain = {
      domainId: createPartnerDomainId(),
      partnerId: input.partnerId,
      brandId: brand.brandId,
      hostname,
      normalizedHostname: hostname,
      kind,
      status: "pending",
      cloudflareCustomHostnameId: null,
      dnsTarget: null,
      validationErrors: null,
      verificationTokenHash,
      verifiedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    doc.domains.push(domain);
    if (kind === "primary" && !brand.canonicalDomain) {
      brand.canonicalDomain = hostname;
      brand.updatedAt = now;
    }
  });

  if (!domain) throw new PartnerError("Failed to register domain.", 500);
  return {
    domain,
    dns: dnsInstructionsFor(hostname, "pending-cname-target"),
    verificationToken,
  };
}

export async function verifyPartnerDomain(
  actor: PartnerActor,
  input: {
    partnerId: string;
    hostname: string;
    /** Injected DNS TXT value for tests / operator tooling. */
    presentedToken: string;
  },
): Promise<PartnerDomainRecord> {
  assertPartnerScope(actor, input.partnerId, "partner_admin");
  const hostname = normalizeHostname(input.hostname);
  if (!hostname) throw new PartnerError("Invalid hostname.");
  const presentedHash = await hashToken(input.presentedToken.trim());
  const now = nowIso();
  let updated: PartnerDomainRecord | null = null;

  await mutate((doc) => {
    const domain = doc.domains.find(
      (item) =>
        item.partnerId === input.partnerId &&
        (item.normalizedHostname === hostname || item.hostname === hostname),
    );
    if (!domain) throw new PartnerError("Domain not found.", 404);
    if (!domain.verificationTokenHash) {
      throw new PartnerError("Domain has no verification token.", 409);
    }
    if (domain.verificationTokenHash !== presentedHash) {
      domain.status = "failed";
      domain.updatedAt = now;
      throw new PartnerError("DNS verification failed.", 400);
    }
    domain.status = "active";
    domain.verifiedAt = now;
    domain.updatedAt = now;
    domain.verificationTokenHash = null;
    updated = domain;
  });

  if (!updated) throw new PartnerError("Domain not found.", 404);
  return updated;
}

const ACCENT_HEX = /^#([0-9a-fA-F]{6})$/;

function sanitizePublicAssetUrl(value: string | null | undefined): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      throw new PartnerError("Logo URL must be https or a site-relative path.");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof PartnerError) throw error;
    throw new PartnerError("Logo URL is invalid.");
  }
}

function sanitizeAccentHex(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!ACCENT_HEX.test(trimmed)) {
    throw new PartnerError("Accent must be a #RRGGBB color.");
  }
  return trimmed.toUpperCase();
}

export async function updatePartnerBranding(
  actor: PartnerActor,
  input: {
    partnerId: string;
    displayName?: string;
    accent?: string | null;
    onAccent?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    canonicalDomain?: string | null;
  },
): Promise<PartnerBrandRecord> {
  if (actor.kind === "platform") {
    throw new PartnerError(
      "Partners configure branding in their own panel at /partners/portal.",
      403,
      "partner_self_service_only",
    );
  }
  assertPartnerScope(actor, input.partnerId, "partner_admin");
  rejectClientBrandId((input as { brandId?: unknown }).brandId);
  const now = nowIso();
  let brand: PartnerBrandRecord | null = null;

  await mutate((doc) => {
    brand = doc.brands.find((item) => item.partnerId === input.partnerId) ?? null;
    if (!brand) throw new PartnerError("Partner brand missing.", 404);
    if (input.displayName !== undefined) {
      const name = input.displayName.trim();
      if (!name) throw new PartnerError("displayName cannot be empty.");
      brand.displayName = name;
      const partner = doc.partners.find((item) => item.partnerId === input.partnerId);
      if (partner) {
        partner.displayName = name;
        partner.updatedAt = now;
      }
    }
    if (input.accent !== undefined) brand.accent = sanitizeAccentHex(input.accent);
    if (input.onAccent !== undefined) brand.onAccent = sanitizeAccentHex(input.onAccent);
    if (input.logoUrl !== undefined) brand.logoUrl = sanitizePublicAssetUrl(input.logoUrl);
    if (input.faviconUrl !== undefined) brand.faviconUrl = sanitizePublicAssetUrl(input.faviconUrl);
    if (input.canonicalDomain !== undefined) {
      if (input.canonicalDomain === null || input.canonicalDomain === "") {
        brand.canonicalDomain = null;
      } else {
        const host = normalizeHostname(input.canonicalDomain);
        if (!host) throw new PartnerError("canonicalDomain is invalid.");
        brand.canonicalDomain = host;
      }
    }
    brand.updatedAt = now;
  });

  if (!brand) throw new PartnerError("Partner brand missing.", 404);
  return brand;
}

export async function suspendPartner(
  actor: PartnerActor,
  partnerId: string,
  reason: string,
): Promise<PartnerSummary> {
  assertPlatformActor(actor);
  requireReason(reason);
  const now = nowIso();
  await mutate((doc) => {
    const partner = doc.partners.find((item) => item.partnerId === partnerId);
    if (!partner) throw new PartnerError("Partner not found.", 404);
    if (partner.status === "revoked") throw new PartnerError("Revoked partners cannot be suspended.", 409);
    partner.status = "suspended";
    partner.updatedAt = now;
    for (const entitlement of doc.entitlements.filter((item) => item.partnerId === partnerId)) {
      if (entitlement.status === "active" || entitlement.status === "pending") {
        entitlement.status = "suspended";
        entitlement.updatedAt = now;
      }
    }
    for (const domain of doc.domains.filter((item) => item.partnerId === partnerId)) {
      if (domain.status === "active" || domain.status === "pending") {
        domain.status = "suspended";
        domain.updatedAt = now;
      }
    }
  });
  const store = await getPartnerStore();
  return summaryFrom(await store.read(), partnerId);
}

/** Restore a suspended partner (not revoked). Domains return to pending until re-verified. */
export async function reactivatePartner(
  actor: PartnerActor,
  partnerId: string,
  reason: string,
): Promise<PartnerSummary> {
  assertPlatformActor(actor);
  requireReason(reason);
  const now = nowIso();
  await mutate((doc) => {
    const partner = doc.partners.find((item) => item.partnerId === partnerId);
    if (!partner) throw new PartnerError("Partner not found.", 404);
    if (partner.status === "revoked") {
      throw new PartnerError("Revoked partners cannot be reactivated.", 409);
    }
    if (partner.status !== "suspended") {
      throw new PartnerError("Only suspended partners can be reactivated.", 409);
    }
    partner.status = "active";
    partner.updatedAt = now;
    for (const entitlement of doc.entitlements.filter((item) => item.partnerId === partnerId)) {
      if (entitlement.status === "suspended") {
        entitlement.status = "active";
        entitlement.updatedAt = now;
      }
    }
    for (const domain of doc.domains.filter((item) => item.partnerId === partnerId)) {
      if (domain.status === "suspended") {
        domain.status = domain.verifiedAt ? "active" : "pending";
        domain.updatedAt = now;
      }
    }
  });
  const store = await getPartnerStore();
  return summaryFrom(await store.read(), partnerId);
}

export async function revokePartner(
  actor: PartnerActor,
  partnerId: string,
  reason: string,
): Promise<PartnerSummary> {
  assertPlatformActor(actor);
  const revokeReason = requireReason(reason);
  const now = nowIso();
  await mutate((doc) => {
    const partner = doc.partners.find((item) => item.partnerId === partnerId);
    if (!partner) throw new PartnerError("Partner not found.", 404);
    partner.status = "revoked";
    partner.updatedAt = now;
    for (const entitlement of doc.entitlements.filter((item) => item.partnerId === partnerId)) {
      entitlement.status = "revoked";
      entitlement.updatedAt = now;
      entitlement.revokedAt = now;
      entitlement.revokeReason = revokeReason;
    }
    for (const member of doc.members.filter((item) => item.partnerId === partnerId)) {
      member.status = "revoked";
    }
    for (const domain of doc.domains.filter((item) => item.partnerId === partnerId)) {
      domain.status = "revoked";
      domain.updatedAt = now;
      domain.verificationTokenHash = null;
    }
    for (const invite of doc.invites.filter((item) => item.partnerId === partnerId && !item.consumedAt)) {
      invite.consumedAt = now;
    }
  });
  const store = await getPartnerStore();
  return summaryFrom(await store.read(), partnerId);
}

export async function getPartnerSummary(
  actor: PartnerActor,
  partnerId: string,
): Promise<PartnerSummary> {
  assertPartnerScope(actor, partnerId);
  const store = await getPartnerStore();
  return summaryFrom(await store.read(), partnerId);
}

export async function listPartners(actor: PartnerActor): Promise<PartnerSummary[]> {
  assertPlatformActor(actor);
  const store = await getPartnerStore();
  const doc = await store.read();
  return doc.partners.map((partner) => summaryFrom(doc, partner.partnerId));
}

export async function resolveBrandIdForHostname(hostname: string): Promise<string | null> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;

  // Platform hosts resolve to the platform brand only — never a partner brand.
  if (normalized === "suhuella.com" || normalized === "www.suhuella.com" || normalized === "ops.suhuella.com") {
    return "suhuella";
  }

  const store = await getPartnerStore();
  const doc = await store.read();
  const active = doc.domains.find(
    (item) =>
      (item.normalizedHostname === normalized || item.hostname === normalized) &&
      item.status === "active" &&
      doc.partners.some(
        (partner) =>
          partner.partnerId === item.partnerId &&
          partner.status !== "revoked" &&
          partner.status !== "suspended",
      ),
  );
  if (active) return active.brandId;

  if (normalized.startsWith("ops.")) {
    const primary = normalized.slice(4);
    const primaryHit = doc.domains.find(
      (item) =>
        (item.normalizedHostname === primary || item.hostname === primary) &&
        item.status === "active" &&
        doc.partners.some(
          (partner) =>
            partner.partnerId === item.partnerId &&
            partner.status !== "revoked" &&
            partner.status !== "suspended",
        ),
    );
    if (primaryHit) return primaryHit.brandId;
  }
  return null;
}

export async function resolvePartnerDomainState(hostname: string): Promise<{
  status: PartnerDomainRecord["status"] | "unknown" | "platform";
  brandId: string | null;
  partnerId: string | null;
  domain: PartnerDomainRecord | null;
}> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    return { status: "unknown", brandId: null, partnerId: null, domain: null };
  }
  if (isPlatformPublicHostname(normalized)) {
    return {
      status: "platform",
      brandId: "suhuella",
      partnerId: null,
      domain: null,
    };
  }

  const store = await getPartnerStore();
  const doc = await store.read();
  const domain =
    doc.domains.find(
      (item) => item.normalizedHostname === normalized || item.hostname === normalized,
    ) ?? null;
  if (!domain) {
    return { status: "unknown", brandId: null, partnerId: null, domain: null };
  }
  const partner = doc.partners.find((item) => item.partnerId === domain.partnerId);
  if (!partner || partner.status === "revoked") {
    return { status: "revoked", brandId: null, partnerId: domain.partnerId, domain };
  }
  if (partner.status === "suspended" || domain.status === "suspended") {
    return {
      status: "suspended",
      brandId: domain.brandId,
      partnerId: domain.partnerId,
      domain,
    };
  }
  return {
    status: domain.status,
    brandId: domain.status === "active" ? domain.brandId : domain.brandId,
    partnerId: domain.partnerId,
    domain,
  };
}

export async function requireBrandIdForHostname(hostname: string): Promise<string> {
  const brandId = await resolveBrandIdForHostname(hostname);
  if (!brandId) throw new PartnerError("Unknown hostname.", 404);
  return brandId;
}

export function suggestOpsHostname(primaryHostname: string): string {
  const host = normalizeHostname(primaryHostname);
  if (!host) throw new PartnerError("Invalid hostname.");
  return opsHostnameForPrimary(host);
}

export function assertCloudConnectionBrandScope(input: {
  connectionBrandId: string;
  actorPartnerId: string | null;
  actorBrandId: string;
}): void {
  if (input.connectionBrandId !== input.actorBrandId) {
    throw new PartnerAuthzError("Cloud connection brand_id does not match the resolved brand.");
  }
  if (input.actorPartnerId) {
    // Tenant actors must never read another partner's brand rows.
    // brand_id equality above is necessary but partner scope is enforced by caller.
  }
}

export type { PartnerEntitlementOrigin };

const GIFT_PORTAL_ORIGINS = new Set(["gift", "manual", "internal", "test"]);

function slugFromEmail(email: string, taken: Set<string>): string {
  const local = email.split("@")[0] ?? "partner";
  let slug = local.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  if (slug.length < 2 || slug === "suhuella") slug = "partner";
  const base = slug;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function ensureActiveAdmin(
  doc: PartnerDocument,
  partnerId: string,
  email: string,
  now: string,
): void {
  let member = doc.members.find((item) => item.partnerId === partnerId && item.email === email);
  if (!member) {
    doc.members.push({
      memberId: createPartnerMemberId(),
      partnerId,
      email,
      role: "partner_admin",
      status: "active",
      invitedAt: now,
      acceptedAt: now,
    });
    return;
  }
  member.status = "active";
  member.role = member.role === "partner_member" ? member.role : "partner_admin";
  member.acceptedAt = member.acceptedAt ?? now;
}

export async function hasPartnerPortalMembership(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return false;
  const store = await getPartnerStore();
  const doc = await store.read();
  return doc.members.some((member) => {
    if (member.email !== normalized) return false;
    if (member.status !== "active" && member.status !== "invited") return false;
    const partner = doc.partners.find((item) => item.partnerId === member.partnerId);
    return Boolean(partner && partner.status !== "revoked");
  });
}

function resolvePartnerPortalAccess(
  doc: PartnerDocument,
  normalizedEmail: string,
): { member: PartnerMemberRecord; partner: PartnerRecord; entitlement: PartnerEntitlementRecord | null } | null {
  const memberships = doc.members.filter(
    (item) => item.email === normalizedEmail && (item.status === "active" || item.status === "invited"),
  );
  const ranked = memberships
    .map((member) => {
      const partner = doc.partners.find((item) => item.partnerId === member.partnerId);
      if (!partner || partner.status === "revoked" || partner.status === "suspended") return null;
      const entitlement =
        doc.entitlements
          .filter((item) => item.partnerId === partner.partnerId && item.status !== "revoked")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      return { member, partner, entitlement };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const chosen =
    ranked.find((item) => item.member.status === "active" && item.entitlement?.status === "active") ??
    ranked.find((item) => item.entitlement && GIFT_PORTAL_ORIGINS.has(item.entitlement.origin)) ??
    null;
  if (!chosen?.entitlement) return null;
  if (chosen.entitlement.status === "active") return chosen;
  if (
    chosen.entitlement.status === "pending" &&
    GIFT_PORTAL_ORIGINS.has(chosen.entitlement.origin)
  ) {
    return chosen;
  }
  return null;
}

/** Read-only gate for portal OTP. Application interest alone does not qualify. */
export async function hasPartnerPortalAccess(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return false;
  const store = await getPartnerStore();
  const doc = await store.read();
  return resolvePartnerPortalAccess(doc, normalized) !== null;
}

/**
 * Portal login for an already authorized member.
 * Gift/manual/internal/test pending entitlements activate here.
 * Does not create a partner, a gift, or a Stripe subscription.
 */
export async function openPartnerPortalForVerifiedEmail(email: string): Promise<
  | { ok: true; email: string; partnerId: string; role: PartnerMemberRole }
  | { ok: false; error: "no_membership" }
> {
  const normalized = requireEmail(email);
  const opened: { current: { email: string; partnerId: string; role: PartnerMemberRole } | null } = {
    current: null,
  };
  await mutate((doc) => {
    const chosen = resolvePartnerPortalAccess(doc, normalized);
    if (!chosen) return;

    const now = nowIso();
    if (chosen.member.status !== "active") {
      chosen.member.status = "active";
      chosen.member.acceptedAt = now;
    }
    if (
      chosen.entitlement &&
      chosen.entitlement.status === "pending" &&
      GIFT_PORTAL_ORIGINS.has(chosen.entitlement.origin)
    ) {
      chosen.entitlement.status = "active";
      chosen.entitlement.updatedAt = now;
      if (chosen.partner.status === "pending") {
        chosen.partner.status = "active";
        chosen.partner.updatedAt = now;
      }
    }
    if (chosen.entitlement?.status !== "active") return;
    for (const invite of doc.invites) {
      if (invite.email === normalized && invite.partnerId === chosen.partner.partnerId && !invite.consumedAt) {
        invite.consumedAt = now;
      }
    }
    opened.current = {
      email: normalized,
      partnerId: chosen.partner.partnerId,
      role: chosen.member.role,
    };
  });
  if (!opened.current) return { ok: false, error: "no_membership" };
  return { ok: true, ...opened.current };
}

export type StripePartnerProvisionResult = {
  partnerId: string;
  created: boolean;
  alreadyCovered: boolean;
};

/**
 * Idempotent partner provisioning from a verified paid Stripe subscription.
 * Does not convert an existing gift/manual entitlement into stripe.
 * A pending or rejected interest row does not block this path.
 */
export async function upsertStripePartnerFromVerifiedPayment(input: {
  email: string;
  displayName: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  validUntil: string | null;
}): Promise<StripePartnerProvisionResult> {
  const email = requireEmail(input.email);
  const subscriptionId = input.stripeSubscriptionId.trim();
  const customerId = input.stripeCustomerId.trim();
  if (!subscriptionId || !customerId) {
    throw new PartnerError("Stripe subscription and customer ids are required.");
  }
  const displayName = input.displayName.trim() || email;
  const result: { current: StripePartnerProvisionResult | null } = { current: null };

  await mutate((doc) => {
    const now = nowIso();
    const sameSubscription = doc.entitlements.find(
      (item) => item.origin === "stripe" && item.stripeSubscriptionId === subscriptionId,
    );
    if (sameSubscription) {
      sameSubscription.status = "active";
      sameSubscription.validUntil = input.validUntil;
      sameSubscription.stripeCustomerId = customerId;
      sameSubscription.updatedAt = now;
      const partner = doc.partners.find((item) => item.partnerId === sameSubscription.partnerId);
      if (partner && partner.status !== "revoked") {
        partner.status = "active";
        partner.updatedAt = now;
        ensureActiveAdmin(doc, partner.partnerId, email, now);
      }
      result.current = { partnerId: sameSubscription.partnerId, created: false, alreadyCovered: false };
      return;
    }

    const partner = doc.partners.find((item) => item.ownerEmail === email && item.status !== "revoked");
    if (partner) {
      const covering = doc.entitlements.find(
        (item) =>
          item.partnerId === partner.partnerId &&
          item.status === "active" &&
          item.origin !== "stripe",
      );
      const activeStripe = doc.entitlements.find(
        (item) =>
          item.partnerId === partner.partnerId &&
          item.origin === "stripe" &&
          item.status === "active",
      );
      if (covering || activeStripe) {
        result.current = { partnerId: partner.partnerId, created: false, alreadyCovered: true };
        return;
      }
      doc.entitlements.push({
        entitlementId: createPartnerEntitlementId(),
        partnerId: partner.partnerId,
        status: "active",
        origin: "stripe",
        validUntil: input.validUntil,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        createdAt: now,
        updatedAt: now,
        createdBy: "stripe_reconciliation",
        revokedAt: null,
        revokeReason: null,
      });
      partner.status = "active";
      partner.updatedAt = now;
      ensureActiveAdmin(doc, partner.partnerId, email, now);
      result.current = { partnerId: partner.partnerId, created: false, alreadyCovered: false };
      return;
    }

    const taken = new Set(doc.partners.map((item) => item.slug));
    const slug = slugFromEmail(email, taken);
    const partnerId = createPartnerId();
    const brandId = createPartnerBrandId(slug);
    doc.partners.push({
      partnerId,
      slug,
      displayName,
      status: "active",
      ownerEmail: email,
      createdAt: now,
      updatedAt: now,
      createdBy: "stripe_reconciliation",
      notes: "Provisioned from verified Stripe payment.",
    });
    doc.brands.push({
      brandId,
      partnerId,
      displayName,
      accent: null,
      onAccent: null,
      logoUrl: null,
      faviconUrl: null,
      canonicalDomain: null,
      updatedAt: now,
    });
    doc.entitlements.push({
      entitlementId: createPartnerEntitlementId(),
      partnerId,
      status: "active",
      origin: "stripe",
      validUntil: input.validUntil,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      createdAt: now,
      updatedAt: now,
      createdBy: "stripe_reconciliation",
      revokedAt: null,
      revokeReason: null,
    });
    ensureActiveAdmin(doc, partnerId, email, now);
    result.current = { partnerId, created: true, alreadyCovered: false };
  });

  if (!result.current) throw new PartnerError("Could not provision partner from Stripe.", 500);
  const { getPartnerApplicationStore } = await import("./application-store.ts");
  const applications = await getPartnerApplicationStore();
  await applications.recordPaidPartnerLink({ email, partnerId: result.current.partnerId });
  return result.current;
}

/**
 * Subscription ended. Suspends only the Stripe partner entitlement.
 * Does not delete brand, domain, or customer licenses, and does not alter gift origin.
 * End-customer suspension remains an unresolved commercial decision and is not applied.
 * invoice.payment_failed does not change status: no grace period is invented.
 */
export async function suspendStripePartnerSubscription(stripeSubscriptionId: string): Promise<boolean> {
  const subscriptionId = stripeSubscriptionId.trim();
  if (!subscriptionId) return false;
  let changed = false;
  await mutate((doc) => {
    const entitlement = doc.entitlements.find(
      (item) => item.origin === "stripe" && item.stripeSubscriptionId === subscriptionId,
    );
    if (!entitlement || entitlement.status === "revoked") return;
    const now = nowIso();
    if (entitlement.status !== "suspended") {
      entitlement.status = "suspended";
      entitlement.updatedAt = now;
      changed = true;
    }
    const partner = doc.partners.find((item) => item.partnerId === entitlement.partnerId);
    if (!partner || partner.status === "revoked") return;
    const stillCovered = doc.entitlements.some(
      (item) =>
        item.partnerId === partner.partnerId &&
        item.entitlementId !== entitlement.entitlementId &&
        item.status === "active",
    );
    if (!stillCovered && partner.status !== "suspended") {
      partner.status = "suspended";
      partner.updatedAt = now;
      changed = true;
    }
  });
  return changed;
}

export async function refreshStripePartnerPeriod(input: {
  stripeSubscriptionId: string;
  validUntil: string | null;
}): Promise<boolean> {
  const subscriptionId = input.stripeSubscriptionId.trim();
  if (!subscriptionId) return false;
  let changed = false;
  await mutate((doc) => {
    const entitlement = doc.entitlements.find(
      (item) => item.origin === "stripe" && item.stripeSubscriptionId === subscriptionId && item.status === "active",
    );
    if (!entitlement) return;
    entitlement.validUntil = input.validUntil;
    entitlement.updatedAt = nowIso();
    changed = true;
  });
  return changed;
}
