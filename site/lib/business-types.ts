export type BusinessPlan = "business" | "enterprise";

export type BusinessAccountStatus = "active" | "trial" | "suspended";

export type BusinessSeatRole = "owner" | "admin" | "member";

export type BusinessSeatStatus = "invited" | "active" | "suspended" | "removed";

export type BusinessBillingInterval = "month" | "year";

export type BusinessAccount = {
  organisationId: string;
  name: string;
  billingCustomerId: string;
  ownerEmail: string | null;
  plan: BusinessPlan;
  seatLimit: number;
  seatPriceCents: number;
  currency: string;
  status: BusinessAccountStatus;
  trialEndsAt: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionItemId: string | null;
  stripeStatus: string | null;
  currentPeriodEnd: string | null;
  recurringAmountCents: number | null;
  billingInterval: BusinessBillingInterval | null;
  billingNeedsReconciliation: boolean;
  lastStripeEventId: string | null;
  lastStripeEventCreated: number | null;
  stripeCheckoutSessionId: string | null;
  /** Active devices allowed per assigned seat. Superadmin-configurable; default 3. */
  deviceLimitPerSeat?: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessSeatChangeSource = "desktop" | "ops" | "webhook";

export type BusinessSeatChangeResult = "success" | "rejected" | "failed";

export type BusinessSeatChangeRecord = {
  id: string;
  organisationId: string;
  actorEmail: string;
  actorKind: "superadmin" | "business_admin";
  actorRole: string | null;
  source: BusinessSeatChangeSource;
  reason: string | null;
  previousQuantity: number;
  requestedQuantity: number;
  confirmedQuantity: number | null;
  stripeSubscriptionId: string | null;
  result: BusinessSeatChangeResult;
  error: string | null;
  timestamp: string;
};

export type ProcessedStripeEvent = {
  id: string;
  receivedAt: string;
};

export type BusinessBranding = {
  organisationId: string;
  logoAssetRef: string | null;
  updatedAt: string;
  updatedByEmail: string;
};

export type BusinessSeat = {
  seatId: string;
  organisationId: string;
  email: string;
  role: BusinessSeatRole;
  status: BusinessSeatStatus;
  licenseId: string;
  invitedAt: string;
  activatedAt: string | null;
  lastSeenAt: string | null;
};

export type BusinessActor =
  | { kind: "superadmin" }
  | { kind: "business_admin"; email: string; organisationId: string };

export type BusinessError =
  | "invalid_request"
  | "not_found"
  | "forbidden"
  | "min_seats"
  | "seat_limit"
  | "seat_in_use"
  | "duplicate_email"
  | "unsupported_plan"
  | "cannot_change_pricing"
  | "cannot_grant_lifetime"
  | "cannot_access_other_organisation"
  | "cannot_modify_recommendation_engine"
  | "cannot_modify_user_files"
  | "cannot_revoke_paid_license"
  | "invalid_branding_asset"
  | "subscription_missing"
  | "subscription_item_missing"
  | "stale_stripe_reference"
  | "stripe_unavailable"
  | "stripe_timeout"
  | "billing_mismatch"
  | "needs_reconciliation"
  | "not_business";

export const OCCUPIED_SEAT_STATUSES: readonly BusinessSeatStatus[] = [
  "invited",
  "active",
  "suspended",
];
