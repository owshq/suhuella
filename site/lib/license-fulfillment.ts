import {
  normalizeEmail,
  parseLicenseEdition,
  type LicenseEdition,
  type LicenseGrant,
} from "./license-context.ts";
import { normalizeLicenseGrant } from "./license-entitlement.ts";
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
): Promise<FulfilledLicense | null> {
  const email = normalizeEmail(session.email ?? "");
  if (!email.includes("@")) return null;

  const edition = editionFromCheckout(session);
  const existing = await findGrantByEmail(email);
  const now = new Date().toISOString();
  const validUntil =
    edition === "personal_lifetime" ? null : (session.currentPeriodEnd ?? existing?.validUntil ?? null);

  const grant: LicenseGrant = normalizeLicenseGrant({
    email,
    customerId: session.customerId || existing?.customerId || `cust_${email}`,
    licenseId: existing?.licenseId || `lic_${session.customerId || email}`,
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
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await upsertStoredGrant(grant);
  return { email, edition, status: "active" };
}

/** A Stripe customer record alone is not a paid entitlement. */
export function stripeCustomerImpliesPaidGrant(_hasCustomer: boolean, _hasLiveSubscription: boolean): false {
  return false;
}
