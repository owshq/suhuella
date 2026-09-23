import { normalizeEmail } from "../license-context.ts";
import {
  readLicensePersistence,
  withLicensePersistence,
} from "../license-persistence/store.ts";
import type {
  CheckoutGenerationBinding,
  CheckoutReconciliationPending,
  CheckoutReconciliationPendingReason,
  CommercialGenerationId,
  CommercialGenerationPriceBinding,
  CommercialGenerationRecord,
  LicenseAcquisitionKind,
  LicenseAcquisitionRecord,
} from "./types.ts";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function readCommercialGenerationRegistry(): Promise<CommercialGenerationRecord[]> {
  const document = await readLicensePersistence();
  return document.commercialGenerations ?? [];
}

export async function readCommercialGenerationPriceMap(): Promise<CommercialGenerationPriceBinding[]> {
  const document = await readLicensePersistence();
  return document.commercialGenerationPrices ?? [];
}

export async function findCheckoutGenerationBinding(
  checkoutSessionId: string,
): Promise<CheckoutGenerationBinding | null> {
  const id = checkoutSessionId.trim();
  if (!id) return null;
  const document = await readLicensePersistence();
  return (document.checkoutGenerationBindings ?? []).find((row) => row.checkoutSessionId === id) ?? null;
}

export async function recordCheckoutGenerationBinding(input: {
  checkoutSessionId: string;
  commercialGenerationId: CommercialGenerationId | null;
  priceId: string;
  plan: string;
  boundAt?: string;
  versionModelActiveAtBind?: boolean;
}): Promise<void> {
  const checkoutSessionId = input.checkoutSessionId.trim();
  if (!checkoutSessionId) return;
  const boundAt = input.boundAt ?? new Date().toISOString();

  await withLicensePersistence((document) => {
    if (!document.checkoutGenerationBindings) document.checkoutGenerationBindings = [];
    const existing = document.checkoutGenerationBindings.find(
      (row) => row.checkoutSessionId === checkoutSessionId,
    );
    if (existing) return;
    document.checkoutGenerationBindings.push({
      checkoutSessionId,
      commercialGenerationId: input.commercialGenerationId,
      priceId: input.priceId.trim(),
      plan: input.plan.trim(),
      boundAt,
      versionModelActiveAtBind: input.versionModelActiveAtBind === true,
    });
  });
}

export async function recordCheckoutReconciliationPending(input: {
  checkoutSessionId: string;
  email: string;
  priceId: string;
  plan: string;
  reason: CheckoutReconciliationPendingReason;
  stripeEventId?: string | null;
}): Promise<CheckoutReconciliationPending | null> {
  const checkoutSessionId = input.checkoutSessionId.trim();
  const normalizedEmail = normalizeEmail(input.email);
  if (!checkoutSessionId || !normalizedEmail.includes("@")) return null;

  let created: CheckoutReconciliationPending | null = null;
  await withLicensePersistence((document) => {
    if (!document.checkoutReconciliationPending) document.checkoutReconciliationPending = [];
    const existing = document.checkoutReconciliationPending.find(
      (row) => row.checkoutSessionId === checkoutSessionId,
    );
    if (existing) {
      created = existing;
      return;
    }
    created = {
      id: createId("recon"),
      checkoutSessionId,
      normalizedEmail,
      priceId: input.priceId.trim(),
      plan: input.plan.trim(),
      reason: input.reason,
      stripeEventId: input.stripeEventId?.trim() || null,
      recordedAt: new Date().toISOString(),
      status: "open",
    };
    document.checkoutReconciliationPending.push(created);
  });
  return created;
}

export async function findCheckoutReconciliationPending(
  checkoutSessionId: string,
): Promise<CheckoutReconciliationPending | null> {
  const id = checkoutSessionId.trim();
  if (!id) return null;
  const document = await readLicensePersistence();
  return (
    (document.checkoutReconciliationPending ?? []).find((row) => row.checkoutSessionId === id) ??
    null
  );
}

export async function listOpenCheckoutReconciliationPending(): Promise<CheckoutReconciliationPending[]> {
  const document = await readLicensePersistence();
  return (document.checkoutReconciliationPending ?? []).filter((row) => row.status === "open");
}

export async function listLicenseAcquisitions(licenseId: string): Promise<LicenseAcquisitionRecord[]> {
  const id = licenseId.trim();
  if (!id) return [];
  const document = await readLicensePersistence();
  return (document.licenseAcquisitions ?? []).filter((row) => row.licenseId === id);
}

export async function recordLicenseAcquisition(input: {
  licenseId: string;
  email: string;
  kind: LicenseAcquisitionKind;
  commercialGenerationId: CommercialGenerationId | null;
  checkoutSessionId?: string | null;
  stripeEventId?: string | null;
  edition: LicenseAcquisitionRecord["edition"];
  acquiredAt?: string;
}): Promise<LicenseAcquisitionRecord | null> {
  const licenseId = input.licenseId.trim();
  const normalizedEmail = normalizeEmail(input.email);
  const checkoutSessionId = input.checkoutSessionId?.trim() || null;
  const kind = input.kind;
  if (!licenseId || !normalizedEmail.includes("@")) return null;

  let created: LicenseAcquisitionRecord | null = null;
  await withLicensePersistence((document) => {
    if (!document.licenseAcquisitions) document.licenseAcquisitions = [];
    if (checkoutSessionId) {
      const duplicate = document.licenseAcquisitions.find(
        (row) => row.checkoutSessionId === checkoutSessionId && row.kind === kind,
      );
      if (duplicate) {
        created = duplicate;
        return;
      }
    }
    if (input.stripeEventId) {
      const duplicateEvent = document.licenseAcquisitions.find(
        (row) => row.stripeEventId === input.stripeEventId && row.kind === kind,
      );
      if (duplicateEvent) {
        created = duplicateEvent;
        return;
      }
    }
    created = {
      id: createId("lacq"),
      licenseId,
      normalizedEmail,
      kind,
      commercialGenerationId: input.commercialGenerationId,
      checkoutSessionId,
      stripeEventId: input.stripeEventId?.trim() || null,
      edition: input.edition,
      acquiredAt: input.acquiredAt ?? new Date().toISOString(),
    };
    document.licenseAcquisitions.push(created);
  });
  return created;
}

/** Version ids recorded in append-only acquisition history. */
export function acquiredCommercialGenerationIdsFromHistory(
  acquisitions: LicenseAcquisitionRecord[],
): string[] {
  const ids = new Set<string>();
  for (const row of acquisitions) {
    if (row.commercialGenerationId?.trim()) ids.add(row.commercialGenerationId.trim());
  }
  return [...ids];
}

/** Original grant version plus every acquired upgrade — matches generation-rights union. */
export function cumulativeCommercialGenerationIds(input: {
  grantCommercialGenerationId?: string | null;
  acquisitions: LicenseAcquisitionRecord[];
}): string[] {
  const ids = new Set<string>();
  if (input.grantCommercialGenerationId?.trim()) {
    ids.add(input.grantCommercialGenerationId.trim());
  }
  for (const id of acquiredCommercialGenerationIdsFromHistory(input.acquisitions)) {
    ids.add(id);
  }
  return [...ids];
}

export async function seedCommercialGenerationRegistryForTests(
  rows: CommercialGenerationRecord[],
  priceMap: CommercialGenerationPriceBinding[] = [],
): Promise<void> {
  await withLicensePersistence((document) => {
    document.commercialGenerations = rows;
    document.commercialGenerationPrices = priceMap;
  });
}
