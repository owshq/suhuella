import { consumeVerifiedEmailProof, requestEmailVerificationCode } from "@/lib/email-verification";
import {
  acceptOnboardingInvite,
  PartnerError,
  PartnerStoreUnavailableError,
  peekOnboardingInvite,
} from "@/lib/partners";
import { clientIpFromRequest } from "@/lib/client-ip";
import {
  isPlatformPublicPartnerApiHost,
  platformPublicPartnerApiDeniedResponse,
} from "@/lib/partners/platform-public-api";
import {
  partnerSessionCookieHeader,
  signPartnerSession,
} from "@/lib/partners/session";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function errorStatus(error: unknown): number {
  if (error instanceof PartnerStoreUnavailableError) return 503;
  if (error instanceof PartnerError) return error.status;
  return 400;
}

function errorCode(error: unknown): string {
  if (error instanceof PartnerStoreUnavailableError) return "unavailable";
  if (error instanceof PartnerError) {
    if (error.code) return error.code;
    if (error.status === 404) return "not_found";
    if (error.status === 409) return "conflict";
    if (error.status === 410) return "expired";
    if (error.status === 403) return "forbidden";
    if (error.status === 503) return "unavailable";
  }
  return "invalid_request";
}

/** Preview invite without consuming the token. Token is query-only for this GET. */
export async function GET(request: NextRequest) {
  if (!isPlatformPublicPartnerApiHost(request.headers)) {
    return platformPublicPartnerApiDeniedResponse();
  }
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return json({ ok: false, error: "invalid_request" }, 400);
  try {
    const preview = await peekOnboardingInvite(token);
    return json({
      ok: true,
      inviteId: preview.inviteId,
      email: preview.email,
      role: preview.role,
      partnerDisplayName: preview.partnerDisplayName,
      expiresAt: preview.expiresAt,
      status: preview.status,
    });
  } catch (error) {
    return json({ ok: false, error: errorCode(error) }, errorStatus(error));
  }
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

  // Reject client-supplied partner/brand/role — invite row is authoritative.
  if (body.partnerId != null || body.brandId != null || body.role != null) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return json({ ok: false, error: "invalid_request" }, 400);

  try {
    if (action === "request_code") {
      const preview = await peekOnboardingInvite(token);
      if (preview.status !== "open") {
        return json({ ok: false, error: preview.status }, preview.status === "expired" ? 410 : 409);
      }
      const result = await requestEmailVerificationCode({
        email: preview.email,
        purpose: "PARTNER_ONBOARDING",
        clientIp: clientIpFromRequest(request),
      });
      if (!result.ok) {
        const status =
          result.error === "rate_limited" ? 429 : result.error === "server_error" ? 500 : 400;
        return json({ ok: false, error: result.error }, status);
      }
      return json({
        ok: true,
        challengeId: result.challengeId,
        message: result.message,
        email: preview.email,
      });
    }

    if (action === "accept") {
      const proofId = typeof body.proofId === "string" ? body.proofId.trim() : "";
      if (!proofId) return json({ ok: false, error: "invalid_request" }, 400);
      const proof = await consumeVerifiedEmailProof({
        proofId,
        purpose: "PARTNER_ONBOARDING",
      });
      if (!proof.ok) {
        return json(
          { ok: false, error: proof.error },
          proof.error === "expired" ? 410 : 400,
        );
      }
      const summary = await acceptOnboardingInvite({
        token,
        verifiedEmail: proof.email,
      });
      const member = summary.members.find(
        (item) => item.email === proof.email && item.status === "active",
      );
      if (!member) {
        return json({ ok: false, error: "forbidden" }, 403);
      }
      const sessionToken = await signPartnerSession({
        email: member.email,
        partnerId: summary.partner.partnerId,
        role: member.role,
      });
      return json(
        {
          ok: true,
          partnerDisplayName: summary.partner.displayName,
          brandId: summary.brand.brandId,
          status: summary.partner.status,
          role: member.role,
          next: "configure_brand_and_hostname",
          // Intentionally omit tokens / invite ids / partnerId after accept.
        },
        200,
        { "Set-Cookie": partnerSessionCookieHeader(sessionToken) },
      );
    }

    return json({ ok: false, error: "invalid_request" }, 400);
  } catch (error) {
    return json({ ok: false, error: errorCode(error) }, errorStatus(error));
  }
}
