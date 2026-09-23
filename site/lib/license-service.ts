import { brand } from "@suhuella/brand";
import {
  buildSignedLicenseContext,
  isValidEmail,
  lifetimeHasNoExpiry,
  normalizeEmail,
  offlineUntilFrom,
  readSignedLicenseToken,
  type LicenseApiError,
  type LicenseContext,
  type LicenseGrant,
} from "./license-context.ts";
import {
  touchBusinessSeat,
  effectiveLogoForAccount,
  businessService,
  findBusinessGrantByEmail,
  findBusinessGrantByLicenseId,
} from "./business-service.ts";
import { effectiveDeviceLimitForGrant } from "./license-device-limit.ts";
import { organisationOverviewForActor, type BusinessOrganisationOverview } from "./business-organisation.ts";
import type { BusinessError, BusinessSeatRole } from "./business-types.ts";
import { defaultBusinessStore } from "./business-store.ts";
import { fulfillLicenseFromCheckout } from "./license-fulfillment.ts";
import { reconcilePaidCheckoutSession } from "./checkout-reconciliation.ts";
import { publicDevicesForLicense, type LicenseDevicePublic } from "./license-devices.ts";
import type { FulfilledCheckoutSession } from "./verify-stripe-session.ts";
import { desktopStatusForGrant, normalizeLicenseGrant } from "./license-entitlement.ts";
import { grantAllowsPresentationBrand } from "./license-presentation.ts";
import { consumeActivationAttempt } from "./activation-attempt.ts";
import { consumeVerifiedEmailProof } from "./email-verification.ts";
import { presentedTokenAlgorithmFromLicenseToken } from "./license-hmac-retirement-metrics.ts";
import {
  activeDeviceCount,
  findActivation,
  findGrantByEmail,
  findGrantByLicenseId,
  listActivations,
  revokeActivation,
  upsertActivation,
  upsertStoredGrant,
} from "./license-store.ts";

export type ActivateInput = {
  email?: string;
  emailProofId?: string;
  deviceId: string;
  deviceName: string;
  platform?: string;
  appVersion?: string;
};

export type TokenInput = {
  deviceId: string;
  licenseToken: string;
  deviceName?: string;
  targetDeviceId?: string;
};

export type LicenseSession = {
  context: LicenseContext;
  devices: LicenseDevicePublic[];
};

type ServiceResult<T> =
  | { ok: true; context?: T; session?: LicenseSession; deactivated?: true }
  | { ok: false; error: LicenseApiError; devices?: LicenseDevicePublic[] };

async function devicesForLicense(
  licenseId: string,
  currentDeviceId: string,
): Promise<LicenseDevicePublic[]> {
  const devices = await listActivations(licenseId);
  return publicDevicesForLicense(devices, licenseId, currentDeviceId);
}

function signingMaterialConfigured(): boolean {
  return Boolean(
    process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim() || process.env.LICENSE_SIGNING_SECRET?.trim(),
  );
}

function presentationRejected(grant: LicenseGrant): boolean {
  return !grantAllowsPresentationBrand(grant, brand.id);
}

async function decodeToken(licenseToken: string): Promise<LicenseContext | null> {
  if (!signingMaterialConfigured()) return null;
  const unsigned = await readSignedLicenseToken(licenseToken);
  if (!unsigned) return null;
  return { ...unsigned, licenseToken };
}

