/**
 * Partner self-service session after onboarding accept.
 * partner_id / role are always re-checked against the store — never trusted from the client alone.
 */
import { hmacBase64Url } from "../license-context.ts";
import { getPartnerStore } from "./store.ts";
import type { PartnerActor, PartnerMemberRole } from "./types.ts";

export const PARTNER_SESSION_COOKIE = "suhuella_partner_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PartnerSessionPayload = {
  v: 1;
  email: string;
  partnerId: string;
  role: PartnerMemberRole;
  exp: number;
};

function textToBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToText(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(`${padded}${pad}`);
}

function signingSecret(): string {
  return process.env.PARTNER_SESSION_SECRET?.trim() || "";
}

export async function signPartnerSession(
  input: Omit<PartnerSessionPayload, "v" | "exp"> & { exp?: number },
): Promise<string> {
  const secret = signingSecret();
  if (!secret) throw new Error("PARTNER_SESSION_SECRET is not configured");
  const payload: PartnerSessionPayload = {
    v: 1,
    email: input.email.trim().toLowerCase(),
    partnerId: input.partnerId,
    role: input.role,
    exp: input.exp ?? Date.now() + SESSION_TTL_MS,
  };
  const body = textToBase64Url(JSON.stringify(payload));
  return `${body}.${await hmacBase64Url(body, secret)}`;
}

export async function readPartnerSessionToken(
  token: string,
): Promise<PartnerSessionPayload | null> {
  const secret = signingSecret();
  if (!secret || !token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacBase64Url(body, secret);
  if (expected !== signature) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(body)) as PartnerSessionPayload;
    if (parsed.v !== 1 || !parsed.email || !parsed.partnerId || !parsed.role) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (parsed.role !== "partner_admin" && parsed.role !== "partner_member") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Re-validate membership on every request so revoked/suspended members lose access
 * even if the cookie is still signed.
 */
export async function resolvePartnerActorFromSessionToken(
  token: string,
): Promise<PartnerActor | null> {
  const payload = await readPartnerSessionToken(token);
  if (!payload) return null;
  const store = await getPartnerStore();
  const doc = await store.read();
  const partner = doc.partners.find((item) => item.partnerId === payload.partnerId);
  if (!partner || partner.status === "revoked" || partner.status === "suspended") {
    return null;
  }
  const member = doc.members.find(
    (item) =>
      item.partnerId === payload.partnerId &&
      item.email === payload.email &&
      item.status === "active",
  );
  if (!member) return null;
  return {
    kind: "partner",
    email: member.email,
    partnerId: member.partnerId,
    role: member.role,
  };
}

export function partnerSessionCookieHeader(token: string, maxAgeSeconds = SESSION_TTL_MS / 1000): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.CF_PAGES === "1" ? "; Secure" : "";
  return `${PARTNER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}${secure}`;
}

export function clearPartnerSessionCookieHeader(): string {
  return `${PARTNER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function partnerSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${PARTNER_SESSION_COOKIE}=`)) {
      return part.slice(PARTNER_SESSION_COOKIE.length + 1) || null;
    }
  }
  return null;
}

export type PublicPartnerSession = {
  email: string;
  role: PartnerMemberRole;
  partnerDisplayName: string;
  brandId: string;
  displayName: string;
  logoUrl: string | null;
  accent: string | null;
};
