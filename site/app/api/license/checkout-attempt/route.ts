import { isCheckoutPlan } from "@/lib/checkout";
import { createActivationAttempt } from "@/lib/activation-attempt";
import { clientIpFromRequest } from "@/lib/client-ip";
import { rawCardRejection } from "@/lib/raw-card-guard";
import { rejectIfCapabilityLimited, rejectIfRateLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cardRejected = rawCardRejection({ body });
  if (cardRejected) return cardRejected;

  const limited = await rejectIfCapabilityLimited("checkout");
  if (limited) return limited;

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const clientIp = clientIpFromRequest(request);
  const rateLimited = await rejectIfRateLimited([
    { key: `checkout-attempt:device:${deviceId || "unknown"}`, limit: 8 },
    ...(clientIp ? [{ key: `checkout-attempt:ip:${clientIp}`, limit: 20 }] : []),
  ]);
  if (rateLimited) return rateLimited;

  const planRaw = typeof body.plan === "string" ? body.plan : "";
  const result = await createActivationAttempt({
    deviceId,
    plan: isCheckoutPlan(planRaw) ? planRaw : null,
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json(
    { ok: true, activationAttemptId: result.activationAttemptId },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
