/**
 * Limited applicant identity after email verification.
 * This cookie is not a partner membership and cannot open the admin portal.
 */
import { hmacBase64Url } from "../license-context.ts";

export const PARTNER_APPLICANT_COOKIE = "suhuella_partner_applicant";
const TTL_MS = 60 * 60 * 1000;

type ApplicantPayload = {
  v: 1;
  email: string;
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

export async function signPartnerApplicantSession(email: string): Promise<string> {
  const secret = signingSecret();
  if (!secret) throw new Error("PARTNER_SESSION_SECRET is not configured");
  const payload: ApplicantPayload = {
    v: 1,
    email: email.trim().toLowerCase(),
    exp: Date.now() + TTL_MS,
  };
  const body = textToBase64Url(JSON.stringify(payload));
  return `${body}.${await hmacBase64Url(body, secret)}`;
}

export async function readPartnerApplicantSession(token: string): Promise<{ email: string } | null> {
  const secret = signingSecret();
  if (!secret || !token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmacBase64Url(body, secret);
  if (expected !== signature) return null;
  try {
    const parsed = JSON.parse(base64UrlToText(body)) as ApplicantPayload;
    if (parsed.v !== 1 || !parsed.email || parsed.exp < Date.now()) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

export function partnerApplicantCookieHeader(token: string): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.CF_PAGES === "1" ? "; Secure" : "";
  return `${PARTNER_APPLICANT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(TTL_MS / 1000)}${secure}`;
}

export function partnerApplicantTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";").map((item) => item.trim())) {
    if (part.startsWith(`${PARTNER_APPLICANT_COOKIE}=`)) {
      return part.slice(PARTNER_APPLICANT_COOKIE.length + 1) || null;
    }
  }
  return null;
}
