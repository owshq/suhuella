import { actorFromRequest, businessErrorStatus } from "@/lib/business-auth";
import { withBusinessService } from "@/lib/business-persistence/store.ts";
import { BusinessPersistenceUnavailableError } from "@/lib/business-persistence/types.ts";
import type { BusinessSeatRole } from "@/lib/business-types";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organisationId = url.searchParams.get("organisationId")?.trim() ?? "";
  const actor = actorFromRequest(request, organisationId);
  if (!actor) return json({ ok: false, error: "forbidden" }, 403);

  try {
    const result = await withBusinessService((service) => service.listSeats(actor, organisationId));
    return result.ok
      ? json({ ok: true, ...result.value })
      : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
  } catch (error) {
    if (error instanceof BusinessPersistenceUnavailableError) {
      return json({ ok: false, error: "persistence_unavailable" }, 503);
    }
    return json({ ok: false, error: "server_error" }, 500);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const organisationId = typeof body.organisationId === "string" ? body.organisationId : "";
  const actor = actorFromRequest(request, organisationId);
  if (!actor) return json({ ok: false, error: "forbidden" }, 403);

  const action = typeof body.action === "string" ? body.action : "";
  const seatId = typeof body.seatId === "string" ? body.seatId : "";
  const email = typeof body.email === "string" ? body.email : "";
  const role = (typeof body.role === "string" ? body.role : "member") as BusinessSeatRole;

  try {
    switch (action) {
      case "invite": {
        const result = await withBusinessService((service) =>
          service.inviteSeat(actor, organisationId, email, role),
        );
        return result.ok
          ? json({ ok: true, seat: result.value })
          : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
      }
      case "remove": {
        const result = await withBusinessService((service) =>
          service.removeSeat(actor, organisationId, seatId),
        );
        return result.ok
          ? json({ ok: true, seat: result.value })
          : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
      }
      case "resend": {
        const result = await withBusinessService((service) =>
          service.resendInvitation(actor, organisationId, seatId),
        );
        return result.ok
          ? json({ ok: true, seat: result.value })
          : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
      }
      case "reset_devices": {
        const result = await withBusinessService((service) =>
          service.resetSeatDevices(actor, organisationId, seatId),
        );
        return result.ok
          ? json({ ok: true, ...result.value })
          : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
      }
      case "change_global_pricing":
        return json({ ok: false, error: "cannot_change_pricing" }, 403);
      case "grant_personal_lifetime":
        return json({ ok: false, error: "cannot_grant_lifetime" }, 403);
      case "access_other_organisation":
        return json({ ok: false, error: "cannot_access_other_organisation" }, 403);
      case "modify_recommendation_engine":
        return json({ ok: false, error: "cannot_modify_recommendation_engine" }, 403);
      case "modify_user_files":
        return json({ ok: false, error: "cannot_modify_user_files" }, 403);
      default:
        return json({ ok: false, error: "invalid_request" }, 400);
    }
  } catch (error) {
    if (error instanceof BusinessPersistenceUnavailableError) {
      return json({ ok: false, error: "persistence_unavailable" }, 503);
    }
    return json({ ok: false, error: "server_error" }, 500);
  }
}
