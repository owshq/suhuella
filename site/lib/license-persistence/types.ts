import type { LicenseActivation, LicenseGrant } from "../license-context.ts";
import type {
  CheckoutGenerationBinding,
  CheckoutReconciliationPending,
  CommercialGenerationPriceBinding,
  CommercialGenerationRecord,
  LicenseAcquisitionRecord,
} from "../commercial-generations/types.ts";
import type { LifetimeUpgradeIntent } from "../lifetime-upgrade/types.ts";

export type EmailVerificationPurpose =
  | "LICENSE_ACTIVATION"
  | "LICENSE_RECOVERY"
  | "BUSINESS_OWNER_VERIFICATION"
  | "BUSINESS_CHECKOUT"
  | "LIFETIME_UPGRADE"
  | "PARTNER_ONBOARDING"
  | "PARTNER_APPLICATION"
  | "PARTNER_PORTAL";

export type EmailVerificationChallenge = {
  id: string;
  normalizedEmail: string;
  purpose: EmailVerificationPurpose;
  deviceId: string | null;
  codeHash: string;
  expiresAt: string;
  attemptCount: number;
  sendCount: number;
  consumedAt: string | null;
  createdAt: string;
};

export type VerifiedEmailProof = {
  id: string;
  normalizedEmail: string;
  purpose: EmailVerificationPurpose;
  deviceId: string | null;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

export type ActivationAttempt = {
  id: string;
  checkoutSessionId: string | null;
  deviceId: string;
  plan: string | null;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
};

export type RateLimitEvent = {
  bucketKey: string;
  eventAt: string;
};

/** Receipt that a Stripe event was handled. Not a license and not a payment. */
export type StripeEventReceipt = {
  id: string;
  processedAt: string;
};

export type LicensePersistenceDocument = {
  version: 1;
  activations: LicenseActivation[];
  challenges: EmailVerificationChallenge[];
  proofs: VerifiedEmailProof[];
  activationAttempts: ActivationAttempt[];
  rateLimitEvents: RateLimitEvent[];
  grants: LicenseGrant[];
  stripeEvents: StripeEventReceipt[];
  commercialGenerations?: CommercialGenerationRecord[];
  commercialGenerationPrices?: CommercialGenerationPriceBinding[];
  checkoutGenerationBindings?: CheckoutGenerationBinding[];
  licenseAcquisitions?: LicenseAcquisitionRecord[];
  checkoutReconciliationPending?: CheckoutReconciliationPending[];
  licenseVersionModelActivatedAt?: string | null;
  lifetimeUpgradeIntents?: LifetimeUpgradeIntent[];
};

export type LicensePersistenceKind = "file" | "d1" | "memory" | "unavailable";

export class LicensePersistenceUnavailableError extends Error {
  readonly code = "license_persistence_unavailable";

  constructor() {
    super("LICENSE_DB is required in production");
    this.name = "LicensePersistenceUnavailableError";
  }
}

export type LicensePersistenceStore = {
  readonly kind: LicensePersistenceKind;
  read(): Promise<LicensePersistenceDocument>;
  write(document: LicensePersistenceDocument): Promise<void>;
};

export function emptyLicensePersistenceDocument(): LicensePersistenceDocument {
  return {
    version: 1,
    activations: [],
    challenges: [],
    proofs: [],
    activationAttempts: [],
    rateLimitEvents: [],
    grants: [],
    stripeEvents: [],
    commercialGenerations: [],
    commercialGenerationPrices: [],
    checkoutGenerationBindings: [],
    licenseAcquisitions: [],
    lifetimeUpgradeIntents: [],
  };
}
