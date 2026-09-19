import { deactivateLicense, licenseErrorStatus } from "@/lib/license-service";
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

  const result = await deactivateLicense({
    deviceId: typeof body.deviceId === "string" ? body.deviceId : "",
    licenseToken: typeof body.licenseToken === "string" ? body.licenseToken : "",
    targetDeviceId:
      typeof body.targetDeviceId === "string" ? body.targetDeviceId : undefined,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error },
      { status: licenseErrorStatus(result.error), headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { ok: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
