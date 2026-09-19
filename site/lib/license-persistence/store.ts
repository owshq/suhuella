import { parseLicenseGrant } from "../license-entitlement.ts";
import type { LicenseGrant } from "../license-context.ts";
import {
  emptyLicensePersistenceDocument,
  LicensePersistenceUnavailableError,
  type LicensePersistenceDocument,
  type LicensePersistenceKind,
  type LicensePersistenceStore,
} from "./types.ts";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseDocument(value: unknown): LicensePersistenceDocument {
  if (!isRecord(value) || value.version !== 1) {
    return emptyLicensePersistenceDocument();
  }
  return {
    version: 1,
    activations: Array.isArray(value.activations) ? (value.activations as LicensePersistenceDocument["activations"]) : [],
    challenges: Array.isArray(value.challenges) ? (value.challenges as LicensePersistenceDocument["challenges"]) : [],
    proofs: Array.isArray(value.proofs) ? (value.proofs as LicensePersistenceDocument["proofs"]) : [],
    activationAttempts: Array.isArray(value.activationAttempts)
      ? (value.activationAttempts as LicensePersistenceDocument["activationAttempts"])
      : [],
    rateLimitEvents: Array.isArray(value.rateLimitEvents)
      ? (value.rateLimitEvents as LicensePersistenceDocument["rateLimitEvents"])
      : [],
    grants: Array.isArray(value.grants)
      ? value.grants
          .map((item) => parseLicenseGrant(item))
          .filter((item): item is LicenseGrant => item !== null)
      : [],
  };
}

function grantRow(grant: LicenseGrant) {
  const stripeCustomer =
    grant.paymentProvider === "stripe" || grant.customerId.startsWith("cus_")
      ? grant.customerId
      : null;
  return {
    licenseId: grant.licenseId,
    normalizedEmail: grant.email,
    customerId: grant.customerId,
    stripeCustomerId: stripeCustomer,
    stripeSubscriptionId: grant.subscriptionId ?? null,
    edition: grant.edition,
    status: grant.status,
    origin: grant.origin,
    validUntil: grant.validUntil ?? null,
    deviceLimit: grant.deviceLimit ?? null,
    organisationId: grant.organisationId ?? null,
    createdAt: grant.createdAt ?? new Date().toISOString(),
    updatedAt: grant.updatedAt ?? new Date().toISOString(),
    revokedAt: grant.revokedAt ?? null,
    revokeReason: grant.revocationReason ?? null,
    payload: JSON.stringify(grant),
  };
}

class UnavailableLicensePersistenceStore implements LicensePersistenceStore {
  readonly kind: LicensePersistenceKind = "unavailable";

  async read(): Promise<LicensePersistenceDocument> {
    throw new LicensePersistenceUnavailableError();
  }

  async write(): Promise<void> {
    throw new LicensePersistenceUnavailableError();
  }
}

class MemoryLicensePersistenceStore implements LicensePersistenceStore {
  readonly kind: LicensePersistenceKind = "memory";
  private document = emptyLicensePersistenceDocument();

  async read(): Promise<LicensePersistenceDocument> {
    return structuredClone(this.document);
  }

  async write(document: LicensePersistenceDocument): Promise<void> {
    this.document = structuredClone(document);
  }
}

async function createFileStore(): Promise<LicensePersistenceStore | null> {
  if (typeof process.versions?.node !== "string") return null;

  try {
    const [{ mkdir, readFile, writeFile }, pathMod] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);

    const configured = process.env.LICENSE_STORE_PATH?.trim();
    const filePath = configured || pathMod.join(process.cwd(), ".data", "license-state.json");
    let document: LicensePersistenceDocument | null = null;
    let writeQueue = Promise.resolve();

    const load = async (): Promise<LicensePersistenceDocument> => {
      if (document) return document;
      try {
        const raw = await readFile(filePath, "utf8");
        document = parseDocument(JSON.parse(raw) as unknown);
      } catch {
        document = emptyLicensePersistenceDocument();
      }
      return document;
    };

    return {
      kind: "file",
      read: async () => structuredClone(await load()),
      write: async (next) => {
        writeQueue = writeQueue.then(async () => {
          document = structuredClone(next);
          await mkdir(pathMod.dirname(filePath), { recursive: true });
          await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
        });
        await writeQueue;
      },
    };
  } catch {
    return null;
  }
}

