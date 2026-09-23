import { browseCloudChildren } from "@/lib/integrations/browse";
import { isCloudIntegrationsPubliclyEnabled } from "@/lib/integrations/providers";
import type { CloudOwnerKind } from "@/lib/integrations/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isCloudIntegrationsPubliclyEnabled()) {
    return Response.json(
      { ok: false, error: "integrations_disabled" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { id } = await context.params;
  const ownerId =
    request.headers.get("x-suhuella-device-id")?.trim() ||
    request.nextUrl.searchParams.get("deviceId")?.trim() ||
    "";
  const ownerKindParam = request.nextUrl.searchParams.get("ownerKind");
  const ownerKind: CloudOwnerKind =
    ownerKindParam === "license" || ownerKindParam === "organisation" ? ownerKindParam : "device";
  const parentId = request.nextUrl.searchParams.get("parent")?.trim() || "root";
  const cursor = request.nextUrl.searchParams.get("cursor")?.trim() || null;

  // Never accept tokens from the client.
  if (
    request.nextUrl.searchParams.has("access_token") ||
    request.nextUrl.searchParams.has("refresh_token") ||
    request.nextUrl.searchParams.has("token")
  ) {
    return Response.json(
      { ok: false, error: "token_not_accepted" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await browseCloudChildren({
    connectionId: id,
    ownerKind,
    ownerId,
    parentId,
    cursor,
  });

  if (!result.ok) {
    const status =
      result.error === "forbidden"
        ? 403
        : result.error === "not_found"
          ? 404
          : result.error === "needs_reauth"
            ? 401
            : result.error === "integrations_disabled"
              ? 403
              : 400;
    return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
  }

  // Public browse payload — no tokens.
  return Response.json(
    {
      ok: true,
      connectionId: result.connectionId,
      provider: result.provider,
      parentId: result.parentId,
      parentName: result.parentName,
      parentOfParentId: result.parentOfParentId,
      source: {
        id: result.connectionId,
        displayName: result.handle.rootLabel,
      },
      handle: result.handle,
      items: result.page.items,
      nextCursor: result.page.nextCursor,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
