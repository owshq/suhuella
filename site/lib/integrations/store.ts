import type { CloudOwnerKind, CloudProviderId } from "./types.ts";

export type OAuthPendingRecord = {
  state: string;
  provider: CloudProviderId;
  brandId: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  codeVerifier: string;
  redirectUri: string;
  returnPath: string;
  nonce: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

export type CloudConnectionRecord = {
  id: string;
  brandId: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  provider: CloudProviderId;
  accountExternalId: string | null;
  accountEmail: string | null;
  accountDisplayName: string | null;
  status: string;
  scopesJson: string;
  tokenExpiresAt: string | null;
  revokedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudCredentialRecord = {
  connectionId: string;
  encryptionVersion: number;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  keyId: string;
  createdAt: string;
  rotatedAt: string | null;
};

export type CloudSyncJobRecord = {
  id: string;
  connectionId: string;
  brandId: string;
  status: string;
  cursorJson: string | null;
  checkpointJson: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  cancelRequested: number;
  progressFiles: number;
  progressBytes: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type CloudWebhookReceiptRecord = {
  receiptId: string;
  provider: string;
  connectionId: string | null;
  processedAt: string;
};

export interface CloudIntegrationsStore {
  readonly kind: "memory" | "d1";
  putPending(record: OAuthPendingRecord): Promise<void>;
  getPending(state: string): Promise<OAuthPendingRecord | null>;
  consumePending(state: string, consumedAt: string): Promise<OAuthPendingRecord | null>;
  putConnection(record: CloudConnectionRecord): Promise<void>;
  getConnection(id: string): Promise<CloudConnectionRecord | null>;
  listConnections(input: {
    brandId: string;
    ownerKind: CloudOwnerKind;
    ownerId: string;
  }): Promise<CloudConnectionRecord[]>;
  updateConnection(record: CloudConnectionRecord): Promise<void>;
  deleteConnection(id: string): Promise<void>;
  putCredential(record: CloudCredentialRecord): Promise<void>;
  getCredential(connectionId: string): Promise<CloudCredentialRecord | null>;
  deleteCredential(connectionId: string): Promise<void>;
  putSyncJob(record: CloudSyncJobRecord): Promise<void>;
  getSyncJob(id: string): Promise<CloudSyncJobRecord | null>;
  listSyncJobsForConnection(connectionId: string): Promise<CloudSyncJobRecord[]>;
  updateSyncJob(record: CloudSyncJobRecord): Promise<void>;
  putWebhookReceipt(record: CloudWebhookReceiptRecord): Promise<boolean>;
}

class MemoryCloudIntegrationsStore implements CloudIntegrationsStore {
  readonly kind = "memory" as const;
  private pending = new Map<string, OAuthPendingRecord>();
  private connections = new Map<string, CloudConnectionRecord>();
  private credentials = new Map<string, CloudCredentialRecord>();
  private jobs = new Map<string, CloudSyncJobRecord>();
  private receipts = new Map<string, CloudWebhookReceiptRecord>();

  async putPending(record: OAuthPendingRecord): Promise<void> {
    this.pending.set(record.state, { ...record });
  }

  async getPending(state: string): Promise<OAuthPendingRecord | null> {
    const row = this.pending.get(state);
    return row ? { ...row } : null;
  }

  async consumePending(state: string, consumedAt: string): Promise<OAuthPendingRecord | null> {
    const row = this.pending.get(state);
    if (!row || row.consumedAt) return null;
    const next = { ...row, consumedAt };
    this.pending.set(state, next);
    return { ...next };
  }

  async putConnection(record: CloudConnectionRecord): Promise<void> {
    this.connections.set(record.id, { ...record });
  }

  async getConnection(id: string): Promise<CloudConnectionRecord | null> {
    const row = this.connections.get(id);
    return row ? { ...row } : null;
  }

  async listConnections(input: {
    brandId: string;
    ownerKind: CloudOwnerKind;
    ownerId: string;
  }): Promise<CloudConnectionRecord[]> {
    return [...this.connections.values()]
      .filter(
        (row) =>
          row.brandId === input.brandId &&
          row.ownerKind === input.ownerKind &&
          row.ownerId === input.ownerId &&
          row.status !== "disconnected",
      )
      .map((row) => ({ ...row }));
  }

  async updateConnection(record: CloudConnectionRecord): Promise<void> {
    this.connections.set(record.id, { ...record });
  }

  async deleteConnection(id: string): Promise<void> {
    this.connections.delete(id);
    this.credentials.delete(id);
    for (const [jobId, job] of this.jobs) {
      if (job.connectionId === id) this.jobs.delete(jobId);
    }
  }

  async putCredential(record: CloudCredentialRecord): Promise<void> {
    this.credentials.set(record.connectionId, {
      ...record,
      ciphertext: new Uint8Array(record.ciphertext),
      iv: new Uint8Array(record.iv),
    });
  }

  async getCredential(connectionId: string): Promise<CloudCredentialRecord | null> {
    const row = this.credentials.get(connectionId);
    if (!row) return null;
    return {
      ...row,
      ciphertext: new Uint8Array(row.ciphertext),
      iv: new Uint8Array(row.iv),
    };
  }

  async deleteCredential(connectionId: string): Promise<void> {
    this.credentials.delete(connectionId);
  }

  async putSyncJob(record: CloudSyncJobRecord): Promise<void> {
    this.jobs.set(record.id, { ...record });
  }

  async getSyncJob(id: string): Promise<CloudSyncJobRecord | null> {
    const row = this.jobs.get(id);
    return row ? { ...row } : null;
  }

  async listSyncJobsForConnection(connectionId: string): Promise<CloudSyncJobRecord[]> {
    return [...this.jobs.values()]
      .filter((row) => row.connectionId === connectionId)
      .map((row) => ({ ...row }));
  }

  async updateSyncJob(record: CloudSyncJobRecord): Promise<void> {
    this.jobs.set(record.id, { ...record });
  }

  /** Returns true if inserted (first time), false if duplicate. */
  async putWebhookReceipt(record: CloudWebhookReceiptRecord): Promise<boolean> {
    if (this.receipts.has(record.receiptId)) return false;
    this.receipts.set(record.receiptId, { ...record });
    return true;
  }
}

function createD1Store(db: any): CloudIntegrationsStore {
  return {
    kind: "d1",
    async putPending(record) {
      await db
        .prepare(
          `INSERT INTO cloud_oauth_pending
            (state, provider, brand_id, owner_kind, owner_id, code_verifier, redirect_uri, return_path, nonce, expires_at, consumed_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.state,
          record.provider,
          record.brandId,
          record.ownerKind,
          record.ownerId,
          record.codeVerifier,
          record.redirectUri,
          record.returnPath,
          record.nonce,
          record.expiresAt,
          record.consumedAt,
          record.createdAt,
        )
        .run();
    },
    async getPending(state) {
      const row = await db
        .prepare(`SELECT * FROM cloud_oauth_pending WHERE state = ?`)
        .bind(state)
        .first();
      return row ? mapPending(row) : null;
    },
    async consumePending(state, consumedAt) {
      const existing = await db
        .prepare(`SELECT * FROM cloud_oauth_pending WHERE state = ?`)
        .bind(state)
        .first();
      if (!existing || existing.consumed_at) return null;
      await db
        .prepare(`UPDATE cloud_oauth_pending SET consumed_at = ? WHERE state = ? AND consumed_at IS NULL`)
        .bind(consumedAt, state)
        .run();
      const row = await db
        .prepare(`SELECT * FROM cloud_oauth_pending WHERE state = ?`)
        .bind(state)
        .first();
      return row ? mapPending(row) : null;
    },
    async putConnection(record) {
      await db
        .prepare(
          `INSERT INTO cloud_connection
            (id, brand_id, owner_kind, owner_id, provider, account_external_id, account_email, account_display_name,
             status, scopes_json, token_expires_at, revoked_at, last_error_code, last_error_message, last_sync_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.id,
          record.brandId,
          record.ownerKind,
          record.ownerId,
          record.provider,
          record.accountExternalId,
          record.accountEmail,
          record.accountDisplayName,
          record.status,
          record.scopesJson,
          record.tokenExpiresAt,
          record.revokedAt,
          record.lastErrorCode,
          record.lastErrorMessage,
          record.lastSyncAt,
          record.createdAt,
          record.updatedAt,
        )
        .run();
    },
    async getConnection(id) {
      const row = await db.prepare(`SELECT * FROM cloud_connection WHERE id = ?`).bind(id).first();
      return row ? mapConnection(row) : null;
    },
    async listConnections(input) {
      const rows = await db
        .prepare(
          `SELECT * FROM cloud_connection
           WHERE brand_id = ? AND owner_kind = ? AND owner_id = ? AND status != 'disconnected'`,
        )
        .bind(input.brandId, input.ownerKind, input.ownerId)
        .all();
      return (rows.results ?? []).map(mapConnection);
    },
    async updateConnection(record) {
      await db
        .prepare(
          `UPDATE cloud_connection SET
            account_external_id = ?, account_email = ?, account_display_name = ?, status = ?,
            scopes_json = ?, token_expires_at = ?, revoked_at = ?, last_error_code = ?,
            last_error_message = ?, last_sync_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          record.accountExternalId,
          record.accountEmail,
          record.accountDisplayName,
          record.status,
          record.scopesJson,
          record.tokenExpiresAt,
          record.revokedAt,
          record.lastErrorCode,
          record.lastErrorMessage,
          record.lastSyncAt,
          record.updatedAt,
          record.id,
        )
        .run();
    },
    async deleteConnection(id) {
      await db.batch([
        db.prepare(`DELETE FROM cloud_credential WHERE connection_id = ?`).bind(id),
        db.prepare(`DELETE FROM cloud_sync_job WHERE connection_id = ?`).bind(id),
        db.prepare(`DELETE FROM cloud_webhook_subscription WHERE connection_id = ?`).bind(id),
        db.prepare(`DELETE FROM cloud_connection WHERE id = ?`).bind(id),
      ]);
    },
    async putCredential(record) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO cloud_credential
            (connection_id, encryption_version, ciphertext, iv, key_id, created_at, rotated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.connectionId,
          record.encryptionVersion,
          record.ciphertext,
          record.iv,
          record.keyId,
          record.createdAt,
          record.rotatedAt,
        )
        .run();
    },
    async getCredential(connectionId) {
      const row = await db
        .prepare(`SELECT * FROM cloud_credential WHERE connection_id = ?`)
        .bind(connectionId)
        .first();
      return row ? mapCredential(row) : null;
    },
    async deleteCredential(connectionId) {
      await db.prepare(`DELETE FROM cloud_credential WHERE connection_id = ?`).bind(connectionId).run();
    },
    async putSyncJob(record) {
      await db
        .prepare(
          `INSERT INTO cloud_sync_job
            (id, connection_id, brand_id, status, cursor_json, checkpoint_json, attempt_count, max_attempts,
             next_attempt_at, cancel_requested, progress_files, progress_bytes, last_error_code, last_error_message,
             created_at, updated_at, started_at, finished_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          record.id,
          record.connectionId,
          record.brandId,
          record.status,
          record.cursorJson,
          record.checkpointJson,
          record.attemptCount,
          record.maxAttempts,
          record.nextAttemptAt,
          record.cancelRequested,
          record.progressFiles,
          record.progressBytes,
          record.lastErrorCode,
          record.lastErrorMessage,
          record.createdAt,
          record.updatedAt,
          record.startedAt,
          record.finishedAt,
        )
        .run();
    },
    async getSyncJob(id) {
      const row = await db.prepare(`SELECT * FROM cloud_sync_job WHERE id = ?`).bind(id).first();
      return row ? mapSyncJob(row) : null;
    },
    async listSyncJobsForConnection(connectionId) {
      const rows = await db
        .prepare(`SELECT * FROM cloud_sync_job WHERE connection_id = ? ORDER BY created_at DESC`)
        .bind(connectionId)
        .all();
      return (rows.results ?? []).map(mapSyncJob);
    },
    async updateSyncJob(record) {
      await db
        .prepare(
          `UPDATE cloud_sync_job SET
            status = ?, cursor_json = ?, checkpoint_json = ?, attempt_count = ?, next_attempt_at = ?,
            cancel_requested = ?, progress_files = ?, progress_bytes = ?, last_error_code = ?,
            last_error_message = ?, updated_at = ?, started_at = ?, finished_at = ?
           WHERE id = ?`,
        )
        .bind(
          record.status,
          record.cursorJson,
          record.checkpointJson,
          record.attemptCount,
          record.nextAttemptAt,
          record.cancelRequested,
          record.progressFiles,
          record.progressBytes,
          record.lastErrorCode,
          record.lastErrorMessage,
          record.updatedAt,
          record.startedAt,
          record.finishedAt,
          record.id,
        )
        .run();
    },
    async putWebhookReceipt(record) {
      try {
        await db
          .prepare(
            `INSERT INTO cloud_webhook_receipt (receipt_id, provider, connection_id, processed_at)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(record.receiptId, record.provider, record.connectionId, record.processedAt)
          .run();
        return true;
      } catch {
        return false;
      }
    },
  };
}

function mapPending(row: any): OAuthPendingRecord {
  return {
    state: row.state,
    provider: row.provider,
    brandId: row.brand_id,
    ownerKind: row.owner_kind,
    ownerId: row.owner_id,
    codeVerifier: row.code_verifier,
    redirectUri: row.redirect_uri,
    returnPath: row.return_path,
    nonce: row.nonce,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at ?? null,
    createdAt: row.created_at,
  };
}

function mapConnection(row: any): CloudConnectionRecord {
  return {
    id: row.id,
    brandId: row.brand_id,
    ownerKind: row.owner_kind,
    ownerId: row.owner_id,
    provider: row.provider,
    accountExternalId: row.account_external_id ?? null,
    accountEmail: row.account_email ?? null,
    accountDisplayName: row.account_display_name ?? null,
    status: row.status,
    scopesJson: row.scopes_json,
    tokenExpiresAt: row.token_expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    lastErrorCode: row.last_error_code ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    lastSyncAt: row.last_sync_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCredential(row: any): CloudCredentialRecord {
  return {
    connectionId: row.connection_id,
    encryptionVersion: Number(row.encryption_version),
    ciphertext: row.ciphertext instanceof Uint8Array ? row.ciphertext : new Uint8Array(row.ciphertext),
    iv: row.iv instanceof Uint8Array ? row.iv : new Uint8Array(row.iv),
    keyId: row.key_id,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at ?? null,
  };
}

function mapSyncJob(row: any): CloudSyncJobRecord {
  return {
    id: row.id,
    connectionId: row.connection_id,
    brandId: row.brand_id,
    status: row.status,
    cursorJson: row.cursor_json ?? null,
    checkpointJson: row.checkpoint_json ?? null,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 8),
    nextAttemptAt: row.next_attempt_at ?? null,
    cancelRequested: Number(row.cancel_requested ?? 0),
    progressFiles: Number(row.progress_files ?? 0),
    progressBytes: Number(row.progress_bytes ?? 0),
    lastErrorCode: row.last_error_code ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
  };
}

let storePromise: Promise<CloudIntegrationsStore> | null = null;
let testStore: CloudIntegrationsStore | null = null;

async function resolveD1(): Promise<any | null> {
  if (process.env.SUHUELLA_DEV_OPENNEXT === "0") return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as { LICENSE_DB?: any }).LICENSE_DB ?? null;
  } catch {
    return null;
  }
}

async function createStore(): Promise<CloudIntegrationsStore> {
  if (testStore) return testStore;
  const d1 = await resolveD1();
  if (d1) return createD1Store(d1);
  return new MemoryCloudIntegrationsStore();
}

export function getCloudIntegrationsStore(): Promise<CloudIntegrationsStore> {
  if (!storePromise) storePromise = createStore();
  return storePromise;
}

export function resetCloudIntegrationsStoreForTests(store?: CloudIntegrationsStore): void {
  testStore = store ?? new MemoryCloudIntegrationsStore();
  storePromise = Promise.resolve(testStore);
}

export function clearCloudIntegrationsStoreForTests(): void {
  testStore = null;
  storePromise = null;
}
