import { clientIpFromRequest } from "@/lib/client-ip";
import { checkLicense, licenseErrorStatus } from "@/lib/license-service";
import { rejectIfCapabilityLimited, rejectIfRateLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await rejectIfCapabilityLimited("license-check");
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

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const clientIp = clientIpFromRequest(request);
  const rateLimited = await rejectIfRateLimited([
    { key: `license-check:device:${deviceId || "unknown"}`, limit: 60 },
    ...(clientIp ? [{ key: `license-check:ip:${clientIp}`, limit: 120 }] : []),
  ]);
  if (rateLimited) return rateLimited;

  const result = await checkLicense({
    deviceId,
    licenseToken: typeof body.licenseToken === "string" ? body.licenseToken : "",
    deviceName: typeof body.deviceName === "string" ? body.deviceName : undefined,
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
