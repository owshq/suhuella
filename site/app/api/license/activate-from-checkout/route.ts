import { clientIpFromRequest } from "@/lib/client-ip";
import { rawCardRejection } from "@/lib/raw-card-guard";
import { activateFromCheckoutSession, licenseErrorStatus } from "@/lib/license-service";
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
    { key: `license-activate-checkout:device:${deviceId || "unknown"}`, limit: 8 },
    ...(clientIp ? [{ key: `license-activate-checkout:ip:${clientIp}`, limit: 20 }] : []),
  ]);
  if (rateLimited) return rateLimited;

  const result = await activateFromCheckoutSession({
    sessionId: typeof body.sessionId === "string" ? body.sessionId : "",
    activationAttemptId:
      typeof body.activationAttemptId === "string" ? body.activationAttemptId : undefined,
    deviceId,
    deviceName: typeof body.deviceName === "string" ? body.deviceName : "",
    platform: typeof body.platform === "string" ? body.platform : "",
    appVersion: typeof body.appVersion === "string" ? body.appVersion : "",
    origin: request.nextUrl.origin,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: licenseErrorStatus(result.error), headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    {
      ok: true,
      license: result.session?.context ?? result.context,
      devices: result.session?.devices ?? [],
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
