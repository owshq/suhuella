import { brand } from "@suhuella/brand";
import { verifyCloudflareAccessJwt } from "./access-jwt";
import { isProductionRuntime } from "./auth-runtime";
import { normalizeEmail } from "./catalog";
import { isLocalhostHost, requestHost } from "./host";
import type { OperationsAuthMethod } from "./session";
import type { OperationsActor } from "./types";

export { isProductionRuntime } from "./auth-runtime";

export type OperationsAuthFailure = {
  ok: false;
  status: 401 | 403 | 503;
  error: "unauthorized" | "forbidden" | "access_unconfigured";
  message: string;
};

export type OperationsAuthSuccess = {
  ok: true;
  actor: OperationsActor;
  authMethod: OperationsAuthMethod;
};

export type OperationsAuthResult = OperationsAuthSuccess | OperationsAuthFailure;

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getSuperadminEmails(): string[] {
  return readEnv("SUPERADMIN_EMAILS")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function isSuperadmin(email: string): boolean {
  return getSuperadminEmails().includes(normalizeEmail(email));
}

function headerEmail(headers: Headers): string {
  return normalizeEmail(
    headers.get("cf-access-authenticated-user-email") ??
      headers.get("Cf-Access-Authenticated-User-Email") ??
      "",
  );
}

function headerJwt(headers: Headers): string {
  return (
    headers.get("cf-access-jwt-assertion") ??
    headers.get("Cf-Access-Jwt-Assertion") ??
    ""
  ).trim();
}

function deny(
  status: OperationsAuthFailure["status"],
  error: OperationsAuthFailure["error"],
  message: string,
): OperationsAuthFailure {
  return { ok: false, status, error, message };
}

function success(
  actor: OperationsActor,
  authMethod: OperationsAuthMethod,
): OperationsAuthSuccess {
  return { ok: true, actor, authMethod };
}

async function authenticateProduction(
  headers: Headers,
): Promise<OperationsAuthResult> {
  const teamDomain = readEnv("CF_ACCESS_TEAM_DOMAIN");
  const audience = readEnv("CF_ACCESS_AUD");
  const allowlist = getSuperadminEmails();

  if (!teamDomain || !audience || allowlist.length === 0) {
    return deny(
      503,
      "access_unconfigured",
      "Operations access is not configured. Set SUPERADMIN_EMAILS, CF_ACCESS_TEAM_DOMAIN, and CF_ACCESS_AUD, and put Cloudflare Access in front of /_ops.",
    );
  }

  const token = headerJwt(headers);
  if (!token) {
    return deny(
      401,
      "unauthorized",
      `This surface is restricted to ${brand.displayName} operations. Access is granted by Cloudflare Access.`,
    );
  }

  let jwtEmail: string | null = null;
  try {
    jwtEmail = await verifyCloudflareAccessJwt(token, teamDomain, audience);
  } catch {
    jwtEmail = null;
  }

  if (!jwtEmail) {
    return deny(
      401,
      "unauthorized",
      "Cloudflare Access assertion was missing or invalid.",
    );
  }

  const claimed = headerEmail(headers);
  if (claimed && claimed !== jwtEmail) {
    return deny(401, "unauthorized", "Access identity did not match.");
  }

  if (!isSuperadmin(jwtEmail)) {
    return deny(
      403,
      "forbidden",
      `This Cloudflare Access identity is not a ${brand.displayName} superadmin.`,
    );
  }

  return success({ email: jwtEmail, role: "SUPER_ADMIN" }, "cloudflare_access");
}

function authenticateLocalhost(): OperationsAuthResult {
  const allowlist = getSuperadminEmails();
  const email = allowlist[0] ?? "dev@localhost";
  return success({ email, role: "SUPER_ADMIN" }, "localhost");
}

function authenticateDevelopment(): OperationsAuthResult {
  const allowDev = readEnv("OPERATIONS_ALLOW_DEV_ACCESS") === "true";
  const devEmail = normalizeEmail(readEnv("OPERATIONS_DEV_EMAIL"));

  if (!allowDev || !devEmail) {
    return deny(
      401,
      "unauthorized",
      "Operations is only open on localhost during local development. Use http://localhost:3000/_ops or set OPERATIONS_ALLOW_DEV_ACCESS=true with OPERATIONS_DEV_EMAIL.",
    );
  }

  if (!isSuperadmin(devEmail)) {
    return deny(
      401,
      "unauthorized",
      "OPERATIONS_DEV_EMAIL must be listed in SUPERADMIN_EMAILS.",
    );
  }

  return success({ email: devEmail, role: "SUPER_ADMIN" }, "localhost");
}

export async function authenticateOperations(
  headers: Headers,
): Promise<OperationsAuthResult> {
  const host = requestHost(headers);

  if (!isProductionRuntime() && isLocalhostHost(host)) {
    return authenticateLocalhost();
  }

  if (isProductionRuntime()) {
    return authenticateProduction(headers);
  }

  return authenticateDevelopment();
}

export function operationsAuthHeaders(): HeadersInit {
  return { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
}
