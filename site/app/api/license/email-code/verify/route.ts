import { verifyEmailVerificationCode } from "@/lib/email-verification";
import { rejectIfCapabilityLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await rejectIfCapabilityLimited("license-recovery");
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await verifyEmailVerificationCode({
    challengeId: typeof body.challengeId === "string" ? body.challengeId : "",
    code: typeof body.code === "string" ? body.code : "",
  });

  if (!result.ok) {
    const error = result.error === "expired" ? "invalid_proof" : result.error;
    const status = result.error === "rate_limited" ? 429 : 400;
    return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { ok: true, proofId: result.proofId, expiresAt: result.expiresAt },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
