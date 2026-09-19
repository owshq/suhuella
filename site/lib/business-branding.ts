import { normalizeEmail } from "./license-context.ts";
import type { BusinessAccount, BusinessBranding, BusinessError } from "./business-types.ts";

export const BUSINESS_LOGO_MAX_BYTES = 64 * 1024;
export const BUSINESS_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export function canonicalBusinessOwnerEmail(account: BusinessAccount): string {
  return account.ownerEmail ? normalizeEmail(account.ownerEmail) : "";
}

export function canChangeBusinessLogo(account: BusinessAccount, actorEmail: string): boolean {
  if (account.status === "suspended") return false;
  if (
    account.status === "trial" &&
    account.trialEndsAt &&
    Date.parse(account.trialEndsAt) < Date.now()
  ) {
    return false;
  }
  const owner = canonicalBusinessOwnerEmail(account);
  return Boolean(owner) && owner === normalizeEmail(actorEmail);
}

export function effectiveBusinessLogo(
  account: BusinessAccount,
  branding: BusinessBranding | null,
): string | null {
  if (account.status === "suspended") return null;
  return branding?.logoAssetRef ?? null;
}

function sniffImageType(bytes: Uint8Array): (typeof BUSINESS_LOGO_TYPES)[number] | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const raw = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function validateBusinessLogo(input: {
  dataUrl?: string;
  claimedType?: string;
}): { ok: true; logoAssetRef: string } | { ok: false; error: BusinessError } {
  const dataUrl = input.dataUrl?.trim() ?? "";
  if (!dataUrl.startsWith("data:image/")) return { ok: false, error: "invalid_branding_asset" };
  if (dataUrl.includes("image/svg") || dataUrl.includes("svg+xml")) {
    return { ok: false, error: "invalid_branding_asset" };
  }
  const bytes = decodeBase64(dataUrl);
  if (!bytes || bytes.length === 0 || bytes.length > BUSINESS_LOGO_MAX_BYTES) {
    return { ok: false, error: "invalid_branding_asset" };
  }
  const sniffed = sniffImageType(bytes);
  if (!sniffed) return { ok: false, error: "invalid_branding_asset" };
  if (input.claimedType && input.claimedType !== sniffed) {
    return { ok: false, error: "invalid_branding_asset" };
  }
  const raw = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  return { ok: true, logoAssetRef: `data:${sniffed};base64,${raw}` };
}
