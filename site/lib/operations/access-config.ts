import { isValidEmail, normalizeEmail } from "./catalog.ts";

/**
 * Worker secret formats. Invalid values count as missing (production returns 503).
 *
 * SUPERADMIN_EMAILS
 *   Comma-separated emails. Trimmed and lowercased. No scheme, no display name.
 *   `admin@suhuella.com` or `admin@suhuella.com,ops@suhuella.com`
 *
 * CF_ACCESS_TEAM_DOMAIN
 *   Hostname only. No scheme, path, port, or trailing slash.
 *   `<team>.cloudflareaccess.com`
 *
 * CF_ACCESS_AUD
 *   Application Audience (AUD) tag, copied exactly. Case-sensitive.
 *   16–256 characters: letters, digits, `.`, `_`, `~`, `-`. No spaces or URL.
 */
const ACCESS_TEAM_DOMAIN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
const ACCESS_AUDIENCE = /^[A-Za-z0-9][A-Za-z0-9._~-]{15,255}$/;

export type OperationsAccessConfigKey =
  | "SUPERADMIN_EMAILS"
  | "CF_ACCESS_TEAM_DOMAIN"
  | "CF_ACCESS_AUD";

export type OperationsAccessConfigStatus = Record<
  OperationsAccessConfigKey,
  boolean
>;

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function parseSuperadminEmails(raw: string): string[] | null {
  const parts = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const emails = parts.map((value) => normalizeEmail(value));
  if (emails.some((email) => !isValidEmail(email) || /\s/.test(email))) return null;
  return [...new Set(emails)];
}

export function parseAccessTeamDomain(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value !== raw.trim().toLowerCase()) return null;
  if (value.includes("://") || value.includes("/") || value.includes(":")) return null;
  return ACCESS_TEAM_DOMAIN.test(value) ? value : null;
}

export function parseAccessAudience(raw: string): string | null {
  const value = raw.trim();
  if (!value || value !== raw.trim() || /\s/.test(value)) return null;
  return ACCESS_AUDIENCE.test(value) ? value : null;
}

export function getSuperadminEmails(): string[] {
  return parseSuperadminEmails(readEnv("SUPERADMIN_EMAILS")) ?? [];
}

export function getAccessTeamDomain(): string | null {
  return parseAccessTeamDomain(readEnv("CF_ACCESS_TEAM_DOMAIN"));
}

export function getAccessAudience(): string | null {
  return parseAccessAudience(readEnv("CF_ACCESS_AUD"));
}

export function getOperationsAccessConfigStatus(): OperationsAccessConfigStatus {
  return {
    SUPERADMIN_EMAILS: getSuperadminEmails().length > 0,
    CF_ACCESS_TEAM_DOMAIN: Boolean(getAccessTeamDomain()),
    CF_ACCESS_AUD: Boolean(getAccessAudience()),
  };
}

export function isOperationsAccessConfigured(
  status: OperationsAccessConfigStatus = getOperationsAccessConfigStatus(),
): boolean {
  return (
    status.SUPERADMIN_EMAILS &&
    status.CF_ACCESS_TEAM_DOMAIN &&
    status.CF_ACCESS_AUD
  );
}

export function missingOperationsAccessConfig(
  status: OperationsAccessConfigStatus = getOperationsAccessConfigStatus(),
): OperationsAccessConfigKey[] {
  return (Object.entries(status) as [OperationsAccessConfigKey, boolean][])
    .filter(([, present]) => !present)
    .map(([key]) => key);
}
