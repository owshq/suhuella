import { hmacLegacySigningSelfCheck, operatorTaskAuthorized, sendDesktopUpdateNotices } from "@/lib/license-desktop-update-notice";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!operatorTaskAuthorized(request.headers.get("x-suhuella-operator-token"))) {
    return new Response("Not found", { status: 404 });
  }

  const hmacLegacyOk = await hmacLegacySigningSelfCheck();
  const mail = await sendDesktopUpdateNotices();

  return Response.json(
    {
      ok: mail.failed.length === 0 && hmacLegacyOk,
      hmacLegacyOk,
      sent: mail.sent.length,
      failed: mail.failed.length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
