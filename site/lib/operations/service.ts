import { getBusinessPricingConfig } from "@/lib/business-config";
import { businessService, grantFromBusinessSeat } from "@/lib/business-service";
import { defaultBusinessStore } from "@/lib/business-store";
import type { LicenseEdition, LicenseGrant } from "@/lib/license-context";
import {
  assertAdminCanMutateGift,
  assertAdminCanRevokeLicense,
  assertAdminCanRevokeOrganisation,
  classifyLicenseGrant,
  inferIsPaid,
} from "@/lib/license-entitlement";
import {
  findActivationByDevice,
  findGrantByLicenseId,
  listAllActivations,
  listLicenseGrants,
  renameActivation,
  resetActivations,
  revokeActivation,
  upsertActivation,
  upsertStoredGrant,
} from "@/lib/license-store";
import {
  isAdminCreateOrigin,
  isValidEmail,
  minimumSeatsForPlan,
  normalizeEmail,
  validateReason,
} from "./catalog";
import {
  createAuditId,
  createCustomerId,
  createDeviceId,
  createDiagnosticId,
  createLicenseId,
  createRequestId,
  nowIso,
} from "./ids";
import { normalizeServiceHealth } from "../service-health";
import { getServiceHealthStore, writeServiceHealth } from "../service-health-store";
import { getOperationsStore } from "./store";
import type {
  Activation,
  AuditEntry,
  Customer,
  DiagnosticExport,
  License,
  OperationsAction,
  OperationsActor,
  OperationsDocument,
  OperationsSnapshot,
  Organisation,
  Seat,
} from "./types";

export class OperationsError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "OperationsError";
  }
}

function requireReason(reason: string): string {
  const error = validateReason(reason);
  if (error) throw new OperationsError(error);
  return reason.trim();
}

function requireEmail(value: string): string {
  const email = normalizeEmail(value);
  if (!isValidEmail(email)) throw new OperationsError("A valid email is required.");
  return email;
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new OperationsError(result.error);
  return result.value;
}

function customerIdForEmail(email: string, grants: LicenseGrant[]): string {
  return grants.find((grant) => grant.email === email)?.customerId ?? `cust_${email}`;
}

function asOperationsError(error: unknown): never {
  const message = error instanceof Error ? error.message : "The action was rejected.";
  throw new OperationsError(message);
}

function toOperationsLicense(
  grant: LicenseGrant,
  activations: Array<{ licenseId: string; lastSeen: string; status: string }>,
): License {
  const classified = classifyLicenseGrant(grant);
  const devices = activations.filter((item) => item.licenseId === grant.licenseId);
  const lastSeen = devices
    .map((item) => item.lastSeen)
    .sort()
    .at(-1) ?? null;
  return {
    id: grant.licenseId,
    customerId: grant.customerId,
    email: grant.email,
    edition: classified.edition,
    origin: classified.origin,
    status: classified.status,
    entitlementStatus: classified.entitlementStatus,
    isPaid: classified.isPaid,
    isGifted: classified.isGifted,
    isRevocableByAdmin: classified.isRevocableByAdmin,
    validUntil: classified.validUntil,
    currentPeriodEnd: classified.currentPeriodEnd,
    deviceLimit: classified.deviceLimit,
    deviceCount: devices.filter((item) => item.status === "active").length,
    capabilities: classified.capabilities,
    lastCheckedAt: lastSeen,
    paymentProvider: classified.paymentProvider,
    paymentReference: classified.paymentReference,
    createdAt: classified.createdAt ?? "",
    createdBy: classified.createdBy,
    revokedAt: classified.revokedAt,
    revokedBy: classified.revokedBy,
    revocationReason: classified.revocationReason,
  };
}

async function findLicenseGrant(licenseId: string): Promise<LicenseGrant | undefined> {
  const stored = await findGrantByLicenseId(licenseId);
  if (stored) return stored;
  const seats = unwrap(businessService.listAllSeats({ kind: "superadmin" }));
  const seat = seats.find((item) => item.licenseId === licenseId);
  if (!seat) return undefined;
  const account = businessService.findAccount(seat.organisationId);
  if (!account) return undefined;
  return grantFromBusinessSeat(account, seat) ?? undefined;
}

