function token(bytes = 16): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, bytes);
}

export function createPartnerId(): string {
  return `ptr_${token()}`;
}

export function createPartnerMemberId(): string {
  return `pm_${token()}`;
}

export function createPartnerBrandId(slug: string): string {
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return clean || `brand_${token(8)}`;
}

export function createPartnerDomainId(): string {
  return `pd_${token()}`;
}

export function createPartnerEntitlementId(): string {
  return `pe_${token()}`;
}

export function createPartnerInviteId(): string {
  return `pi_${token()}`;
}

export function createOnboardingToken(): string {
  return `onb_${token(24)}${token(24)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function hashToken(tokenValue: string): Promise<string> {
  const bytes = new TextEncoder().encode(tokenValue);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
