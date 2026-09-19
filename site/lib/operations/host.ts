export const OPERATIONS_INTERNAL_PATH = "/_ops";
export const DEFAULT_OPERATIONS_BASE_URL = "https://ops.suhuella.com";

/** @deprecated Use getOperationsBaseUrl() for public links. */
export const OPERATIONS_PUBLIC_PATH = OPERATIONS_INTERNAL_PATH;

export function requestHost(headers: Headers): string {
  return (
    headers.get("host") ??
    headers.get("x-forwarded-host") ??
    ""
  ).trim();
}

export function isLocalhostHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower.startsWith("[") && lower.includes("]")) {
    return lower.slice(1, lower.indexOf("]")) === "::1";
  }
  const hostname = lower.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getOperationsBaseUrl(): string {
  const configured = process.env.OPS_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return DEFAULT_OPERATIONS_BASE_URL;
}

export function isOperationsCanonicalHost(host: string): boolean {
  if (isLocalhostHost(host)) return true;
  const hostname = host.toLowerCase().split(":")[0];
  try {
    return hostname === new URL(getOperationsBaseUrl()).hostname.toLowerCase();
  } catch {
    return hostname === "ops.suhuella.com";
  }
}
