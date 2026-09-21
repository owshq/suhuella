import { disconnectConnection } from "@/lib/integrations/connections";
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

  const ownerId =
    (typeof body.deviceId === "string" && body.deviceId.trim()) ||
    request.headers.get("x-suhuella-device-id")?.trim() ||
    "";
  const ownerKind: CloudOwnerKind =
    body.ownerKind === "license" || body.ownerKind === "organisation" ? body.ownerKind : "device";

  const result = await disconnectConnection({
    connectionId: id,
    ownerKind,
    ownerId,
  });

  if (!result.ok) {
    const status = result.error === "forbidden" ? 403 : 404;
    return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
}
