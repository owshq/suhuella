import {
  readLicensePersistence,
  withLicensePersistence,
} from "../license-persistence/store.ts";
import type { LifetimeUpgradeIntent, LifetimeUpgradeIntentStatus } from "./types.ts";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const ACTIVE_STATUSES: LifetimeUpgradeIntentStatus[] = [
  "pending",
  "checkout_created",
  "paid_pending_fulfillment",
];

export function upgradeIntentIdempotencyKey(licenseId: string, targetGenerationId: string): string {
  return `${licenseId.trim()}:${targetGenerationId.trim()}`;
}

export async function findLifetimeUpgradeIntentById(
  intentId: string,
): Promise<LifetimeUpgradeIntent | null> {
  const id = intentId.trim();
  if (!id) return null;
  const document = await readLicensePersistence();
  return (document.lifetimeUpgradeIntents ?? []).find((row) => row.id === id) ?? null;
}

export async function findLifetimeUpgradeIntentBySessionId(
  checkoutSessionId: string,
): Promise<LifetimeUpgradeIntent | null> {
  const id = checkoutSessionId.trim();
  if (!id) return null;
  const document = await readLicensePersistence();
  return (
    (document.lifetimeUpgradeIntents ?? []).find((row) => row.checkoutSessionId === id) ?? null
  );
}

export async function findActiveLifetimeUpgradeIntent(input: {
  licenseId: string;
  targetGenerationId: string;
}): Promise<LifetimeUpgradeIntent | null> {
  const key = upgradeIntentIdempotencyKey(input.licenseId, input.targetGenerationId);
  const document = await readLicensePersistence();
  return (
    (document.lifetimeUpgradeIntents ?? []).find(
      (row) => row.idempotencyKey === key && ACTIVE_STATUSES.includes(row.status),
    ) ?? null
  );
}

export async function createOrReuseLifetimeUpgradeIntent(input: {
  licenseId: string;
  normalizedEmail: string;
  sourceGenerationId: string;
  targetGenerationId: string;
}): Promise<{ intent: LifetimeUpgradeIntent; reused: boolean }> {
  const idempotencyKey = upgradeIntentIdempotencyKey(input.licenseId, input.targetGenerationId);
  let created: LifetimeUpgradeIntent | null = null;
  let reused = false;

  await withLicensePersistence((document) => {
    if (!document.lifetimeUpgradeIntents) document.lifetimeUpgradeIntents = [];
    const existing = document.lifetimeUpgradeIntents.find(
      (row) => row.idempotencyKey === idempotencyKey && ACTIVE_STATUSES.includes(row.status),
    );
    if (existing) {
      created = existing;
      reused = true;
      return;
    }
    const now = new Date().toISOString();
    created = {
      id: createId("lui"),
      licenseId: input.licenseId.trim(),
      normalizedEmail: input.normalizedEmail.trim(),
      sourceGenerationId: input.sourceGenerationId.trim(),
      targetGenerationId: input.targetGenerationId.trim(),
      checkoutSessionId: null,
      idempotencyKey,
      status: "pending",
      incidentNote: null,
      createdAt: now,
      updatedAt: now,
    };
    document.lifetimeUpgradeIntents.push(created);
  });

  if (!created) throw new Error("lifetime_upgrade_intent_create_failed");
  return { intent: created, reused };
}

export async function attachCheckoutSessionToUpgradeIntent(input: {
  intentId: string;
  checkoutSessionId: string;
}): Promise<LifetimeUpgradeIntent | null> {
  const intentId = input.intentId.trim();
  const checkoutSessionId = input.checkoutSessionId.trim();
  if (!intentId || !checkoutSessionId) return null;

  let updated: LifetimeUpgradeIntent | null = null;
  await withLicensePersistence((document) => {
    const row = (document.lifetimeUpgradeIntents ?? []).find((item) => item.id === intentId);
    if (!row) return;
    if (row.checkoutSessionId && row.checkoutSessionId !== checkoutSessionId) return;
    row.checkoutSessionId = checkoutSessionId;
    row.status = "checkout_created";
    row.updatedAt = new Date().toISOString();
    updated = { ...row };
  });
  return updated;
}

export async function updateLifetimeUpgradeIntentStatus(input: {
  intentId: string;
  status: LifetimeUpgradeIntentStatus;
  incidentNote?: string | null;
}): Promise<LifetimeUpgradeIntent | null> {
  let updated: LifetimeUpgradeIntent | null = null;
  await withLicensePersistence((document) => {
    const row = (document.lifetimeUpgradeIntents ?? []).find((item) => item.id === input.intentId);
    if (!row) return;
    row.status = input.status;
    if (input.incidentNote !== undefined) row.incidentNote = input.incidentNote;
    row.updatedAt = new Date().toISOString();
    updated = { ...row };
  });
  return updated;
}
