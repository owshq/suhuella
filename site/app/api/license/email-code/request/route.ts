import { clientIpFromRequest } from "@/lib/client-ip";
import { requestEmailVerificationCode } from "@/lib/email-verification";
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

  const clientIp = clientIpFromRequest(request);

  const result = await requestEmailVerificationCode({
    email: typeof body.email === "string" ? body.email : "",
    purpose: typeof body.purpose === "string" ? body.purpose : "",
    deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
    clientIp,
  });

  if (!result.ok) {
    const status = result.error === "rate_limited" ? 429 : result.error === "server_error" ? 500 : 400;
    return Response.json({ ok: false, error: result.error }, { status, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { ok: true, challengeId: result.challengeId, message: result.message },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
