import type { LicenseActivation, LicenseGrant } from "../license-context.ts";

export type EmailVerificationPurpose =
  | "LICENSE_ACTIVATION"
  | "LICENSE_RECOVERY"
  | "BUSINESS_OWNER_VERIFICATION";

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

export type LicensePersistenceDocument = {
  version: 1;
  activations: LicenseActivation[];
  challenges: EmailVerificationChallenge[];
  proofs: VerifiedEmailProof[];
  activationAttempts: ActivationAttempt[];
  rateLimitEvents: RateLimitEvent[];
  grants: LicenseGrant[];
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
  };
}
