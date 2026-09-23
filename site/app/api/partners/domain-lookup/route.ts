import { NextResponse } from "next/server";
import { resolvePartnerDomainState } from "@/lib/partners/service";
import { normalizeHostname } from "@/lib/partners/domains";

/**
 * Public lightweight lookup for middleware / edge.
 * Returns only status — no secrets, no partner internals.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = normalizeHostname(url.searchParams.get("host") ?? "");
  if (!host) {
    return NextResponse.json({ status: "unknown" as const });
  }
  try {
    const state = await resolvePartnerDomainState(host);
    return NextResponse.json({
      status: state.status,
    });
  } catch {
    return NextResponse.json({ status: "unknown" as const });
  }
}
