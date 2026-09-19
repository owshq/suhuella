import { operationsAuthHeaders } from "@/lib/operations/auth";
import { readOperationsSnapshot } from "@/lib/operations/service";
import { getReleaseManifest } from "@/lib/release-manifest";
import { requireOperationsActor } from "../guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperationsActor(request);
  if (!auth.ok) return auth.response;

  const [snapshot, release] = await Promise.all([
    readOperationsSnapshot(auth.actor),
    getReleaseManifest(),
  ]);

  return Response.json(
    { ok: true, snapshot, release },
    { status: 200, headers: operationsAuthHeaders() },
  );
}
