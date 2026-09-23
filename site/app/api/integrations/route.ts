import {
  listIntegrationCatalog,
  listOwnerConnections,
} from "@/lib/integrations/connections";
import { getCloudProviderAdapter } from "@/lib/integrations/google-drive-adapter";
import { isCloudIntegrationsPubliclyEnabled } from "@/lib/integrations/providers";
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

  const enabled = isCloudIntegrationsPubliclyEnabled();
  const [catalog, connections] = await Promise.all([
    Promise.resolve(listIntegrationCatalog()),
    listOwnerConnections(owner),
  ]);

  const sources = connections
    .filter((connection) => connection.status === "active" || connection.status === "needs_reauth")
    .map((connection) => {
      const handle = getCloudProviderAdapter(connection.provider).mapToSourceHandle({
        connectionId: connection.id,
        accountExternalId: null,
        accountDisplayName: connection.accountDisplayName,
        accountEmail: connection.accountEmail,
      });
      return {
        id: connection.id,
        displayName: handle.rootLabel,
        provider: connection.provider,
        status: connection.status,
        accountEmail: connection.accountEmail,
        browseRoot: `cloud:${connection.id}`,
      };
    });

  return Response.json(
    {
      ok: true,
      enabled,
      catalog,
      connections,
      sources,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
