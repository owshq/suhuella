import { requestHost } from "../operations/host.ts";
import { isPlatformPublicHostname, normalizeHostname } from "./domains.ts";

export type PartnerDomainGateStatus =
  | "active"
  | "pending"
  | "failed"
  | "suspended"
  | "revoked"
  | "unknown"
  | "platform";

export type PartnerHostnameGateDecision =
  | { action: "next" }
  | { action: "rewrite_status"; state: Exclude<PartnerDomainGateStatus, "active" | "platform"> };

/**
 * Paths that must never enter partner hostname resolution.
 * Includes Cloudflare Access endpoints — rewriting them causes login redirect loops.
 */
export function shouldBypassPartnerHostnamePath(pathname: string): boolean {
  if (!pathname) return true;
  if (pathname.startsWith("/cdn-cgi/")) return true;
  if (pathname.startsWith("/.well-known/cloudflare-access")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/hostname-status")) return true;
  // Operations UI on the ops host (and local /ops) — never treat as partner web.
  if (pathname === "/ops" || pathname.startsWith("/ops/")) return true;
  return false;
}

/**
 * Resolve the normalized request hostname for partner gating.
 * Uses the same Host / X-Forwarded-Host trust rules as requestHost().
 */
export function hostnameFromRequestHeaders(headers: {
  get(name: string): string | null;
}): string | null {
  const headerBag = new Headers();
  const host = headers.get("host");
  const forwarded = headers.get("x-forwarded-host");
  if (host) headerBag.set("host", host);
  if (forwarded) headerBag.set("x-forwarded-host", forwarded);
  return normalizeHostname(requestHost(headerBag));
}

/**
 * Pure decision for partner Custom Hostname middleware.
 * Never redirects to suhuella.com or Access login URLs.
 */
export function decidePartnerHostnameGate(input: {
  hostname: string | null;
  pathname: string;
  status?: PartnerDomainGateStatus | null;
}): PartnerHostnameGateDecision {
  if (shouldBypassPartnerHostnamePath(input.pathname)) {
    return { action: "next" };
  }
  if (!input.hostname || isPlatformPublicHostname(input.hostname)) {
    return { action: "next" };
  }
  // Status not loaded yet — caller must resolve before rewrite.
  if (input.status == null) {
    return { action: "next" };
  }
  if (input.status === "active" || input.status === "platform") {
    return { action: "next" };
  }
  return { action: "rewrite_status", state: input.status };
}
