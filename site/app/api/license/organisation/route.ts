import { clientIpFromRequest } from "@/lib/client-ip";
import {
  manageOrganisation,
  organisationErrorStatus,
  organisationForLicense,
  type OrganisationAction,
} from "@/lib/license-service";
import { rejectIfCapabilityLimited, rejectIfRateLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const limited = await rejectIfCapabilityLimited("license-check");
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const clientIp = clientIpFromRequest(request);
  const rateLimited = await rejectIfRateLimited([
    { key: `license-organisation:device:${deviceId || "unknown"}`, limit: 40 },
    ...(clientIp ? [{ key: `license-organisation:ip:${clientIp}`, limit: 80 }] : []),
  ]);
  if (rateLimited) return rateLimited;

  const tokenInput = {
    deviceId,
    licenseToken: typeof body.licenseToken === "string" ? body.licenseToken : "",
  };
  const action = typeof body.action === "string" ? body.action : "";
  const result = action
    ? await manageOrganisation({
        ...tokenInput,
        action: action as OrganisationAction,
        seatId: typeof body.seatId === "string" ? body.seatId : "",
        email: typeof body.email === "string" ? body.email : "",
        seatCount: typeof body.seatCount === "number" ? body.seatCount : Number(body.seatCount),
      })
    : await organisationForLicense(tokenInput);

  return result.ok
    ? json({ ok: true, organisation: result.organisation })
    : json({ ok: false, error: result.error }, organisationErrorStatus(result.error));
}
