import { brand } from "@suhuella/brand";
import { productCopy } from '../../lib/product-copy'
import {
  clearLegacyBrowserComputerName,
  getBrowserComputerName,
  persistBrowserComputerName,
  readLegacyBrowserComputerName,
  upgradeGenericDeviceName,
} from "../../lib/device-identity";
import type { LicenseApiError, LicenseContext } from "./types";
import type {
  BusinessOrganisationAction,
  BusinessOrganisationResult,
} from "../../types";
import { idbGet, idbSet, STORE } from "./idb";

const DEVICE_KEY = "device";
const LICENSE_KEY = "license";
const APP_VERSION = brand.release.version;

type StoredDevice = {
  deviceId: string;
  deviceName: string;
};

type LicenseActionResult =
  | { ok: true; license: LicenseContext }
  | { ok: false; error: LicenseApiError; license: LicenseContext | null };

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDevice(): Promise<StoredDevice> {
  const existing = await idbGet<StoredDevice>(STORE.meta, DEVICE_KEY);
  if (existing?.deviceId) {
    const upgradedName = upgradeGenericDeviceName(existing.deviceName);
    if (upgradedName !== existing.deviceName) {
      const next = { ...existing, deviceName: upgradedName };
      await idbSet(STORE.meta, DEVICE_KEY, next);
      persistBrowserComputerName(upgradedName);
      return next;
    }
    return existing;
  }
  const legacyName = readLegacyBrowserComputerName();
  const deviceName = legacyName ?? getBrowserComputerName();
  const device: StoredDevice = {
    deviceId: createId(),
    deviceName,
  };
  persistBrowserComputerName(deviceName);
  clearLegacyBrowserComputerName();
  await idbSet(STORE.meta, DEVICE_KEY, device);
  return device;
}

export async function renameDevice(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return (await getDevice()).deviceName;
  const existing = await getDevice();
  const next = { ...existing, deviceName: trimmed };
  persistBrowserComputerName(trimmed);
  await idbSet(STORE.meta, DEVICE_KEY, next);
  return trimmed;
}

export async function loadLicense(): Promise<LicenseContext | null> {
  return (await idbGet<LicenseContext>(STORE.meta, LICENSE_KEY)) ?? null;
}

export async function saveLicense(license: LicenseContext): Promise<void> {
  await idbSet(STORE.meta, LICENSE_KEY, license);
}

export async function clearLicense(): Promise<void> {
  await idbSet(STORE.meta, LICENSE_KEY, null);
}

export function editionLabel(edition: LicenseContext["edition"]): string {
  if (edition === "personal_lifetime") return "Personal Lifetime";
  if (edition === "personal_monthly") return "Personal Monthly";
  if (edition === "business") return "Business";
  if (edition === "enterprise") return "Enterprise";
  return "Free";
}

export function licenseErrorMessage(error: LicenseApiError): string {
  if (error === "unknown_email" || error === "no_license") return "No active license was found for this email.";
  if (error === "device_limit") {
    return "This Personal license allows 1 device. Deactivate another computer, then activate this one.";
  }
  if (error === "payment_incomplete") return "Payment was not completed.";
  if (error === "revoked") return "This complimentary license is no longer active.";
  if (error === "expired") return "This subscription is no longer active.";
  if (error === "not_activated") return "This device is not on your license.";
  if (error === "service_unavailable") {
    return "Some online functions are temporarily unavailable. Your local files are unaffected.";
  }
  if (error === "offline") return productCopy("SuHuella can keep working offline for a limited time.");
  return "We could not update your license. Try again later.";
}

function errorFromStatus(status: number): LicenseApiError {
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  if (status >= 500) return "server_error";
  return "offline";
}

function isTransientLicenseError(error: LicenseApiError): boolean {
  return error === "offline" || error === "server_error" || error === "service_unavailable" || error === "rate_limited";
}

let lastSeenOffline = false;

export function browserLicenseWasOffline(): boolean {
  return lastSeenOffline;
}

