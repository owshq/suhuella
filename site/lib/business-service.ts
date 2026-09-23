import {
  defaultBusinessBillingClient,
  type BusinessBillingClient,
  type StripeSubscriptionSnapshot,
} from "./business-billing.ts";
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
  BusinessSeatChangeRecord,
  BusinessSeatChangeSource,
  BusinessSeatRole,
} from "./business-types.ts";
import { OCCUPIED_SEAT_STATUSES } from "./business-types.ts";
import {
  BUSINESS_DEFAULT_DEVICE_LIMIT,
  capabilitiesForEdition,
  isValidEmail,
  knowledgeSourcesForEdition,
  MAX_DEVICE_LIMIT_PER_SEAT,
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

export function businessDeviceLimitForAccount(
  account: Pick<BusinessAccount, "deviceLimitPerSeat">,
): number {
  const configured = account.deviceLimitPerSeat;
  if (
    typeof configured === "number" &&
    Number.isInteger(configured) &&
    configured >= 1 &&
    configured <= MAX_DEVICE_LIMIT_PER_SEAT
  ) {
    return configured;
  }
  return BUSINESS_DEFAULT_DEVICE_LIMIT;
}

export type LicenseBridge = {
  findGrantByEmail(email: string): LicenseGrant | undefined | Promise<LicenseGrant | undefined>;
  findGrantByLicenseId(licenseId: string): LicenseGrant | undefined | Promise<LicenseGrant | undefined>;
  upsertGrant(grant: LicenseGrant): LicenseGrant | Promise<LicenseGrant>;
  resetActivations(licenseId: string): Promise<number>;
  listActivations(licenseId: string): Promise<
    { deviceId: string; status: string; deviceName?: string; platform?: string; lastSeen?: string }[]
  >;
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
    deviceLimit: businessDeviceLimitForAccount(account),
    validUntil: account.trialEndsAt,
    organisationId: account.organisationId,
    organisationName: account.name,
    seatId: seat.seatId,
    memberRole: seat.role,
    channel: "stable",
    isPaid: account.status !== "trial",
    isGifted: false,
    isRevocableByAdmin: false,
    paymentProvider: account.stripeSubscriptionId ? "stripe" : null,
    paymentReference: account.stripeSubscriptionId,
    subscriptionId: account.stripeSubscriptionId,
    currentPeriodEnd: account.currentPeriodEnd,
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
    deviceLimit: businessDeviceLimitForAccount(account),
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
  billing?: BusinessBillingClient;
  now?: () => Date;
}) {
  const store = options?.store ?? defaultBusinessStore;
  const licenses = options?.licenses ?? defaultLicenseBridge;
  const billing = options?.billing ?? defaultBusinessBillingClient;
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

  function findManagedOrganisation(email: string): { account: BusinessAccount; seat: BusinessSeat } | undefined {
    const normalized = normalizeEmail(email);
    const data = snapshot();
    const seat = data.seats.find(
      (item) =>
        item.email === normalized &&
        OCCUPIED_SEAT_STATUSES.includes(item.status) &&
        (item.role === "owner" || item.role === "admin"),
    );
    if (!seat) return undefined;
    const account = data.accounts.find((item) => item.organisationId === seat.organisationId);
    if (!account) return undefined;
    return { account, seat };
  }

  function findBusinessGrantByLicenseId(licenseId: string): LicenseGrant | undefined {
    const id = licenseId.trim();
    if (!id) return undefined;
    const data = snapshot();
    const seat = data.seats.find(
      (item) => item.licenseId === id && OCCUPIED_SEAT_STATUSES.includes(item.status),
    );
    if (!seat) return undefined;
    const account = data.accounts.find((item) => item.organisationId === seat.organisationId);
    if (!account) return undefined;
    return grantFromBusinessSeat(account, seat, now()) ?? undefined;
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

  async function syncOrganisationSeatGrants(account: BusinessAccount): Promise<number> {
    const seats = snapshot().seats.filter(
      (item) => item.organisationId === account.organisationId && item.status !== "removed",
    );
    let synced = 0;
    for (const seat of seats) {
      const grant = grantFromBusinessSeat(account, seat, now());
      if (!grant) continue;
      await licenses.upsertGrant(grant);
      synced += 1;
    }
    return synced;
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
      stripeSubscriptionId: null,
      stripeSubscriptionItemId: null,
      stripeStatus: null,
      currentPeriodEnd: null,
      recurringAmountCents: null,
      billingInterval: null,
      billingNeedsReconciliation: false,
      lastStripeEventId: null,
      lastStripeEventCreated: null,
      stripeCheckoutSessionId: null,
      deviceLimitPerSeat: BUSINESS_DEFAULT_DEVICE_LIMIT,
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
    if (owner) {
      const grant = grantFromBusinessSeat(account, owner, now());
      if (grant) void licenses.upsertGrant(grant);
    }
    return { ok: true, value: { account, owner } };
  }

  async function setOrganisationDeviceLimit(
    actor: BusinessActor,
    organisationId: string,
    deviceLimitPerSeat: number,
  ): Promise<BusinessResult<{ account: BusinessAccount; syncedSeats: number }>> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    if (
      !Number.isInteger(deviceLimitPerSeat) ||
      deviceLimitPerSeat < 1 ||
      deviceLimitPerSeat > MAX_DEVICE_LIMIT_PER_SEAT
    ) {
      return { ok: false, error: "invalid_request" };
    }
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };

    const data = snapshot();
    const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
    const next: BusinessAccount = {
      ...account,
      deviceLimitPerSeat,
      updatedAt: now().toISOString(),
    };
    data.accounts[index] = next;
    persist(data);

    const syncedSeats = await syncOrganisationSeatGrants(next);
    return { ok: true, value: { account: next, syncedSeats } };
  }

  function assignedSeatCount(organisationId: string): number {
    return occupiedSeats(snapshot().seats, organisationId).length;
  }

  function validatePurchasedQuantity(
    account: BusinessAccount,
    seatLimit: number,
  ): BusinessError | null {
    if (account.plan !== "business" && account.plan !== "enterprise") return "not_business";
    const config = pricing();
    const minSeats = account.plan === "enterprise" ? 1 : config.minSeats;
    if (!Number.isInteger(seatLimit) || seatLimit < minSeats) return "min_seats";
    if (seatLimit < assignedSeatCount(account.organisationId)) return "seat_in_use";
    return null;
  }

  function recordSeatChange(entry: Omit<BusinessSeatChangeRecord, "id" | "timestamp">): void {
    const data = snapshot();
    data.seatChanges = [
      {
        ...entry,
        id: newId("sch"),
        timestamp: now().toISOString(),
      },
      ...(data.seatChanges ?? []),
    ].slice(0, 200);
    persist(data);
  }

  function applyConfirmedBilling(
    account: BusinessAccount,
    confirmed: StripeSubscriptionSnapshot,
    event?: { id?: string | null; created?: number | null },
  ): BusinessAccount {
    const assigned = assignedSeatCount(account.organisationId);
    const minSeats = account.plan === "enterprise" ? 1 : pricing().minSeats;
    const belowMinimum = confirmed.quantity < minSeats;
    const cannotApply = confirmed.quantity < assigned || belowMinimum;
    const next: BusinessAccount = {
      ...account,
      seatLimit: cannotApply ? account.seatLimit : confirmed.quantity,
      billingCustomerId: confirmed.customerId || account.billingCustomerId,
      stripeSubscriptionId: confirmed.subscriptionId,
      stripeSubscriptionItemId: confirmed.subscriptionItemId,
      stripeStatus: confirmed.status,
      currentPeriodEnd: confirmed.currentPeriodEnd,
      recurringAmountCents: confirmed.amountCents,
      currency: confirmed.currency || account.currency,
      billingInterval: confirmed.interval,
      billingNeedsReconciliation: cannotApply,
      lastStripeEventId: event?.id ?? account.lastStripeEventId,
      lastStripeEventCreated: event?.created ?? account.lastStripeEventCreated,
      updatedAt: now().toISOString(),
    };
    const data = snapshot();
    const index = data.accounts.findIndex((item) => item.organisationId === account.organisationId);
    if (index !== -1) {
      data.accounts[index] = next;
      persist(data);
    }
    return next;
  }

  function setSeatCount(
    actor: BusinessActor,
    organisationId: string,
    seatLimit: number,
  ): BusinessResult<BusinessAccount> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const invalid = validatePurchasedQuantity(account, seatLimit);
    if (invalid) return { ok: false, error: invalid };
    return { ok: false, error: "subscription_missing" };
  }

  async function changeSeatQuantity(
    actor: BusinessActor,
    organisationId: string,
    requestedQuantity: number,
    meta: {
      source: BusinessSeatChangeSource;
      reason?: string | null;
      actorRole?: string | null;
      idempotencyKey?: string;
    },
  ): Promise<BusinessResult<BusinessAccount>> {
    const denied = requireManager(actor, organisationId);
    if (denied) {
      recordSeatChange({
        organisationId,
        actorEmail: actor.kind === "business_admin" ? actor.email : "superadmin",
        actorKind: actor.kind,
        actorRole: meta.actorRole ?? actor.kind,
        source: meta.source,
        reason: meta.reason ?? null,
        previousQuantity: findAccount(organisationId)?.seatLimit ?? 0,
        requestedQuantity,
        confirmedQuantity: null,
        stripeSubscriptionId: findAccount(organisationId)?.stripeSubscriptionId ?? null,
        result: "rejected",
        error: denied,
      });
      return { ok: false, error: denied };
    }

    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };

    const actorEmail = actor.kind === "business_admin" ? actor.email : "superadmin";
    const invalid = validatePurchasedQuantity(account, requestedQuantity);
    if (invalid) {
      recordSeatChange({
        organisationId,
        actorEmail,
        actorKind: actor.kind,
        actorRole: meta.actorRole ?? actor.kind,
        source: meta.source,
        reason: meta.reason ?? null,
        previousQuantity: account.seatLimit,
        requestedQuantity,
        confirmedQuantity: null,
        stripeSubscriptionId: account.stripeSubscriptionId,
        result: "rejected",
        error: invalid,
      });
      return { ok: false, error: invalid };
    }

    const live = await billing.readSubscription({
      subscriptionId: account.stripeSubscriptionId,
      customerId: account.billingCustomerId,
    });
    if (!live.ok) {
      recordSeatChange({
        organisationId,
        actorEmail,
        actorKind: actor.kind,
        actorRole: meta.actorRole ?? actor.kind,
        source: meta.source,
        reason: meta.reason ?? null,
        previousQuantity: account.seatLimit,
        requestedQuantity,
        confirmedQuantity: null,
        stripeSubscriptionId: account.stripeSubscriptionId,
        result: "failed",
        error: live.error,
      });
      return { ok: false, error: live.error };
    }

    if (live.value.quantity === requestedQuantity) {
      const reconciled = applyConfirmedBilling(account, live.value);
      recordSeatChange({
        organisationId,
        actorEmail,
        actorKind: actor.kind,
        actorRole: meta.actorRole ?? actor.kind,
        source: meta.source,
        reason: meta.reason ?? null,
        previousQuantity: account.seatLimit,
        requestedQuantity,
        confirmedQuantity: reconciled.seatLimit,
        stripeSubscriptionId: reconciled.stripeSubscriptionId,
        result: "success",
        error: null,
      });
      return { ok: true, value: reconciled };
    }

    const updated = await billing.updateQuantity({
      subscriptionId: live.value.subscriptionId,
      subscriptionItemId: live.value.subscriptionItemId,
      quantity: requestedQuantity,
      idempotencyKey:
        meta.idempotencyKey?.trim() ||
        `seatqty:${organisationId}:${live.value.subscriptionItemId}:${account.seatLimit}:${requestedQuantity}`,
    });
    if (!updated.ok) {
      recordSeatChange({
        organisationId,
        actorEmail,
        actorKind: actor.kind,
        actorRole: meta.actorRole ?? actor.kind,
        source: meta.source,
        reason: meta.reason ?? null,
        previousQuantity: account.seatLimit,
        requestedQuantity,
        confirmedQuantity: null,
        stripeSubscriptionId: live.value.subscriptionId,
        result: "failed",
        error: updated.error,
      });
      return { ok: false, error: updated.error };
    }

    const next = applyConfirmedBilling(account, updated.value);
    recordSeatChange({
      organisationId,
      actorEmail,
      actorKind: actor.kind,
      actorRole: meta.actorRole ?? actor.kind,
      source: meta.source,
      reason: meta.reason ?? null,
      previousQuantity: account.seatLimit,
      requestedQuantity,
      confirmedQuantity: next.seatLimit,
      stripeSubscriptionId: next.stripeSubscriptionId,
      result: "success",
      error: null,
    });
    return { ok: true, value: next };
  }

  async function reconcileSeatBilling(
    actor: BusinessActor,
    organisationId: string,
    event?: { id?: string | null; created?: number | null },
  ): Promise<BusinessResult<BusinessAccount>> {
    if (actor.kind !== "superadmin") return { ok: false, error: "forbidden" };
    const account = findAccount(organisationId);
    if (!account) return { ok: false, error: "not_found" };
    const live = await billing.readSubscription({
      subscriptionId: account.stripeSubscriptionId,
      customerId: account.billingCustomerId,
    });
    if (!live.ok) return { ok: false, error: live.error };
    if (
      event?.created &&
      account.lastStripeEventCreated &&
      event.created < account.lastStripeEventCreated &&
      live.value.quantity !== account.seatLimit
    ) {
      const data = snapshot();
      const index = data.accounts.findIndex((item) => item.organisationId === organisationId);
      const flagged = { ...account, billingNeedsReconciliation: true, updatedAt: now().toISOString() };
      if (index !== -1) {
        data.accounts[index] = flagged;
        persist(data);
      }
      return { ok: false, error: "needs_reconciliation" };
    }
    return { ok: true, value: applyConfirmedBilling(account, live.value, event) };
  }

  function findAccountByStripeRef(ref: {
    subscriptionId?: string | null;
    customerId?: string | null;
  }): BusinessAccount | undefined {
    const data = snapshot();
    return data.accounts.find(
      (item) =>
        (ref.subscriptionId && item.stripeSubscriptionId === ref.subscriptionId) ||
        (ref.customerId && item.billingCustomerId === ref.customerId),
    );
  }

  function findAccountByCheckoutSessionId(sessionId: string): BusinessAccount | undefined {
    const id = sessionId.trim();
    if (!id) return undefined;
    return snapshot().accounts.find((item) => item.stripeCheckoutSessionId === id);
  }

  function provisionFromStripeCheckout(input: {
    email: string;
    organisationName: string;
    checkoutSessionId: string;
    confirmed: StripeSubscriptionSnapshot;
    eventId: string;
    eventCreated?: number | null;
  }): BusinessResult<{ account: BusinessAccount }> | { ok: false; error: "busy" } {
    const checkoutSessionId = input.checkoutSessionId.trim();
    const email = normalizeEmail(input.email);
    const organisationName = input.organisationName.trim();
    if (!checkoutSessionId || !isValidEmail(email) || !organisationName) {
      return { ok: false, error: "invalid_request" };
    }

    const bySession = findAccountByCheckoutSessionId(checkoutSessionId);
    if (bySession) {
      return {
        ok: true,
        value: {
          account: applyConfirmedBilling(bySession, input.confirmed, {
            id: input.eventId,
            created: input.eventCreated ?? null,
          }),
        },
      };
    }

    const byStripe = findAccountByStripeRef({
      subscriptionId: input.confirmed.subscriptionId,
      customerId: input.confirmed.customerId,
    });
    if (byStripe) {
      const linked = {
        ...byStripe,
        stripeCheckoutSessionId: byStripe.stripeCheckoutSessionId ?? checkoutSessionId,
      };
      const data = snapshot();
      const index = data.accounts.findIndex((item) => item.organisationId === linked.organisationId);
      if (index !== -1) {
        data.accounts[index] = linked;
        persist(data);
      }
      return {
        ok: true,
        value: {
          account: applyConfirmedBilling(linked, input.confirmed, {
            id: input.eventId,
            created: input.eventCreated ?? null,
          }),
        },
      };
    }

    const managed = findManagedOrganisation(email);
    if (managed?.account.stripeSubscriptionId) {
      return {
        ok: true,
        value: {
          account: applyConfirmedBilling(managed.account, input.confirmed, {
            id: input.eventId,
            created: input.eventCreated ?? null,
          }),
        },
      };
    }

    const created = createAccount({ kind: "superadmin" }, {
      name: organisationName,
      seatLimit: input.confirmed.quantity,
      ownerEmail: email,
      billingCustomerId: input.confirmed.customerId,
      status: "active",
    });
    if (!created.ok) return created;

    const data = snapshot();
    const index = data.accounts.findIndex(
      (item) => item.organisationId === created.value.account.organisationId,
    );
    if (index === -1) return { ok: false, error: "not_found" };
    const seeded = {
      ...data.accounts[index],
      stripeCheckoutSessionId: checkoutSessionId,
    };
    data.accounts[index] = seeded;
    persist(data);

    return {
      ok: true,
      value: {
        account: applyConfirmedBilling(seeded, input.confirmed, {
          id: input.eventId,
          created: input.eventCreated ?? null,
        }),
      },
    };
  }

  function markStripeEventProcessed(eventId: string): boolean {
    const data = snapshot();
    const events = data.stripeEvents ?? [];
    if (events.some((item) => item.id === eventId)) return false;
    data.stripeEvents = [{ id: eventId, receivedAt: now().toISOString() }, ...events].slice(0, 500);
    persist(data);
    return true;
  }

  function listSeatChanges(organisationId?: string): BusinessSeatChangeRecord[] {
    const rows = snapshot().seatChanges ?? [];
    return organisationId ? rows.filter((item) => item.organisationId === organisationId) : rows;
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
    const grant = grantFromBusinessSeat(account, seat, now());
    if (grant) void licenses.upsertGrant(grant);
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
      deviceLimit: businessDeviceLimitForAccount(account),
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
        activations: {
          deviceId: string;
          status: string;
          deviceName?: string;
          platform?: string;
          lastSeen?: string;
        }[];
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
        monthlyAmountCents:
          account.recurringAmountCents ?? monthlyAmountCents(account.seatLimit, pricing()),
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
    findManagedOrganisation,
    findBusinessGrantByEmail,
    findBusinessGrantByLicenseId,
    setOrganisationDeviceLimit,
    createAccount,
    setSeatCount,
    changeSeatQuantity,
    reconcileSeatBilling,
    findAccountByStripeRef,
    findAccountByCheckoutSessionId,
    provisionFromStripeCheckout,
    markStripeEventProcessed,
    listSeatChanges,
    assignedSeatCount,
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

export function findBusinessGrantByLicenseId(licenseId: string): LicenseGrant | undefined {
  return businessService.findBusinessGrantByLicenseId(licenseId);
}

export function findManagedOrganisation(email: string) {
  return businessService.findManagedOrganisation(email);
}

export function touchBusinessSeat(email: string): BusinessSeat | undefined {
  return businessService.touchSeat(email);
}

export type ConvertibleOrigin = Extract<LicenseOrigin, "manual" | "gift" | "partner">;
