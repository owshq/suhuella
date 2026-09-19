import { businessService } from "@/lib/business-service";
import { normalizeEmail } from "@/lib/license-context";
import { rejectIfCapabilityLimited } from "@/lib/service-capability-guard";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await rejectIfCapabilityLimited("business-branding");
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const organisationId = typeof body.organisationId === "string" ? body.organisationId : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : body.dataUrl === null ? null : undefined;
  const claimedType = typeof body.claimedType === "string" ? body.claimedType : undefined;

  if (!organisationId || !email) {
    return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const result = businessService.setBranding(email, organisationId, {
    dataUrl,
    claimedType,
  });
  if (!result.ok) {
    const status = result.error === "forbidden" ? 403 : result.error === "not_found" ? 404 : 400;
    return Response.json({ ok: false, error: result.error }, { status });
  }

  return Response.json({ ok: true, branding: { organisationId, updatedAt: result.value.updatedAt } }, { status: 200 });
}
