import {
  getBusinessPricingConfig,
  monthlyAmountCents,
  type BusinessPricingConfig,
} from "./business-config.ts";
import {
  defaultBusinessStore,
  type BusinessStore,
} from "./business-store.ts";
import {
  canChangeBusinessLogo,
  effectiveBusinessLogo,
  validateBusinessLogo,
} from "./business-branding.ts";
import type {
  BusinessAccount,
  BusinessAccountStatus,
  BusinessActor,
  BusinessBranding,
  BusinessError,
  BusinessSeat,
  BusinessSeatRole,
} from "./business-types.ts";
import { OCCUPIED_SEAT_STATUSES } from "./business-types.ts";
import {
  capabilitiesForEdition,
  deviceLimitForEdition,
  isValidEmail,
  knowledgeSourcesForEdition,
  normalizeEmail,
  type LicenseContext,
  type LicenseGrant,
  type LicenseOrigin,
} from "./license-context.ts";
import {
  findGrantByEmail,
  findGrantByLicenseId,
  listActivations,
  resetActivations,
  upsertStoredGrant,
} from "./license-store.ts";

export type BusinessResult<T> = { ok: true; value: T } | { ok: false; error: BusinessError };

export type LicenseBridge = {
  findGrantByEmail(email: string): LicenseGrant | undefined | Promise<LicenseGrant | undefined>;
  findGrantByLicenseId(licenseId: string): LicenseGrant | undefined | Promise<LicenseGrant | undefined>;
  upsertGrant(grant: LicenseGrant): LicenseGrant | Promise<LicenseGrant>;
  resetActivations(licenseId: string): Promise<number>;
  listActivations(licenseId: string): Promise<{ deviceId: string; status: string }[]>;
};

const defaultLicenseBridge: LicenseBridge = {
  findGrantByEmail,
  findGrantByLicenseId,
  upsertGrant: upsertStoredGrant,
  resetActivations,
  listActivations,
};

function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function occupiedSeats(seats: BusinessSeat[], organisationId: string): BusinessSeat[] {
  return seats.filter(
    (seat) =>
      seat.organisationId === organisationId && OCCUPIED_SEAT_STATUSES.includes(seat.status),
  );
}

function canManageSeats(actor: BusinessActor, organisationId: string, seats: BusinessSeat[]): boolean {
  if (actor.kind === "superadmin") return true;
  if (actor.organisationId !== organisationId) return false;
  const seat = seats.find(
    (item) =>
      item.organisationId === organisationId &&
      item.email === normalizeEmail(actor.email) &&
      (item.status === "invited" || item.status === "active") &&
      (item.role === "owner" || item.role === "admin"),
  );
  return Boolean(seat);
}

function forbidCrossOrg(actor: BusinessActor, organisationId: string): BusinessError | null {
  if (actor.kind === "superadmin") return null;
  if (actor.organisationId !== organisationId) return "cannot_access_other_organisation";
  return null;
}

export function effectiveLogoForAccount(account: BusinessAccount): string | null {
  const branding =
    defaultBusinessStore
      .load()
      .brandings.find((item) => item.organisationId === account.organisationId) ?? null;
  return effectiveBusinessLogo(account, branding);
}

export function grantFromBusinessSeat(
  account: BusinessAccount,
  seat: BusinessSeat,
  now = new Date(),
): LicenseGrant | null {
  if (seat.status === "removed") return null;

  let status: LicenseGrant["status"] = "active";
  if (account.status === "suspended" || seat.status === "suspended") {
    status = "revoked";
  } else if (account.status === "trial" && account.trialEndsAt) {
    if (new Date(account.trialEndsAt).getTime() < now.getTime()) {
      status = "expired";
    }
  }

  return {
    email: seat.email,
    customerId: account.billingCustomerId,
    licenseId: seat.licenseId,
    edition: "business",
    origin: "business",
    status,
    deviceLimit: deviceLimitForEdition("business"),
    validUntil: account.trialEndsAt,
    organisationId: account.organisationId,
    organisationName: account.name,
    seatId: seat.seatId,
    memberRole: seat.role,
    channel: "stable",
    isPaid: account.status !== "trial",
    isGifted: false,
    isRevocableByAdmin: false,
    entitlementStatus:
      status === "revoked" ? "suspended_seat" : status === "expired" ? "expired" : "active",
  };
}

