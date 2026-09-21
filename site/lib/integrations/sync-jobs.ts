/**
 * Resumable cloud sync jobs.
 * One HTTP request never walks an entire Drive — only enqueues / advances one page.
 * Future: CF Queue consumer on suhuella-sync. Today: D1-backed job + processSyncJobPage.
 */

import { getOAuthProviderImpl } from "./oauth-providers.ts";
import { loadConnectionTokens, refreshConnectionTokens } from "./tokens.ts";
import { getCloudIntegrationsStore, type CloudSyncJobRecord } from "./store.ts";
import type { CloudSyncProgress } from "./types.ts";

const MAX_CONCURRENT_PER_CONNECTION = 1;
const PAGE_FILE_BUDGET = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function newJobId(): string {
  return `csync_${crypto.randomUUID().replace(/-/g, "")}`;
}

function backoffMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

export async function enqueueSyncJob(input: {
  connectionId: string;
  brandId: string;
}): Promise<string> {
  const store = await getCloudIntegrationsStore();
  const existing = await store.listSyncJobsForConnection(input.connectionId);
  const active = existing.filter((j) =>
    j.status === "queued" || j.status === "running" || j.status === "waiting_backoff",
  );
  if (active.length >= MAX_CONCURRENT_PER_CONNECTION) {
    return active[0]!.id;
  }

  const createdAt = nowIso();
  const id = newJobId();
  await store.putSyncJob({
    id,
    connectionId: input.connectionId,
    brandId: input.brandId,
    status: "queued",
    cursorJson: null,
    checkpointJson: JSON.stringify({ page: 0 }),
    attemptCount: 0,
    maxAttempts: 8,
    nextAttemptAt: createdAt,
    cancelRequested: 0,
    progressFiles: 0,
    progressBytes: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: null,
  });
  return id;
}

export async function requestSyncCancel(jobId: string): Promise<boolean> {
  const store = await getCloudIntegrationsStore();
  const job = await store.getSyncJob(jobId);
  if (!job) return false;
  await store.updateSyncJob({
    ...job,
    cancelRequested: 1,
    updatedAt: nowIso(),
  });
  return true;
}

export async function getLatestSyncProgress(connectionId: string): Promise<CloudSyncProgress | null> {
  const store = await getCloudIntegrationsStore();
  const jobs = await store.listSyncJobsForConnection(connectionId);
  const job = jobs[0];
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status as CloudSyncProgress["status"],
    progressFiles: job.progressFiles,
    progressBytes: job.progressBytes,
    lastErrorCode: job.lastErrorCode,
    lastErrorMessage: job.lastErrorMessage,
    updatedAt: job.updatedAt,
  };
}

/**
 * Advance a single page. Call from a queue consumer / cron — never from a long user HTTP request
 * that expects the whole library.
 */
