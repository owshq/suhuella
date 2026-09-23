import { clientIpFromRequest } from "@/lib/client-ip";
import { rawCardRejection } from "@/lib/raw-card-guard";
import { reconcilePaidCheckoutSession } from "@/lib/checkout-reconciliation";
import {
  getReleaseManifest,
  manifestToInstallerUrls,
} from "@/lib/release-manifest";
import { rejectIfDurableLicenseStateUnavailable, rejectIfRateLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cardRejected = rawCardRejection({ searchParams: request.nextUrl.searchParams });
  if (cardRejected) return cardRejected;

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

  const result = await reconcilePaidCheckoutSession({
    sessionId,
    secretKey,
    origin: request.nextUrl.origin,
  });

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

  const license = result.license;

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