export function licenseContextFromBusinessSeat(
  account: BusinessAccount,
  seat: BusinessSeat,
  activatedDevices = 0,
  now = new Date(),
): Omit<LicenseContext, "licenseToken"> | null {
  const grant = grantFromBusinessSeat(account, seat, now);
  if (!grant) return null;

  return {
    licenseId: grant.licenseId,
    customerId: grant.customerId,
    email: grant.email,
    edition: "business",
    status: grant.status,
    capabilities: capabilitiesForEdition("business"),
    enabledKnowledgeSources: knowledgeSourcesForEdition("business"),
    deviceLimit: deviceLimitForEdition("business", grant.deviceLimit),
    activatedDevices,
    organisationId: account.organisationId,
    organisationName: account.name,
    organisationLogo: effectiveLogoForAccount(account),
    seatId: seat.seatId,
    memberRole: seat.role,
    validUntil: grant.validUntil ?? null,
    lastCheckedAt: now.toISOString(),
    offlineUntil: grant.validUntil ?? now.toISOString(),
    channel: "stable",
  };
}

export function createBusinessService(options?: {
  store?: BusinessStore;
  pricing?: BusinessPricingConfig;
  licenses?: LicenseBridge;
  now?: () => Date;
}) {
  const store = options?.store ?? defaultBusinessStore;
  const licenses = options?.licenses ?? defaultLicenseBridge;
  const now = options?.now ?? (() => new Date());

  function pricing(): BusinessPricingConfig {
    return options?.pricing ?? getBusinessPricingConfig();
  }

  function snapshot() {
    return store.load();
  }

  function persist(next: ReturnType<typeof snapshot>) {
    store.save(next);
  }

  function findAccount(organisationId: string): BusinessAccount | undefined {
    return snapshot().accounts.find((item) => item.organisationId === organisationId);
  }

  function findSeat(organisationId: string, seatId: string): BusinessSeat | undefined {
    return snapshot().seats.find(
      (item) => item.organisationId === organisationId && item.seatId === seatId,
    );
  }

  function findOccupiedByEmail(organisationId: string, email: string): BusinessSeat | undefined {
    const normalized = normalizeEmail(email);
    return occupiedSeats(snapshot().seats, organisationId).find((item) => item.email === normalized);
  }

  function findBusinessGrantByEmail(email: string): LicenseGrant | undefined {
    const normalized = normalizeEmail(email);
    const data = snapshot();
    const seat = data.seats.find(
      (item) => item.email === normalized && OCCUPIED_SEAT_STATUSES.includes(item.status),
    );
    if (!seat) return undefined;
    const account = data.accounts.find((item) => item.organisationId === seat.organisationId);
    if (!account) return undefined;
    return grantFromBusinessSeat(account, seat, now()) ?? undefined;
  }

  function requireManager(
    actor: BusinessActor,
    organisationId: string,
  ): BusinessError | null {
    const cross = forbidCrossOrg(actor, organisationId);
    if (cross) return cross;
    if (!canManageSeats(actor, organisationId, snapshot().seats)) return "forbidden";
    return null;
  }

  function createAccount(
    actor: BusinessActor,
    input: {
      name: string;
      seatLimit?: number;
      ownerEmail?: string;
      billingCustomerId?: string;
      status?: BusinessAccountStatus;
      trialDays?: number;
      plan?: BusinessAccount["plan"];
    },
  ): BusinessResult<{ account: BusinessAccount; owner?: BusinessSeat }> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const name = input.name?.trim() ?? "";
    if (!name) return { ok: false, error: "invalid_request" };

    const config = pricing();
    const plan = input.plan === "enterprise" ? "enterprise" : "business";
    const minSeats = plan === "enterprise" ? 1 : config.minSeats;
    const seatLimit = input.seatLimit ?? minSeats;
    if (seatLimit < minSeats) return { ok: false, error: "min_seats" };

    const createdAt = now().toISOString();
    const trialDays = input.trialDays ?? 0;
    const status: BusinessAccountStatus =
      input.status === "trial" || trialDays > 0 ? "trial" : (input.status ?? "active");
    const ownerEmail = input.ownerEmail ? normalizeEmail(input.ownerEmail) : null;
    const account: BusinessAccount = {
      organisationId: newId("org"),
      name,
      billingCustomerId: input.billingCustomerId?.trim() || newId("cust"),
      ownerEmail,
      plan,
      seatLimit,
      seatPriceCents: config.seatPriceCents,
      currency: config.currency,
      status,
      trialEndsAt:
        status === "trial"
          ? new Date(now().getTime() + Math.max(trialDays, 1) * 24 * 60 * 60 * 1000).toISOString()
          : null,
      createdAt,
      updatedAt: createdAt,
    };

    const data = snapshot();
    data.accounts.push(account);

    let owner: BusinessSeat | undefined;
    if (input.ownerEmail) {
      if (!isValidEmail(input.ownerEmail)) return { ok: false, error: "invalid_request" };
      owner = {
        seatId: newId("seat"),
        organisationId: account.organisationId,
        email: normalizeEmail(input.ownerEmail),
        role: "owner",
        status: "invited",
        licenseId: newId("lic"),
        invitedAt: createdAt,
        activatedAt: null,
        lastSeenAt: null,
      };
      data.seats.push(owner);
    }

    persist(data);
    return { ok: true, value: { account, owner } };
  }

  function setSeatCount(
    actor: BusinessActor,
    organisationId: string,
    seatLimit: number,
  ): BusinessResult<BusinessAccount> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const config = pricing();
    const minSeats = account.plan === "enterprise" ? 1 : config.minSeats;
    if (seatLimit < minSeats) return { ok: false, error: "min_seats" };
    const assigned = occupiedSeats(snapshot().seats, organisationId).length;
    if (seatLimit < assigned) return { ok: false, error: "seat_in_use" };

    const data = snapshot();
    const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
    const next = { ...account, seatLimit, updatedAt: now().toISOString() };
    data.accounts[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  function changePlan(
    actor: BusinessActor,
    organisationId: string,
    plan: string,
  ): BusinessResult<BusinessAccount> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    if (plan !== "business" && plan !== "enterprise") {
      return { ok: false, error: "unsupported_plan" };
    }
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const data = snapshot();
    const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
    const next = {
      ...account,
      plan: plan === "enterprise" ? ("enterprise" as const) : ("business" as const),
      updatedAt: now().toISOString(),
    };
    data.accounts[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  function setOrganisationStatus(
    actor: BusinessActor,
    organisationId: string,
    status: BusinessAccountStatus,
  ): BusinessResult<BusinessAccount> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    if (status === "suspended" && account.status !== "trial") {
      return { ok: false, error: "cannot_revoke_paid_license" };
    }
    const data = snapshot();
    const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
    const next = {
      ...account,
      status,
      trialEndsAt: status === "trial" ? account.trialEndsAt : status === "active" ? null : account.trialEndsAt,
      updatedAt: now().toISOString(),
    };
    data.accounts[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  function grantTrial(
    actor: BusinessActor,
    organisationId: string,
    days: number,
  ): BusinessResult<BusinessAccount> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    if (!Number.isFinite(days) || days <= 0) return { ok: false, error: "invalid_request" };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const data = snapshot();
    const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
    const next: BusinessAccount = {
      ...account,
      status: "trial",
      trialEndsAt: new Date(now().getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now().toISOString(),
    };
    data.accounts[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  function inviteSeat(
    actor: BusinessActor,
    organisationId: string,
    email: string,
    role: BusinessSeatRole = "member",
  ): BusinessResult<BusinessSeat> {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    if (role === "owner" && actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    if (!isValidEmail(email)) return { ok: false, error: "invalid_request" };

    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    if (findOccupiedByEmail(organisationId, email)) {
      return { ok: false, error: "duplicate_email" };
    }

    const assigned = occupiedSeats(snapshot().seats, organisationId).length;
    if (assigned >= account.seatLimit) return { ok: false, error: "seat_limit" };

    const invitedAt = now().toISOString();
    const seat: BusinessSeat = {
      seatId: newId("seat"),
      organisationId,
      email: normalizeEmail(email),
      role,
      status: "invited",
      licenseId: newId("lic"),
      invitedAt,
      activatedAt: null,
      lastSeenAt: null,
    };
    const data = snapshot();
    data.seats.push(seat);
    persist(data);
    return { ok: true, value: seat };
  }

  function removeSeat(
    actor: BusinessActor,
    organisationId: string,
    seatId: string,
  ): BusinessResult<BusinessSeat> {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    const seat = findSeat(organisationId, seatId);
    if (!seat || seat.status === "removed") return { ok: false, error: "not_found" };

    const data = snapshot();
    const index = data.seats.findIndex((item) => item.seatId === seatId);
    const next = { ...seat, status: "removed" as const };
    data.seats[index] = next;
    persist(data);
    void licenses.resetActivations(seat.licenseId);
    return { ok: true, value: next };
  }

  function resendInvitation(
    actor: BusinessActor,
    organisationId: string,
    seatId: string,
  ): BusinessResult<BusinessSeat> {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    const seat = findSeat(organisationId, seatId);
    if (!seat || seat.status === "removed") return { ok: false, error: "not_found" };
    const data = snapshot();
    const index = data.seats.findIndex((item) => item.seatId === seatId);
    const next = {
      ...seat,
      status: seat.status === "suspended" ? seat.status : ("invited" as const),
      invitedAt: now().toISOString(),
    };
    data.seats[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  async function resetSeatDevices(
    actor: BusinessActor,
    organisationId: string,
    seatId: string,
  ): Promise<BusinessResult<{ seat: BusinessSeat; reset: number }>> {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    const seat = findSeat(organisationId, seatId);
    if (!seat || seat.status === "removed") return { ok: false, error: "not_found" };
    const reset = await licenses.resetActivations(seat.licenseId);
    return { ok: true, value: { seat, reset } };
  }

  async function convertLicense(
    actor: BusinessActor,
    input: {
      organisationId: string;
      licenseId?: string;
      email?: string;
      role?: BusinessSeatRole;
    },
  ): Promise<BusinessResult<{ seat: BusinessSeat; grant: LicenseGrant }>> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const account = findAccount(input.organisationId);
    if (!account) return { ok: false, error: "not_found" };

    const source =
      (input.licenseId ? await Promise.resolve(licenses.findGrantByLicenseId(input.licenseId)) : undefined) ??
      (input.email ? await Promise.resolve(licenses.findGrantByEmail(input.email)) : undefined);
    if (!source) return { ok: false, error: "not_found" };
    if (source.edition === "business" || source.edition === "enterprise") {
      return { ok: false, error: "invalid_request" };
    }

    const invited = inviteSeat(
      actor,
      input.organisationId,
      source.email,
      input.role ?? "member",
    );
    if (!invited.ok) return invited;

    const data = snapshot();
    const index = data.seats.findIndex((item) => item.seatId === invited.value.seatId);
    const seat = { ...invited.value, licenseId: source.licenseId };
    data.seats[index] = seat;
    const grant: LicenseGrant = {
      ...source,
      origin: source.origin,
      edition: "business",
      organisationId: account.organisationId,
      organisationName: account.name,
      seatId: seat.seatId,
      isPaid: account.status !== "trial",
      isGifted: false,
      isRevocableByAdmin: false,
    };
    const grantIndex = data.grants.findIndex((item) => item.licenseId === source.licenseId);
    if (grantIndex === -1) data.grants.push(grant);
    else data.grants[grantIndex] = grant;
    persist(data);
    await Promise.resolve(licenses.upsertGrant(grant));
    return { ok: true, value: { seat, grant } };
  }

  function grantPersonalLifetime(): BusinessResult<never> {
    return { ok: false, error: "cannot_grant_lifetime" };
  }

  function changeGlobalPricing(): BusinessResult<never> {
    return { ok: false, error: "cannot_change_pricing" };
  }

  function modifyRecommendationEngine(): BusinessResult<never> {
    return { ok: false, error: "cannot_modify_recommendation_engine" };
  }

  function modifyUserFiles(): BusinessResult<never> {
    return { ok: false, error: "cannot_modify_user_files" };
  }

  function touchSeat(email: string): BusinessSeat | undefined {
    const normalized = normalizeEmail(email);
    const data = snapshot();
    const index = data.seats.findIndex(
      (item) => item.email === normalized && OCCUPIED_SEAT_STATUSES.includes(item.status),
    );
    if (index === -1) return undefined;
    const seat = data.seats[index];
    if (seat.status === "suspended") return seat;
    const stamped = now().toISOString();
    const next: BusinessSeat = {
      ...seat,
      status: "active",
      activatedAt: seat.activatedAt ?? stamped,
      lastSeenAt: stamped,
    };
    data.seats[index] = next;
    persist(data);
    return next;
  }

  async function inspectLicense(
    actor: BusinessActor,
    organisationId: string,
    seatId?: string,
  ): Promise<
    BusinessResult<{
      account: BusinessAccount;
      seats: Array<{
        seat: BusinessSeat;
        context: Omit<LicenseContext, "licenseToken"> | null;
        activations: { deviceId: string; status: string }[];
      }>;
      monthlyAmountCents: number;
    }>
  > {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const seats = snapshot()
      .seats.filter((item) => item.organisationId === organisationId)
      .filter((item) => (seatId ? item.seatId === seatId : item.status !== "removed"));
    const mapped = await Promise.all(
      seats.map(async (seat) => {
        const activations = await licenses.listActivations(seat.licenseId);
        return {
          seat,
          context: licenseContextFromBusinessSeat(
            account,
            seat,
            activations.filter((item) => item.status === "active").length,
            now(),
          ),
          activations,
        };
      }),
    );
    return {
      ok: true,
      value: {
        account,
        monthlyAmountCents: monthlyAmountCents(account.seatLimit, pricing()),
        seats: mapped,
      },
    };
  }

  function listAccounts(actor: BusinessActor): BusinessResult<BusinessAccount[]> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    return { ok: true, value: snapshot().accounts };
  }

  function setSeatStatus(
    actor: BusinessActor,
    organisationId: string,
    seatId: string,
    status: Extract<BusinessSeat["status"], "active" | "suspended">,
  ): BusinessResult<BusinessSeat> {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    const seat = findSeat(organisationId, seatId);
    if (!seat || seat.status === "removed") return { ok: false, error: "not_found" };
    const data = snapshot();
    const index = data.seats.findIndex((item) => item.seatId === seatId);
    const next = { ...seat, status };
    data.seats[index] = next;
    persist(data);
    if (status === "suspended") void licenses.resetActivations(seat.licenseId);
    return { ok: true, value: next };
  }

  function changeAdmin(
    actor: BusinessActor,
    organisationId: string,
    email: string,
  ): BusinessResult<BusinessAccount> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const nextAdmin = findOccupiedByEmail(organisationId, email);
    if (!nextAdmin) return { ok: false, error: "not_found" };

    const data = snapshot();
    data.seats = data.seats.map((seat) => {
      if (seat.organisationId !== organisationId || seat.status === "removed") return seat;
      if (seat.seatId === nextAdmin.seatId) return { ...seat, role: "owner" as const };
      if (seat.role === "owner") return { ...seat, role: "admin" as const };
      return seat;
    });
    const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
    const next = {
      ...account,
      ownerEmail: normalizeEmail(nextAdmin.email),
      updatedAt: now().toISOString(),
    };
    data.accounts[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  function getBranding(organisationId: string): BusinessBranding | null {
    return (
      snapshot().brandings.find((item) => item.organisationId === organisationId) ?? null
    );
  }

  function setBranding(
    actorEmail: string,
    organisationId: string,
    input: { dataUrl?: string | null; claimedType?: string },
  ): BusinessResult<BusinessBranding> {
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    if (!canChangeBusinessLogo(account, actorEmail)) {
      return { ok: false, error: "forbidden" };
    }
    const nowIso = now().toISOString();
    let logoAssetRef: string | null = null;
    if (input.dataUrl) {
      const validated = validateBusinessLogo({
        dataUrl: input.dataUrl,
        claimedType: input.claimedType,
      });
      if (!validated.ok) return validated;
      logoAssetRef = validated.logoAssetRef;
    }
    const next: BusinessBranding = {
      organisationId,
      logoAssetRef,
      updatedAt: nowIso,
      updatedByEmail: normalizeEmail(actorEmail),
    };
    const data = snapshot();
    const index = data.brandings.findIndex((item) => item.organisationId === organisationId);
    if (index === -1) data.brandings.push(next);
    else data.brandings[index] = next;
    persist(data);
    return { ok: true, value: next };
  }

  function listAllSeats(actor: BusinessActor): BusinessResult<BusinessSeat[]> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    return {
      ok: true,
      value: snapshot().seats.filter((item) => item.status !== "removed"),
    };
  }

  function listSeats(
    actor: BusinessActor,
    organisationId: string,
  ): BusinessResult<{ account: BusinessAccount; seats: BusinessSeat[] }> {
    const denied = requireManager(actor, organisationId);
    if (denied) return { ok: false, error: denied };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    return {
      ok: true,
      value: {
        account,
        seats: snapshot().seats.filter(
          (item) => item.organisationId === organisationId && item.status !== "removed",
        ),
      },
    };
  }

  return {
    pricing,
    findAccount,
    findBusinessGrantByEmail,
    createAccount,
    setSeatCount,
    changePlan,
    setOrganisationStatus,
    grantTrial,
    inviteSeat,
    removeSeat,
    resendInvitation,
    resetSeatDevices,
    convertLicense,
    grantPersonalLifetime,
    changeGlobalPricing,
    modifyRecommendationEngine,
    modifyUserFiles,
    touchSeat,
    inspectLicense,
    listAccounts,
    listSeats,
    listAllSeats,
    setSeatStatus,
    changeAdmin,
    getBranding,
    setBranding,
    monthlyAmountCents: (seatLimit: number) => monthlyAmountCents(seatLimit, pricing()),
  };
}

export const businessService = createBusinessService();

export function findBusinessGrantByEmail(email: string): LicenseGrant | undefined {
  return businessService.findBusinessGrantByEmail(email);
}

export function touchBusinessSeat(email: string): BusinessSeat | undefined {
  return businessService.touchSeat(email);
}

export type ConvertibleOrigin = Extract<LicenseOrigin, "manual" | "gift" | "partner">;
