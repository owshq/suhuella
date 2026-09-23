export type LicenseEdition =
  | "free"
  | "personal_lifetime"
  | "personal_monthly"
  | "business"
  | "enterprise";

export type LicenseStatus = "active" | "expired" | "revoked";

export type LicenseChannel = "stable" | "beta";

/**
 * Commercial generation access on a grant. Distinct from app semver, edition, and status.
 * `legacy_unassigned` — predates generation model or checkout had no server binding.
 */
export type GenerationAccessMode =
  | "legacy_unassigned"
  | "purchased_generation"
  | "active_subscription"
  | "version_binding_required";

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
  /** Optional until enforcement. Omitted on legacy signed tokens. */
  commercialGenerationId?: string | null;
  /** Initial purchase + upgrade targets. Server-signed cumulative version set. */
  acquiredCommercialGenerationIds?: string[];
  generationAccessMode?: GenerationAccessMode;
  /** Signed at issuance. Executor authority — not Worker env or renderer flags. */
  generationEnforcementActive?: boolean;
  /** Registry revision at sign time. Audit only when capabilities are signed. */
  policyRevision?: string | null;
  /** Absent on pre-006 tokens. */
  signedContractVersion?: number;
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
  /** Who sold the license. Missing means Platform. Not a presentation brand. */
  issuedByOperator?: string;
  /** Presentation brands that may use this grant. Missing means SuHuella only. */
  acceptedBrands?: string[];
  /** Brand shown at purchase. Analytics only. Not license authority. */
  presentationBrandAtPurchase?: string;
  /** Lifetime: generation purchased. Null when legacy or subscription-only. */
  commercialGenerationId?: string | null;
  generationAccessMode?: GenerationAccessMode;
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
  /** Algorithm the client presented at last check, or issued token on first activate (2B metric). */
  lastPresentedTokenAlgorithm?: "ed25519" | "legacy-hmac-sha256" | "unknown";
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

export const PERSONAL_LIFETIME_DEVICE_LIMIT = 1;
export const PERSONAL_MONTHLY_DEVICE_LIMIT = 3;
export const BUSINESS_DEFAULT_DEVICE_LIMIT = 3;
export const MAX_DEVICE_LIMIT_PER_SEAT = 10;

export function deviceLimitForEdition(
  edition: LicenseEdition,
  override?: number,
): number {
  if (edition === "free" || edition === "personal_lifetime") {
    // Ignore stored overrides so old lifetime grants with device_limit=3 stay single-device.
    return PERSONAL_LIFETIME_DEVICE_LIMIT;
  }
  if (edition === "personal_monthly") {
    return PERSONAL_MONTHLY_DEVICE_LIMIT;
  }
  if (edition === "business" || edition === "enterprise") {
    if (typeof override === "number" && override > 0) {
      return Math.min(override, MAX_DEVICE_LIMIT_PER_SEAT);
    }
    return BUSINESS_DEFAULT_DEVICE_LIMIT;
  }
  return PERSONAL_LIFETIME_DEVICE_LIMIT;
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

export { validateSignedLicensePayload } from "@suhuella/product/lib/signed-license-contract.ts";

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

/** @deprecated Legacy HMAC helper — new tokens use Ed25519 via license-token-signing.ts */
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
): Promise<string> {
  const { signLicenseTokenBody, textToBase64Url: encodeBody } = await import(
    "./license-token-signing.ts"
  );
  const body = encodeBody(canonicalize(unsignedLicensePayload(context)));
  return signLicenseTokenBody(body);
}

export async function readSignedLicenseToken(
  licenseToken: string,
): Promise<Omit<LicenseContext, "licenseToken"> | null> {
  const { verifyLicenseTokenSignature } = await import("./license-token-signing.ts");
  const verified = await verifyLicenseTokenSignature(licenseToken);
  if (!verified.ok) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(verified.body)) as Omit<LicenseContext, "licenseToken">;
    if (!parsed.licenseId || !parsed.edition || !parsed.email) return null;
    const { validateSignedLicensePayload } = await import(
      "@suhuella/product/lib/signed-license-contract.ts"
    );
    const validation = validateSignedLicensePayload(parsed);
    if (!validation.ok) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function buildSignedLicenseContext(
  input: Omit<
    LicenseContext,
    "licenseToken" | "capabilities" | "enabledKnowledgeSources" | "signedContractVersion"
  > & {
    capabilities?: string[];
    enabledKnowledgeSources?: string[];
    signedContractVersion?: number;
  },
): Promise<LicenseContext> {
  const { SIGNED_LICENSE_CONTRACT_VERSION } = await import(
    "@suhuella/product/lib/signed-license-contract.ts"
  );
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
      ...(input.commercialGenerationId !== undefined
        ? { commercialGenerationId: input.commercialGenerationId }
        : {}),
      ...(input.generationAccessMode !== undefined
        ? { generationAccessMode: input.generationAccessMode }
        : {}),
      ...(input.acquiredCommercialGenerationIds && input.acquiredCommercialGenerationIds.length > 0
        ? { acquiredCommercialGenerationIds: input.acquiredCommercialGenerationIds }
        : {}),
      signedContractVersion: input.signedContractVersion ?? SIGNED_LICENSE_CONTRACT_VERSION,
      ...(input.generationEnforcementActive !== undefined
        ? { generationEnforcementActive: input.generationEnforcementActive }
        : {}),
      ...(input.policyRevision !== undefined ? { policyRevision: input.policyRevision } : {}),
    });
  return {
    ...unsigned,
    licenseToken: await signLicenseContext(unsigned),
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
