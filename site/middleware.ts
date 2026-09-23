import { NextResponse, type NextRequest } from "next/server";
import {
  decidePartnerHostnameGate,
  hostnameFromRequestHeaders,
  shouldBypassPartnerHostnamePath,
} from "@/lib/partners/middleware-gate";
import { isPlatformPublicHostname } from "@/lib/partners/domains";
import { decideOpsHostGate } from "@/lib/operations/ops-host-gate";

/**
 * Edge gate for:
 * 1) ops.suhuella.com — Operations routing (no partner resolution, no /ops bounce)
 * 2) partner Custom Hostnames — brand isolation without same-origin Access fetch
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = hostnameFromRequestHeaders(request.headers);

  // Cloudflare Access + asset paths: never rewrite.
  if (
    pathname.startsWith("/cdn-cgi/") ||
    pathname.startsWith("/.well-known/cloudflare-access") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const opsDecision = decideOpsHostGate({ hostname, pathname });
  if (opsDecision.action === "redirect") {
    // Stay on the ops hostname — build from the incoming request URL/host.
    const url = request.nextUrl.clone();
    if (hostname) url.hostname = hostname;
    url.pathname = opsDecision.pathname;
    url.protocol = "https:";
    return NextResponse.redirect(url);
  }
  if (opsDecision.action === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = opsDecision.pathname;
    return NextResponse.rewrite(url);
  }

  if (shouldBypassPartnerHostnamePath(pathname)) {
    return NextResponse.next();
  }

  if (!hostname || isPlatformPublicHostname(hostname)) {
    return NextResponse.next();
  }

  try {
    const internalUrl = new URL("/api/internal/partner-domain-state", request.url);
    internalUrl.searchParams.set("hostname", hostname);
    const response = await fetch(internalUrl, {
      headers: { "x-suhuella-middleware": "1" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.next();
    }
    const state = (await response.json()) as {
      status: Parameters<typeof decidePartnerHostnameGate>[0]["status"];
    };
    const decision = decidePartnerHostnameGate({
      hostname,
      pathname,
      status: state.status,
    });
    if (decision.action === "next") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/hostname-status";
    url.search = "";
    return NextResponse.rewrite(url);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