async function refreshExistingMonthlyGrant(grant: LicenseGrant): Promise<LicenseGrant> {
  if (grant.origin !== "stripe" || grant.edition !== "personal_monthly") return grant;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || !grant.customerId) return grant;

  try {
    const subscriptions = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(grant.customerId)}&status=all&limit=5`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: "no-store",
      },
    );
    if (!subscriptions.ok) return grant;
    const subBody = (await subscriptions.json()) as {
      data?: Array<{ id: string; status: string; current_period_end?: number }>;
    };
    const live = (subBody.data ?? []).find(
      (item) => item.status === "active" || item.status === "trialing",
    );
    if (!live) {
      const next = normalizeLicenseGrant({
        ...grant,
        status: grant.validUntil && new Date(grant.validUntil).getTime() > Date.now() ? grant.status : "expired",
        subscriptionId: grant.subscriptionId,
      });
      if (next.status !== grant.status) await upsertStoredGrant(next);
      return next;
    }
    const periodEnd =
      live.current_period_end != null ? new Date(live.current_period_end * 1000).toISOString() : grant.currentPeriodEnd;
    const next = normalizeLicenseGrant({
      ...grant,
      subscriptionId: live.id,
      currentPeriodEnd: periodEnd,
      validUntil: periodEnd,
      status: "active",
    });
    if (next.status !== grant.status || next.validUntil !== grant.validUntil) {
      await upsertStoredGrant(next);
    }
    return next;
  } catch {
    return grant;
  }
}

async function resolveGrant(email: string): Promise<LicenseGrant | null> {
  const durable = await findGrantByEmail(email);
  if (durable) return refreshExistingMonthlyGrant(durable);
  const business = findBusinessGrantByEmail(email);
  return business ?? null;
}

function organisationLogoForGrant(grant: LicenseGrant): string | null {
  if (!grant.organisationId) return null;
  const account = defaultBusinessStore
    .load()
    .accounts.find((item) => item.organisationId === grant.organisationId);
  if (!account) return null;
  return effectiveLogoForAccount(account);
}

async function contextFromGrant(
  grant: LicenseGrant,
  activatedDevices: number,
  now = new Date(),
): Promise<LicenseContext> {
  if (!signingMaterialConfigured()) {
    throw new Error("LICENSE_SIGNING_PRIVATE_KEY or LICENSE_SIGNING_SECRET is not configured");
  }

  const { commercialGenerationEnforcementActive } = await import(
    "./commercial-generations/enforcement.ts"
  );
  const { readCommercialGenerationRegistry } = await import(
    "./commercial-generations/persistence.ts"
  );
  const { effectiveCapabilitiesForLicense } = await import(
    "@suhuella/product/lib/generation-rights.ts"
  );
  const { listLicenseAcquisitions, cumulativeCommercialGenerationIds } = await import(
    "./commercial-generations/persistence.ts"
  );
  const registry = await readCommercialGenerationRegistry();
  const enforcementActive = commercialGenerationEnforcementActive();
  const status = desktopStatusForGrant(grant);
  const validUntil = lifetimeHasNoExpiry(grant.edition)
    ? null
    : (grant.validUntil ?? grant.currentPeriodEnd ?? null);
  const acquiredCommercialGenerationIds = cumulativeCommercialGenerationIds({
    grantCommercialGenerationId: grant.commercialGenerationId,
    acquisitions: await listLicenseAcquisitions(grant.licenseId),
  });
  const capabilities = effectiveCapabilitiesForLicense({
    edition: grant.edition,
    status,
    validUntil,
    commercialGenerationId: grant.commercialGenerationId,
    acquiredCommercialGenerationIds,
    generationAccessMode: grant.generationAccessMode,
    origin: grant.origin,
    registry,
    enforcementActive,
  });
  const { commercialGenerationPolicyRevision } = await import(
    "@suhuella/product/lib/signed-license-contract.ts"
  );

  const context = await buildSignedLicenseContext(
    {
      licenseId: grant.licenseId,
      customerId: grant.customerId,
      email: grant.email,
      edition: grant.edition,
      status,
      capabilities,
      deviceLimit: effectiveDeviceLimitForGrant(grant),
      activatedDevices,
      organisationId: grant.organisationId,
      organisationName: grant.organisationName,
      organisationLogo: organisationLogoForGrant(grant),
      seatId: grant.seatId,
      memberRole: grant.memberRole,
      validUntil,
      lastCheckedAt: now.toISOString(),
      offlineUntil: offlineUntilFrom(now, grant.validUntil ?? null),
      channel: grant.channel ?? "stable",
      ...(grant.commercialGenerationId !== undefined
        ? { commercialGenerationId: grant.commercialGenerationId }
        : {}),
      ...(grant.generationAccessMode !== undefined
        ? { generationAccessMode: grant.generationAccessMode }
        : {}),
      ...(acquiredCommercialGenerationIds.length > 0
        ? { acquiredCommercialGenerationIds }
        : {}),
      generationEnforcementActive: enforcementActive,
      policyRevision: commercialGenerationPolicyRevision(registry),
    },
  );
  return context;
}

export async function activateFromVerifiedCheckout(
  session: FulfilledCheckoutSession,
  device: Omit<ActivateInput, "email" | "emailProofId">,
): Promise<ServiceResult<LicenseContext>> {
  const fulfilled = await fulfillLicenseFromCheckout(session);
  if (!fulfilled) return { ok: false, error: "invalid_request" };
  return activateLicenseForEmail(fulfilled.email, device);
}

export async function activateFromCheckoutSession(input: {
  sessionId: string;
  activationAttemptId?: string;
  deviceId: string;
  deviceName: string;
  platform?: string;
  appVersion?: string;
  origin?: string;
}): Promise<ServiceResult<LicenseContext>> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!secretKey) return { ok: false, error: "server_error" };

  const verified = await reconcilePaidCheckoutSession({
    sessionId: input.sessionId,
    secretKey,
    origin: input.origin,
  });
  if (!verified.ok) {
    if (verified.error === "payment_incomplete") return { ok: false, error: "payment_incomplete" };
    if (verified.error === "invalid_session" || verified.error === "missing_session") {
      return { ok: false, error: "invalid_request" };
    }
    return { ok: false, error: "server_error" };
  }

  const attemptId = input.activationAttemptId?.trim() ?? "";
  if (!attemptId) {
    return { ok: false, error: "email_verification_required" };
  }

  const attempt = await consumeActivationAttempt({
    activationAttemptId: attemptId,
    deviceId: input.deviceId,
    checkoutSessionId: input.sessionId,
  });
  if (!attempt.ok) {
    return { ok: false, error: "email_verification_required" };
  }

  return activateFromVerifiedCheckout(verified.session, input);
}

async function activateLicenseForEmail(
  emailInput: string,
  input: Omit<ActivateInput, "email" | "emailProofId">,
): Promise<ServiceResult<LicenseContext>> {
  const email = normalizeEmail(emailInput);
  const deviceId = input.deviceId?.trim() ?? "";
  const deviceName = input.deviceName?.trim() || "This computer";

  if (!isValidEmail(email) || !deviceId) {
    return { ok: false, error: "invalid_request" };
  }

  const grant = await resolveGrant(email);
  if (!grant) {
    return { ok: false, error: "unknown_email" };
  }
  if (grant.status === "revoked") {
    return { ok: false, error: "revoked" };
  }
  if (grant.status === "expired") {
    return { ok: false, error: "no_license" };
  }
  if (presentationRejected(grant)) {
    return { ok: false, error: "no_license" };
  }
  if (grant.validUntil && new Date(grant.validUntil).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }

  const existing = await findActivation(grant.licenseId, deviceId);
  const limit = effectiveDeviceLimitForGrant(grant);
  const active = await activeDeviceCount(grant.licenseId);
  if (!existing && active >= limit) {
    return {
      ok: false,
      error: "device_limit",
      devices: await devicesForLicense(grant.licenseId, deviceId),
    };
  }
  if (existing?.status === "revoked") {
    return { ok: false, error: "revoked" };
  }

  const now = new Date().toISOString();

  try {
    const activatedDevices = await activeDeviceCount(grant.licenseId);
    const context = await contextFromGrant(grant, activatedDevices);
    await upsertActivation({
      licenseId: grant.licenseId,
      deviceId,
      deviceName,
      platform: input.platform?.trim() ?? "",
      appVersion: input.appVersion?.trim() ?? "",
      activatedAt: existing?.activatedAt ?? now,
      lastSeen: now,
      status: "active",
      lastPresentedTokenAlgorithm: presentedTokenAlgorithmFromLicenseToken(context.licenseToken),
    });
    touchBusinessSeat(email);
    const devices = await listActivations(grant.licenseId);
    return {
      ok: true,
      session: {
        context,
        devices: publicDevicesForLicense(devices, grant.licenseId, deviceId),
      },
    };
  } catch {
    return { ok: false, error: "server_error" };
  }
}

export async function activateLicense(
  input: ActivateInput,
): Promise<ServiceResult<LicenseContext>> {
  const deviceId = input.deviceId?.trim() ?? "";
  const proofId = input.emailProofId?.trim() ?? "";
  if (!deviceId) {
    return { ok: false, error: "invalid_request" };
  }

  if (proofId) {
    const proof = await consumeVerifiedEmailProof({
      proofId,
      purpose: "LICENSE_ACTIVATION",
      deviceId,
    });
    if (!proof.ok) {
      return { ok: false, error: proof.error === "expired" ? "invalid_proof" : "invalid_proof" };
    }
    return activateLicenseForEmail(proof.email, input);
  }

  return { ok: false, error: "email_verification_required" };
}

export async function checkLicense(input: TokenInput): Promise<ServiceResult<LicenseContext>> {
  const deviceId = input.deviceId?.trim() ?? "";
  const licenseToken = input.licenseToken?.trim() ?? "";
  if (!deviceId || !licenseToken) {
    return { ok: false, error: "invalid_request" };
  }

  const previous = await decodeToken(licenseToken);
  if (!previous) {
    return { ok: false, error: "not_activated" };
  }

  const found =
    (await findGrantByEmail(previous.email)) ??
    (await findGrantByLicenseId(previous.licenseId)) ??
    findBusinessGrantByEmail(previous.email) ??
    findBusinessGrantByLicenseId(previous.licenseId);
  if (!found) {
    return { ok: false, error: "no_license" };
  }
  const grant =
    found.origin === "business"
      ? found
      : await refreshExistingMonthlyGrant(found);

  if (grant.status === "revoked" || previous.status === "revoked") {
    return { ok: false, error: "revoked" };
  }
  if (grant.status !== "active") {
    return { ok: false, error: "expired" };
  }
  if (presentationRejected(grant)) {
    return { ok: false, error: "no_license" };
  }
  if (grant.validUntil && new Date(grant.validUntil).getTime() < Date.now()) {
    return { ok: false, error: "expired" };
  }

  const activation = await findActivation(grant.licenseId, deviceId);
  if (activation?.status === "revoked") {
    return { ok: false, error: "revoked" };
  }

  const limit = effectiveDeviceLimitForGrant(grant);
  const active = await activeDeviceCount(grant.licenseId);
  if (!activation && active >= limit) {
    return {
      ok: false,
      error: "device_limit",
      devices: await devicesForLicense(grant.licenseId, deviceId),
    };
  }

  const deviceName = input.deviceName?.trim() || activation?.deviceName || "This computer";
  const presentedAlgorithm = presentedTokenAlgorithmFromLicenseToken(licenseToken);

  try {
    const activatedDevices = await activeDeviceCount(grant.licenseId);
    const context = await contextFromGrant(grant, activatedDevices);
    await upsertActivation({
      licenseId: grant.licenseId,
      deviceId,
      deviceName,
      platform: activation?.platform ?? "",
      appVersion: activation?.appVersion ?? "",
      activatedAt: activation?.activatedAt ?? new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: "active",
      lastPresentedTokenAlgorithm: presentedAlgorithm,
    });
    touchBusinessSeat(previous.email);
    const devices = await listActivations(grant.licenseId);
    return {
      ok: true,
      session: {
        context,
        devices: publicDevicesForLicense(devices, grant.licenseId, deviceId),
      },
    };
  } catch {
    return { ok: false, error: "server_error" };
  }
}

export async function deactivateLicense(input: TokenInput): Promise<ServiceResult<never>> {
  const deviceId = input.deviceId?.trim() ?? "";
  const licenseToken = input.licenseToken?.trim() ?? "";
  const targetDeviceId = input.targetDeviceId?.trim() || deviceId;
  if (!deviceId || !licenseToken) {
    return { ok: false, error: "invalid_request" };
  }

  const previous = await decodeToken(licenseToken);
  if (!previous) {
    return { ok: false, error: "not_activated" };
  }

  const actor = await findActivation(previous.licenseId, deviceId);
  if (!actor || actor.status !== "active") {
    return { ok: false, error: "not_activated" };
  }

  const target = await findActivation(previous.licenseId, targetDeviceId);
  if (!target || target.status !== "active") {
    return { ok: false, error: "not_activated" };
  }

  if (!(await revokeActivation(previous.licenseId, targetDeviceId))) {
    return { ok: false, error: "not_activated" };
  }

  return { ok: true, deactivated: true };
}

export type OrganisationAction = "invite" | "remove" | "reset_devices" | "change_seats";

export type OrganisationServiceError = LicenseApiError | BusinessError;

export type OrganisationServiceResult =
  | { ok: true; organisation: BusinessOrganisationOverview }
  | { ok: false; error: OrganisationServiceError };

async function organisationActorFromToken(input: TokenInput): Promise<
  | { ok: true; actor: { kind: "business_admin"; email: string; organisationId: string } }
  | { ok: false; error: OrganisationServiceError }
> {
  const deviceId = input.deviceId?.trim() ?? "";
  const licenseToken = input.licenseToken?.trim() ?? "";
  if (!deviceId || !licenseToken) return { ok: false, error: "invalid_request" };

  const previous = await decodeToken(licenseToken);
  if (!previous) return { ok: false, error: "not_activated" };
  if (previous.edition !== "business" && previous.edition !== "enterprise") {
    return { ok: false, error: "forbidden" };
  }
  if (previous.memberRole !== "owner" && previous.memberRole !== "admin") {
    return { ok: false, error: "forbidden" };
  }
  if (!previous.organisationId) return { ok: false, error: "not_found" };

  const found =
    (await findGrantByEmail(previous.email)) ??
    (await findGrantByLicenseId(previous.licenseId));
  if (!found) return { ok: false, error: "no_license" };
  if (presentationRejected(found)) return { ok: false, error: "no_license" };
  if (found.status === "revoked") return { ok: false, error: "revoked" };
  if (found.status !== "active") return { ok: false, error: "expired" };

  const activation = await findActivation(previous.licenseId, deviceId);
  if (!activation || activation.status !== "active") {
    return { ok: false, error: "not_activated" };
  }

  return {
    ok: true,
    actor: {
      kind: "business_admin",
      email: normalizeEmail(previous.email),
      organisationId: previous.organisationId,
    },
  };
}

export async function organisationForLicense(input: TokenInput): Promise<OrganisationServiceResult> {
  const session = await organisationActorFromToken(input);
  if (!session.ok) return session;
  const result = await organisationOverviewForActor(session.actor);
  return result.ok ? result : { ok: false, error: result.error };
}

export async function manageOrganisation(
  input: TokenInput & {
    action: OrganisationAction;
    seatId?: string;
    email?: string;
    role?: BusinessSeatRole;
    seatCount?: number;
  },
): Promise<OrganisationServiceResult> {
  const session = await organisationActorFromToken(input);
  if (!session.ok) return session;

  const organisationId = session.actor.organisationId;
  const seatId = input.seatId?.trim() ?? "";
  const email = input.email?.trim() ?? "";

  if (input.action === "change_seats") {
    const changed = await businessService.changeSeatQuantity(
      session.actor,
      organisationId,
      Number(input.seatCount),
      { source: "desktop", reason: "Organisation admin requested a seat change" },
    );
    if (!changed.ok) return { ok: false, error: changed.error };
  } else if (input.action === "invite") {
    const invited = businessService.inviteSeat(session.actor, organisationId, email, input.role ?? "member");
    if (!invited.ok) return { ok: false, error: invited.error };
  } else if (input.action === "remove") {
    const listed = businessService.listSeats(session.actor, organisationId);
    if (!listed.ok) return { ok: false, error: listed.error };
    const target = listed.value.seats.find((item) => item.seatId === seatId);
    if (target && normalizeEmail(target.email) === session.actor.email) {
      return { ok: false, error: "invalid_request" };
    }
    const removed = businessService.removeSeat(session.actor, organisationId, seatId);
    if (!removed.ok) return { ok: false, error: removed.error };
  } else if (input.action === "reset_devices") {
    const reset = await businessService.resetSeatDevices(session.actor, organisationId, seatId);
    if (!reset.ok) return { ok: false, error: reset.error };
  } else {
    return { ok: false, error: "invalid_request" };
  }

  const overview = await organisationOverviewForActor(session.actor);
  return overview.ok ? overview : { ok: false, error: overview.error };
}

export function organisationErrorStatus(error: OrganisationServiceError): number {
  if (error === "forbidden") return 403;
  if (error === "not_found" || error === "no_license") return 404;
  if (error === "seat_limit" || error === "duplicate_email" || error === "seat_in_use" || error === "min_seats") {
    return 409;
  }
  if (error === "stripe_unavailable" || error === "stripe_timeout") return 503;
  return licenseErrorStatus(error as LicenseApiError);
}

export function licenseErrorStatus(error: LicenseApiError): number {
  if (error === "server_error") return 500;
  if (error === "service_unavailable") return 503;
  if (error === "device_limit") return 409;
  if (error === "rate_limited") return 429;
  if (error === "expired" || error === "revoked") return 403;
  if (error === "payment_incomplete") return 402;
  return 400;
}