function buildCustomers(
  grants: LicenseGrant[],
  seats: Seat[],
  activations: Activation[],
): Customer[] {
  const byEmail = new Map<string, Customer>();

  for (const grant of grants) {
    byEmail.set(grant.email, {
      id: grant.customerId,
      email: grant.email,
      createdAt: "",
      lastSeenAt: null,
    });
  }

  for (const seat of seats) {
    const existing = byEmail.get(seat.email);
    byEmail.set(seat.email, {
      id: existing?.id ?? seat.customerId ?? customerIdForEmail(seat.email, grants),
      email: seat.email,
      createdAt: existing?.createdAt || seat.createdAt,
      lastSeenAt: existing?.lastSeenAt ?? null,
    });
  }

  for (const activation of activations) {
    const email = grants.find((grant) => grant.licenseId === activation.licenseId)?.email;
    if (!email) continue;
    const existing = byEmail.get(email);
    if (!existing) continue;
    if (
      !existing.lastSeenAt ||
      existing.lastSeenAt < activation.lastSeenAt
    ) {
      existing.lastSeenAt = activation.lastSeenAt;
    }
  }

  return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

async function buildSnapshot(
  actor: OperationsActor,
  document: OperationsDocument,
  persistence: OperationsSnapshot["persistence"],
): Promise<OperationsSnapshot> {
  const grants = await listLicenseGrants();
  const accounts = unwrap(businessService.listAccounts({ kind: "superadmin" }));
  const businessSeats = unwrap(businessService.listAllSeats({ kind: "superadmin" }));

  const organisations: Organisation[] = accounts.map((account) => {
    const owner = businessSeats.find(
      (seat) => seat.organisationId === account.organisationId && seat.role === "owner",
    );
    return {
      id: account.organisationId,
      name: account.name,
      billingEmail: owner?.email ?? account.billingCustomerId,
      seatCount: account.seatLimit,
      plan: account.plan,
      status: account.status === "suspended" ? "suspended" : "active",
      adminCustomerId: owner ? customerIdForEmail(owner.email, grants) : account.billingCustomerId,
      isPaid: inferIsPaid(account.plan === "enterprise" ? "enterprise" : "business", account.status !== "trial"),
      createdAt: account.createdAt,
    };
  });

  const seats: Seat[] = businessSeats.map((seat) => ({
    id: seat.seatId,
    organisationId: seat.organisationId,
    customerId: customerIdForEmail(seat.email, grants),
    email: seat.email,
    status: seat.status === "removed" ? "suspended" : seat.status,
    licenseId: seat.licenseId,
    createdAt: seat.invitedAt,
  }));

  const rawActivations = await listAllActivations();
  const grantLicenses: License[] = grants.map((grant) =>
    toOperationsLicense(grant, (rawActivations as any[])),
  );

  const seatLicenses: License[] = businessSeats
    .filter((seat) => !grants.some((grant) => grant.licenseId === seat.licenseId))
    .map((seat) => {
      const account = accounts.find((item) => item.organisationId === seat.organisationId);
      const grant = account ? grantFromBusinessSeat(account, seat) : null;
      if (grant) return toOperationsLicense(grant, (rawActivations as any[]));
      return toOperationsLicense(
        {
          email: seat.email,
          customerId: customerIdForEmail(seat.email, grants),
          licenseId: seat.licenseId,
          edition: (account?.plan ?? "business") as LicenseEdition,
          origin: account?.plan === "enterprise" ? "enterprise" : "business",
          status: seat.status === "suspended" || account?.status === "suspended" ? "revoked" : "active",
          createdAt: seat.invitedAt,
        },
        (rawActivations as any[]),
      );
    });

  const licenses = [...grantLicenses, ...seatLicenses];
  const activations: Activation[] = (rawActivations as any[]).map((item) => ({
    id: item.deviceId,
    licenseId: item.licenseId,
    customerId:
      licenses.find((license) => license.id === item.licenseId)?.customerId ?? "",
    deviceId: item.deviceId,
    deviceName: item.deviceName,
    platform: item.platform,
    appVersion: item.appVersion,
    lastSeenAt: item.lastSeen,
    status: item.status === "active" ? "active" : "deactivated",
  }));

  const customers = buildCustomers(grants, seats, activations);
  const healthStore = await getServiceHealthStore();
  const serviceHealth = await healthStore.read();

  return {
    persistence,
    actor,
    customers,
    licenses,
    organisations,
    seats,
    activations,
    diagnostics: document.diagnostics,
    audit: document.audit,
    serviceHealth: {
      ...serviceHealth,
      persistence: healthStore.kind,
    },
  };
}

function appendAudit(
  document: OperationsDocument,
  actor: OperationsActor,
  action: string,
  targetType: string,
  targetId: string,
  reason: string,
  meta: Record<string, unknown> | null = null,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
): void {
  const entry: AuditEntry = {
    id: createAuditId(),
    actor: actor.email,
    adminEmail: actor.email,
    adminRole: actor.role,
    action,
    targetType,
    targetId,
    timestamp: nowIso(),
    reason,
    requestId: createRequestId(),
    before,
    after,
    meta,
  };
  document.audit.unshift(entry);
}

function extractCompatibility(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const direct = record.compatibilityStatus ?? record.compatibility;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (direct && typeof direct === "object") {
    const nested = direct as Record<string, unknown>;
    const status = nested.status ?? nested.state;
    if (typeof status === "string" && status.trim()) return status.trim();
  }
  return null;
}

async function applyAction(
  document: OperationsDocument,
  actor: OperationsActor,
  input: OperationsAction,
): Promise<void> {
  const reason = requireReason(input.reason);
  const superadmin = { kind: "superadmin" as const };

  switch (input.action) {
    case "create_license": {
      if (!isAdminCreateOrigin(input.origin)) {
        throw new OperationsError(
          "Admin can only create gift, promo, manual, internal, or test licenses.",
        );
      }
      const email = requireEmail(input.email);
      const createdAt = nowIso();
      const grant: LicenseGrant = {
        email,
        customerId: createCustomerId(),
        licenseId: createLicenseId(),
        edition: input.edition,
        origin: input.origin,
        status: "active",
        channel: "stable",
        isPaid: false,
        createdAt,
        createdBy: actor.email,
      };
      const stored = await upsertStoredGrant(grant);
      appendAudit(
        document,
        actor,
        input.action,
        "license",
        stored.licenseId,
        reason,
        { email, edition: input.edition, origin: input.origin },
        null,
        { ...stored },
      );
      return;
    }

    case "update_customer_email": {
      const email = requireEmail(input.email);
      const allGrants = await listLicenseGrants();
      const grants = allGrants.filter(
        (grant) =>
          grant.customerId === input.customerId || grant.email === input.customerId,
      );
      const seats = unwrap(businessService.listAllSeats(superadmin)).filter(
        (seat) =>
          seat.email === input.customerId ||
          customerIdForEmail(seat.email, allGrants) === input.customerId,
      );
      if (grants.length === 0 && seats.length === 0) {
        throw new OperationsError("Customer not found.", 404);
      }
      for (const grant of grants) {
        await upsertStoredGrant({ ...grant, email });
      }
      const data = defaultBusinessStore.load();
      data.seats = data.seats.map((seat) =>
        seats.some((item) => item.seatId === seat.seatId) ? { ...seat, email } : seat,
      );
      defaultBusinessStore.save(data);
      appendAudit(document, actor, input.action, "customer", input.customerId, reason, {
        email,
      });
      return;
    }

    case "suspend_license":
    case "revoke_license": {
      const grant = await findLicenseGrant(input.licenseId);
      if (!grant) throw new OperationsError("License not found.", 404);
      try {
        assertAdminCanRevokeLicense(grant);
      } catch (error) {
        asOperationsError(error);
      }
      const now = nowIso();
      const next = await upsertStoredGrant({
        ...grant,
        status: "revoked",
        entitlementStatus: "revoked_gift",
        revokedAt: now,
        revokedBy: actor.email,
        revocationReason: reason,
        updatedAt: now,
      });
      appendAudit(
        document,
        actor,
        "revoke_license",
        "license",
        grant.licenseId,
        reason,
        null,
        { status: grant.status, origin: grant.origin, isPaid: grant.isPaid },
        { status: next.status, revokedAt: next.revokedAt },
      );
      return;
    }

    case "reactivate_license":
    case "restore_license": {
      const grant = await findLicenseGrant(input.licenseId);
      if (!grant) throw new OperationsError("License not found.", 404);
      try {
        assertAdminCanMutateGift(grant, "restored");
      } catch (error) {
        asOperationsError(error);
      }
      const now = nowIso();
      const next = await upsertStoredGrant({
        ...grant,
        status: "active",
        entitlementStatus: "active",
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
        updatedAt: now,
      });
      appendAudit(
        document,
        actor,
        "restore_license",
        "license",
        grant.licenseId,
        reason,
        null,
        { status: grant.status },
        { status: next.status },
      );
      return;
    }

    case "expire_license": {
      const grant = await findLicenseGrant(input.licenseId);
      if (!grant) throw new OperationsError("License not found.", 404);
      try {
        assertAdminCanMutateGift(grant, "expired");
      } catch (error) {
        asOperationsError(error);
      }
      const now = nowIso();
      const next = await upsertStoredGrant({
        ...grant,
        status: "expired",
        entitlementStatus: "expired",
        validUntil: now,
        updatedAt: now,
      });
      appendAudit(
        document,
        actor,
        input.action,
        "license",
        grant.licenseId,
        reason,
        null,
        { status: grant.status, validUntil: grant.validUntil ?? null },
        { status: next.status, validUntil: next.validUntil ?? null },
      );
      return;
    }

    case "extend_license": {
      const grant = await findLicenseGrant(input.licenseId);
      if (!grant) throw new OperationsError("License not found.", 404);
      try {
        assertAdminCanMutateGift(grant, "extended");
      } catch (error) {
        asOperationsError(error);
      }
      if (Number.isNaN(new Date(input.validUntil).getTime())) {
        throw new OperationsError("A valid expiry date is required.");
      }
      const next = await upsertStoredGrant({
        ...grant,
        validUntil: input.validUntil,
        updatedAt: nowIso(),
      });
      appendAudit(
        document,
        actor,
        input.action,
        "license",
        grant.licenseId,
        reason,
        { validUntil: input.validUntil },
        { validUntil: grant.validUntil ?? null },
        { validUntil: next.validUntil ?? null },
      );
      return;
    }

    case "refresh_license": {
      const grant = await findLicenseGrant(input.licenseId);
      if (!grant) throw new OperationsError("License not found.", 404);
      appendAudit(document, actor, input.action, "license", grant.licenseId, reason, {
        origin: grant.origin,
        status: grant.status,
      });
      return;
    }

    case "create_organisation": {
      const billingEmail = requireEmail(input.billingEmail);
      const minSeats = minimumSeatsForPlan(input.plan);
      if (!Number.isInteger(input.seatCount) || input.seatCount < minSeats) {
        throw new OperationsError(
          `${input.plan === "business" ? "Business" : "Enterprise"} seat count must be at least ${minSeats}.`,
        );
      }
      const created = unwrap(
        businessService.createAccount(superadmin, {
          name: input.name,
          ownerEmail: billingEmail,
          seatLimit: input.seatCount,
          plan: input.plan,
        }),
      );
      if (created.owner) {
        const grant = grantFromBusinessSeat(created.account, created.owner);
        if (grant) await upsertStoredGrant(grant);
      }
      appendAudit(
        document,
        actor,
        input.action,
        "organisation",
        created.account.organisationId,
        reason,
        {
          name: input.name,
          billingEmail,
          seatCount: input.seatCount,
          plan: input.plan,
        },
      );
      return;
    }

    case "add_seats":
    case "remove_seats": {
      if (!Number.isInteger(input.count) || input.count < 1) {
        throw new OperationsError("Seat count must be a positive integer.");
      }
      const account = businessService.findAccount(input.organisationId);
      if (!account) throw new OperationsError("Organisation not found.", 404);
      const next =
        input.action === "add_seats"
          ? account.seatLimit + input.count
          : account.seatLimit - input.count;
      unwrap(businessService.setSeatCount(superadmin, account.organisationId, next));
      appendAudit(
        document,
        actor,
        input.action,
        "organisation",
        account.organisationId,
        reason,
        { count: input.count, seatCount: next },
      );
      return;
    }

    case "invite_user": {
      const email = requireEmail(input.email);
      const seat = unwrap(
        businessService.inviteSeat(superadmin, input.organisationId, email, "member"),
      );
      const account = businessService.findAccount(input.organisationId);
      const grant = account ? grantFromBusinessSeat(account, seat) : null;
      if (grant) await upsertStoredGrant(grant);
      appendAudit(document, actor, input.action, "seat", seat.seatId, reason, {
        organisationId: input.organisationId,
        email,
      });
      return;
    }

    case "suspend_seat":
    case "reactivate_seat": {
      const seats = unwrap(businessService.listAllSeats(superadmin));
      const seat = seats.find((item) => item.seatId === input.seatId);
      if (!seat) throw new OperationsError("Seat not found.", 404);
      const next = unwrap(
        businessService.setSeatStatus(
          superadmin,
          seat.organisationId,
          seat.seatId,
          input.action === "suspend_seat" ? "suspended" : "active",
        ),
      );
      appendAudit(
        document,
        actor,
        input.action,
        "seat",
        seat.seatId,
        reason,
        null,
        { status: seat.status },
        { status: next.status },
      );
      return;
    }

    case "remove_seat": {
      const seats = unwrap(businessService.listAllSeats(superadmin));
      const seat = seats.find((item) => item.seatId === input.seatId);
      if (!seat) throw new OperationsError("Seat not found.", 404);
      const next = unwrap(businessService.removeSeat(superadmin, seat.organisationId, seat.seatId));
      appendAudit(
        document,
        actor,
        input.action,
        "seat",
        seat.seatId,
        reason,
        null,
        { status: seat.status, email: seat.email },
        { status: next.status },
      );
      return;
    }

    case "change_admin": {
      const seats = unwrap(businessService.listAllSeats(superadmin));
      const grants = await listLicenseGrants();
      const admin = seats.find(
        (seat) =>
          seat.organisationId === input.organisationId &&
          (seat.seatId === input.customerId ||
            customerIdForEmail(seat.email, grants) === input.customerId ||
            seat.email === input.customerId),
      );
      if (!admin) throw new OperationsError("The new admin must already have a seat.");
      unwrap(businessService.changeAdmin(superadmin, input.organisationId, admin.email));
      appendAudit(
        document,
        actor,
        input.action,
        "organisation",
        input.organisationId,
        reason,
        { email: admin.email },
      );
      return;
    }

    case "suspend_organisation":
    case "reactivate_organisation": {
      const account = businessService.findAccount(input.organisationId);
      if (!account) throw new OperationsError("Organisation not found.", 404);
      if (input.action === "suspend_organisation") {
        try {
          assertAdminCanRevokeOrganisation(account.status !== "trial");
        } catch (error) {
          asOperationsError(error);
        }
      }
      const next = unwrap(
        businessService.setOrganisationStatus(
          superadmin,
          input.organisationId,
          input.action === "suspend_organisation" ? "suspended" : "active",
        ),
      );
      appendAudit(
        document,
        actor,
        input.action,
        "organisation",
        input.organisationId,
        reason,
        null,
        { status: account.status },
        { status: next.status },
      );
      return;
    }

    case "deactivate_device": {
      const activation = await findActivationByDevice(input.activationId);
      if (!activation) throw new OperationsError("Activation not found.", 404);
      await revokeActivation(activation.licenseId, activation.deviceId);
      appendAudit(
        document,
        actor,
        input.action,
        "activation",
        activation.deviceId,
        reason,
      );
      return;
    }

    case "rename_device": {
      const name = input.deviceName.trim();
      if (!name) throw new OperationsError("Device name is required.");
      if (!(await renameActivation(input.activationId, name))) {
        throw new OperationsError("Activation not found.", 404);
      }
      appendAudit(
        document,
        actor,
        input.action,
        "activation",
        input.activationId,
        reason,
        { deviceName: name },
      );
      return;
    }

    case "reset_license_devices": {
      const reset = await resetActivations(input.licenseId);
      appendAudit(document, actor, input.action, "license", input.licenseId, reason, {
        deactivated: reset,
      });
      return;
    }

    case "reset_seat_devices": {
      const seats = unwrap(businessService.listAllSeats(superadmin));
      const seat = seats.find((item) => item.seatId === input.seatId);
      if (!seat) throw new OperationsError("Seat not found.", 404);
      const result = unwrap(
        await businessService.resetSeatDevices(superadmin, seat.organisationId, seat.seatId),
      );
      appendAudit(document, actor, input.action, "seat", seat.seatId, reason, {
        deactivated: result.reset,
      });
      return;
    }

    case "record_activation": {
      const license =
        (await findGrantByLicenseId(input.licenseId)) ??
        unwrap(businessService.listAllSeats(superadmin)).find(
          (seat) => seat.licenseId === input.licenseId,
        );
      if (!license) throw new OperationsError("License not found.", 404);
      const deviceName = input.deviceName.trim();
      const platform = input.platform.trim();
      const appVersion = input.appVersion.trim();
      if (!deviceName || !platform || !appVersion) {
        throw new OperationsError("Device name, platform, and app version are required.");
      }
      const deviceId = createDeviceId();
      await upsertActivation({
        licenseId: input.licenseId,
        deviceId,
        deviceName,
        platform,
        appVersion,
        activatedAt: nowIso(),
        lastSeen: nowIso(),
        status: "active",
      });
      appendAudit(document, actor, input.action, "activation", deviceId, reason, {
        licenseId: input.licenseId,
        deviceName,
        platform,
        appVersion,
      });
      return;
    }

    case "set_service_health": {
      const previous = await (await getServiceHealthStore()).read();
      const next = await writeServiceHealth(
        normalizeServiceHealth({
          serviceState: input.serviceState,
          affectedCapabilities: input.affectedCapabilities,
          retryAfter: input.retryAfter,
          updatedAt: nowIso(),
          updatedBy: actor.email,
        }),
      );
      appendAudit(document, actor, input.action, "service_health", next.serviceState, reason, {
        serviceState: next.serviceState,
        affectedCapabilities: next.affectedCapabilities,
        retryAfter: next.retryAfter,
      }, {
        serviceState: previous.serviceState,
        affectedCapabilities: previous.affectedCapabilities,
      }, {
        serviceState: next.serviceState,
        affectedCapabilities: next.affectedCapabilities,
      });
      return;
    }

    case "receive_diagnostic": {
      const source = input.source.trim();
      if (!source) throw new OperationsError("Diagnostic source is required.");
      const customerEmail = input.customerEmail
        ? requireEmail(input.customerEmail)
        : null;
      const diagnostic: DiagnosticExport = {
        id: createDiagnosticId(),
        receivedAt: nowIso(),
        source,
        customerEmail,
        payload: input.payload,
        compatibilityStatus: extractCompatibility(input.payload),
      };
      document.diagnostics.unshift(diagnostic);
      appendAudit(document, actor, input.action, "diagnostic", diagnostic.id, reason, {
        source,
        customerEmail,
      });
      return;
    }
  }
}

export async function readOperationsSnapshot(
  actor: OperationsActor,
): Promise<OperationsSnapshot> {
  const store = await getOperationsStore();
  const document = await store.read();
  return buildSnapshot(actor, document, store.persistence);
}

export async function performOperationsAction(
  actor: OperationsActor,
  input: OperationsAction,
): Promise<OperationsSnapshot> {
  const store = await getOperationsStore();
  const document = await store.read();
  await applyAction(document, actor, input);
  await store.write(document);
  return readOperationsSnapshot(actor);
}

export function operationsPricing() {
  return getBusinessPricingConfig();
}
