import { handleOAuthCallback } from "@/lib/integrations/connections";
import { parseProviderPathSlug, providerPathSlug } from "@/lib/integrations/providers";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: providerSlug } = await context.params;
  const provider = parseProviderPathSlug(providerSlug);
  if (!provider) {
    return Response.redirect(new URL("/home?integration=error&code=provider_unknown", request.url), 302);
  }

  // Reject any attempt to pass bearer tokens via query (defense in depth).
  const params = request.nextUrl.searchParams;
  if (params.has("access_token") || params.has("refresh_token") || params.has("token")) {
    return Response.redirect(new URL("/home?integration=error&code=token_not_accepted", request.url), 302);
  }

  const result = await handleOAuthCallback({
    provider,
    state: params.get("state"),
    code: params.get("code"),
    error: params.get("error"),
  });

  if (!result.ok) {
    const url = new URL(result.returnPath, request.url);
    url.searchParams.set("integration", "error");
    url.searchParams.set("code", result.error);
    return Response.redirect(url, 302);
  }

  const url = new URL(result.returnPath, request.url);
  url.searchParams.set("integration", "connected");
  url.searchParams.set("provider", providerPathSlug(provider));
  return Response.redirect(url, 302);
}
