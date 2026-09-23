import { resolveBoundCommercialGeneration } from "../commercial-generations/grant-application.ts";
import {
  listLicenseAcquisitions,
  recordLicenseAcquisition,
} from "../commercial-generations/persistence.ts";
import { normalizeLicenseGrant } from "../license-entitlement.ts";
import { findGrantByLicenseId, upsertStoredGrant } from "../license-store.ts";
import { configuredPriceId, loadCatalogPrice } from "../stripe-catalog.ts";
import {
  verifyStripeCheckoutSession,
  type FulfilledCheckoutSession,
  type VerifySessionError,
} from "../verify-stripe-session.ts";
import {
  findLifetimeUpgradeIntentBySessionId,
  updateLifetimeUpgradeIntentStatus,
} from "./intent-persistence.ts";

export type LifetimeUpgradeFulfillmentResult =
  | { ok: true; fulfilled: boolean; duplicate?: boolean; paymentRecorded?: boolean }
  | { ok: false; error: VerifySessionError | "server_error" };

async function applyUpgradeToGrant(input: {
  session: FulfilledCheckoutSession;
  intentId: string;
  licenseId: string;
  targetGenerationId: string;
  stripeEventId?: string;
}): Promise<{ fulfilled: boolean; duplicate: boolean }> {
  const grant = await findGrantByLicenseId(input.licenseId);
  if (!grant || grant.edition !== "personal_lifetime") {
    await updateLifetimeUpgradeIntentStatus({ intentId: input.intentId, status: "failed" });
    return { fulfilled: false, duplicate: false };
  }

  const acquisitions = await listLicenseAcquisitions(input.licenseId);
  const alreadyUpgraded = acquisitions.some(
    (row) =>
      row.kind === "upgrade" &&
      row.commercialGenerationId === input.targetGenerationId &&
      row.licenseId === input.licenseId,
  );
  if (alreadyUpgraded || grant.commercialGenerationId === input.targetGenerationId) {
    await updateLifetimeUpgradeIntentStatus({
      intentId: input.intentId,
      status: "fulfilled",
    });
    return { fulfilled: true, duplicate: true };
  }

  const boundGenerationId = await resolveBoundCommercialGeneration(input.session.sessionId);
  if (!boundGenerationId || boundGenerationId !== input.targetGenerationId) {
    await updateLifetimeUpgradeIntentStatus({ intentId: input.intentId, status: "failed" });
    return { fulfilled: false, duplicate: false };
  }

  await recordLicenseAcquisition({
    licenseId: input.licenseId,
    email: grant.email,
    kind: "upgrade",
    commercialGenerationId: input.targetGenerationId,
    checkoutSessionId: input.session.sessionId,
    stripeEventId: input.stripeEventId ?? null,
    edition: "personal_lifetime",
  });

  const now = new Date().toISOString();
  await upsertStoredGrant(
    normalizeLicenseGrant({
      ...grant,
      // Keep original purchased version on the grant; cumulative rights come from acquisitions.
      generationAccessMode: "purchased_generation",
      updatedAt: now,
    }),
  );

  await updateLifetimeUpgradeIntentStatus({ intentId: input.intentId, status: "fulfilled" });
  return { fulfilled: true, duplicate: false };
}

/**
 * Grants the upgrade generation exactly once from a persisted intent.
 * Works without browser return to success and tolerates duplicate webhook delivery.
 */
export async function fulfillLifetimeUpgradeFromCheckout(input: {
  sessionId: string;
  secretKey: string;
  origin?: string;
  stripeEventId?: string;
}): Promise<LifetimeUpgradeFulfillmentResult> {
  const verified = await verifyStripeCheckoutSession(input.sessionId, input.secretKey, input.origin);
  if (!verified.ok) return verified;

  const session = verified.session;
  if (session.priceId !== configuredPriceId("lifetime_upgrade")) {
    return { ok: false, error: "invalid_session" };
  }
  if (session.quantity != null && session.quantity !== 1) {
    return { ok: false, error: "invalid_session" };
  }

  const price = await loadCatalogPrice("lifetime_upgrade", input.secretKey);
  if (!price.ok) {
    return {
      ok: false,
      error: price.reason === "stripe_unavailable" ? "server_error" : "invalid_session",
    };
  }

  const intent = await findLifetimeUpgradeIntentBySessionId(session.sessionId);
  if (!intent) return { ok: true, fulfilled: false };

  if (intent.status === "fulfilled") {
    return { ok: true, fulfilled: true, duplicate: true };
  }

  if (intent.status === "duplicate_payment") {
    return { ok: true, fulfilled: false, duplicate: true, paymentRecorded: true };
  }

  const priorUpgrade = (await listLicenseAcquisitions(intent.licenseId)).some(
    (row) =>
      row.kind === "upgrade" &&
      row.commercialGenerationId === intent.targetGenerationId &&
      row.checkoutSessionId !== session.sessionId,
  );
  if (priorUpgrade) {
    await updateLifetimeUpgradeIntentStatus({
      intentId: intent.id,
      status: "duplicate_payment",
      incidentNote: `duplicate_confirmed_payment:${session.sessionId}`,
    });
    return { ok: true, fulfilled: false, duplicate: true, paymentRecorded: true };
  }

  await updateLifetimeUpgradeIntentStatus({
    intentId: intent.id,
    status: "paid_pending_fulfillment",
  });

  const applied = await applyUpgradeToGrant({
    session,
    intentId: intent.id,
    licenseId: intent.licenseId,
    targetGenerationId: intent.targetGenerationId,
    stripeEventId: input.stripeEventId,
  });

  return {
    ok: true,
    fulfilled: applied.fulfilled,
    duplicate: applied.duplicate,
  };
}
