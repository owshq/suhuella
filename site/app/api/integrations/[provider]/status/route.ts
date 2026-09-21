import { getConnectionStatus } from "@/lib/integrations/connections";
import type { CloudOwnerKind } from "@/lib/integrations/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: id } = await context.params;
  const ownerId =
    request.headers.get("x-suhuella-device-id")?.trim() ||
    request.nextUrl.searchParams.get("deviceId")?.trim() ||
    "";
  const ownerKindParam = request.nextUrl.searchParams.get("ownerKind");
  const ownerKind: CloudOwnerKind =
    ownerKindParam === "license" || ownerKindParam === "organisation" ? ownerKindParam : "device";

  const result = await getConnectionStatus({
    connectionId: id,
    ownerKind,
    ownerId,
  });

  if (!result.ok) {
    const status = result.error === "forbidden" ? 403 : 404;
    return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
  }

  // Public view only — never include tokens or ciphertext.
  return Response.json(
    {
      ok: true,
      connection: result.connection,
      sync: result.sync,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
