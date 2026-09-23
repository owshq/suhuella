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
    stripeEvents: Array.isArray(value.stripeEvents)
      ? value.stripeEvents.flatMap((item) => {
          if (!isRecord(item) || typeof item.id !== "string" || typeof item.processedAt !== "string") {
            return [];
          }
          return [{ id: item.id, processedAt: item.processedAt }];
        })
      : [],
    commercialGenerations: Array.isArray(value.commercialGenerations)
      ? (value.commercialGenerations as LicensePersistenceDocument["commercialGenerations"])
      : [],
    commercialGenerationPrices: Array.isArray(value.commercialGenerationPrices)
      ? (value.commercialGenerationPrices as LicensePersistenceDocument["commercialGenerationPrices"])
      : [],
    checkoutGenerationBindings: Array.isArray(value.checkoutGenerationBindings)
      ? (value.checkoutGenerationBindings as LicensePersistenceDocument["checkoutGenerationBindings"]).map(
          (row) => ({
            ...row,
            versionModelActiveAtBind: row.versionModelActiveAtBind === true,
          }),
        )
      : [],
    licenseAcquisitions: Array.isArray(value.licenseAcquisitions)
      ? (value.licenseAcquisitions as LicensePersistenceDocument["licenseAcquisitions"])
      : [],
    checkoutReconciliationPending: Array.isArray(value.checkoutReconciliationPending)
      ? (value.checkoutReconciliationPending as LicensePersistenceDocument["checkoutReconciliationPending"])
      : [],
    licenseVersionModelActivatedAt:
      typeof value.licenseVersionModelActivatedAt === "string"
        ? value.licenseVersionModelActivatedAt
        : null,
    lifetimeUpgradeIntents: Array.isArray(value.lifetimeUpgradeIntents)
      ? (value.lifetimeUpgradeIntents as LicensePersistenceDocument["lifetimeUpgradeIntents"])
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

      const mapActivationRow = (row: any) => ({
        licenseId: row.license_id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        platform: row.platform,
        appVersion: row.app_version,
        activatedAt: row.activated_at,
        lastSeen: row.last_seen,
        status: row.status === "revoked" ? ("revoked" as const) : ("active" as const),
        ...(row.last_presented_token_algorithm
          ? {
              lastPresentedTokenAlgorithm: row.last_presented_token_algorithm as
                | "ed25519"
                | "legacy-hmac-sha256"
                | "unknown",
            }
          : {}),
      });

      try {
        const activations = await db
          .prepare(
            `SELECT license_id, device_id, device_name, platform, app_version, activated_at, last_seen, status,
                    last_presented_token_algorithm
             FROM license_activation`,
          )
          .all();
        document.activations = ((activations.results as any[]) ?? []).map(mapActivationRow);
      } catch {
        const activations = await db
          .prepare(
            `SELECT license_id, device_id, device_name, platform, app_version, activated_at, last_seen, status
             FROM license_activation`,
          )
          .all();
        document.activations = ((activations.results as any[]) ?? []).map(mapActivationRow);
      }

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

      try {
        const events = await db.prepare(`SELECT event_id, processed_at FROM stripe_event`).all();
        document.stripeEvents = ((events.results as any[]) ?? []).map((row) => ({
          id: String(row.event_id),
          processedAt: String(row.processed_at),
        }));
      } catch {
        document.stripeEvents = [];
      }

      try {
        const generations = await db
          .prepare(
            `SELECT id, label, required_capabilities, effective_from, created_at FROM commercial_generation`,
          )
          .all();
        document.commercialGenerations = ((generations.results as any[]) ?? []).map((row) => ({
          id: String(row.id),
          label: String(row.label),
          requiredCapabilities: JSON.parse(String(row.required_capabilities)) as string[],
          effectiveFrom: row.effective_from ? String(row.effective_from) : null,
          createdAt: String(row.created_at),
        }));
      } catch {
        document.commercialGenerations = [];
      }

      try {
        const prices = await db
          .prepare(`SELECT price_id, commercial_generation_id, product FROM commercial_generation_price`)
          .all();
        document.commercialGenerationPrices = ((prices.results as any[]) ?? []).map((row) => ({
          priceId: String(row.price_id),
          commercialGenerationId: String(row.commercial_generation_id),
          product: row.product as NonNullable<
            LicensePersistenceDocument["commercialGenerationPrices"]
          >[number]["product"],
        }));
      } catch {
        document.commercialGenerationPrices = [];
      }

      try {
        const bindings = await db
          .prepare(
            `SELECT checkout_session_id, commercial_generation_id, price_id, plan, bound_at,
                    version_model_active_at_bind
             FROM checkout_generation_binding`,
          )
          .all();
        document.checkoutGenerationBindings = ((bindings.results as any[]) ?? []).map((row) => ({
          checkoutSessionId: String(row.checkout_session_id),
          commercialGenerationId: row.commercial_generation_id
            ? String(row.commercial_generation_id)
            : null,
          priceId: String(row.price_id),
          plan: String(row.plan),
          boundAt: String(row.bound_at),
          versionModelActiveAtBind: Number(row.version_model_active_at_bind) === 1,
        }));
      } catch {
        document.checkoutGenerationBindings = [];
      }

      try {
        const acquisitions = await db
          .prepare(
            `SELECT id, license_id, normalized_email, kind, commercial_generation_id,
                    checkout_session_id, stripe_event_id, edition, acquired_at
             FROM license_acquisition`,
          )
          .all();
        document.licenseAcquisitions = ((acquisitions.results as any[]) ?? []).map((row) => ({
          id: String(row.id),
          licenseId: String(row.license_id),
          normalizedEmail: String(row.normalized_email),
          kind: row.kind as NonNullable<LicensePersistenceDocument["licenseAcquisitions"]>[number]["kind"],
          commercialGenerationId: row.commercial_generation_id
            ? String(row.commercial_generation_id)
            : null,
          checkoutSessionId: row.checkout_session_id ? String(row.checkout_session_id) : null,
          stripeEventId: row.stripe_event_id ? String(row.stripe_event_id) : null,
          edition: row.edition as NonNullable<
            LicensePersistenceDocument["licenseAcquisitions"]
          >[number]["edition"],
          acquiredAt: String(row.acquired_at),
        }));
      } catch {
        document.licenseAcquisitions = [];
      }

      try {
        const pending = await db
          .prepare(
            `SELECT id, checkout_session_id, normalized_email, price_id, plan, reason,
                    stripe_event_id, recorded_at, status
             FROM checkout_reconciliation_pending`,
          )
          .all();
        document.checkoutReconciliationPending = ((pending.results as any[]) ?? []).map((row) => ({
          id: String(row.id),
          checkoutSessionId: String(row.checkout_session_id),
          normalizedEmail: String(row.normalized_email),
          priceId: String(row.price_id),
          plan: String(row.plan),
          reason: row.reason as NonNullable<
            LicensePersistenceDocument["checkoutReconciliationPending"]
          >[number]["reason"],
          stripeEventId: row.stripe_event_id ? String(row.stripe_event_id) : null,
          recordedAt: String(row.recorded_at),
          status: row.status === "resolved" ? "resolved" : "open",
        }));
      } catch {
        document.checkoutReconciliationPending = [];
      }

      try {
        const intents = await db
          .prepare(
            `SELECT id, license_id, normalized_email, source_generation_id, target_generation_id,
                    checkout_session_id, idempotency_key, status, incident_note, created_at, updated_at
             FROM lifetime_upgrade_intent`,
          )
          .all();
        document.lifetimeUpgradeIntents = ((intents.results as any[]) ?? []).map((row) => ({
          id: String(row.id),
          licenseId: String(row.license_id),
          normalizedEmail: String(row.normalized_email),
          sourceGenerationId: String(row.source_generation_id),
          targetGenerationId: String(row.target_generation_id),
          checkoutSessionId: row.checkout_session_id ? String(row.checkout_session_id) : null,
          idempotencyKey: String(row.idempotency_key),
          status: row.status as NonNullable<
            LicensePersistenceDocument["lifetimeUpgradeIntents"]
          >[number]["status"],
          incidentNote: row.incident_note ? String(row.incident_note) : null,
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
        }));
      } catch {
        document.lifetimeUpgradeIntents = [];
      }

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
      try {
        await db.batch([
          db.prepare(`DELETE FROM license_acquisition`),
          db.prepare(`DELETE FROM checkout_reconciliation_pending`),
          db.prepare(`DELETE FROM checkout_generation_binding`),
          db.prepare(`DELETE FROM commercial_generation_price`),
          db.prepare(`DELETE FROM commercial_generation`),
          db.prepare(`DELETE FROM license_version_model_state`),
        ]);
      } catch {
        /* 0011/0012 not applied yet */
      }
      try {
        await db.prepare(`DELETE FROM lifetime_upgrade_intent`).run();
      } catch {
        /* 0012 not applied yet */
      }

      const statements: any[] = [];
      for (const activation of next.activations) {
        if (activation.lastPresentedTokenAlgorithm) {
          statements.push(
            db.prepare(
              `INSERT INTO license_activation
               (license_id, device_id, device_name, platform, app_version, activated_at, last_seen, status,
                last_presented_token_algorithm)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(
              activation.licenseId,
              activation.deviceId,
              activation.deviceName,
              activation.platform,
              activation.appVersion,
              activation.activatedAt,
              activation.lastSeen,
              activation.status,
              activation.lastPresentedTokenAlgorithm,
            ),
          );
        } else {
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

      const commercialStatements: any[] = [];
      for (const generation of next.commercialGenerations ?? []) {
        commercialStatements.push(
          db.prepare(
            `INSERT INTO commercial_generation
             (id, label, required_capabilities, effective_from, created_at)
             VALUES (?, ?, ?, ?, ?)`,
          ).bind(
            generation.id,
            generation.label,
            JSON.stringify(generation.requiredCapabilities),
            generation.effectiveFrom,
            generation.createdAt,
          ),
        );
      }
      for (const price of next.commercialGenerationPrices ?? []) {
        commercialStatements.push(
          db.prepare(
            `INSERT INTO commercial_generation_price (price_id, commercial_generation_id, product)
             VALUES (?, ?, ?)`,
          ).bind(price.priceId, price.commercialGenerationId, price.product),
        );
      }
      for (const binding of next.checkoutGenerationBindings ?? []) {
        commercialStatements.push(
          db.prepare(
            `INSERT INTO checkout_generation_binding
             (checkout_session_id, commercial_generation_id, price_id, plan, bound_at,
              version_model_active_at_bind)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).bind(
            binding.checkoutSessionId,
            binding.commercialGenerationId,
            binding.priceId,
            binding.plan,
            binding.boundAt,
            binding.versionModelActiveAtBind ? 1 : 0,
          ),
        );
      }
      for (const incident of next.checkoutReconciliationPending ?? []) {
        commercialStatements.push(
          db.prepare(
            `INSERT INTO checkout_reconciliation_pending
             (id, checkout_session_id, normalized_email, price_id, plan, reason,
              stripe_event_id, recorded_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            incident.id,
            incident.checkoutSessionId,
            incident.normalizedEmail,
            incident.priceId,
            incident.plan,
            incident.reason,
            incident.stripeEventId,
            incident.recordedAt,
            incident.status,
          ),
        );
      }
      for (const acquisition of next.licenseAcquisitions ?? []) {
        commercialStatements.push(
          db.prepare(
            `INSERT INTO license_acquisition
             (id, license_id, normalized_email, kind, commercial_generation_id,
              checkout_session_id, stripe_event_id, edition, acquired_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            acquisition.id,
            acquisition.licenseId,
            acquisition.normalizedEmail,
            acquisition.kind,
            acquisition.commercialGenerationId,
            acquisition.checkoutSessionId,
            acquisition.stripeEventId,
            acquisition.edition,
            acquisition.acquiredAt,
          ),
        );
      }
      if (commercialStatements.length > 0) {
        try {
          await db.batch(commercialStatements);
        } catch {
          /* 0011 not applied yet — core grant writes remain durable */
        }
      }

      const upgradeIntentStatements = (next.lifetimeUpgradeIntents ?? []).map((intent) =>
        db
          .prepare(
            `INSERT INTO lifetime_upgrade_intent
             (id, license_id, normalized_email, source_generation_id, target_generation_id,
              checkout_session_id, idempotency_key, status, incident_note, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            intent.id,
            intent.licenseId,
            intent.normalizedEmail,
            intent.sourceGenerationId,
            intent.targetGenerationId,
            intent.checkoutSessionId,
            intent.idempotencyKey,
            intent.status,
            intent.incidentNote,
            intent.createdAt,
            intent.updatedAt,
          ),
      );
      if (upgradeIntentStatements.length > 0) {
        try {
          await db.batch(upgradeIntentStatements);
        } catch {
          /* 0012 not applied yet */
        }
      }

      try {
        const eventStatements = [
          db.prepare(`DELETE FROM stripe_event`),
          ...next.stripeEvents.map((event) =>
            db
              .prepare(`INSERT INTO stripe_event (event_id, processed_at) VALUES (?, ?)`)
              .bind(event.id, event.processedAt),
          ),
        ];
        await db.batch(eventStatements);
      } catch {
        /* 0005 is not applied yet. Grant writes stay durable; event receipts retry. */
      }
    },
  };
}

async function resolveD1Database(): Promise<any | null> {
  if (process.env.SUHUELLA_DEV_OPENNEXT === "0") {
    const { resolveDevWranglerD1Adapter } = await import("../dev/local-wrangler-d1.ts");
    return resolveDevWranglerD1Adapter();
  }
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
let testDatabase: unknown = null;

export function setLicensePersistenceDatabaseForTests(db: unknown | null): void {
  testDatabase = db;
  storePromise = null;
}

async function createStore(): Promise<LicensePersistenceStore> {
  if (testDatabase) return createD1Store(testDatabase);
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
  testDatabase = null;
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
