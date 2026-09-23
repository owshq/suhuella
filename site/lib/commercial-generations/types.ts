import type { GenerationAccessMode, LicenseEdition } from "../license-context.ts";

/** Opaque commercial generation id. Production ids require operator confirmation. */
export type CommercialGenerationId = string;

export type { GenerationAccessMode };

export type LicenseAcquisitionKind =
  | "initial_purchase"
  | "subscription_period"
  | "upgrade"
  | "renewal";

/** Registry row: commercial generation and capabilities that require it (not app semver). */
export type CommercialGenerationRecord = {
  id: CommercialGenerationId;
  label: string;
  /** Product capabilities gated to this generation when enforcement is on. Not patch/security scope. */
  requiredCapabilities: string[];
  /** When sales may bind new checkouts to this generation. Null = registered only, not for checkout. */
  effectiveFrom: string | null;
  createdAt: string;
};

/** Server-side price → generation map. Never supplied by the browser. */
export type CommercialGenerationPriceBinding = {
  priceId: string;
  commercialGenerationId: CommercialGenerationId;
  product: "lifetime" | "monthly" | "business" | "lifetime_upgrade";
};

/** Frozen at checkout session creation — authoritative for delayed webhooks. */
export type CheckoutGenerationBinding = {
  checkoutSessionId: string;
  commercialGenerationId: CommercialGenerationId | null;
  priceId: string;
  plan: string;
  boundAt: string;
  /** Persisted server evidence: was LICENSE_VERSION_MODEL active when this session was created. */
  versionModelActiveAtBind: boolean;
};

export type CheckoutReconciliationPendingReason =
  | "binding_missing"
  | "version_unresolved"
  | "fulfillment_deferred";

export type CheckoutReconciliationPending = {
  id: string;
  checkoutSessionId: string;
  normalizedEmail: string;
  priceId: string;
  plan: string;
  reason: CheckoutReconciliationPendingReason;
  stripeEventId: string | null;
  recordedAt: string;
  status: "open" | "resolved";
};

/** Append-only purchase history. Original acquisition is never overwritten. */
export type LicenseAcquisitionRecord = {
  id: string;
  licenseId: string;
  normalizedEmail: string;
  kind: LicenseAcquisitionKind;
  commercialGenerationId: CommercialGenerationId | null;
  checkoutSessionId: string | null;
  stripeEventId: string | null;
  edition: LicenseEdition;
  acquiredAt: string;
};

/** Fixture-only ids for tests. Production generations require operator confirmation. */
export const FIXTURE_COMMERCIAL_GENERATION: CommercialGenerationRecord = {
  id: "gen_fixture_alpha",
  label: "Fixture generation alpha",
  requiredCapabilities: ["apply_bulk_organisation"],
  effectiveFrom: "2026-09-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
};

export const FIXTURE_COMMERCIAL_GENERATION_B: CommercialGenerationRecord = {
  id: "gen_fixture_beta",
  label: "Fixture generation beta",
  requiredCapabilities: ["apply_bulk_organisation", "rename_file"],
  effectiveFrom: "2026-09-15T00:00:00.000Z",
  createdAt: "2026-09-15T00:00:00.000Z",
};
