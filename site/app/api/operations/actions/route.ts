import { parseOperationsAction } from "@/lib/operations/actions";
import { operationsAuthHeaders } from "@/lib/operations/auth";
import {
  OperationsError,
  performOperationsAction,
} from "@/lib/operations/service";
import { getReleaseManifest } from "@/lib/release-manifest";
import { requireOperationsActor } from "../guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireOperationsActor(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json", message: "Expected a JSON body." },
      { status: 400, headers: operationsAuthHeaders() },
    );
  }

  let action;
  try {
    action = parseOperationsAction(body);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "invalid_action",
        message: error instanceof Error ? error.message : "Invalid action.",
      },
      { status: 400, headers: operationsAuthHeaders() },
    );
  }

  try {
    const [snapshot, release] = await Promise.all([
      performOperationsAction(auth.actor, action),
      getReleaseManifest(),
    ]);

    return Response.json(
      { ok: true, snapshot, release },
      { status: 200, headers: operationsAuthHeaders() },
    );
  } catch (error) {
    if (error instanceof OperationsError) {
      return Response.json(
        { ok: false, error: "rejected", message: error.message },
        { status: error.status, headers: operationsAuthHeaders() },
      );
    }

    console.error("Operations action failed", error);
    return Response.json(
      { ok: false, error: "server_error", message: "The action could not be completed." },
      { status: 500, headers: operationsAuthHeaders() },
    );
  }
}
