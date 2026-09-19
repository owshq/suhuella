import { operationsAuthHeaders } from "@/lib/operations/auth";
import { buildOperationsSession } from "@/lib/operations/session";
import { requireOperationsActor } from "../guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperationsActor(request);
  if (!auth.ok) return auth.response;

  const session = buildOperationsSession(
    auth.actor,
    request.headers,
    auth.authMethod,
  );

  return Response.json(
    { ok: true, actor: auth.actor, session },
    { status: 200, headers: operationsAuthHeaders() },
  );
}
