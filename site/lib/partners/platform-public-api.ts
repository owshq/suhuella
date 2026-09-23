import { isPlatformPublicHostname, normalizeHostname } from "./domains.ts";
import { requestHost } from "../operations/host.ts";

export function platformPublicHostFromHeaders(headers: Headers): string | null {
  return normalizeHostname(requestHost(headers));
}

export function isPlatformPublicPartnerApiHost(headers: Headers): boolean {
  const hostname = platformPublicHostFromHeaders(headers);
  if (!hostname) return false;
  return isPlatformPublicHostname(hostname);
}

export function platformPublicPartnerApiDeniedResponse(): Response {
  return Response.json(
    { ok: false, error: "forbidden" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
