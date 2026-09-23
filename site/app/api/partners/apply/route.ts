import {
  consumeVerifiedEmailProof,
  peekVerifiedEmailProof,
  requestEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/email-verification";
import { clientIpFromRequest } from "@/lib/client-ip";
import {
  findPartnerApplication,
  PartnerApplicationError,
  PartnerApplicationStoreUnavailableError,
  submitPartnerApplication,
} from "@/lib/partners/application-store";
import { rejectClientAuthorityFields } from "@/lib/partners/http-actor";
import {
  partnerApplicantCookieHeader,
  signPartnerApplicantSession,
} from "@/lib/partners/applicant-session";
import {
  isPlatformPublicPartnerApiHost,
  platformPublicPartnerApiDeniedResponse,
} from "@/lib/partners/platform-public-api";
import { resolvePartnerProgramJourney } from "@/lib/partners/program-journey";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

async function journeyForProof(proofId: string) {
  const proof = await peekVerifiedEmailProof({
    proofId,
    purpose: "PARTNER_APPLICATION",
  });
  if (!proof.ok) {
    return { ok: false as const, error: proof.error };
  }
  const journey = await resolvePartnerProgramJourney(proof.email);
  const application = await findPartnerApplication(proof.email);
  return {
    ok: true as const,
    email: proof.email,
    journey,
    application,
  };
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

  const authorityError = rejectClientAuthorityFields(body);
  if (authorityError) {
    return json({ ok: false, error: authorityError }, 400);
  }
  if (body.origin != null) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "request_code") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return json({ ok: false, error: "invalid_request" }, 400);
    const result = await requestEmailVerificationCode({
      email,
      purpose: "PARTNER_APPLICATION",
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
    });
  }

  if (action === "verify_code") {
    const challengeId = typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!challengeId || !code) return json({ ok: false, error: "invalid_request" }, 400);
    const verified = await verifyEmailVerificationCode({ challengeId, code });
    if (!verified.ok) {
      const status =
        verified.error === "rate_limited"
          ? 429
          : verified.error === "expired"
            ? 410
            : 400;
      return json({ ok: false, error: verified.error }, status);
    }
    const statusPayload = await journeyForProof(verified.proofId);
    if (!statusPayload.ok) {
      return json({ ok: false, error: statusPayload.error }, 400);
    }
    const applicantToken = await signPartnerApplicantSession(statusPayload.email);
    return json(
      {
        ok: true,
        proofId: verified.proofId,
        expiresAt: verified.expiresAt,
        email: statusPayload.email,
        journey: statusPayload.journey,
        application: statusPayload.application,
      },
      200,
      { "Set-Cookie": partnerApplicantCookieHeader(applicantToken) },
    );
  }

  if (action === "status") {
    const proofId = typeof body.proofId === "string" ? body.proofId.trim() : "";
    if (!proofId) return json({ ok: false, error: "invalid_request" }, 400);
    const statusPayload = await journeyForProof(proofId);
    if (!statusPayload.ok) {
      const status = statusPayload.error === "expired" ? 410 : 400;
      return json({ ok: false, error: statusPayload.error }, status);
    }
    return json({
      ok: true,
      email: statusPayload.email,
      journey: statusPayload.journey,
      application: statusPayload.application,
    });
  }

  if (action === "submit_interest") {
    const proofId = typeof body.proofId === "string" ? body.proofId.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!proofId || displayName.length < 2) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    const proof = await peekVerifiedEmailProof({
      proofId,
      purpose: "PARTNER_APPLICATION",
    });
    if (!proof.ok) {
      return json(
        { ok: false, error: proof.error },
        proof.error === "expired" ? 410 : 400,
      );
    }

    try {
      const application = await submitPartnerApplication({
        email: proof.email,
        displayName,
      });
      const consumed = await consumeVerifiedEmailProof({
        proofId,
        purpose: "PARTNER_APPLICATION",
      });
      if (!consumed.ok) {
        // D1 succeeded; proof may have been consumed by a parallel retry with same proof.
        const existing = await findPartnerApplication(proof.email);
        if (!existing) {
          return json({ ok: false, error: "invalid_proof" }, 400);
        }
      }
      const journey = await resolvePartnerProgramJourney(proof.email);
      return json({
        ok: true,
        received: true,
        application,
        journey,
      });
    } catch (error) {
      if (error instanceof PartnerApplicationStoreUnavailableError) {
        return json({ ok: false, error: "unavailable" }, 503);
      }
      if (error instanceof PartnerApplicationError) {
        return json({ ok: false, error: error.code, message: error.message }, error.status);
      }
      return json({ ok: false, error: "server_error" }, 500);
    }
  }

  return json({ ok: false, error: "invalid_request" }, 400);
}
