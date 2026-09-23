import { OPERATIONS_PUBLIC_HOST } from "./host.ts";

/** Public paths on ops.suhuella.com → internal /ops app routes. */
export const OPS_HOST_PATH_REWRITES: Readonly<Record<string, string>> = {
  "/": "/ops",
  "/licenses": "/ops/licenses",
  "/business": "/ops/business",
  "/devices": "/ops/devices",
  "/usage": "/ops/usage",
  "/releases": "/ops/releases",
  "/support": "/ops/support",
  "/customers": "/ops/customers",
  "/billing": "/ops/billing",
  "/activity": "/ops/activity",
  "/partners": "/ops/partners",
};

export type OpsHostGateDecision =
  | { action: "next" }
  | { action: "rewrite"; pathname: string }
  | { action: "redirect"; pathname: string };

/**
 * Operations hostname routing.
 *
 * Browser URL stays at `/` (and section aliases). Internal app lives under `/ops`.
 * Never emit a relative redirect to `/ops` from the product shell — that bounces
 * through `suhuella.com/ops` → `ops.suhuella.com/` → `/ops` (ERR_TOO_MANY_REDIRECTS).
 */
export function decideOpsHostGate(input: {
  hostname: string | null;
  pathname: string;
}): OpsHostGateDecision {
  if (input.hostname !== OPERATIONS_PUBLIC_HOST) {
    return { action: "next" };
  }
  const pathname = input.pathname || "/";
  if (
    pathname.startsWith("/cdn-cgi/") ||
    pathname.startsWith("/.well-known/cloudflare-access") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next")
  ) {
    return { action: "next" };
  }

  // Canonicalize legacy /ops URLs to the ops-host root aliases.
  if (pathname === "/ops") {
    return { action: "redirect", pathname: "/" };
  }
  if (pathname.startsWith("/ops/")) {
    const rest = pathname.slice("/ops".length);
    return { action: "redirect", pathname: rest || "/" };
  }

  const rewriteTo = OPS_HOST_PATH_REWRITES[pathname];
  if (rewriteTo) {
    return { action: "rewrite", pathname: rewriteTo };
  }

  // Unknown product paths on the ops host → operations dashboard (no redirect loop).
  return { action: "rewrite", pathname: "/ops" };
}

export function isOpsPlatformHostname(hostname: string | null): boolean {
  return hostname === OPERATIONS_PUBLIC_HOST;
}
