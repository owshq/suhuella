import { brand } from "@suhuella/brand";
import {
  buildCallbackUri,
  currentBrandIntegrationConfig,
  getCloudProvider,
  isAllowedCallbackUri,
  isCloudIntegrationsPubliclyEnabled,
  isCloudProviderId,
  listCloudProviders,
  providerEnabledForBrand,
} from "./providers.ts";
import {
  decryptCloudTokens,
  encryptCloudTokens,
} from "./crypto-vault.ts";
import { randomCodeVerifier, randomNonce, randomOAuthState, timingSafeEqualString } from "./oauth-pkce.ts";
import {
  buildPkceAuthorizeUrl,
  getOAuthProviderImpl,
  readOAuthClient,
} from "./oauth-providers.ts";
import { getCloudIntegrationsStore, type CloudConnectionRecord } from "./store.ts";
import type {
  CloudConnectionPublic,
  CloudOwnerKind,
  CloudTokenSet,
} from "./types.ts";

const PENDING_TTL_MS = 10 * 60 * 1000;
const SAFE_RETURN = /^\/(home|sources|settings)(\?.*)?$/;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function toPublic(row: CloudConnectionRecord): CloudConnectionPublic {
  let scopes: string[] = [];
  try {
    scopes = JSON.parse(row.scopesJson) as string[];
  } catch {
    scopes = [];
  }
  return {
    id: row.id,
    brandId: row.brandId,
    provider: row.provider,
    status: row.status as CloudConnectionPublic["status"],
    accountEmail: row.accountEmail,
    accountDisplayName: row.accountDisplayName,
    scopes,
    tokenExpiresAt: row.tokenExpiresAt,
    lastSyncAt: row.lastSyncAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listIntegrationCatalog(brandId = brand.id) {
  return listCloudProviders().map((p) => ({
    provider: p.provider,
    displayName: p.displayName,
    supportsWebhooks: p.supportsWebhooks,
    enabled: providerEnabledForBrand(p.provider, brandId) && isCloudIntegrationsPubliclyEnabled(),
    scopes: [...p.scopes],
  }));
}

export async function listOwnerConnections(input: {
  brandId?: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
}): Promise<CloudConnectionPublic[]> {
  const brandId = input.brandId ?? brand.id;
  const store = await getCloudIntegrationsStore();
  const rows = await store.listConnections({
    brandId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
  });
  return rows.map(toPublic);
}

export async function startOAuth(input: {
  provider: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  origin: string;
  returnPath?: string;
}): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  if (!isCloudIntegrationsPubliclyEnabled()) {
    return { ok: false, error: "integrations_disabled" };
  }
  if (!isCloudProviderId(input.provider)) return { ok: false, error: "provider_unknown" };
  const brandId = brand.id;
  if (!providerEnabledForBrand(input.provider, brandId)) {
    return { ok: false, error: "provider_not_enabled" };
  }
  if (!input.ownerId.trim()) return { ok: false, error: "owner_required" };

  const client = readOAuthClient(input.provider);
  if (!client) return { ok: false, error: "oauth_client_missing" };

  const redirectUri = buildCallbackUri(input.origin, input.provider);
  if (!isAllowedCallbackUri(redirectUri, brandId)) {
    return { ok: false, error: "redirect_uri_not_allowed" };
  }

  const returnPath =
    input.returnPath && SAFE_RETURN.test(input.returnPath) ? input.returnPath : "/home";
  const state = randomOAuthState();
  const codeVerifier = randomCodeVerifier();
  const nonce = randomNonce();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString();

  const store = await getCloudIntegrationsStore();
  await store.putPending({
    state,
    provider: input.provider,
    brandId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId.trim(),
    codeVerifier,
    redirectUri,
    returnPath,
    nonce,
    expiresAt,
    consumedAt: null,
    createdAt,
  });

  const authorizeUrl = await buildPkceAuthorizeUrl({
    provider: input.provider,
    clientId: client.clientId,
    redirectUri,
    state,
    codeVerifier,
    nonce,
  });

  return { ok: true, authorizeUrl };
}

export async function handleOAuthCallback(input: {
  provider: string;
  state: string | null;
  code: string | null;
  error: string | null;
}): Promise<{ ok: true; returnPath: string; connectionId: string } | { ok: false; error: string; returnPath: string }> {
  const returnFallback = "/home";
  if (!isCloudProviderId(input.provider)) {
    return { ok: false, error: "provider_unknown", returnPath: returnFallback };
  }
  if (input.error) {
    return { ok: false, error: "provider_denied", returnPath: returnFallback };
  }
  if (!input.state || !input.code) {
    return { ok: false, error: "invalid_callback", returnPath: returnFallback };
  }

  const store = await getCloudIntegrationsStore();
  const pendingPeek = await store.getPending(input.state);
  if (!pendingPeek) {
    return { ok: false, error: "state_invalid", returnPath: returnFallback };
  }
  if (pendingPeek.consumedAt) {
    return { ok: false, error: "callback_replay", returnPath: pendingPeek.returnPath };
  }
  if (Date.parse(pendingPeek.expiresAt) < Date.now()) {
    return { ok: false, error: "state_expired", returnPath: pendingPeek.returnPath };
  }
  if (pendingPeek.provider !== input.provider) {
    return { ok: false, error: "state_provider_mismatch", returnPath: pendingPeek.returnPath };
  }
  if (pendingPeek.brandId !== brand.id) {
    return { ok: false, error: "brand_mismatch", returnPath: pendingPeek.returnPath };
  }
  if (!isAllowedCallbackUri(pendingPeek.redirectUri, pendingPeek.brandId)) {
    return { ok: false, error: "redirect_uri_not_allowed", returnPath: pendingPeek.returnPath };
  }

  const pending = await store.consumePending(input.state, nowIso());
  if (!pending) {
    return { ok: false, error: "callback_replay", returnPath: pendingPeek.returnPath };
  }

  const client = readOAuthClient(input.provider);
  if (!client) {
    return { ok: false, error: "oauth_client_missing", returnPath: pending.returnPath };
  }

  const impl = getOAuthProviderImpl(input.provider);
  let tokens: CloudTokenSet;
  try {
    tokens = await impl.exchangeCode({
      provider: input.provider,
      code: input.code,
      codeVerifier: pending.codeVerifier,
      redirectUri: pending.redirectUri,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token_exchange_failed";
    if (message.includes("code_verifier") || message === "token_exchange_failed") {
      return { ok: false, error: "pkce_invalid", returnPath: pending.returnPath };
    }
    return { ok: false, error: "token_exchange_failed", returnPath: pending.returnPath };
  }

  if (tokens.idToken && impl.validateIdToken) {
    try {
      await impl.validateIdToken({
        idToken: tokens.idToken,
        clientId: client.clientId,
        nonce: pending.nonce,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "id_token_invalid";
      return { ok: false, error: code, returnPath: pending.returnPath };
    }
  }

  let profile;
  try {
    profile = await impl.fetchAccount(tokens.accessToken);
  } catch {
    return { ok: false, error: "userinfo_failed", returnPath: pending.returnPath };
  }

  const def = getCloudProvider(input.provider)!;
  const createdAt = nowIso();
  const connectionId = newId("cconn");
  const scopes = tokens.rawScopes?.length ? tokens.rawScopes : [...def.scopes];

  await store.putConnection({
    id: connectionId,
    brandId: pending.brandId,
    ownerKind: pending.ownerKind,
    ownerId: pending.ownerId,
    provider: input.provider,
    accountExternalId: profile.externalId,
    accountEmail: profile.email,
    accountDisplayName: profile.displayName,
    status: "active",
    scopesJson: JSON.stringify(scopes),
    tokenExpiresAt: tokens.expiresAt ?? null,
    revokedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastSyncAt: null,
    createdAt,
    updatedAt: createdAt,
  });

  const encrypted = await encryptCloudTokens(tokens);
  await store.putCredential({
    connectionId,
    encryptionVersion: encrypted.encryptionVersion,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    keyId: encrypted.keyId,
    createdAt,
    rotatedAt: null,
  });

  const { enqueueSyncJob } = await import("./sync-jobs.ts");
  await enqueueSyncJob({ connectionId, brandId: pending.brandId });

  return { ok: true, returnPath: pending.returnPath, connectionId };
}

async function assertOwner(
  connection: CloudConnectionRecord,
  owner: { brandId?: string; ownerKind: CloudOwnerKind; ownerId: string },
): Promise<boolean> {
  const brandId = owner.brandId ?? brand.id;
  return (
    connection.brandId === brandId &&
    connection.ownerKind === owner.ownerKind &&
    timingSafeEqualString(connection.ownerId, owner.ownerId)
  );
}

export async function getConnectionStatus(input: {
  connectionId: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  brandId?: string;
}): Promise<
  | { ok: true; connection: CloudConnectionPublic; sync: import("./types.ts").CloudSyncProgress | null }
  | { ok: false; error: string }
> {
  const store = await getCloudIntegrationsStore();
  const row = await store.getConnection(input.connectionId);
  if (!row || row.status === "disconnected") return { ok: false, error: "not_found" };
  if (!(await assertOwner(row, input))) return { ok: false, error: "forbidden" };
  const { getLatestSyncProgress } = await import("./sync-jobs.ts");
  const sync = await getLatestSyncProgress(input.connectionId);
  return { ok: true, connection: toPublic(row), sync };
}

export async function disconnectConnection(input: {
  connectionId: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  brandId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const store = await getCloudIntegrationsStore();
  const row = await store.getConnection(input.connectionId);
  if (!row || row.status === "disconnected") return { ok: false, error: "not_found" };
  if (!(await assertOwner(row, input))) return { ok: false, error: "forbidden" };

  const cred = await store.getCredential(row.id);
  if (cred) {
    try {
      const tokens = await decryptCloudTokens({
        encryptionVersion: cred.encryptionVersion,
        ciphertext: cred.ciphertext,
        iv: cred.iv,
        keyId: cred.keyId,
      });
      const impl = getOAuthProviderImpl(row.provider);
      if (impl.revoke) await impl.revoke(tokens.accessToken);
    } catch {
      /* best-effort revoke */
    }
  }

  await store.deleteCredential(row.id);
  const updatedAt = nowIso();
  await store.updateConnection({
    ...row,
    status: "disconnected",
    revokedAt: updatedAt,
    updatedAt,
    lastErrorCode: null,
    lastErrorMessage: null,
  });
  await store.deleteConnection(row.id);
  return { ok: true };
}

export async function reconnectConnection(input: {
  connectionId: string;
  ownerKind: CloudOwnerKind;
  ownerId: string;
  origin: string;
  brandId?: string;
}): Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }> {
  const store = await getCloudIntegrationsStore();
  const row = await store.getConnection(input.connectionId);
  if (!row) return { ok: false, error: "not_found" };
  if (!(await assertOwner(row, input))) return { ok: false, error: "forbidden" };
  return startOAuth({
    provider: row.provider,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    origin: input.origin,
    returnPath: "/home",
  });
}

/** Server-only re-export — prefer importing from tokens.ts in new code. */
export { loadConnectionTokens, refreshConnectionTokens } from "./tokens.ts";

export function brandConfigForDocs() {
  return currentBrandIntegrationConfig();
}
