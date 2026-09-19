import { clientIpFromRequest } from "@/lib/client-ip";
import { fulfillLicenseFromCheckout } from "@/lib/license-fulfillment";
import {
  getReleaseManifest,
  manifestToInstallerUrls,
} from "@/lib/release-manifest";
import { rejectIfDurableLicenseStateUnavailable, rejectIfRateLimited } from "@/lib/service-capability-guard";
import { verifyStripeCheckoutSession } from "@/lib/verify-stripe-session";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const durable = await rejectIfDurableLicenseStateUnavailable("checkout");
  if (durable) return durable;

  const clientIp = clientIpFromRequest(request);
  const rateLimited = await rejectIfRateLimited(
    clientIp ? [{ key: `verify-session:ip:${clientIp}`, limit: 20 }] : [],
  );
  if (rateLimited) return rateLimited;

  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return Response.json(
      { ok: false, error: "missing_session" },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";

  const result = await verifyStripeCheckoutSession(sessionId, secretKey, request.nextUrl.origin);

  if (!result.ok) {
    const status =
      result.error === "server_error"
        ? 500
        : result.error === "payment_incomplete"
          ? 402
          : 400;

    return Response.json(
      { ok: false, error: result.error },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const license = await fulfillLicenseFromCheckout(result.session);

  const release = await getReleaseManifest();
  const installers = release ? manifestToInstallerUrls(release) : { windows: "", mac: "" };

  if (!installers.windows || !installers.mac) {
    console.error(
      "Release manifest missing installer URLs after verified payment",
    );
  }

  return Response.json(
    {
      ok: true,
      installers,
      license,
      release: release
        ? {
            version: release.version,
            channel: release.channel,
            minimumVersion: release.minimumVersion,
            mandatory: release.mandatory,
          }
        : null,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
