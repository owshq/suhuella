import { PartnerError, PartnerStoreUnavailableError, updatePartnerBranding } from "@/lib/partners";
import { PartnerAuthzError } from "@/lib/partners/authz";
import {
  rejectClientAuthorityFields,
  resolvePartnerHttpActor,
} from "@/lib/partners/http-actor";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Partner self-service branding.
 * partner_id / brand_id are derived from the authenticated actor — never from the body.
 */
export async function POST(request: NextRequest) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
  if (gate.actor.kind === "partner" && gate.actor.role !== "partner_admin") {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (rejectClientAuthorityFields(body)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const partnerId =
    gate.actor.kind === "platform"
      ? typeof body.targetPartnerId === "string"
        ? body.targetPartnerId.trim()
        : ""
      : gate.actor.partnerId;
  if (!partnerId) return json({ ok: false, error: "invalid_request" }, 400);

  try {
    const brand = await updatePartnerBranding(gate.actor, {
      partnerId,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      logoUrl:
        body.logoUrl === null
          ? null
          : typeof body.logoUrl === "string"
            ? body.logoUrl
            : undefined,
      accent:
        body.accent === null
          ? null
          : typeof body.accent === "string"
            ? body.accent
            : undefined,
      onAccent:
        body.onAccent === null
          ? null
          : typeof body.onAccent === "string"
            ? body.onAccent
            : undefined,
    });
    return json({
      ok: true,
      brand: {
        brandId: brand.brandId,
        displayName: brand.displayName,
        logoUrl: brand.logoUrl,
        accent: brand.accent,
        onAccent: brand.onAccent,
      },
    });
  } catch (error) {
    if (error instanceof PartnerStoreUnavailableError) {
      return json({ ok: false, error: "unavailable" }, 503);
    }
    if (error instanceof PartnerAuthzError) {
      return json({ ok: false, error: "forbidden", message: error.message }, error.status);
    }
    if (error instanceof PartnerError) {
      return json(
        { ok: false, error: error.code ?? "request_failed", message: error.message },
        error.status,
      );
    }
    return json({ ok: false, error: "server_error" }, 500);
  }
}
