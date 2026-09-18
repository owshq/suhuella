import { getInstallerUrls } from "@/lib/downloads";
import { verifyStripeCheckoutSession } from "@/lib/verify-stripe-session";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY is not configured");
    return Response.json(
      { ok: false, error: "server_error" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const result = await verifyStripeCheckoutSession(sessionId, secretKey);

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

  return Response.json(
    {
      ok: true,
      installers: getInstallerUrls(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
