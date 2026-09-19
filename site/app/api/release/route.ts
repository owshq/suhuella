import { getReleaseManifest, publicReleasePayload } from "@/lib/release-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const release = await getReleaseManifest();

  if (!release) {
    return Response.json(
      { ok: false, error: "manifest_unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return Response.json(
    { ok: true, release: publicReleasePayload(release) },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=60" },
    },
  );
}
