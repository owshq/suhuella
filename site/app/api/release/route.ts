import { publicReleasePayload } from "@/lib/installer-availability";
import { getReleaseManifest } from "@/lib/release-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const release = await getReleaseManifest();
  if (!release) {
    return Response.json(
      { ok: false, error: "release_unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return Response.json(
    {
      ok: true,
      release: publicReleasePayload(release),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
