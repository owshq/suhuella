import { normalizeEmail } from "./license-context.ts";
import type { BusinessActor } from "./business-types.ts";

export function superadminEmails(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? process.env.SUPERADMIN_EMAIL ?? "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export function superadminToken(): string {
  return process.env.SUPERADMIN_TOKEN?.trim() || "";
}

function isListedSuperadmin(email: string): boolean {
  return superadminEmails().includes(normalizeEmail(email));
}

export function isSuperAdminRequest(request: Request): boolean {
  const token = superadminToken();
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (token && authorization === `Bearer ${token}`) return true;

  const accessEmail = request.headers.get("cf-access-authenticated-user-email");
  if (accessEmail && isListedSuperadmin(accessEmail)) return true;

  const actorEmail = request.headers.get("x-suhuella-actor-email");

  const devAllowed = process.env.OPERATIONS_ALLOW_DEV_ACCESS === "true";
  const devEmail = normalizeEmail(process.env.OPERATIONS_DEV_EMAIL ?? "");
  if (
    process.env.NODE_ENV !== "production" &&
    devAllowed &&
    devEmail &&
    isListedSuperadmin(devEmail) &&
    !actorEmail
  ) {
    return true;
  }

  return false;
}

export function actorFromRequest(
  request: Request,
  organisationId?: string,
): BusinessActor | null {
  if (isSuperAdminRequest(request)) return { kind: "superadmin" };

  const email = request.headers.get("x-suhuella-actor-email")?.trim() ?? "";
  const claimedOrg = request.headers.get("x-suhuella-organisation-id")?.trim() || "";
  const org = claimedOrg || organisationId?.trim() || "";
  if (!email || !org) return null;
  return { kind: "business_admin", email: normalizeEmail(email), organisationId: org };
}

export function businessErrorStatus(error: string): number {
  if (error === "not_found") return 404;
  if (
    error === "forbidden" ||
    error === "cannot_change_pricing" ||
    error === "cannot_grant_lifetime" ||
    error === "cannot_access_other_organisation" ||
    error === "cannot_modify_recommendation_engine" ||
    error === "cannot_modify_user_files"
  ) {
    return 403;
  }
  if (error === "duplicate_email" || error === "seat_limit" || error === "seat_in_use" || error === "min_seats") {
    return 409;
  }
  if (error === "stripe_unavailable" || error === "stripe_timeout") return 503;
  return 400;
}
