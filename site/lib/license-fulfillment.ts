import { applyCommercialGenerationOnFulfillment } from "./commercial-generations/grant-application.ts";
import { recordCheckoutReconciliationPending } from "./commercial-generations/persistence.ts";
import {
  normalizeEmail,
  parseLicenseEdition,
  type LicenseEdition,
  type LicenseGrant,
} from "./license-context.ts";
import { normalizeLicenseGrant } from "./license-entitlement.ts";
import { PLATFORM_OPERATOR } from "./license-presentation.ts";
import { configuredPriceId } from "./stripe-catalog.ts";
import { findGrantByEmail, upsertStoredGrant } from "./license-store.ts";
import type { FulfilledCheckoutSession } from "./verify-stripe-session.ts";

export type FulfilledLicense = {
  email: string;
  edition: LicenseEdition;
  status: "active";
};

export function editionFromCheckout(session: FulfilledCheckoutSession): LicenseEdition {
  const fromMetadata = parseLicenseEdition(session.edition);
  if (fromMetadata && fromMetadata !== "free") return fromMetadata;
  if (session.mode === "subscription") return "personal_monthly";
  return "personal_lifetime";
}

export async function fulfillLicenseFromCheckout(
  session: FulfilledCheckoutSession,
  options: { stripeEventId?: string } = {},
): Promise<FulfilledLicense | null> {
  const email = normalizeEmail(session.email ?? "");
  if (!email.includes("@")) return null;

  const edition = editionFromCheckout(session);
  const existing = await findGrantByEmail(email);
  if (existing && existing.origin !== "stripe") return null;
  const now = new Date().toISOString();
  const validUntil =
    edition === "personal_lifetime" ? null : (session.currentPeriodEnd ?? existing?.validUntil ?? null);

  const licenseId = existing?.licenseId || `lic_${session.customerId || email}`;
  const generationUpdate = await applyCommercialGenerationOnFulfillment({
    session,
    edition,
    existing,
    licenseId,
    stripeEventId: options.stripeEventId,
  });

  if ("deferReconciliation" in generationUpdate) {
    const product = edition === "personal_monthly" ? "monthly" : "lifetime";
    await recordCheckoutReconciliationPending({
      checkoutSessionId: session.sessionId,
      email,
      priceId: session.priceId ?? configuredPriceId(product) ?? "",
      plan: product,
      reason:
        generationUpdate.reason === "binding_missing"
          ? "binding_missing"
          : "version_unresolved",
      stripeEventId: options.stripeEventId ?? null,
    });
    return null;
  }

  const grant: LicenseGrant = normalizeLicenseGrant({
    email,
    customerId: session.customerId || existing?.customerId || `cust_${email}`,
    licenseId,
    edition,
    origin: "stripe",
    status: "active",
    validUntil,
    currentPeriodEnd: session.currentPeriodEnd,
    paymentProvider: "stripe",
    paymentReference: session.sessionId,
    checkoutSessionId: session.sessionId,
    subscriptionId: session.subscriptionId ?? existing?.subscriptionId,
    deviceLimit: existing?.deviceLimit,
    organisationId: existing?.organisationId,
    organisationName: existing?.organisationName,
    seatId: existing?.seatId,
    memberRole: existing?.memberRole,
    isPaid: true,
    issuedByOperator: existing?.issuedByOperator?.trim() || PLATFORM_OPERATOR,
    acceptedBrands:
      existing?.acceptedBrands && existing.acceptedBrands.length > 0
        ? existing.acceptedBrands
        : ["suhuella"],
    presentationBrandAtPurchase: existing?.presentationBrandAtPurchase || "suhuella",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(generationUpdate.commercialGenerationId !== undefined
      ? { commercialGenerationId: generationUpdate.commercialGenerationId }
      : existing?.commercialGenerationId !== undefined
        ? { commercialGenerationId: existing.commercialGenerationId }
        : {}),
    generationAccessMode:
      generationUpdate.generationAccessMode ??
      existing?.generationAccessMode ??
      undefined,
  });

  await upsertStoredGrant(grant);
  return { email, edition, status: "active" };
}

/** A Stripe customer record alone is not a paid entitlement. */
export function stripeCustomerImpliesPaidGrant(_hasCustomer: boolean, _hasLiveSubscription: boolean): false {
  return false;
}
