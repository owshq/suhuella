import type { LicenseActivation, LicenseGrant } from "./license-context.ts";
import { normalizeEmail } from "./license-context.ts";
import { normalizeLicenseGrant, parseLicenseGrant } from "./license-entitlement.ts";
import { readLicensePersistence, withLicensePersistence } from "./license-persistence/store.ts";

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Development / test seed only. Ignored in production. Never overrides a durable grant. */
export function listEnvLicenseGrants(): LicenseGrant[] {
  if (isProductionRuntime()) return [];
  const raw = process.env.LICENSE_GRANTS?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseLicenseGrant).filter((item): item is LicenseGrant => item !== null);
  } catch {
    return [];
  }
}

export async function listDurableGrants(): Promise<LicenseGrant[]> {
  const document = await readLicensePersistence();
  return document.grants.map((grant) => normalizeLicenseGrant(grant));
}

export async function listLicenseGrants(): Promise<LicenseGrant[]> {
  const durable = await listDurableGrants();
  if (isProductionRuntime()) return durable;
  const envGrants = listEnvLicenseGrants().filter(
    (grant) => !durable.some((item) => item.licenseId === grant.licenseId),
  );
  return [...durable, ...envGrants];
}

export async function listGrantsForAdmin(): Promise<LicenseGrant[]> {
  return listLicenseGrants();
}

/** @deprecated Use listDurableGrants. Kept name for callers during the store cutover. */
export async function listStoredLicenseGrants(): Promise<LicenseGrant[]> {
  return listDurableGrants();
}

export async function findGrantByEmail(email: string): Promise<LicenseGrant | undefined> {
  const normalized = normalizeEmail(email);
  return (await listLicenseGrants()).find((grant) => grant.email === normalized);
}

export async function findGrantByLicenseId(licenseId: string): Promise<LicenseGrant | undefined> {
  return (await listLicenseGrants()).find((grant) => grant.licenseId === licenseId);
}

export async function findGrantByStripeCustomerId(
  customerId: string,
): Promise<LicenseGrant | undefined> {
  const id = customerId.trim();
  if (!id) return undefined;
  return (await listDurableGrants()).find(
    (grant) =>
      grant.customerId === id ||
      grant.paymentReference === id ||
      grant.subscriptionId === id,
  );
}

export async function upsertStoredGrant(grant: LicenseGrant): Promise<LicenseGrant> {
  const next = normalizeLicenseGrant(grant);
  await withLicensePersistence((document) => {
    const index = document.grants.findIndex((item) => item.licenseId === next.licenseId);
    if (index === -1) document.grants.push(next);
    else document.grants[index] = next;
  });
  return next;
}

export async function revokeGrant(
  licenseId: string,
  input: { revokedBy?: string; revocationReason?: string },
): Promise<LicenseGrant | undefined> {
  const existing = await findGrantByLicenseId(licenseId);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  return upsertStoredGrant({
    ...existing,
    status: "revoked",
    revokedAt: now,
    revokedBy: input.revokedBy,
    revocationReason: input.revocationReason,
    updatedAt: now,
  });
}

export async function listActivations(licenseId: string): Promise<LicenseActivation[]> {
  const document = await readLicensePersistence();
  return document.activations.filter((item) => item.licenseId === licenseId);
}

export async function findActivation(
  licenseId: string,
  deviceId: string,
): Promise<LicenseActivation | undefined> {
  const items = await listActivations(licenseId);
  return items.find((item) => item.deviceId === deviceId);
}

export async function upsertActivation(activation: LicenseActivation): Promise<LicenseActivation> {
  await withLicensePersistence((document) => {
    const index = document.activations.findIndex(
      (item) => item.licenseId === activation.licenseId && item.deviceId === activation.deviceId,
    );
    if (index === -1) document.activations.push(activation);
    else document.activations[index] = activation;
  });
  return activation;
}

export async function revokeActivation(licenseId: string, deviceId: string): Promise<boolean> {
  const existing = await findActivation(licenseId, deviceId);
  if (!existing || existing.status !== "active") return false;
  await upsertActivation({
    ...existing,
    status: "revoked",
    lastSeen: new Date().toISOString(),
  });
  return true;
}

export async function activeDeviceCount(licenseId: string): Promise<number> {
  const items = await listActivations(licenseId);
  return items.filter((item) => item.status === "active").length;
}

export async function resetActivations(licenseId: string): Promise<number> {
  const active = (await listActivations(licenseId)).filter((item) => item.status === "active");
  const lastSeen = new Date().toISOString();
  for (const item of active) {
    await upsertActivation({ ...item, status: "revoked", lastSeen });
  }
  return active.length;
}

export async function listAllActivations(): Promise<LicenseActivation[]> {
  const document = await readLicensePersistence();
  return [...document.activations];
}

export async function findActivationByDevice(
  deviceId: string,
): Promise<LicenseActivation | undefined> {
  const document = await readLicensePersistence();
  return document.activations.find((item) => item.deviceId === deviceId);
}

export async function renameActivation(deviceId: string, deviceName: string): Promise<boolean> {
  const document = await readLicensePersistence();
  const existing = document.activations.find((item) => item.deviceId === deviceId);
  if (!existing) return false;
  await upsertActivation({ ...existing, deviceName });
  return true;
}