async function createD1Store(db: any): Promise<LicensePersistenceStore> {
  return {
    kind: "d1",
    read: async () => {
      const document = emptyLicensePersistenceDocument();

      const activations = await db
        .prepare(
          `SELECT license_id, device_id, device_name, platform, app_version, activated_at, last_seen, status
           FROM license_activation`,
        )
        .all();

      document.activations = ((activations.results as any[]) ?? []).map((row) => ({
        licenseId: row.license_id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        platform: row.platform,
        appVersion: row.app_version,
        activatedAt: row.activated_at,
        lastSeen: row.last_seen,
        status: row.status === "revoked" ? "revoked" : "active",
      }));

      const challenges = await db
        .prepare(`SELECT * FROM email_verification_challenge`)
        .all();
      document.challenges = ((challenges.results as any[]) ?? []).map((row) => ({
        id: String(row.id),
        normalizedEmail: String(row.normalized_email),
        purpose: row.purpose as LicensePersistenceDocument["challenges"][number]["purpose"],
        deviceId: row.device_id ? String(row.device_id) : null,
        codeHash: String(row.code_hash),
        expiresAt: String(row.expires_at),
        attemptCount: Number(row.attempt_count ?? 0),
        sendCount: Number(row.send_count ?? 1),
        consumedAt: row.consumed_at ? String(row.consumed_at) : null,
        createdAt: String(row.created_at),
      }));

      const proofs = await db.prepare(`SELECT * FROM verified_email_proof`).all();
      document.proofs = ((proofs.results as any[]) ?? []).map((row) => ({
        id: String(row.id),
        normalizedEmail: String(row.normalized_email),
        purpose: row.purpose as LicensePersistenceDocument["proofs"][number]["purpose"],
        deviceId: row.device_id ? String(row.device_id) : null,
        expiresAt: String(row.expires_at),
        consumedAt: row.consumed_at ? String(row.consumed_at) : null,
        createdAt: String(row.created_at),
      }));

      const attempts = await db.prepare(`SELECT * FROM activation_attempt`).all();
      document.activationAttempts = ((attempts.results as any[]) ?? []).map((row) => ({
        id: String(row.id),
        checkoutSessionId: row.checkout_session_id ? String(row.checkout_session_id) : null,
        deviceId: String(row.device_id),
        plan: row.plan ? String(row.plan) : null,
        expiresAt: String(row.expires_at),
        consumedAt: row.consumed_at ? String(row.consumed_at) : null,
        createdAt: String(row.created_at),
      }));

      const rateEvents = await db.prepare(`SELECT bucket_key, event_at FROM rate_limit_event`).all();
      document.rateLimitEvents = ((rateEvents.results as any[]) ?? []).map((row) => ({
        bucketKey: row.bucket_key,
        eventAt: row.event_at,
      }));

      const grants = await db.prepare(`SELECT payload FROM license_grant`).all();
      document.grants = ((grants.results as any[]) ?? [])
        .map((row) => {
          try {
            return parseLicenseGrant(JSON.parse(String(row.payload)));
          } catch {
            return null;
          }
        })
        .filter((item: LicenseGrant | null): item is LicenseGrant => item !== null);

      return document;
    },
    write: async (next) => {
      await db.batch([
        db.prepare(`DELETE FROM license_activation`),
        db.prepare(`DELETE FROM email_verification_challenge`),
        db.prepare(`DELETE FROM verified_email_proof`),
        db.prepare(`DELETE FROM activation_attempt`),
        db.prepare(`DELETE FROM rate_limit_event`),
        db.prepare(`DELETE FROM license_grant`),
      ]);

      const statements: any[] = [];
      for (const activation of next.activations) {
        statements.push(
          db.prepare(
            `INSERT INTO license_activation
             (license_id, device_id, device_name, platform, app_version, activated_at, last_seen, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            activation.licenseId,
            activation.deviceId,
            activation.deviceName,
            activation.platform,
            activation.appVersion,
            activation.activatedAt,
            activation.lastSeen,
            activation.status,
          ),
        );
      }
      for (const challenge of next.challenges) {
        statements.push(
          db.prepare(
            `INSERT INTO email_verification_challenge
             (id, normalized_email, purpose, device_id, code_hash, expires_at, attempt_count, send_count, consumed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            challenge.id,
            challenge.normalizedEmail,
            challenge.purpose,
            challenge.deviceId,
            challenge.codeHash,
            challenge.expiresAt,
            challenge.attemptCount,
            challenge.sendCount,
            challenge.consumedAt,
            challenge.createdAt,
          ),
        );
      }
      for (const proof of next.proofs) {
        statements.push(
          db.prepare(
            `INSERT INTO verified_email_proof
             (id, normalized_email, purpose, device_id, expires_at, consumed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            proof.id,
            proof.normalizedEmail,
            proof.purpose,
            proof.deviceId,
            proof.expiresAt,
            proof.consumedAt,
            proof.createdAt,
          ),
        );
      }
      for (const attempt of next.activationAttempts) {
        statements.push(
          db.prepare(
            `INSERT INTO activation_attempt
             (id, checkout_session_id, device_id, plan, expires_at, consumed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            attempt.id,
            attempt.checkoutSessionId,
            attempt.deviceId,
            attempt.plan,
            attempt.expiresAt,
            attempt.consumedAt,
            attempt.createdAt,
          ),
        );
      }
      for (const event of next.rateLimitEvents) {
        statements.push(
          db.prepare(`INSERT INTO rate_limit_event (bucket_key, event_at) VALUES (?, ?)`).bind(
            event.bucketKey,
            event.eventAt,
          ),
        );
      }
      for (const grant of next.grants) {
        const row = grantRow(grant);
        statements.push(
          db.prepare(
            `INSERT INTO license_grant
             (license_id, normalized_email, customer_id, stripe_customer_id, stripe_subscription_id,
              edition, status, origin, valid_until, device_limit, organisation_id,
              created_at, updated_at, revoked_at, revoke_reason, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            row.licenseId,
            row.normalizedEmail,
            row.customerId,
            row.stripeCustomerId,
            row.stripeSubscriptionId,
            row.edition,
            row.status,
            row.origin,
            row.validUntil,
            row.deviceLimit,
            row.organisationId,
            row.createdAt,
            row.updatedAt,
            row.revokedAt,
            row.revokeReason,
            row.payload,
          ),
        );
      }

      if (statements.length > 0) {
        await db.batch(statements);
      }
    },
  };
}

async function resolveD1Database(): Promise<any | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as { LICENSE_DB?: any }).LICENSE_DB;
    return db ?? null;
  } catch {
    return null;
  }
}

let storePromise: Promise<LicensePersistenceStore> | null = null;

async function createStore(): Promise<LicensePersistenceStore> {
  const d1 = await resolveD1Database();
  if (d1) return createD1Store(d1);
  if (isProductionRuntime()) return new UnavailableLicensePersistenceStore();
  return (await createFileStore()) ?? new MemoryLicensePersistenceStore();
}

export function getLicensePersistenceStore(): Promise<LicensePersistenceStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export function resetLicensePersistenceStoreForTests(): void {
  storePromise = null;
}

export async function isDurableLicensePersistenceReady(): Promise<boolean> {
  return (await getLicensePersistenceStore()).kind === "d1";
}

export async function productionLicensePersistenceReady(): Promise<boolean> {
  if (!isProductionRuntime()) return true;
  return isDurableLicensePersistenceReady();
}

export async function withLicensePersistence<T>(
  mutate: (document: LicensePersistenceDocument) => T | Promise<T>,
): Promise<T> {
  const store = await getLicensePersistenceStore();
  const document = await store.read();
  const result = await mutate(document);
  await store.write(document);
  return result;
}

export async function readLicensePersistence(): Promise<LicensePersistenceDocument> {
  return (await getLicensePersistenceStore()).read();
}
