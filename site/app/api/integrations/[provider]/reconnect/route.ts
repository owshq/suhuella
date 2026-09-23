import { reconnectConnection } from "@/lib/integrations/connections";
import type { CloudOwnerKind } from "@/lib/integrations/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: id } = await context.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if ("accessToken" in body || "access_token" in body || "refresh_token" in body) {
    return Response.json(
      { ok: false, error: "token_not_accepted" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ownerId =
    (typeof body.deviceId === "string" && body.deviceId.trim()) ||
    request.headers.get("x-suhuella-device-id")?.trim() ||
    "";
  const ownerKind: CloudOwnerKind =
    body.ownerKind === "license" || body.ownerKind === "organisation" ? body.ownerKind : "device";

  const result = await reconnectConnection({
    connectionId: id,
    ownerKind,
    ownerId,
    origin: request.nextUrl.origin,
    returnPath: typeof body.returnPath === "string" ? body.returnPath : "/sources",
  });

  if (!result.ok) {
    const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 400;
    return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
}
