import {
  PartnerApplicationError,
  PartnerApplicationStoreUnavailableError,
  type PartnerApplicationRecord,
  type PartnerApplicationStatus,
} from "./application-types.ts";

export type { PartnerApplicationRecord, PartnerApplicationStatus };
export { PartnerApplicationError, PartnerApplicationStoreUnavailableError };

type D1DatabaseLike = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
    };
  };
};

export type PartnerApplicationStore = {
  readonly kind: "memory" | "d1";
  submitInterest(input: { email: string; displayName: string }): Promise<PartnerApplicationRecord>;
  findByEmail(email: string): Promise<PartnerApplicationRecord | null>;
  findById(applicationId: string): Promise<PartnerApplicationRecord | null>;
  list(): Promise<PartnerApplicationRecord[]>;
  setStatus(input: {
    applicationId: string;
    status: PartnerApplicationStatus;
    reviewedBy: string | null;
    rejectionReason?: string | null;
  }): Promise<PartnerApplicationRecord>;
  /** Verified payment links a partner even if interest was pending or rejected. */
  recordPaidPartnerLink(input: {
    email: string;
    partnerId: string;
  }): Promise<PartnerApplicationRecord | null>;
  claimForApproval(input: {
    applicationId: string;
    reviewedBy: string;
    approvalAttemptId: string;
  }): Promise<PartnerApplicationRecord | null>;
  completeApproval(input: {
    applicationId: string;
    partnerId: string;
    approvalAttemptId: string;
    reviewedBy: string;
  }): Promise<PartnerApplicationRecord>;
  releaseApprovalClaim(input: {
    applicationId: string;
    approvalAttemptId: string;
    reviewedBy: string;
    releaseTo: "pending" | "in_review";
  }): Promise<void>;
};

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapRow(row: Record<string, unknown>): PartnerApplicationRecord {
  return {
    applicationId: String(row.application_id),
    normalizedEmail: String(row.normalized_email),
    displayName: String(row.display_name),
    status: row.status as PartnerApplicationStatus,
    partnerId: row.partner_id ? String(row.partner_id) : null,
    approvalAttemptId: row.approval_attempt_id ? String(row.approval_attempt_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
  };
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.NEXTJS_ENV === "production"
  );
}

async function resolveD1Database(): Promise<D1DatabaseLike | null> {
  if (process.env.SUHUELLA_DEV_OPENNEXT === "0") return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as { LICENSE_DB?: D1DatabaseLike }).LICENSE_DB ?? null;
  } catch {
    return null;
  }
}

class MemoryPartnerApplicationStore implements PartnerApplicationStore {
  readonly kind = "memory" as const;
  private rows = new Map<string, PartnerApplicationRecord>();

  async submitInterest(input: {
    email: string;
    displayName: string;
  }): Promise<PartnerApplicationRecord> {
    const normalizedEmail = normalizeEmail(input.email);
    const displayName = input.displayName.trim();
    const now = new Date().toISOString();
    const existing = [...this.rows.values()].find(
      (item) => item.normalizedEmail === normalizedEmail,
    );
    if (existing?.status === "rejected") {
      throw new PartnerApplicationError(
        "This application was rejected. Contact SuHuella to reopen it.",
        "application_rejected",
        409,
      );
    }
    if (existing) {
      if (existing.status === "pending" || existing.status === "in_review") {
        existing.displayName = displayName;
        existing.updatedAt = now;
        return structuredClone(existing);
      }
      return structuredClone(existing);
    }
    const record: PartnerApplicationRecord = {
      applicationId: createId("ptr_app"),
      normalizedEmail,
      displayName,
      status: "pending",
      partnerId: null,
      approvalAttemptId: null,
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    };
    this.rows.set(record.applicationId, record);
    return structuredClone(record);
  }

  async findByEmail(email: string): Promise<PartnerApplicationRecord | null> {
    const normalizedEmail = normalizeEmail(email);
    const row = [...this.rows.values()].find((item) => item.normalizedEmail === normalizedEmail);
    return row ? structuredClone(row) : null;
  }

  async findById(applicationId: string): Promise<PartnerApplicationRecord | null> {
    const row = this.rows.get(applicationId);
    return row ? structuredClone(row) : null;
  }

