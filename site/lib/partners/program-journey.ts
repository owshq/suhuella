import {
  isPaidCheckoutPubliclyEnabled,
  isPartnerCheckoutEnvEnabled,
} from "../paid-checkout.ts";
import { configuredPriceId, STRIPE_CATALOG } from "../stripe-catalog.ts";
import { getPartnerStore } from "./store.ts";

export type PartnerProgramEntitlementKind =
  | "none"
  | "gift_pending_invite"
  | "gift_active"
  | "paid_pending"
  | "paid_ready"
  | "stripe_active";

export type PartnerProgramStep =
  | "verify_email"
  | "entitlement"
  | "setup"
  | "activation"
  | "complete";

export type PartnerProgramJourney = {
  step: PartnerProgramStep;
  email: string;
  partnerDisplayName: string | null;
  entitlement: {
    kind: PartnerProgramEntitlementKind;
    checkoutAvailable: boolean;
    checkoutClosedReason:
      | "catalog_disabled"
      | "platform_checkout_off"
      | "partner_checkout_off"
      | "price_not_configured"
      | null;
  };
  setup: {
    hasActiveMember: boolean;
    hasPendingDomain: boolean;
    hasActiveDomain: boolean;
    setupPath: "/partners/portal" | null;
  };
  activation: {
    commercialReady: boolean;
    technicalReady: boolean;
  };
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPartnerCheckoutPubliclyEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!STRIPE_CATALOG.partner.checkoutEnabled) return false;
  if (!isPaidCheckoutPubliclyEnabled(env)) return false;
  if (!isPartnerCheckoutEnvEnabled(env)) return false;
  return Boolean(configuredPriceId("partner"));
}

export async function resolvePartnerProgramJourney(email: string): Promise<PartnerProgramJourney> {
  const normalized = normalizeEmail(email);
  const store = await getPartnerStore();
  const doc = await store.read();
  const now = Date.now();

  const checkoutAvailable = isPartnerCheckoutPubliclyEnabled();
  const checkoutClosedReason = checkoutAvailable
    ? null
    : !STRIPE_CATALOG.partner.checkoutEnabled
      ? "catalog_disabled"
      : !isPaidCheckoutPubliclyEnabled()
        ? "platform_checkout_off"
        : !isPartnerCheckoutEnvEnabled()
          ? "partner_checkout_off"
          : !configuredPriceId("partner")
            ? "price_not_configured"
            : "catalog_disabled";

  const openInvite = doc.invites.find(
    (invite) =>
      invite.email === normalized &&
      !invite.consumedAt &&
      Date.parse(invite.expiresAt) > now,
  );

  const partnerByOwner = doc.partners.find((item) => item.ownerEmail === normalized);
  const activeMember = doc.members.find(
    (item) => item.email === normalized && item.status === "active",
  );
  const partner =
    (activeMember
      ? doc.partners.find((item) => item.partnerId === activeMember.partnerId)
      : null) ??
    (openInvite
      ? doc.partners.find((item) => item.partnerId === openInvite.partnerId)
      : null) ??
    partnerByOwner ??
    null;

  const brand = partner
    ? doc.brands.find((item) => item.partnerId === partner.partnerId) ?? null
    : null;

  const entitlement =
    partner == null
      ? null
      : doc.entitlements
          .filter((item) => item.partnerId === partner.partnerId && item.status !== "revoked")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  const domains = partner
    ? doc.domains.filter((item) => item.partnerId === partner.partnerId)
    : [];
  const hasActiveDomain = domains.some((item) => item.status === "active");
  const hasPendingDomain = domains.some((item) => item.status === "pending");

  let entitlementKind: PartnerProgramEntitlementKind = "none";
  if (openInvite && !entitlement) {
    entitlementKind = "gift_pending_invite";
  } else if (entitlement?.origin === "stripe" && entitlement.status === "active") {
    entitlementKind = "stripe_active";
  } else if (
    entitlement &&
    entitlement.status === "active" &&
    entitlement.origin !== "stripe"
  ) {
    entitlementKind = "gift_active";
  } else if (entitlement && entitlement.status === "pending") {
    entitlementKind = checkoutAvailable ? "paid_ready" : "paid_pending";
  } else if (!partner && !openInvite) {
    entitlementKind = checkoutAvailable ? "paid_ready" : "paid_pending";
  }

  const commercialReady = Boolean(
    entitlement &&
      entitlement.status === "active" &&
      partner &&
      partner.status !== "revoked" &&
      partner.status !== "suspended",
  );
  const technicalReady = commercialReady && hasActiveDomain;
  const hasActiveMember = Boolean(activeMember);

  let step: PartnerProgramStep = "entitlement";
  if (technicalReady && partner?.status === "active") {
    step = "complete";
  } else if (commercialReady || hasActiveMember || openInvite) {
    step = hasActiveDomain ? "activation" : "setup";
  } else if (entitlementKind === "paid_pending" || entitlementKind === "paid_ready") {
    step = "entitlement";
  } else if (entitlementKind === "gift_pending_invite") {
    step = "entitlement";
  }

  return {
    step,
    email: normalized,
    partnerDisplayName: brand?.displayName ?? partner?.displayName ?? null,
    entitlement: {
      kind: entitlementKind,
      checkoutAvailable,
      checkoutClosedReason,
    },
    setup: {
      hasActiveMember,
      hasPendingDomain,
      hasActiveDomain,
      setupPath: hasActiveMember ? "/partners/portal" : null,
    },
    activation: {
      commercialReady,
      technicalReady,
    },
  };
}
