import {
  consumeVerifiedEmailProof,
  peekVerifiedEmailProof,
} from "@/lib/email-verification";
import { reconcileBusinessCheckoutForOwner } from "@/lib/business-reconciliation";
import { rawCardRejection } from "@/lib/raw-card-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Owner-authenticated Business purchase reconciliation. Not a public verify-session shortcut. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const cardRejected = rawCardRejection({ body });
  if (cardRejected) return cardRejected;

  const proofId = typeof body.proofId === "string" ? body.proofId.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!proofId || !sessionId) return json({ ok: false, error: "invalid_request" }, 400);

  const proof = await peekVerifiedEmailProof({ proofId, purpose: "BUSINESS_CHECKOUT" });
  if (!proof.ok) {
    return json({ ok: false, error: proof.error === "expired" ? "expired" : "unauthorized" }, 401);
  }

  const consumed = await consumeVerifiedEmailProof({ proofId, purpose: "BUSINESS_CHECKOUT" });
  if (!consumed.ok) return json({ ok: false, error: "unauthorized" }, 401);

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!secretKey) return json({ ok: false, error: "server_error" }, 500);

  const result = await reconcileBusinessCheckoutForOwner({
    sessionId,
    ownerEmail: consumed.email,
    secretKey,
  });

  if (!result.ok) {
    const status =
      result.error === "unauthorized"
        ? 403
        : result.error === "persistence_unavailable"
          ? 503
          : result.error === "not_paid"
            ? 409
            : result.error === "invalid_session"
              ? 400
              : 500;
    return json({ ok: false, error: result.error }, status);
  }

  return json({
    ok: true,
    organisationId: result.organisationId,
    duplicate: result.duplicate === true,
  });
}
