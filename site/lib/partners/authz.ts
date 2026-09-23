import type { PartnerActor, PartnerMemberRole } from "./types.ts";

export class PartnerAuthzError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PartnerAuthzError";
    this.status = status;
  }
}

export function assertPlatformActor(actor: PartnerActor): asserts actor is Extract<
  PartnerActor,
  { kind: "platform" }
> {
  if (actor.kind !== "platform") {
    throw new PartnerAuthzError("Only SuHuella platform operators can perform this action.");
  }
}

export function assertPartnerScope(
  actor: PartnerActor,
  partnerId: string,
  minRole: PartnerMemberRole = "partner_member",
): void {
  if (actor.kind === "platform") return;
  if (actor.partnerId !== partnerId) {
    throw new PartnerAuthzError("Partner tenants cannot access another partner.");
  }
  if (minRole === "partner_admin" && actor.role !== "partner_admin") {
    throw new PartnerAuthzError("Partner admin role required.");
  }
}

/**
 * brand_id from the browser is never authoritative.
 * Resolve brand from the partner record / verified hostname instead.
 */
export function rejectClientBrandId(brandIdFromClient: unknown): void {
  if (brandIdFromClient !== undefined && brandIdFromClient !== null && brandIdFromClient !== "") {
    throw new PartnerAuthzError("brand_id from the client is not trusted.", 400);
  }
}
