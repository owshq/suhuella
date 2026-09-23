/**
 * Cloud integrations — types only.
 * Separate from Cloudflare Access (ops) and Stripe (payments).
 */

export type CloudProviderId = "google_drive" | "dropbox" | "onedrive" | "box";

export type CloudOwnerKind = "device" | "license" | "organisation";

export type CloudConnectionStatus =
  | "pending"
  | "active"
  | "needs_reauth"
  | "revoked"
  | "error"
  | "disconnected";

export type CloudSyncJobStatus =
  | "queued"
  | "running"
  | "waiting_backoff"
  | "completed"
  | "failed"
  | "cancelled";

export type CloudProviderDefinition = {
  provider: CloudProviderId;
  displayName: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: readonly string[];
  supportsWebhooks: boolean;
  /** Brand ids allowed to use this provider (empty = none). */
  brandAllowlist: readonly string[];
  /** Feature flag: false keeps UI on Coming later and rejects start. */
  enabled: boolean;
  /** When false, omit from Sources catalog entirely (stub retained for later). */
  showInSourcesCatalog?: boolean;
  userinfoUrl?: string;
  revokeUrl?: string;
};

export type CloudBrandIntegrationConfig = {
  brandId: string;
  displayName: string;
  primaryDomain: string;
  /** Exact redirect URIs allowed for this brand (no wildcards). */
  callbackOrigins: readonly string[];
};

export type EncryptedCredentialBlob = {
  encryptionVersion: number;
  ciphertext: Uint8Array;
  iv: Uint8Array;
  keyId: string;
};

export type CloudTokenSet = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  idToken?: string;
  rawScopes?: string[];
};

export type CloudConnectionPublic = {
  id: string;
  brandId: string;
  provider: CloudProviderId;
  status: CloudConnectionStatus;
  accountEmail: string | null;
  accountDisplayName: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudSyncProgress = {
  jobId: string;
  status: CloudSyncJobStatus;
  progressFiles: number;
  progressBytes: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string;
};
