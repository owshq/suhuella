import { resolvePartnerDomainState } from "@/lib/partners/service";

export const runtime = "nodejs";

const MIDDLEWARE_HEADER = "x-suhuella-middleware";

/** Node runtime lookup for Edge middleware — avoids bundling local D1 into middleware. */
export async function GET(request: Request): Promise<Response> {
  if (request.headers.get(MIDDLEWARE_HEADER) !== "1") {
    return new Response("Not found", { status: 404 });
  }
  const hostname = new URL(request.url).searchParams.get("hostname")?.trim() ?? "";
  if (!hostname) {
    return Response.json({ status: "unknown", brandId: null, partnerId: null, domain: null });
  }
  const state = await resolvePartnerDomainState(hostname);
  return Response.json(state);
}