  async list(): Promise<PartnerApplicationRecord[]> {
    return [...this.rows.values()]
      .map((item) => structuredClone(item))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async setStatus(input: {
    applicationId: string;
    status: PartnerApplicationStatus;
    reviewedBy: string | null;
    rejectionReason?: string | null;
  }): Promise<PartnerApplicationRecord> {
    const row = this.rows.get(input.applicationId);
    if (!row) throw new PartnerApplicationError("Application not found.", "not_found", 404);
    if (row.status === "rejected" && input.status !== "rejected") {
      throw new PartnerApplicationError(
        "Rejected applications cannot change status without an explicit reopen policy.",
        "application_rejected",
        409,
      );
    }
    const now = new Date().toISOString();
    row.status = input.status;
    row.updatedAt = now;
    row.reviewedBy = input.reviewedBy;
    row.reviewedAt = input.reviewedBy ? now : row.reviewedAt;
    row.rejectionReason =
      input.rejectionReason === undefined ? row.rejectionReason : input.rejectionReason;
    return structuredClone(row);
  }

  async recordPaidPartnerLink(input: {
    email: string;
    partnerId: string;
  }): Promise<PartnerApplicationRecord | null> {
    const normalizedEmail = normalizeEmail(input.email);
    const row = [...this.rows.values()].find((item) => item.normalizedEmail === normalizedEmail);
    if (!row) return null;
    if (row.status === "approved" && row.partnerId && row.partnerId !== input.partnerId) {
      return structuredClone(row);
    }
    const now = new Date().toISOString();
    row.status = "approved";
    row.partnerId = input.partnerId;
    row.updatedAt = now;
    row.reviewedAt = now;
    row.reviewedBy = "stripe_reconciliation";
    return structuredClone(row);
  }

  async claimForApproval(input: {
    applicationId: string;
    reviewedBy: string;
    approvalAttemptId: string;
  }): Promise<PartnerApplicationRecord | null> {
    const row = this.rows.get(input.applicationId);
    if (!row) return null;
    if (row.status === "approved" && row.partnerId) return structuredClone(row);
    if (row.status === "approving" && row.approvalAttemptId === input.approvalAttemptId) {
      return structuredClone(row);
    }
    if (row.status !== "pending" && row.status !== "in_review") return null;
    const now = new Date().toISOString();
    row.status = "approving";
    row.approvalAttemptId = input.approvalAttemptId;
    row.reviewedBy = input.reviewedBy;
    row.updatedAt = now;
    return structuredClone(row);
  }

  async completeApproval(input: {
    applicationId: string;
    partnerId: string;
    approvalAttemptId: string;
    reviewedBy: string;
  }): Promise<PartnerApplicationRecord> {
    const row = this.rows.get(input.applicationId);
    if (!row) throw new PartnerApplicationError("Application not found.", "not_found", 404);
    const now = new Date().toISOString();
    row.status = "approved";
    row.partnerId = input.partnerId;
    row.approvalAttemptId = input.approvalAttemptId;
    row.reviewedBy = input.reviewedBy;
    row.reviewedAt = now;
    row.updatedAt = now;
    return structuredClone(row);
  }

  async releaseApprovalClaim(input: {
    applicationId: string;
    approvalAttemptId: string;
    reviewedBy: string;
    releaseTo: "pending" | "in_review";
  }): Promise<void> {
    const row = this.rows.get(input.applicationId);
    if (!row) return;
    if (row.approvalAttemptId !== input.approvalAttemptId) return;
    if (row.status !== "approving") return;
    row.status = input.releaseTo;
    row.updatedAt = new Date().toISOString();
    row.reviewedBy = input.reviewedBy;
  }
}

function createD1PartnerApplicationStore(db: D1DatabaseLike): PartnerApplicationStore {
  return {
    kind: "d1",
    async submitInterest(input) {
      const normalizedEmail = normalizeEmail(input.email);
      const displayName = input.displayName.trim();
      const now = new Date().toISOString();
      const existing = await this.findByEmail(normalizedEmail);
      if (existing?.status === "rejected") {
        throw new PartnerApplicationError(
          "This application was rejected. Contact SuHuella to reopen it.",
          "application_rejected",
          409,
        );
      }
      if (existing) {
        if (existing.status === "pending" || existing.status === "in_review") {
          await db
            .prepare(
              `UPDATE partner_application
               SET display_name = ?, updated_at = ?
               WHERE application_id = ? AND status IN ('pending', 'in_review')`,
            )
            .bind(displayName, now, existing.applicationId)
            .run();
          return (await this.findById(existing.applicationId)) ?? existing;
        }
        return existing;
      }
      const record: PartnerApplicationRecord = {
        applicationId: createId("ptr_app"),
        normalizedEmail,
        displayName,
        status: "pending",
        partnerId: null,
        approvalAttemptId: null,
        createdAt: now,
        updatedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      };
      await db
        .prepare(
          `INSERT INTO partner_application
           (application_id, normalized_email, display_name, status, partner_id, approval_attempt_id,
            created_at, updated_at, reviewed_at, reviewed_by, rejection_reason)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, NULL, NULL, NULL)`,
        )
        .bind(
          record.applicationId,
          record.normalizedEmail,
          record.displayName,
          record.status,
          record.createdAt,
          record.updatedAt,
        )
        .run();
      return record;
    },
    async findByEmail(email) {
      const row = await db
        .prepare(`SELECT * FROM partner_application WHERE normalized_email = ? LIMIT 1`)
        .bind(normalizeEmail(email))
        .first<Record<string, unknown>>();
      return row ? mapRow(row) : null;
    },
    async findById(applicationId) {
      const row = await db
        .prepare(`SELECT * FROM partner_application WHERE application_id = ? LIMIT 1`)
        .bind(applicationId)
        .first<Record<string, unknown>>();
      return row ? mapRow(row) : null;
    },
    async list() {
      const result = await db
        .prepare(`SELECT * FROM partner_application ORDER BY created_at DESC`)
        .bind()
        .all<Record<string, unknown>>();
      return ((result.results as Record<string, unknown>[]) ?? []).map(mapRow);
    },
    async setStatus(input) {
      const existing = await this.findById(input.applicationId);
      if (!existing) {
        throw new PartnerApplicationError("Application not found.", "not_found", 404);
      }
      if (existing.status === "rejected" && input.status !== "rejected") {
        throw new PartnerApplicationError(
          "Rejected applications cannot change status without an explicit reopen policy.",
          "application_rejected",
          409,
        );
      }
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_application
           SET status = ?, updated_at = ?, reviewed_by = ?, reviewed_at = COALESCE(reviewed_at, ?),
               rejection_reason = ?
           WHERE application_id = ?`,
        )
        .bind(
          input.status,
          now,
          input.reviewedBy,
          input.reviewedBy ? now : null,
          input.rejectionReason ?? existing.rejectionReason,
          input.applicationId,
        )
        .run();
      return (await this.findById(input.applicationId))!;
    },
    async recordPaidPartnerLink(input) {
      const existing = await this.findByEmail(input.email);
      if (!existing) return null;
      if (
        existing.status === "approved" &&
        existing.partnerId &&
        existing.partnerId !== input.partnerId
      ) {
        return existing;
      }
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_application
           SET status = 'approved', partner_id = ?, updated_at = ?, reviewed_at = ?, reviewed_by = 'stripe_reconciliation'
           WHERE normalized_email = ?`,
        )
        .bind(input.partnerId, now, now, normalizeEmail(input.email))
        .run();
      return this.findByEmail(input.email);
    },
    async claimForApproval(input) {
      const existing = await this.findById(input.applicationId);
      if (!existing) return null;
      if (existing.status === "approved" && existing.partnerId) return existing;
      if (
        existing.status === "approving" &&
        existing.approvalAttemptId === input.approvalAttemptId
      ) {
        return existing;
      }
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_application
           SET status = 'approving', approval_attempt_id = ?, reviewed_by = ?, updated_at = ?
           WHERE application_id = ?
             AND status IN ('pending', 'in_review')`,
        )
        .bind(input.approvalAttemptId, input.reviewedBy, now, input.applicationId)
        .run();
      const updated = await this.findById(input.applicationId);
      if (
        !updated ||
        updated.status !== "approving" ||
        updated.approvalAttemptId !== input.approvalAttemptId
      ) {
        return null;
      }
      return updated;
    },
    async completeApproval(input) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_application
           SET status = 'approved', partner_id = ?, approval_attempt_id = ?,
               reviewed_by = ?, reviewed_at = ?, updated_at = ?
           WHERE application_id = ?
             AND (status = 'approving' OR status = 'approved')
             AND (approval_attempt_id = ? OR approval_attempt_id IS NULL)`,
        )
        .bind(
          input.partnerId,
          input.approvalAttemptId,
          input.reviewedBy,
          now,
          now,
          input.applicationId,
          input.approvalAttemptId,
        )
        .run();
      const row = await this.findById(input.applicationId);
      if (!row || row.status !== "approved") {
        throw new PartnerApplicationError("Could not finalize application approval.", "conflict", 409);
      }
      return row;
    },
    async releaseApprovalClaim(input) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_application
           SET status = ?, updated_at = ?, reviewed_by = ?
           WHERE application_id = ? AND status = 'approving' AND approval_attempt_id = ?`,
        )
        .bind(
          input.releaseTo,
          now,
          input.reviewedBy,
          input.applicationId,
          input.approvalAttemptId,
        )
        .run();
    },
  };
}

class UnavailablePartnerApplicationStore implements PartnerApplicationStore {
  readonly kind = "d1" as const;

  private unavailable(): never {
    throw new PartnerApplicationStoreUnavailableError();
  }

  submitInterest(): Promise<PartnerApplicationRecord> {
    return Promise.reject(this.unavailable());
  }
  findByEmail(): Promise<PartnerApplicationRecord | null> {
    return Promise.reject(this.unavailable());
  }
  findById(): Promise<PartnerApplicationRecord | null> {
    return Promise.reject(this.unavailable());
  }
  list(): Promise<PartnerApplicationRecord[]> {
    return Promise.reject(this.unavailable());
  }
  setStatus(): Promise<PartnerApplicationRecord> {
    return Promise.reject(this.unavailable());
  }
  recordPaidPartnerLink(): Promise<PartnerApplicationRecord | null> {
    return Promise.reject(this.unavailable());
  }
  claimForApproval(): Promise<PartnerApplicationRecord | null> {
    return Promise.reject(this.unavailable());
  }
  completeApproval(): Promise<PartnerApplicationRecord> {
    return Promise.reject(this.unavailable());
  }
  releaseApprovalClaim(): Promise<void> {
    return Promise.reject(this.unavailable());
  }
}

let storePromise: Promise<PartnerApplicationStore> | null = null;
let overrideStore: PartnerApplicationStore | null = null;

export function createMemoryPartnerApplicationStore(): PartnerApplicationStore {
  return new MemoryPartnerApplicationStore();
}

export function setPartnerApplicationStoreForTests(store: PartnerApplicationStore | null): void {
  overrideStore = store;
  storePromise = store ? Promise.resolve(store) : null;
}

export function resetPartnerApplicationStoreForTests(): void {
  const memory = new MemoryPartnerApplicationStore();
  overrideStore = memory;
  storePromise = Promise.resolve(memory);
}

/** Test hook: bind a raw D1/SQLite adapter (local wrangler D1). */
export function createPartnerApplicationStoreFromDatabase(
  db: D1DatabaseLike,
): PartnerApplicationStore {
  return createD1PartnerApplicationStore(db);
}

async function createStore(): Promise<PartnerApplicationStore> {
  if (overrideStore) return overrideStore;
  const d1 = await resolveD1Database();
  if (d1) {
    try {
      return createD1PartnerApplicationStore(d1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/no such table/i.test(message)) {
        throw new PartnerApplicationStoreUnavailableError(
          "partner_application table missing. Apply migration 0009_partner_application.sql.",
        );
      }
      throw error;
    }
  }
  if (isProductionRuntime()) return new UnavailablePartnerApplicationStore();
  return new MemoryPartnerApplicationStore();
}

export async function getPartnerApplicationStore(): Promise<PartnerApplicationStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export async function productionPartnerApplicationPersistenceReady(): Promise<boolean> {
  if (!isProductionRuntime()) return true;
  try {
    const store = await getPartnerApplicationStore();
    if (store.kind !== "d1") return false;
    await store.list();
    return true;
  } catch {
    return false;
  }
}

export async function submitPartnerApplication(input: {
  email: string;
  displayName: string;
}): Promise<PartnerApplicationRecord> {
  const store = await getPartnerApplicationStore();
  return store.submitInterest(input);
}

export async function findPartnerApplication(
  email: string,
): Promise<PartnerApplicationRecord | null> {
  const store = await getPartnerApplicationStore();
  return store.findByEmail(email);
}

export async function listPartnerApplications(): Promise<PartnerApplicationRecord[]> {
  const store = await getPartnerApplicationStore();
  return store.list();
}
