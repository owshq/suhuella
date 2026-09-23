import { clientIpFromRequest } from "@/lib/client-ip";
import { handleLicenseCheckPost } from "@/lib/license-check-route-handler";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return handleLicenseCheckPost(body, { clientIp: clientIpFromRequest(request) });
}
