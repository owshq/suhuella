import { listPartnerCustomerLicenses } from "@/lib/partners/customer-licenses";
import { PartnerAuthzError } from "@/lib/partners/authz";
import { resolvePartnerHttpActor } from "@/lib/partners/http-actor";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Customer licenses for the signed-in partner. Not the platform Partner fee. */
export async function GET(request: NextRequest) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
  if (gate.actor.kind !== "partner") return json({ ok: false, error: "forbidden" }, 403);

  const partnerId = request.nextUrl.searchParams.get("partnerId")?.trim() ?? "";
  if (partnerId && partnerId !== gate.actor.partnerId) {
    return json({ ok: false, error: "forbidden" }, 403);
  }
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
  try {
    const page = await listPartnerCustomerLicenses(gate.actor, {
      partnerId: gate.actor.partnerId,
      cursor,
      limit,
    });
    return json({ ok: true, ...page });
  } catch (error) {
    if (error instanceof PartnerAuthzError) return json({ ok: false, error: "forbidden" }, 403);
    return json({ ok: false, error: "server_error" }, 500);
  }
}
