import {
  isAuthorizedWorkersDevHostname,
  normalizeHostname,
} from "../partners/domains.ts";

export const OPERATIONS_INTERNAL_PATH = "/_ops";
export const DEFAULT_OPERATIONS_BASE_URL = "https://ops.suhuella.com";

/** Localhost only. Production entry is the ops hostname root. */
export const OPERATIONS_PUBLIC_PATH = OPERATIONS_INTERNAL_PATH;

export const OPERATIONS_PUBLIC_HOST = "ops.suhuella.com";
export const SUHUELLA_PUBLIC_HOSTS = ["suhuella.com", "www.suhuella.com"] as const;

/**
 * Resolve the effective Host header for routing and brand resolution.
 *
 * X-Forwarded-Host is trusted only when the direct Host is the authorized
 * Worker dev origin (`suhuella.<account>.workers.dev`). Cloudflare sets both
 * when a Custom Hostname is routed through the Worker; public hosts and
 * localhost must never honor a client-supplied X-Forwarded-Host override.
 */
export function requestHost(headers: Headers): string {
  const host = (headers.get("host") ?? "").trim();
  const forwarded = (headers.get("x-forwarded-host") ?? "").trim().split(",")[0]?.trim() ?? "";

  if (host && forwarded) {
    const hostNormalized = normalizeHostname(host);
    if (hostNormalized && isAuthorizedWorkersDevHostname(hostNormalized)) {
      return forwarded;
    }
  }

  return host || forwarded;
}

export function isLocalhostHost(host: string): boolean {
  const normalized = normalizeHostname(host);
  if (!normalized) return false;
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function getOperationsBaseUrl(): string {
  const configured = process.env.OPS_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return DEFAULT_OPERATIONS_BASE_URL;
}

/** @deprecated Prefer normalizeHostname(requestHost(headers)) for brand resolution. */
export function hostnameOf(host: string): string {
  return normalizeHostname(host) ?? "";
}

export function isSuhuellaPublicHost(host: string): boolean {
  const hostname = normalizeHostname(host);
  if (!hostname) return false;
  return (SUHUELLA_PUBLIC_HOSTS as readonly string[]).includes(hostname);
}

export function isOperationsCanonicalHost(host: string): boolean {
  if (isLocalhostHost(host)) return true;
  const hostname = normalizeHostname(host);
  if (!hostname) return false;
  try {
    return hostname === new URL(getOperationsBaseUrl()).hostname.toLowerCase();
  } catch {
    return hostname === OPERATIONS_PUBLIC_HOST;
  }
}

/** Production ops hostname only — not localhost, not suhuella.com. */
export function isOperationsOnlyHost(host: string): boolean {
  return isOperationsCanonicalHost(host) && !isLocalhostHost(host);
}

/** Any `*.workers.dev` origin (authorized or foreign). */
export function isWorkersDevHost(host: string): boolean {
  const normalized = normalizeHostname(host);
  return normalized !== null && normalized.endsWith(".workers.dev");
}
