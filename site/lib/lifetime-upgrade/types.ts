import type { CommercialGenerationId } from "../commercial-generations/types.ts";

export type LifetimeUpgradeIntentStatus =
  | "pending"
  | "checkout_created"
  | "paid_pending_fulfillment"
  | "fulfilled"
  | "failed"
  | "duplicate_payment";

/** Server-side upgrade attempt bound to holder, license, and target generation. */
export type LifetimeUpgradeIntent = {
  id: string;
  licenseId: string;
  normalizedEmail: string;
  sourceGenerationId: CommercialGenerationId;
  targetGenerationId: CommercialGenerationId;
  checkoutSessionId: string | null;
  idempotencyKey: string;
  status: LifetimeUpgradeIntentStatus;
  incidentNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialGenerationUpgradePath = {
  from: CommercialGenerationId;
  to: CommercialGenerationId;
};

export type LifetimeUpgradeEligibilityError =
  | "not_lifetime"
  | "wrong_holder"
  | "inactive_license"
  | "legacy_unassigned"
  | "generation_already_acquired"
  | "no_upgrade_path"
  | "target_not_effective";

export type LifetimeUpgradeCheckoutError =
  | "checkout_closed"
  | "invalid_proof"
  | "invalid_request"
  | "not_eligible"
  | "checkout_in_progress"
  | "price_invalid"
  | "server_error"
  | "stripe_unavailable";
