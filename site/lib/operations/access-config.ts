import { normalizeEmail } from "./catalog";

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

export function getSuperadminEmails(): string[] {
  return readEnv("SUPERADMIN_EMAILS")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export function getOperationsAccessConfigStatus(): OperationsAccessConfigStatus {
  return {
    SUPERADMIN_EMAILS: getSuperadminEmails().length > 0,
    CF_ACCESS_TEAM_DOMAIN: Boolean(readEnv("CF_ACCESS_TEAM_DOMAIN")),
    CF_ACCESS_AUD: Boolean(readEnv("CF_ACCESS_AUD")),
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
