import { checkLicense, licenseErrorStatus } from "./license-service.ts";
import { rejectIfCapabilityLimited, rejectIfRateLimited } from "./service-capability-guard.ts";

export type LicenseCheckRouteBody = {
  deviceId?: string;
  licenseToken?: string;
  deviceName?: string;
};

/** Shared POST /api/license/check logic — imported by route and integration checks. */
export async function handleLicenseCheckPost(
  body: LicenseCheckRouteBody,
  options: { clientIp?: string | null } = {},
): Promise<Response> {
  const limited = await rejectIfCapabilityLimited("license-check");
  if (limited) return limited;

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  const clientIp = options.clientIp?.trim() || null;
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
      { ok: false, error: result.error, devices: result.devices ?? [] },
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
