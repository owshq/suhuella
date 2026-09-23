import { businessErrorStatus } from "@/lib/business-auth";
import { getBusinessPricingConfig } from "@/lib/business-config";
import { businessService } from "@/lib/business-service";
import type { BusinessSeatRole } from "@/lib/business-types";
import { requireOperationsActor } from "../../operations/guard";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await requireOperationsActor(request);
  if (!auth.ok) return auth.response;
  const actor = { kind: "superadmin" as const };

  const listed = businessService.listAccounts(actor);
  if (!listed.ok) return json({ ok: false, error: listed.error }, businessErrorStatus(listed.error));

  return json({
    ok: true,
    pricing: getBusinessPricingConfig(),
    accounts: listed.value,
  });
}

export async function POST(request: Request) {
  const auth = await requireOperationsActor(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const organisationId =
    typeof body.organisationId === "string" ? body.organisationId : "";
  const seatId = typeof body.seatId === "string" ? body.seatId : "";
  const email = typeof body.email === "string" ? body.email : "";
  const role = (typeof body.role === "string" ? body.role : "member") as BusinessSeatRole;
  const scopedActor = { kind: "superadmin" as const };

  switch (action) {
    case "create_account": {
      const result = businessService.createAccount(scopedActor, {
        name: typeof body.name === "string" ? body.name : "",
        seatLimit: typeof body.seatLimit === "number" ? body.seatLimit : undefined,
        ownerEmail: email || undefined,
        billingCustomerId:
          typeof body.billingCustomerId === "string" ? body.billingCustomerId : undefined,
        status: body.status === "trial" ? "trial" : "active",
        trialDays: typeof body.trialDays === "number" ? body.trialDays : undefined,
      });
      return result.ok
        ? json({ ok: true, ...result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "set_seat_count": {
      const result = await businessService.changeSeatQuantity(
        scopedActor,
        organisationId,
        typeof body.seatLimit === "number" ? body.seatLimit : 0,
        {
          source: "ops",
          reason: typeof body.reason === "string" ? body.reason : "Admin seat quantity change",
        },
      );
      return result.ok
        ? json({ ok: true, account: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "change_plan": {
      const result = businessService.changePlan(
        scopedActor,
        organisationId,
        typeof body.plan === "string" ? body.plan : "",
      );
      return result.ok
        ? json({ ok: true, account: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "suspend_organisation": {
      const result = businessService.setOrganisationStatus(
        scopedActor,
        organisationId,
        "suspended",
      );
      return result.ok
        ? json({ ok: true, account: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "reactivate_organisation": {
      const result = businessService.setOrganisationStatus(scopedActor, organisationId, "active");
      return result.ok
        ? json({ ok: true, account: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "grant_trial": {
      const result = businessService.grantTrial(
        scopedActor,
        organisationId,
        typeof body.days === "number" ? body.days : 0,
      );
      return result.ok
        ? json({ ok: true, account: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "add_seat":
    case "invite": {
      const result = businessService.inviteSeat(scopedActor, organisationId, email, role);
      return result.ok
        ? json({ ok: true, seat: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "remove_seat": {
      const result = businessService.removeSeat(scopedActor, organisationId, seatId);
      return result.ok
        ? json({ ok: true, seat: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "resend_invitation": {
      const result = businessService.resendInvitation(scopedActor, organisationId, seatId);
      return result.ok
        ? json({ ok: true, seat: result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "reset_devices": {
      const result = await businessService.resetSeatDevices(scopedActor, organisationId, seatId);
      return result.ok
        ? json({ ok: true, ...result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "convert_license": {
      const result = await businessService.convertLicense(scopedActor, {
        organisationId,
        licenseId: typeof body.licenseId === "string" ? body.licenseId : undefined,
        email,
        role,
      });
      return result.ok
        ? json({ ok: true, ...result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "inspect_license": {
      const result = await businessService.inspectLicense(
        scopedActor,
        organisationId,
        seatId || undefined,
      );
      return result.ok
        ? json({ ok: true, ...result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "list_seats": {
      const result = businessService.listSeats(scopedActor, organisationId);
      return result.ok
        ? json({ ok: true, ...result.value })
        : json({ ok: false, error: result.error }, businessErrorStatus(result.error));
    }
    case "change_global_pricing":
      return json({ ok: false, error: "cannot_change_pricing" }, 403);
    case "grant_personal_lifetime":
      return json({ ok: false, error: "cannot_grant_lifetime" }, 403);
    default:
      return json({ ok: false, error: "invalid_request" }, 400);
  }
}
