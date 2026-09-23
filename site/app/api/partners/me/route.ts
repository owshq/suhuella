import { getPartnerSummary, PartnerError, PartnerStoreUnavailableError } from "@/lib/partners";
import { listPartnerCustomDomains } from "@/lib/partners/custom-domains";
import { resolvePartnerHttpActor } from "@/lib/partners/http-actor";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Current partner session + brand + domains (no secrets, no Cloudflare ids). */
export async function GET(request: NextRequest) {
  const gate = await resolvePartnerHttpActor(request);
  if (!gate.ok) return json({ ok: false, error: gate.error }, gate.status);

  try {
    if (gate.actor.kind !== "partner") {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    const summary = await getPartnerSummary(gate.actor, gate.actor.partnerId);
    const domains = await listPartnerCustomDomains(gate.actor, gate.actor.partnerId);
    return json({
      ok: true,
      email: gate.actor.email,
      role: gate.actor.role,
      partnerDisplayName: summary.partner.displayName,
      partnerStatus: summary.partner.status,
      entitlement: summary.entitlement
        ? {
            status: summary.entitlement.status,
            origin: summary.entitlement.origin,
            validUntil: summary.entitlement.validUntil,
            commercialReference: summary.entitlement.stripeSubscriptionId,
          }
        : null,
      partnerStripe: {
        connected: false,
        note: "Customer billing on the partner's own Stripe account is not integrated. SuHuella does not store those keys. The annual platform fee, when charged, uses SuHuella's Stripe account only.",
      },
      brand: {
        brandId: summary.brand.brandId,
        displayName: summary.brand.displayName,
        logoUrl: summary.brand.logoUrl,
        accent: summary.brand.accent,
        onAccent: summary.brand.onAccent,
      },
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
      nextAction:
        domains.length === 0
          ? "add_hostname"
          : domains.some((item) => item.domain.status === "pending" || item.domain.status === "failed")
            ? "refresh_dns"
            : domains.some((item) => item.domain.status === "active")
              ? "ready"
              : "review_status",
    });
  } catch (error) {
    if (error instanceof PartnerStoreUnavailableError) {
      return json({ ok: false, error: "unavailable" }, 503);
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
