import { startOAuth } from "@/lib/integrations/connections";
import { parseProviderPathSlug } from "@/lib/integrations/providers";
import type { CloudOwnerKind } from "@/lib/integrations/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerSlug } = await context.params;
  const provider = parseProviderPathSlug(providerSlug);
  if (!provider) {
    return Response.json(
      { ok: false, error: "provider_unknown" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Never accept access tokens or refresh tokens from the browser.
  if (
    "accessToken" in body ||
    "access_token" in body ||
    "refreshToken" in body ||
    "refresh_token" in body ||
    "token" in body
  ) {
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

  const result = await startOAuth({
    provider,
    ownerKind,
    ownerId,
    origin: request.nextUrl.origin,
    returnPath: typeof body.returnPath === "string" ? body.returnPath : "/sources",
  });

  if (!result.ok) {
    const status =
      result.error === "redirect_uri_not_allowed"
        ? 400
        : result.error === "integrations_disabled" || result.error === "provider_not_enabled"
          ? 403
          : 400;
    return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
}
