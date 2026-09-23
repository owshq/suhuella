import {
  listPartnerCustomDomains,
  registerPartnerCustomDomain,
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

export async function GET(request: NextRequest) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
  const { actor } = gate;
  const partnerId =
    actor.kind === "platform"
      ? request.nextUrl.searchParams.get("partnerId")?.trim() ?? ""
      : actor.partnerId;
  if (!partnerId) return json({ ok: false, error: "invalid_request" }, 400);
  try {
    if (actor.kind === "partner" && actor.partnerId !== partnerId) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    const domains = await listPartnerCustomDomains(actor, partnerId);
    return json({
      ok: true,
      domains: domains.map((item) => ({
        id: item.domain.domainId,
        hostname: item.domain.hostname,
        status: item.domain.status,
        dnsTarget: item.domain.dnsTarget,
        validationErrors: item.domain.validationErrors,
        instructions: item.instructions,
        steps: item.steps,
        localDevMode: item.localDevMode,
        notes: item.dns.notes,
        sslStatus: item.sslStatus,
        ownershipStatus: item.ownershipStatus,
      })),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);
  const { actor } = gate;
  if (actor.kind === "platform") {
    return json(
      {
        ok: false,
        error: "partner_self_service_only",
        message: "Partners configure hostname and DNS in /partners/portal.",
      },
      403,
    );
  }
  if (actor.kind === "partner" && actor.role !== "partner_admin") {
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

  const hostname = typeof body.hostname === "string" ? body.hostname : "";
  const partnerId =
    actor.kind === "platform"
      ? typeof body.targetPartnerId === "string"
        ? body.targetPartnerId.trim()
        : ""
      : actor.partnerId;
  if (!hostname || !partnerId) return json({ ok: false, error: "invalid_request" }, 400);

  try {
    const view = await registerPartnerCustomDomain(actor, { partnerId, hostname });
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
        nextAction:
          view.domain.status === "active"
            ? PARTNER_DOMAIN_ONBOARDING_COPY.apiNextActionActive.en
            : PARTNER_DOMAIN_ONBOARDING_COPY.apiNextActionPending.en,
      },
    });
  } catch (error) {
    return mapError(error);
  }
}