export async function processSyncJobPage(jobId: string): Promise<CloudSyncJobRecord> {
  const store = await getCloudIntegrationsStore();
  const job = await store.getSyncJob(jobId);
  if (!job) throw new Error("job_not_found");

  if (job.cancelRequested) {
    const cancelled = {
      ...job,
      status: "cancelled",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await store.updateSyncJob(cancelled);
    return cancelled;
  }

  const connection = await store.getConnection(job.connectionId);
  if (!connection) {
    const failed = {
      ...job,
      status: "failed",
      lastErrorCode: "connection_missing",
      lastErrorMessage: "Connection was removed.",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await store.updateSyncJob(failed);
    return failed;
  }

  let tokens = await loadConnectionTokens(job.connectionId);
  if (!tokens) {
    const failed = {
      ...job,
      status: "failed",
      lastErrorCode: "credentials_missing",
      lastErrorMessage: "Reconnect this account.",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await store.updateSyncJob(failed);
    return failed;
  }

  if (tokens.expiresAt && Date.parse(tokens.expiresAt) < Date.now() + 60_000) {
    const refreshed = await refreshConnectionTokens(job.connectionId);
    if (!refreshed.ok) {
      const failed = {
        ...job,
        status: "failed",
        lastErrorCode: refreshed.error,
        lastErrorMessage: "Permissions expired. Reconnect this account.",
        finishedAt: nowIso(),
        updatedAt: nowIso(),
      };
      await store.updateSyncJob(failed);
      return failed;
    }
    tokens = refreshed.tokens;
  }

  const impl = getOAuthProviderImpl(connection.provider);
  if (!impl.listPage) {
    const done = {
      ...job,
      status: "completed",
      finishedAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: job.startedAt ?? nowIso(),
    };
    await store.updateSyncJob(done);
    return done;
  }

  const cursor =
    job.cursorJson && job.cursorJson !== "null" ? (JSON.parse(job.cursorJson) as string | null) : null;

  try {
    const page = await impl.listPage(tokens.accessToken, cursor);
    const addedBytes = page.files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    const progressFiles = job.progressFiles + Math.min(page.files.length, PAGE_FILE_BUDGET);
    const progressBytes = job.progressBytes + addedBytes;
    const checkpoint = {
      page: (((JSON.parse(job.checkpointJson ?? "{}") as { page?: number }).page ?? 0) + 1),
      lastFileId: page.files.at(-1)?.id ?? null,
    };

    if (!page.nextCursor) {
      const completed = {
        ...job,
        status: "completed",
        cursorJson: null,
        checkpointJson: JSON.stringify(checkpoint),
        progressFiles,
        progressBytes,
        startedAt: job.startedAt ?? nowIso(),
        finishedAt: nowIso(),
        updatedAt: nowIso(),
        lastErrorCode: null,
        lastErrorMessage: null,
      };
      await store.updateSyncJob(completed);
      await store.updateConnection({
        ...connection,
        lastSyncAt: nowIso(),
        updatedAt: nowIso(),
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      return completed;
    }

    const continued = {
      ...job,
      status: "queued",
      cursorJson: JSON.stringify(page.nextCursor),
      checkpointJson: JSON.stringify(checkpoint),
      progressFiles,
      progressBytes,
      startedAt: job.startedAt ?? nowIso(),
      updatedAt: nowIso(),
      attemptCount: 0,
      nextAttemptAt: nowIso(),
    };
    await store.updateSyncJob(continued);
    return continued;
  } catch (error) {
    const attemptCount = job.attemptCount + 1;
    const message = error instanceof Error ? error.message : "sync_failed";
    if (attemptCount >= job.maxAttempts) {
      const failed = {
        ...job,
        status: "failed",
        attemptCount,
        lastErrorCode: message,
        lastErrorMessage: "Sync stopped after repeated failures. Try reconnecting.",
        finishedAt: nowIso(),
        updatedAt: nowIso(),
      };
      await store.updateSyncJob(failed);
      return failed;
    }
    const waiting = {
      ...job,
      status: "waiting_backoff",
      attemptCount,
      nextAttemptAt: new Date(Date.now() + backoffMs(attemptCount)).toISOString(),
      lastErrorCode: message,
      lastErrorMessage: "Temporary provider error. Retrying…",
      updatedAt: nowIso(),
      startedAt: job.startedAt ?? nowIso(),
    };
    await store.updateSyncJob(waiting);
    return waiting;
  }
}

/** Idempotent webhook intake — duplicate receipt_id is a no-op. */
export async function acceptWebhookReceipt(input: {
  receiptId: string;
  provider: string;
  connectionId?: string;
}): Promise<{ accepted: boolean; duplicate: boolean }> {
  const store = await getCloudIntegrationsStore();
  const inserted = await store.putWebhookReceipt({
    receiptId: input.receiptId,
    provider: input.provider,
    connectionId: input.connectionId ?? null,
    processedAt: nowIso(),
  });
  return { accepted: inserted, duplicate: !inserted };
}
