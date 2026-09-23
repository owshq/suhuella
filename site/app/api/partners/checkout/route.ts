import {
  partnerApplicantTokenFromCookieHeader,
  readPartnerApplicantSession,
} from "@/lib/partners/applicant-session";
import { createPartnerCheckoutSession } from "@/lib/partners/checkout";
import { rejectClientAuthorityFields } from "@/lib/partners/http-actor";
import {
  isPlatformPublicPartnerApiHost,
  platformPublicPartnerApiDeniedResponse,
} from "@/lib/partners/platform-public-api";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const CARD_FIELDS = ["card", "number", "cvc", "pan", "payment_method_data", "paymentMethod"];

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Hosted Partner Checkout. Closed while partner and paid checkout flags are off. */
export async function POST(request: NextRequest) {
  if (!isPlatformPublicPartnerApiHost(request.headers)) {
    return platformPublicPartnerApiDeniedResponse();
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (rejectClientAuthorityFields(body) || body.origin != null || body.price != null || body.amount != null || body.priceId != null) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (CARD_FIELDS.some((field) => body[field] != null)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const token = partnerApplicantTokenFromCookieHeader(request.headers.get("cookie"));
  const applicant = token ? await readPartnerApplicantSession(token) : null;
  if (!applicant) return json({ ok: false, error: "unauthorized" }, 401);

  const origin = request.nextUrl.origin;
  const result = await createPartnerCheckoutSession({ email: applicant.email, origin });
  if (!result.ok) {
    const status = result.error === "checkout_closed" ? 403 : result.error === "already_covered" ? 409 : 400;
    return json({ ok: false, error: result.error }, status);
  }
  return json({ ok: true, url: result.url });
}
