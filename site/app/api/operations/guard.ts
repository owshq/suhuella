import { authenticateOperations, operationsAuthHeaders } from "@/lib/operations/auth";
import type { OperationsActor } from "@/lib/operations/types";

export async function requireOperationsActor(
  request: Request,
): Promise<
  | { ok: true; actor: OperationsActor; authMethod: "cloudflare_access" | "localhost" }
  | { ok: false; response: Response }
> {
  const result = await authenticateOperations(request.headers);
  if (!result.ok) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: result.error, message: result.message },
        { status: result.status, headers: operationsAuthHeaders() },
      ),
    };
  }

  return {
    ok: true,
    actor: result.actor,
    authMethod: result.authMethod,
  };
}
