export type LicenseEdition =
  | "free"
  | "personal_lifetime"
  | "personal_monthly"
  | "business"
  | "enterprise";

export type LicenseStatus = "active" | "expired" | "revoked";

export type LicenseChannel = "stable" | "beta";

export type LicenseOrigin =
  | "stripe"
  | "gift"
  | "promo"
  | "manual"
  | "internal"
  | "test"
  | "partner"
  | "business"
  | "education"
  | "enterprise"
  | "migration";

/** Sent to Desktop. Never includes origin, Stripe, price, or invoices. */
export type LicenseContext = {
  licenseId: string;
  customerId: string;
  email: string;
  edition: LicenseEdition;
  status: LicenseStatus;
  capabilities: string[];
  enabledKnowledgeSources: string[];
  deviceLimit: number;
  activatedDevices: number;
  organisationId?: string;
  organisationName?: string;
  organisationLogo?: string | null;
  seatId?: string;
  memberRole?: "owner" | "admin" | "member";
  validUntil: string | null;
  lastCheckedAt: string;
  offlineUntil: string;
  channel: LicenseChannel;
  licenseToken: string;
};

export type LicenseGrant = {
  email: string;
  customerId: string;
  licenseId: string;
  edition: LicenseEdition;
  origin: LicenseOrigin;
  status: LicenseStatus;
  deviceLimit?: number;
  validUntil?: string | null;
  currentPeriodEnd?: string | null;
  organisationId?: string;
  organisationName?: string;
  seatId?: string;
  memberRole?: "owner" | "admin" | "member";
  channel?: LicenseChannel;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  subscriptionId?: string | null;
  checkoutSessionId?: string | null;
  invoiceId?: string | null;
  isPaid?: boolean;
  isGifted?: boolean;
  isRevocableByAdmin?: boolean;
  entitlementStatus?:
    | "free_local"
    | "active"
    | "past_due"
    | "grace_period"
    | "canceled_at_period_end"
    | "expired"
    | "refunded"
    | "chargeback"
    | "suspended_seat"
    | "revoked_gift"
    | "invalid";
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
};

export type LicenseActivation = {
  licenseId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  activatedAt: string;
  lastSeen: string;
  status: "active" | "revoked";
};

export type LicenseApiError =
  | "unknown_email"
  | "no_license"
  | "device_limit"
  | "revoked"
  | "not_activated"
  | "expired"
  | "invalid_request"
  | "invalid_proof"
  | "invalid_code"
  | "invalid_attempt"
  | "email_verification_required"
  | "rate_limited"
  | "server_error"
  | "service_unavailable"
  | "payment_incomplete";

const FREE_CAPABILITIES = [
  "recommend_folder",
  "explain_recommendation",
  "navigate_save_dialog",
  "copy_path",
  "open_folder",
  "refresh_index",
] as const;

const PERSONAL_CAPABILITIES = [
  ...FREE_CAPABILITIES,
  "create_folder",
  "rename_file",
  "move_file",
  "apply_bulk_organisation",
] as const;

const LIVE_COLLAB_CAPABILITIES = [...PERSONAL_CAPABILITIES, "save_attachment"] as const;

export function capabilitiesForEdition(edition: LicenseEdition): string[] {
  if (edition === "free") return [...FREE_CAPABILITIES];
  if (edition === "personal_lifetime") return [...PERSONAL_CAPABILITIES];
  if (edition === "business" || edition === "enterprise") {
    return [...LIVE_COLLAB_CAPABILITIES, "business_branding"];
  }
  return [...LIVE_COLLAB_CAPABILITIES];
}

export function knowledgeSourcesForEdition(edition: LicenseEdition): string[] {
  if (edition === "free") return ["local_folder"];
  if (edition === "personal_lifetime") {
    return ["local_folder", "dropbox", "google_drive", "onedrive"];
  }
  return ["local_folder", "dropbox", "google_drive", "onedrive", "gmail", "outlook"];
}

export function deviceLimitForEdition(
  edition: LicenseEdition,
  override?: number,
): number {
  if (typeof override === "number" && override > 0) return override;
  if (edition === "free") return 1;
  if (edition === "business" || edition === "enterprise") return 3;
  return 3;
}

export function isPaidEdition(edition: LicenseEdition): boolean {
  return edition !== "free";
}

export function lifetimeHasNoExpiry(edition: LicenseEdition): boolean {
  return edition === "personal_lifetime";
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

export function unsignedLicensePayload(
  context: Omit<LicenseContext, "licenseToken">,
): Omit<LicenseContext, "licenseToken"> {
  return { ...context };
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToText(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(`${padded}${pad}`);
}

export async function hmacBase64Url(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(signature);
}

export async function signLicenseContext(
  context: Omit<LicenseContext, "licenseToken">,
  secret: string,
): Promise<string> {
  const body = textToBase64Url(canonicalize(unsignedLicensePayload(context)));
  return `${body}.${await hmacBase64Url(body, secret)}`;
}

export async function readSignedLicenseToken(
  licenseToken: string,
  secret: string,
): Promise<Omit<LicenseContext, "licenseToken"> | null> {
  const [body, signature] = licenseToken.split(".");
  if (!body || !signature) return null;
  const expected = await hmacBase64Url(body, secret);
  if (expected !== signature) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(body)) as Omit<LicenseContext, "licenseToken">;
    if (!parsed.licenseId || !parsed.edition || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function buildSignedLicenseContext(
  input: Omit<LicenseContext, "licenseToken" | "capabilities" | "enabledKnowledgeSources"> & {
    capabilities?: string[];
    enabledKnowledgeSources?: string[];
  },
  secret: string,
): Promise<LicenseContext> {
  const unsigned = unsignedLicensePayload({
    licenseId: input.licenseId,
    customerId: input.customerId,
    email: input.email,
    edition: input.edition,
    status: input.status,
    capabilities: input.capabilities ?? capabilitiesForEdition(input.edition),
    enabledKnowledgeSources:
      input.enabledKnowledgeSources ?? knowledgeSourcesForEdition(input.edition),
    deviceLimit: input.deviceLimit,
    activatedDevices: input.activatedDevices,
    organisationId: input.organisationId,
    organisationName: input.organisationName,
    organisationLogo: input.organisationLogo ?? null,
    seatId: input.seatId,
    memberRole: input.memberRole,
    validUntil: input.validUntil,
    lastCheckedAt: input.lastCheckedAt,
    offlineUntil: input.offlineUntil,
    channel: input.channel,
  });
  return {
    ...unsigned,
    licenseToken: await signLicenseContext(unsigned, secret),
  };
}

export function parseLicenseEdition(value: unknown): LicenseEdition | null {
  if (
    value === "free" ||
    value === "personal_lifetime" ||
    value === "personal_monthly" ||
    value === "business" ||
    value === "enterprise"
  ) {
    return value;
  }
  return null;
}

export function parseLicenseOrigin(value: unknown): LicenseOrigin | null {
  if (
    value === "stripe" ||
    value === "gift" ||
    value === "promo" ||
    value === "manual" ||
    value === "internal" ||
    value === "test" ||
    value === "partner" ||
    value === "business" ||
    value === "education" ||
    value === "enterprise" ||
    value === "migration"
  ) {
    return value;
  }
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function offlineUntilFrom(now: Date, validUntil: string | null): string {
  const grace = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (!validUntil) return grace.toISOString();
  const expiry = new Date(validUntil);
  return expiry.getTime() < grace.getTime() ? expiry.toISOString() : grace.toISOString();
}
