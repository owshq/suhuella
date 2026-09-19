import { toPublicServiceHealth } from "@/lib/service-health";
import { readServiceHealth } from "@/lib/service-health-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await readServiceHealth();

  return Response.json(
    { ok: true, ...toPublicServiceHealth(health) },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=15, stale-while-revalidate=30",
      },
    },
  );
}
