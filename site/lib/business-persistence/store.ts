import {
  emptyBusinessStoreShape,
  type BusinessStore,
  type BusinessStoreShape,
} from "../business-store.ts";
import type { BusinessAccount, BusinessBranding, BusinessSeat, BusinessSeatChangeRecord } from "../business-types.ts";
import type { LicenseGrant } from "../license-context.ts";
import { parseLicenseGrant } from "../license-entitlement.ts";
import {
  BusinessPersistenceUnavailableError,
  type BusinessPersistenceKind,
  type BusinessPersistenceStore,
} from "./types.ts";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parsePayload<T>(payload: string, fallback: T): T {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return fallback;
  }
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

async function d1HasBusinessTables(db: any): Promise<boolean> {
  try {
    const row = await db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'business_account' LIMIT 1`,
      )
      .first();
    return Boolean(row);
  } catch {
    return false;
  }
}

function accountRow(account: BusinessAccount) {
  return {
    organisation_id: account.organisationId,
    name: account.name,
    billing_customer_id: account.billingCustomerId,
    owner_email: account.ownerEmail,
    plan: account.plan,
    seat_limit: account.seatLimit,
    seat_price_cents: account.seatPriceCents,
    currency: account.currency,
    status: account.status,
    trial_ends_at: account.trialEndsAt,
    stripe_subscription_id: account.stripeSubscriptionId,
    stripe_subscription_item_id: account.stripeSubscriptionItemId,
    stripe_status: account.stripeStatus,
    current_period_end: account.currentPeriodEnd,
    recurring_amount_cents: account.recurringAmountCents,
    billing_interval: account.billingInterval,
    billing_needs_reconciliation: account.billingNeedsReconciliation ? 1 : 0,
    last_stripe_event_id: account.lastStripeEventId,
    last_stripe_event_created: account.lastStripeEventCreated,
    stripe_checkout_session_id: account.stripeCheckoutSessionId,
    device_limit_per_seat: account.deviceLimitPerSeat ?? null,
    payload: JSON.stringify(account),
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

function seatRow(seat: BusinessSeat) {
  return {
    seat_id: seat.seatId,
    organisation_id: seat.organisationId,
    normalized_email: seat.email,
    role: seat.role,
    status: seat.status,
    license_id: seat.licenseId,
    invited_at: seat.invitedAt,
    activated_at: seat.activatedAt,
    last_seen_at: seat.lastSeenAt,
    payload: JSON.stringify(seat),
  };
}

async function createD1Store(db: any): Promise<BusinessPersistenceStore> {
  return {
    kind: "d1",
    isReady: () => d1HasBusinessTables(db),
    read: async () => {
      const ready = await d1HasBusinessTables(db);
      if (!ready) return emptyBusinessStoreShape();

      const accountsResult = await db.prepare(`SELECT payload FROM business_account`).all();
      const accounts = ((accountsResult.results as any[]) ?? [])
        .map((row) => parsePayload<BusinessAccount | null>(String(row.payload), null))
        .filter((item): item is BusinessAccount => item !== null);

      const seatsResult = await db.prepare(`SELECT payload FROM business_seat`).all();
      const seats = ((seatsResult.results as any[]) ?? [])
        .map((row) => parsePayload<BusinessSeat | null>(String(row.payload), null))
        .filter((item): item is BusinessSeat => item !== null);

      const changesResult = await db.prepare(`SELECT payload FROM business_seat_change`).all();
      const seatChanges = ((changesResult.results as any[]) ?? [])
        .map((row) => parsePayload<BusinessSeatChangeRecord | null>(String(row.payload), null))
        .filter((item): item is BusinessSeatChangeRecord => item !== null);

      const brandingResult = await db.prepare(`SELECT payload FROM business_branding`).all();
      const brandings = ((brandingResult.results as any[]) ?? [])
        .map((row) => parsePayload<BusinessBranding | null>(String(row.payload), null))
        .filter((item): item is BusinessBranding => item !== null);

      return {
        accounts,
        seats,
        grants: [],
        brandings,
        seatChanges,
        stripeEvents: [],
      };
    },
    write: async (document) => {
      const ready = await d1HasBusinessTables(db);
      if (!ready) throw new BusinessPersistenceUnavailableError();

      const statements = [
        db.prepare(`DELETE FROM business_seat_change`),
        db.prepare(`DELETE FROM business_seat`),
        db.prepare(`DELETE FROM business_branding`),
        db.prepare(`DELETE FROM business_account`),
        ...document.accounts.map((account) => {
          const row = accountRow(account);
          return db
            .prepare(
              `INSERT INTO business_account (
                organisation_id, name, billing_customer_id, owner_email, plan, seat_limit,
                seat_price_cents, currency, status, trial_ends_at, stripe_subscription_id,
                stripe_subscription_item_id, stripe_status, current_period_end, recurring_amount_cents,
                billing_interval, billing_needs_reconciliation, last_stripe_event_id,
                last_stripe_event_created, stripe_checkout_session_id, device_limit_per_seat,
                payload, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              row.organisation_id,
              row.name,
              row.billing_customer_id,
              row.owner_email,
              row.plan,
              row.seat_limit,
              row.seat_price_cents,
              row.currency,
              row.status,
              row.trial_ends_at,
              row.stripe_subscription_id,
              row.stripe_subscription_item_id,
              row.stripe_status,
              row.current_period_end,
              row.recurring_amount_cents,
              row.billing_interval,
              row.billing_needs_reconciliation,
              row.last_stripe_event_id,
              row.last_stripe_event_created,
              row.stripe_checkout_session_id,
              row.device_limit_per_seat,
              row.payload,
              row.created_at,
              row.updated_at,
            );
        }),
        ...document.seats.map((seat) => {
          const row = seatRow(seat);
          return db
            .prepare(
              `INSERT INTO business_seat (
                seat_id, organisation_id, normalized_email, role, status, license_id,
                invited_at, activated_at, last_seen_at, payload
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              row.seat_id,
              row.organisation_id,
              row.normalized_email,
              row.role,
              row.status,
              row.license_id,
              row.invited_at,
              row.activated_at,
              row.last_seen_at,
              row.payload,
            );
        }),
        ...(document.brandings ?? []).map((branding) =>
          db
            .prepare(`INSERT INTO business_branding (organisation_id, payload, updated_at) VALUES (?, ?, ?)`)
            .bind(branding.organisationId, JSON.stringify(branding), branding.updatedAt),
        ),
        ...(document.seatChanges ?? []).map((change) =>
          db
            .prepare(`INSERT INTO business_seat_change (id, organisation_id, payload, timestamp) VALUES (?, ?, ?, ?)`)
            .bind(change.id, change.organisationId, JSON.stringify(change), change.timestamp),
        ),
      ];
      await db.batch(statements);
    },
  };
}

class MemoryBusinessPersistenceStore implements BusinessPersistenceStore {
  readonly kind: BusinessPersistenceKind = "memory";
  private document = emptyBusinessStoreShape();

  async isReady(): Promise<boolean> {
    return true;
  }

  async read(): Promise<BusinessStoreShape> {
    return structuredClone(this.document);
  }

  async write(document: BusinessStoreShape): Promise<void> {
    this.document = structuredClone(document);
  }
}

class UnavailableBusinessPersistenceStore implements BusinessPersistenceStore {
  readonly kind: BusinessPersistenceKind = "unavailable";

  async isReady(): Promise<boolean> {
    return false;
  }

  async read(): Promise<BusinessStoreShape> {
    throw new BusinessPersistenceUnavailableError();
  }

  async write(): Promise<void> {
    throw new BusinessPersistenceUnavailableError();
  }
}

async function createFileStore(): Promise<BusinessPersistenceStore | null> {
  if (typeof process.versions?.node !== "string") return null;
  try {
    const [{ readFile, writeFile, mkdir }, pathMod] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const configured = process.env.BUSINESS_STORE_PATH?.trim();
    const filePath = configured || pathMod.join(process.cwd(), ".data", "business.json");
    let document: BusinessStoreShape | null = null;

    return {
      kind: "file",
      isReady: async () => true,
      read: async () => {
        if (document) return structuredClone(document);
        try {
          const raw = await readFile(filePath, "utf8");
          const parsed = JSON.parse(raw) as unknown;
          if (!isRecord(parsed)) document = emptyBusinessStoreShape();
          else {
            document = {
              accounts: Array.isArray(parsed.accounts) ? (parsed.accounts as BusinessAccount[]) : [],
              seats: Array.isArray(parsed.seats) ? (parsed.seats as BusinessSeat[]) : [],
              grants: Array.isArray(parsed.grants) ? (parsed.grants as LicenseGrant[]) : [],
              brandings: Array.isArray(parsed.brandings) ? (parsed.brandings as BusinessBranding[]) : [],
              seatChanges: Array.isArray(parsed.seatChanges)
                ? (parsed.seatChanges as BusinessSeatChangeRecord[])
                : [],
              stripeEvents: [],
            };
          }
        } catch {
          document = emptyBusinessStoreShape();
        }
        return structuredClone(document);
      },
      write: async (next) => {
        document = structuredClone(next);
        await mkdir(pathMod.dirname(filePath), { recursive: true });
        await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      },
    };
  } catch {
    return null;
  }
}

let storePromise: Promise<BusinessPersistenceStore> | null = null;
let testDatabase: unknown = null;

export function setBusinessPersistenceDatabaseForTests(db: unknown | null): void {
  testDatabase = db;
  storePromise = null;
}

export function resetBusinessPersistenceStoreForTests(): void {
  storePromise = null;
  testDatabase = null;
}

async function createStore(): Promise<BusinessPersistenceStore> {
  if (testDatabase) return createD1Store(testDatabase);
  const d1 = await resolveD1Database();
  if (d1) return createD1Store(d1);
  if (isProductionRuntime()) return new UnavailableBusinessPersistenceStore();
  return (await createFileStore()) ?? new MemoryBusinessPersistenceStore();
}

export function getBusinessPersistenceStore(): Promise<BusinessPersistenceStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export async function isBusinessPersistenceReady(): Promise<boolean> {
  return (await getBusinessPersistenceStore()).isReady();
}

export async function productionBusinessPersistenceReady(): Promise<boolean> {
  if (!isProductionRuntime()) return true;
  return isBusinessPersistenceReady();
}

export async function readBusinessPersistence(): Promise<BusinessStoreShape> {
  return (await getBusinessPersistenceStore()).read();
}

export async function withBusinessPersistence<T>(
  mutate: (store: BusinessStore) => Promise<T> | T,
): Promise<T> {
  const persistence = await getBusinessPersistenceStore();
  if (!(await persistence.isReady())) {
    throw new BusinessPersistenceUnavailableError();
  }
  const { createMemoryBusinessStore } = await import("../business-store.ts");
  const { createBusinessService } = await import("../business-service.ts");
  const shape = await persistence.read();
  const memoryStore = createMemoryBusinessStore(shape);
  const service = createBusinessService({ store: memoryStore });
  const result = await mutate(memoryStore);
  await persistence.write(memoryStore.load());
  return result;
}

export async function withBusinessService<T>(
  fn: (service: ReturnType<typeof import("../business-service.ts").createBusinessService>) => Promise<T> | T,
): Promise<T> {
  const persistence = await getBusinessPersistenceStore();
  if (!(await persistence.isReady())) {
    throw new BusinessPersistenceUnavailableError();
  }
  const { createMemoryBusinessStore } = await import("../business-store.ts");
  const { createBusinessService } = await import("../business-service.ts");
  const shape = await persistence.read();
  const memoryStore = createMemoryBusinessStore(shape);
  const service = createBusinessService({ store: memoryStore });
  const result = await fn(service);
  await persistence.write(memoryStore.load());
  return result;
}
