export const OPERATIONS_PUBLIC_PATH = "/_ops";

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
