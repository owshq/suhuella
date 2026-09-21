import { encryptCloudTokens, decryptCloudTokens } from "./crypto-vault.ts";
import { getOAuthProviderImpl, readOAuthClient } from "./oauth-providers.ts";
import { getCloudIntegrationsStore } from "./store.ts";
import type { CloudTokenSet } from "./types.ts";

function nowIso(): string {
  return new Date().toISOString();
}

/** Server-only: load decrypted tokens. Never expose to API JSON. */
export async function loadConnectionTokens(connectionId: string): Promise<CloudTokenSet | null> {
  const store = await getCloudIntegrationsStore();
  const cred = await store.getCredential(connectionId);
  if (!cred) return null;
  return decryptCloudTokens({
    encryptionVersion: cred.encryptionVersion,
    ciphertext: cred.ciphertext,
    iv: cred.iv,
    keyId: cred.keyId,
  });
}

export async function refreshConnectionTokens(
  connectionId: string,
): Promise<{ ok: true; tokens: CloudTokenSet } | { ok: false; error: string }> {
  const store = await getCloudIntegrationsStore();
  const row = await store.getConnection(connectionId);
  if (!row) return { ok: false, error: "not_found" };
  const existing = await loadConnectionTokens(connectionId);
  if (!existing?.refreshToken) return { ok: false, error: "refresh_missing" };

  const client = readOAuthClient(row.provider);
  if (!client) return { ok: false, error: "oauth_client_missing" };

  try {
    const tokens = await getOAuthProviderImpl(row.provider).refresh({
      provider: row.provider,
      refreshToken: existing.refreshToken,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
    });
    const encrypted = await encryptCloudTokens(tokens);
    const now = nowIso();
    await store.putCredential({
      connectionId,
      encryptionVersion: encrypted.encryptionVersion,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      keyId: encrypted.keyId,
      createdAt: now,
      rotatedAt: now,
    });
    await store.updateConnection({
      ...row,
      status: "active",
      tokenExpiresAt: tokens.expiresAt ?? null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: now,
    });
    return { ok: true, tokens };
  } catch (error) {
    const code =
      error instanceof Error && error.message === "refresh_expired" ? "refresh_expired" : "refresh_failed";
    const now = nowIso();
    await store.updateConnection({
      ...row,
      status: "needs_reauth",
      lastErrorCode: code,
      lastErrorMessage: "Reconnect this account to renew permissions.",
      updatedAt: now,
    });
    return { ok: false, error: code };
  }
}
