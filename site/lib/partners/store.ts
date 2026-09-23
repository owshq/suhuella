import {
  emptyPartnerDocument,
  type PartnerDocument,
  type PartnerDomainRecord,
} from "./types.ts";

export type PartnerStore = {
  readonly kind: "memory" | "d1";
  read: () => Promise<PartnerDocument>;
  write: (document: PartnerDocument) => Promise<void>;
};

export class PartnerStoreUnavailableError extends Error {
  constructor(message = "Partner persistence is unavailable.") {
    super(message);
    this.name = "PartnerStoreUnavailableError";
  }
}

class UnavailablePartnerStore implements PartnerStore {
  readonly kind = "d1" as const;

  async read(): Promise<PartnerDocument> {
    throw new PartnerStoreUnavailableError();
  }

  async write(): Promise<void> {
    throw new PartnerStoreUnavailableError();
  }
}

class MemoryPartnerStore implements PartnerStore {
  readonly kind = "memory" as const;
  private document = emptyPartnerDocument();

  async read(): Promise<PartnerDocument> {
    return structuredClone(this.document);
  }

  async write(document: PartnerDocument): Promise<void> {
    this.document = structuredClone(document);
  }
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.NEXTJS_ENV === "production"
  );
}

async function resolveD1Database(): Promise<any | null> {
  if (process.env.SUHUELLA_DEV_OPENNEXT === "0") {
    const { resolveDevWranglerD1Adapter } = await import("../dev/local-wrangler-d1.ts");
    return resolveDevWranglerD1Adapter();
  }
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as { LICENSE_DB?: any }).LICENSE_DB ?? null;
  } catch {
    return null;
  }
}