async function postLicense(pathName: string, body: Record<string, string>): Promise<LicenseActionResult> {
  const current = await loadLicense();
  try {
    const response = await fetch(pathName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let data: { ok: true; license: LicenseContext } | { ok: false; error?: LicenseApiError };
    try {
      data = (await response.json()) as typeof data;
    } catch {
      return { ok: false, error: errorFromStatus(response.status), license: current };
    }
    if (!data || typeof data !== "object") {
      return { ok: false, error: errorFromStatus(response.status), license: current };
    }
    if (!data.ok) {
      return { ok: false, error: data.error ?? errorFromStatus(response.status), license: current };
    }
    await saveLicense(data.license);
    lastSeenOffline = false;
    return { ok: true, license: data.license };
  } catch {
    return { ok: false, error: "offline", license: current };
  }
}

async function postJson<T extends { ok: boolean }>(
  pathName: string,
  body: Record<string, string>,
): Promise<T | { ok: false; error: LicenseApiError }> {
  try {
    const response = await fetch(pathName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    try {
      const data = (await response.json()) as T | { ok: false; error: LicenseApiError };
      if (!data || typeof data !== "object") return { ok: false, error: errorFromStatus(response.status) };
      if (!data.ok && !("error" in data)) return { ok: false, error: errorFromStatus(response.status) };
      return data;
    } catch {
      return { ok: false, error: errorFromStatus(response.status) };
    }
  } catch {
    return { ok: false, error: "offline" };
  }
}

export async function createCheckoutAttempt(
  plan: string,
): Promise<{ ok: true; activationAttemptId: string } | { ok: false; error: LicenseApiError }> {
  const device = await getDevice();
  const result = await postJson<{ ok: true; activationAttemptId?: string }>(
    "/api/license/checkout-attempt",
    { deviceId: device.deviceId, plan },
  );
  if (!result.ok) return result;
  if (!result.activationAttemptId) return { ok: false, error: "server_error" };
  return { ok: true, activationAttemptId: result.activationAttemptId };
}

export async function requestLicenseEmailCode(
  email: string,
): Promise<{ ok: true; challengeId: string; message: string } | { ok: false; error: LicenseApiError }> {
  const device = await getDevice();
  const result = await postJson<{ ok: true; challengeId?: string; message?: string }>(
    "/api/license/email-code/request",
    { email: email.trim(), purpose: "LICENSE_ACTIVATION", deviceId: device.deviceId },
  );
  if (!result.ok) return result;
  if (!result.challengeId) return { ok: false, error: "server_error" };
  return { ok: true, challengeId: result.challengeId, message: result.message ?? "" };
}

export async function verifyLicenseEmailCode(
  challengeId: string,
  code: string,
): Promise<{ ok: true; proofId: string } | { ok: false; error: LicenseApiError }> {
  const result = await postJson<{ ok: true; proofId?: string }>("/api/license/email-code/verify", {
    challengeId: challengeId.trim(),
    code: code.trim(),
  });
  if (!result.ok) return result;
  if (!result.proofId) return { ok: false, error: "server_error" };
  return { ok: true, proofId: result.proofId };
}

export async function activateFromCheckout(
  sessionId: string,
  activationAttemptId?: string,
): Promise<LicenseActionResult> {
  const device = await getDevice();
  return postLicense("/api/license/activate-from-checkout", {
    sessionId: sessionId.trim(),
    ...(activationAttemptId?.trim() ? { activationAttemptId: activationAttemptId.trim() } : {}),
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: "web",
    appVersion: APP_VERSION,
  });
}

export async function updateBusinessBranding(dataUrl: string | null): Promise<LicenseActionResult> {
  const current = await loadLicense();
  if (!current || current.edition !== "business" || !current.organisationId || !current.email) {
    return { ok: false, error: "invalid_request", license: current };
  }
  try {
    const response = await fetch("/api/business/branding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisationId: current.organisationId,
        email: current.email,
        dataUrl,
      }),
    });
    const data = (await response.json()) as { ok: boolean };
    if (!data.ok) return { ok: false, error: "invalid_request", license: current };
    return checkLicense();
  } catch {
    return { ok: false, error: "offline", license: current };
  }
}

async function postOrganisation(body: Record<string, string | number>): Promise<BusinessOrganisationResult> {
  const current = await loadLicense();
  const device = await getDevice();
  if (!current || (current.edition !== "business" && current.edition !== "enterprise")) {
    return { ok: false, error: "forbidden" };
  }
  try {
    const response = await fetch("/api/license/organisation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.deviceId,
        licenseToken: current.licenseToken,
        ...body,
      }),
    });
    const data = (await response.json()) as BusinessOrganisationResult;
    if (!data || typeof data !== "object") return { ok: false, error: "server_error" };
    return data;
  } catch {
    return { ok: false, error: "offline" };
  }
}

export async function getBusinessOrganisation(): Promise<BusinessOrganisationResult> {
  return postOrganisation({});
}

export async function manageBusinessOrganisation(
  action: BusinessOrganisationAction,
  payload: { email?: string; seatId?: string; seatCount?: number } = {},
): Promise<BusinessOrganisationResult> {
  return postOrganisation({
    action,
    email: payload.email ?? "",
    seatId: payload.seatId ?? "",
    ...(payload.seatCount != null ? { seatCount: payload.seatCount } : {}),
  });
}

export async function activateLicense(emailProofId: string): Promise<LicenseActionResult> {
  const device = await getDevice();
  return postLicense("/api/license/activate", {
    emailProofId: emailProofId.trim(),
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: "web",
    appVersion: APP_VERSION,
  });
}

export async function checkLicense(): Promise<LicenseActionResult> {
  const current = await loadLicense();
  if (!current || current.edition === "free") {
    lastSeenOffline = false;
    return { ok: true, license: current ?? freeLicense() };
  }
  const device = await getDevice();
  const result = await postLicense("/api/license/check", {
    deviceId: device.deviceId,
    licenseToken: current.licenseToken,
    deviceName: device.deviceName,
  });
  if (!result.ok && isTransientLicenseError(result.error) && current) {
    lastSeenOffline = true;
    return { ok: true, license: current };
  }
  return result;
}

export async function deactivateLicense(): Promise<LicenseActionResult> {
  const current = await loadLicense();
  const device = await getDevice();
  const result = await postLicense("/api/license/deactivate", {
    deviceId: device.deviceId,
    licenseToken: current?.licenseToken ?? "",
  });
  await clearLicense();
  return result.ok ? { ok: true, license: freeLicense() } : { ...result, license: freeLicense() };
}

export function freeLicense(): LicenseContext {
  const now = new Date().toISOString();
  return {
    licenseId: "free",
    customerId: "",
    email: "",
    edition: "free",
    status: "active",
    capabilities: ["recommend_folder", "explain_recommendation", "refresh_index"],
    enabledKnowledgeSources: ["local_folder"],
    deviceLimit: 1,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil: now,
    channel: "stable",
    licenseToken: "",
  };
}
