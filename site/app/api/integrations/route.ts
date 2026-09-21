import {
  listIntegrationCatalog,
  listOwnerConnections,
} from "@/lib/integrations/connections";
import type { CloudOwnerKind } from "@/lib/integrations/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function ownerFrom(request: NextRequest): { ownerKind: CloudOwnerKind; ownerId: string } | null {
  const ownerId =
    request.headers.get("x-suhuella-device-id")?.trim() ||
    request.nextUrl.searchParams.get("deviceId")?.trim() ||
    "";
  if (!ownerId) return null;
  return { ownerKind: "device", ownerId };
}

export async function GET(request: NextRequest) {
  const owner = ownerFrom(request);
  if (!owner) {
    return Response.json(
      { ok: false, error: "owner_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const [catalog, connections] = await Promise.all([
    Promise.resolve(listIntegrationCatalog()),
    listOwnerConnections(owner),
  ]);

  return Response.json(
    { ok: true, catalog, connections },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