function mapPartner(row: any) {
  return {
    partnerId: String(row.partner_id),
    slug: String(row.slug),
    displayName: String(row.display_name),
    status: row.status,
    ownerEmail: String(row.owner_email),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by ? String(row.created_by) : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

function mapMember(row: any) {
  return {
    memberId: String(row.member_id),
    partnerId: String(row.partner_id),
    email: String(row.email),
    role: row.role,
    status: row.status,
    invitedAt: String(row.invited_at),
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
  };
}

function mapBrand(row: any) {
  return {
    brandId: String(row.brand_id),
    partnerId: String(row.partner_id),
    displayName: String(row.display_name),
    accent: row.accent ? String(row.accent) : null,
    onAccent: row.on_accent ? String(row.on_accent) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    faviconUrl: row.favicon_url ? String(row.favicon_url) : null,
    canonicalDomain: row.canonical_domain ? String(row.canonical_domain) : null,
    updatedAt: String(row.updated_at),
  };
}

function mapDomain(row: any): PartnerDomainRecord {
  const hostname = String(row.hostname);
  const statusRaw = String(row.status ?? "pending");
  const status = (
    statusRaw === "verified" ? "active" : statusRaw
  ) as PartnerDomainRecord["status"];
  return {
    domainId: String(row.domain_id),
    partnerId: String(row.partner_id),
    brandId: String(row.brand_id),
    hostname,
    normalizedHostname: String(row.normalized_hostname ?? hostname).toLowerCase(),
    kind: row.kind,
    status,
    cloudflareCustomHostnameId: row.cloudflare_custom_hostname_id
      ? String(row.cloudflare_custom_hostname_id)
      : null,
    dnsTarget: row.dns_target ? String(row.dns_target) : null,
    validationErrors: row.validation_errors ? String(row.validation_errors) : null,
    verificationTokenHash: row.verification_token_hash
      ? String(row.verification_token_hash)
      : null,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEntitlement(row: any) {
  return {
    entitlementId: String(row.entitlement_id),
    partnerId: String(row.partner_id),
    status: row.status,
    origin: row.origin,
    validUntil: row.valid_until ? String(row.valid_until) : null,
    stripeSubscriptionId: row.stripe_subscription_id
      ? String(row.stripe_subscription_id)
      : null,
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: row.created_by ? String(row.created_by) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    revokeReason: row.revoke_reason ? String(row.revoke_reason) : null,
  };
}

function mapInvite(row: any) {
  return {
    inviteId: String(row.invite_id),
    partnerId: String(row.partner_id),
    email: String(row.email),
    role: row.role,
    tokenHash: String(row.token_hash),
    expiresAt: String(row.expires_at),
    consumedAt: row.consumed_at ? String(row.consumed_at) : null,
    createdAt: String(row.created_at),
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

function createD1Store(db: any): PartnerStore {
  return {
    kind: "d1",
    read: async () => {
      const document = emptyPartnerDocument();
      try {
        const partners = await db.prepare(`SELECT * FROM partner`).all();
        document.partners = ((partners.results as any[]) ?? []).map(mapPartner);

        const members = await db.prepare(`SELECT * FROM partner_member`).all();
        document.members = ((members.results as any[]) ?? []).map(mapMember);

        const brands = await db.prepare(`SELECT * FROM partner_brand`).all();
        document.brands = ((brands.results as any[]) ?? []).map(mapBrand);

        const domains = await db.prepare(`SELECT * FROM partner_domain`).all();
        document.domains = ((domains.results as any[]) ?? []).map(mapDomain);

        const entitlements = await db.prepare(`SELECT * FROM partner_entitlement`).all();
        document.entitlements = ((entitlements.results as any[]) ?? []).map(mapEntitlement);

        const invites = await db.prepare(`SELECT * FROM partner_onboarding_invite`).all();
        document.invites = ((invites.results as any[]) ?? []).map(mapInvite);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/no such table/i.test(message)) {
          throw new PartnerStoreUnavailableError(
            "Partner tables are missing. Apply migration 0007_partners.sql.",
          );
        }
        throw error;
      }
      return document;
    },
    write: async (next) => {
      // Replace-set in one D1 batch (atomic). Does not touch non-partner tables.
      const statements: any[] = [
        db.prepare(`DELETE FROM partner_onboarding_invite`),
        db.prepare(`DELETE FROM partner_entitlement`),
        db.prepare(`DELETE FROM partner_domain`),
        db.prepare(`DELETE FROM partner_brand`),
        db.prepare(`DELETE FROM partner_member`),
        db.prepare(`DELETE FROM partner`),
      ];

      for (const partner of next.partners) {
        statements.push(
          db
            .prepare(
              `INSERT INTO partner
               (partner_id, slug, display_name, status, owner_email, created_at, updated_at, created_by, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              partner.partnerId,
              partner.slug,
              partner.displayName,
              partner.status,
              partner.ownerEmail,
              partner.createdAt,
              partner.updatedAt,
              partner.createdBy,
              partner.notes,
            ),
        );
      }
      for (const member of next.members) {
        statements.push(
          db
            .prepare(
              `INSERT INTO partner_member
               (member_id, partner_id, email, role, status, invited_at, accepted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              member.memberId,
              member.partnerId,
              member.email,
              member.role,
              member.status,
              member.invitedAt,
              member.acceptedAt,
            ),
        );
      }
      for (const brand of next.brands) {
        statements.push(
          db
            .prepare(
              `INSERT INTO partner_brand
               (brand_id, partner_id, display_name, accent, on_accent, logo_url, favicon_url, canonical_domain, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              brand.brandId,
              brand.partnerId,
              brand.displayName,
              brand.accent,
              brand.onAccent,
              brand.logoUrl,
              brand.faviconUrl,
              brand.canonicalDomain,
              brand.updatedAt,
            ),
        );
      }
      for (const domain of next.domains) {
        statements.push(
          db
            .prepare(
              `INSERT INTO partner_domain
               (domain_id, partner_id, brand_id, hostname, kind, status, verification_token_hash, verified_at, created_at, updated_at,
                normalized_hostname, cloudflare_custom_hostname_id, dns_target, validation_errors)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              domain.domainId,
              domain.partnerId,
              domain.brandId,
              domain.hostname,
              domain.kind,
              domain.status,
              domain.verificationTokenHash,
              domain.verifiedAt,
              domain.createdAt,
              domain.updatedAt,
              domain.normalizedHostname ?? domain.hostname,
              domain.cloudflareCustomHostnameId,
              domain.dnsTarget,
              domain.validationErrors,
            ),
        );
      }
      for (const entitlement of next.entitlements) {
        statements.push(
          db
            .prepare(
              `INSERT INTO partner_entitlement
               (entitlement_id, partner_id, status, origin, valid_until, stripe_subscription_id, stripe_customer_id,
                created_at, updated_at, created_by, revoked_at, revoke_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              entitlement.entitlementId,
              entitlement.partnerId,
              entitlement.status,
              entitlement.origin,
              entitlement.validUntil,
              entitlement.stripeSubscriptionId,
              entitlement.stripeCustomerId,
              entitlement.createdAt,
              entitlement.updatedAt,
              entitlement.createdBy,
              entitlement.revokedAt,
              entitlement.revokeReason,
            ),
        );
      }
      for (const invite of next.invites) {
        statements.push(
          db
            .prepare(
              `INSERT INTO partner_onboarding_invite
               (invite_id, partner_id, email, role, token_hash, expires_at, consumed_at, created_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              invite.inviteId,
              invite.partnerId,
              invite.email,
              invite.role,
              invite.tokenHash,
              invite.expiresAt,
              invite.consumedAt,
              invite.createdAt,
              invite.createdBy,
            ),
        );
      }

      await db.batch(statements);
    },
  };
}

let storePromise: Promise<PartnerStore> | null = null;
let overrideStore: PartnerStore | null = null;

export function createMemoryPartnerStore(): PartnerStore {
  return new MemoryPartnerStore();
}

/** Test hook: bind a raw D1/SQLite adapter (local wrangler D1 or isolated sqlite). */
export function createPartnerStoreFromDatabase(db: {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown>;
}): PartnerStore {
  return createD1Store(db);
}

export function setPartnerStoreForTests(store: PartnerStore | null): void {
  overrideStore = store;
  storePromise = store ? Promise.resolve(store) : null;
}

export function resetPartnerStoreForTests(): void {
  const memory = new MemoryPartnerStore();
  overrideStore = memory;
  storePromise = Promise.resolve(memory);
}

async function createStore(): Promise<PartnerStore> {
  if (overrideStore) return overrideStore;
  const d1 = await resolveD1Database();
  if (d1) return createD1Store(d1);
  if (isProductionRuntime()) return new UnavailablePartnerStore();
  return new MemoryPartnerStore();
}

export async function getPartnerStore(): Promise<PartnerStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export async function isDurablePartnerPersistenceReady(): Promise<boolean> {
  try {
    const store = await getPartnerStore();
    if (store.kind !== "d1") return false;
    await store.read();
    return true;
  } catch {
    return false;
  }
}

export async function productionPartnerPersistenceReady(): Promise<boolean> {
  if (!isProductionRuntime()) return true;
  return isDurablePartnerPersistenceReady();
}
