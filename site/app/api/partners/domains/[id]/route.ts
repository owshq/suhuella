import {
  refreshPartnerCustomDomain,
  revokePartnerCustomDomain,
} from "@/lib/partners/custom-domains";
import { PARTNER_DOMAIN_ONBOARDING_COPY } from "@/lib/partners/domain-onboarding-copy";
import { PartnerAuthzError } from "@/lib/partners/authz";
import { PartnerError } from "@/lib/partners/errors";
import {
  rejectClientAuthorityFields,
  resolvePartnerHttpActor,
} from "@/lib/partners/http-actor";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function mapError(error: unknown) {
  if (error instanceof PartnerAuthzError) {
    return json({ ok: false, error: "forbidden", message: error.message }, error.status);
  }
  if (error instanceof PartnerError) {
    const code = error.code ?? (error.status === 503 ? "unavailable" : "request_failed");
    return json({ ok: false, error: code, message: error.message }, error.status);
  }
  return json({ ok: false, error: "server_error" }, 500);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
  const { actor } = gate;
  if (actor.kind === "platform") {
    return json(
      {
        ok: false,
        error: "partner_self_service_only",
        message: "Partners refresh DNS validation in /partners/portal.",
      },
      403,
    );
  }
  if (actor.kind === "partner" && actor.role !== "partner_admin") {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const { id } = await context.params;
  const domainId = id?.trim() ?? "";
  if (!domainId) return json({ ok: false, error: "invalid_request" }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (rejectClientAuthorityFields(body)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "refresh";
  const partnerId = actor.partnerId;
  if (!partnerId) return json({ ok: false, error: "invalid_request" }, 400);

  try {
    if (action === "refresh") {
      const view = await refreshPartnerCustomDomain(actor, { partnerId, domainId });
      return json({
        ok: true,
        domain: {
          id: view.domain.domainId,
          hostname: view.domain.hostname,
          status: view.domain.status,
          dnsTarget: view.domain.dnsTarget,
          validationErrors: view.domain.validationErrors,
          instructions: view.instructions,
          steps: view.steps,
          localDevMode: view.localDevMode,
          notes: view.dns.notes,
          sslStatus: view.sslStatus,
          ownershipStatus: view.ownershipStatus,
          nextAction:
            view.domain.status === "active"
              ? PARTNER_DOMAIN_ONBOARDING_COPY.apiNextActionActive.en
              : PARTNER_DOMAIN_ONBOARDING_COPY.apiNextActionPending.en,
        },
      });
    }
    return json({ ok: false, error: "invalid_request" }, 400);
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
  const { actor } = gate;
  if (actor.kind === "partner" && actor.role !== "partner_admin") {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const { id } = await context.params;
  const domainId = id?.trim() ?? "";
  const partnerId =
    actor.kind === "platform"
      ? request.nextUrl.searchParams.get("partnerId")?.trim() ?? ""
      : actor.partnerId;
  if (!domainId || !partnerId) return json({ ok: false, error: "invalid_request" }, 400);

  try {
    const domain = await revokePartnerCustomDomain(actor, { partnerId, domainId });
    return json({ ok: true, id: domain.domainId, status: domain.status });
  } catch (error) {
    return mapError(error);
  }
}
