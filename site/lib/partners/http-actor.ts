import type { NextRequest } from "next/server";
import { getSuperadminEmails } from "../operations/access-config.ts";
import { authenticateOperations } from "../operations/auth.ts";
import { resolvePartnerActorFromEmail } from "./service.ts";
import {
  partnerSessionTokenFromCookieHeader,
  resolvePartnerActorFromSessionToken,
} from "./session.ts";
import type { PartnerActor } from "./types.ts";

export type PartnerHttpActorResult =
  | { ok: true; actor: PartnerActor; via: "operations" | "partner_session" }
  | { ok: false; status: number; error: string };

/**
 * Resolve the caller for partner self-service / domain APIs.
 * Prefers the HttpOnly partner session (OTP portal / onboarding), then Cloudflare Access
 * Operations identity for platform support reads and emergency revoke.
 * Never trusts partner_id / brand_id / role from the request body.
 */
export async function resolvePartnerHttpActor(
  request: NextRequest,
): Promise<PartnerHttpActorResult> {
  const token = partnerSessionTokenFromCookieHeader(request.headers.get("cookie"));
  if (token) {
    const sessionActor = await resolvePartnerActorFromSessionToken(token);
    if (sessionActor) return { ok: true, actor: sessionActor, via: "partner_session" };
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const auth = await authenticateOperations(request.headers);
  if (auth.ok) {
    const platformEmails = getSuperadminEmails();
    const actor = await resolvePartnerActorFromEmail(auth.actor.email, platformEmails);
    if (actor) return { ok: true, actor, via: "operations" };
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: false, status: auth.status, error: auth.error };
}

export function rejectClientAuthorityFields(
  body: Record<string, unknown>,
): string | null {
  if (
    body.partner_id != null ||
    body.partnerId != null ||
    body.brand_id != null ||
    body.brandId != null ||
    body.role != null ||
    body.status != null ||
    body.cloudflare_custom_hostname_id != null ||
    body.cloudflareCustomHostnameId != null ||
    body.dns_target != null ||
    body.dnsTarget != null ||
    body.cnameTarget != null
  ) {
    return "invalid_request";
  }
  return null;
}
