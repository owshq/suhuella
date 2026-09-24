import {
  getLicensePersistenceStore,
  readLicensePersistence,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import { rememberStripeEvent } from "./checkout-reconciliation.ts";

export type StripeEventProcessingDecision =
  | { action: "process" }
  | { action: "duplicate" }
  | { action: "busy" };

const DEFAULT_LEASE_MS = 5 * 60 * 1000;

const memoryHandlers = new Map<
  string,
  {
    handler: string;
    status: "processing" | "completed" | "retryable";
    leaseExpiresAt: string | null;
    lastError: string | null;
    updatedAt: string;
  }
>();

function nowIso(): string {
  return new Date().toISOString();
}

function leaseExpired(leaseExpiresAt: string | null): boolean {
  if (!leaseExpiresAt) return true;
  return Date.parse(leaseExpiresAt) <= Date.now();
}

function memoryBegin(
  eventId: string,
  handler: string,
  leaseMs: number,
): StripeEventProcessingDecision {
  const existing = memoryHandlers.get(eventId);
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  if (!existing) {
    memoryHandlers.set(eventId, {
      handler,
      status: "processing",
      leaseExpiresAt,
      lastError: null,
      updatedAt: nowIso(),
    });
    return { action: "process" };
  }
  if (existing.status === "completed") return { action: "duplicate" };
  if (existing.status === "processing" && !leaseExpired(existing.leaseExpiresAt)) {
    return { action: "busy" };
  }
  memoryHandlers.set(eventId, {
    handler,
    status: "processing",
    leaseExpiresAt,
    lastError: null,
    updatedAt: nowIso(),
  });
  return { action: "process" };
}

async function memoryComplete(eventId: string): Promise<void> {
  const row = memoryHandlers.get(eventId);
  if (!row) return;
  memoryHandlers.set(eventId, {
    ...row,
    status: "completed",
    leaseExpiresAt: null,
    updatedAt: nowIso(),
  });
  await rememberStripeEvent(eventId);
}

async function memoryFail(eventId: string, error: string): Promise<void> {
  const row = memoryHandlers.get(eventId);
  if (!row) return;
  memoryHandlers.set(eventId, {
    ...row,
    status: "retryable",
    leaseExpiresAt: null,
    lastError: error.slice(0, 500),
    updatedAt: nowIso(),
  });
}

export function resetStripeEventProcessingForTests(): void {
  memoryHandlers.clear();
}

export async function isStripeEventHandlerReady(): Promise<boolean> {
  const store = await getLicensePersistenceStore();
  if (store.isStripeEventHandlerReady) return store.isStripeEventHandlerReady();
  return store.kind === "memory" || store.kind === "file";
}

/**
 * Acquire a processing lease. Completed events are duplicates; active leases return busy.
 * Expired or retryable leases may be reclaimed.
 */
export async function beginStripeEventProcessing(
  eventId: string,
  handler: string,
  options: { leaseMs?: number } = {},
): Promise<StripeEventProcessingDecision> {
  const id = eventId.trim();
  if (!id) return { action: "busy" };
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const store = await getLicensePersistenceStore();
  if (store.beginStripeEventHandler) {
    return store.beginStripeEventHandler(id, handler, leaseMs);
  }
  return memoryBegin(id, handler, leaseMs);
}

/** Mark durable success and record receipt for legacy duplicate checks. */
export async function completeStripeEventProcessing(eventId: string): Promise<void> {
  const id = eventId.trim();
  if (!id) return;
  const store = await getLicensePersistenceStore();
  if (store.completeStripeEventHandler) {
    await store.completeStripeEventHandler(id);
    return;
  }
  await memoryComplete(id);
}

/** Release lease for Stripe retry without marking completed. */
export async function failStripeEventProcessing(eventId: string, error: string): Promise<void> {
  const id = eventId.trim();
  if (!id) return;
  const store = await getLicensePersistenceStore();
  if (store.failStripeEventHandler) {
    await store.failStripeEventHandler(id, error);
    return;
  }
  await memoryFail(id, error);
}

/** Legacy completed check — prefer beginStripeEventProcessing for new handlers. */
export async function stripeEventProcessingCompleted(eventId: string): Promise<boolean> {
  const id = eventId.trim();
  if (!id) return false;
  const store = await getLicensePersistenceStore();
  if (store.readStripeEventHandlerStatus) {
    const status = await store.readStripeEventHandlerStatus(id);
    return status === "completed";
  }
  const memory = memoryHandlers.get(id);
  if (memory?.status === "completed") return true;
  const document = await readLicensePersistence();
  return document.stripeEvents.some((event) => event.id === id);
}

export async function withStripeEventProcessing<T>(
  eventId: string,
  handler: string,
  fn: () => Promise<T>,
  options?: { leaseMs?: number },
): Promise<
  | { ok: true; value: T; duplicate?: boolean }
  | { ok: false; error: "busy" | "server_error" }
> {
  const begun = await beginStripeEventProcessing(eventId, handler, options);
  if (begun.action === "duplicate") return { ok: true, value: undefined as T, duplicate: true };
  if (begun.action === "busy") return { ok: false, error: "busy" };
  try {
    const value = await fn();
    await completeStripeEventProcessing(eventId);
    return { ok: true, value };
  } catch (error) {
    await failStripeEventProcessing(eventId, error instanceof Error ? error.message : String(error));
    return { ok: false, error: "server_error" };
  }
}
