import {
  consumeVerifiedEmailProof,
  peekVerifiedEmailProof,
  requestEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/email-verification";
import { clientIpFromRequest } from "@/lib/client-ip";
import { rejectClientAuthorityFields } from "@/lib/partners/http-actor";
import { openPartnerPortalForVerifiedEmail } from "@/lib/partners/service";
import {
  clearPartnerSessionCookieHeader,
  partnerSessionCookieHeader,
  signPartnerSession,
} from "@/lib/partners/session";
import {
  isPlatformPublicPartnerApiHost,
  platformPublicPartnerApiDeniedResponse,
} from "@/lib/partners/platform-public-api";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export async function POST(request: NextRequest) {
  if (!isPlatformPublicPartnerApiHost(request.headers)) {
    return platformPublicPartnerApiDeniedResponse();
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (rejectClientAuthorityFields(body) || body.origin != null) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "logout") {
    return json({ ok: true }, 200, { "Set-Cookie": clearPartnerSessionCookieHeader() });
  }

  if (action === "request_code") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return json({ ok: false, error: "invalid_request" }, 400);
    const result = await requestEmailVerificationCode({
      email,
      purpose: "PARTNER_PORTAL",
      clientIp: clientIpFromRequest(request),
    });
    if (!result.ok) {
      const status =
        result.error === "rate_limited"
          ? 429
          : result.error === "server_error"
            ? 500
            : result.error === "no_membership"
              ? 403
              : 400;
      return json({ ok: false, error: result.error }, status);
    }
    return json({ ok: true, challengeId: result.challengeId, message: result.message });
  }

  if (action === "verify_code") {
    const challengeId = typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!challengeId || !code) return json({ ok: false, error: "invalid_request" }, 400);
    const verified = await verifyEmailVerificationCode({ challengeId, code });
    if (!verified.ok) {
      const status = verified.error === "expired" ? 410 : verified.error === "rate_limited" ? 429 : 400;
      return json({ ok: false, error: verified.error }, status);
    }
    const proof = await peekVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_PORTAL",
    });
    if (!proof.ok) return json({ ok: false, error: proof.error }, 400);
    const opened = await openPartnerPortalForVerifiedEmail(proof.email);
    if (!opened.ok) return json({ ok: false, error: "no_membership" }, 403);
    const consumed = await consumeVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_PORTAL",
    });
    if (!consumed.ok) return json({ ok: false, error: consumed.error }, 400);
    const token = await signPartnerSession({
      email: opened.email,
      partnerId: opened.partnerId,
      role: opened.role,
    });
    return json({ ok: true, email: opened.email }, 200, {
      "Set-Cookie": partnerSessionCookieHeader(token),
    });
  }

  return json({ ok: false, error: "invalid_request" }, 400);
}
