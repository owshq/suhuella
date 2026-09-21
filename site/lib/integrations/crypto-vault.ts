/**
 * At-rest encryption for cloud OAuth tokens.
 * Key material comes only from Worker secret CLOUD_TOKEN_ENCRYPTION_KEY (base64 32 bytes).
 * Never log plaintext tokens. Never send ciphertext to the browser.
 */

import type { CloudTokenSet, EncryptedCredentialBlob } from "./types.ts";

export const CLOUD_TOKEN_ENCRYPTION_VERSION = 1;
export const CLOUD_TOKEN_KEY_ID_ENV = "CLOUD_TOKEN_ENCRYPTION_KEY";
export const CLOUD_TOKEN_KEY_ID_LABEL = "v1";

function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function requireKeyBytes(env: Record<string, string | undefined> = process.env): Uint8Array<ArrayBuffer> {
  const raw = env[CLOUD_TOKEN_KEY_ID_ENV]?.trim() ?? "";
  if (!raw) {
    throw new Error("cloud_token_key_missing");
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(raw, "base64"));
  } catch {
    throw new Error("cloud_token_key_invalid");
  }
  if (bytes.byteLength !== 32) {
    throw new Error("cloud_token_key_invalid");
  }
  return asBufferSource(bytes);
}

async function importAesKey(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function encodeTokenSet(tokens: CloudTokenSet): Uint8Array<ArrayBuffer> {
  return asBufferSource(new TextEncoder().encode(JSON.stringify(tokens)));
}

function decodeTokenSet(bytes: Uint8Array): CloudTokenSet {
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CloudTokenSet;
  if (!parsed || typeof parsed.accessToken !== "string" || !parsed.accessToken) {
    throw new Error("cloud_token_payload_invalid");
  }
  return {
    accessToken: parsed.accessToken,
    refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
    tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : undefined,
    expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : undefined,
    idToken: typeof parsed.idToken === "string" ? parsed.idToken : undefined,
    rawScopes: Array.isArray(parsed.rawScopes)
      ? parsed.rawScopes.filter((s): s is string => typeof s === "string")
      : undefined,
  };
}

export async function encryptCloudTokens(
  tokens: CloudTokenSet,
  env: Record<string, string | undefined> = process.env,
): Promise<EncryptedCredentialBlob> {
  const keyBytes = requireKeyBytes(env);
  const key = await importAesKey(keyBytes);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodeTokenSet(tokens)),
  );
  return {
    encryptionVersion: CLOUD_TOKEN_ENCRYPTION_VERSION,
    ciphertext: asBufferSource(ciphertext),
    iv: asBufferSource(iv),
    keyId: CLOUD_TOKEN_KEY_ID_LABEL,
  };
}

export async function decryptCloudTokens(
  blob: EncryptedCredentialBlob,
  env: Record<string, string | undefined> = process.env,
): Promise<CloudTokenSet> {
  if (blob.encryptionVersion !== CLOUD_TOKEN_ENCRYPTION_VERSION) {
    throw new Error("cloud_token_version_unsupported");
  }
  const keyBytes = requireKeyBytes(env);
  const key = await importAesKey(keyBytes);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(blob.iv) },
      key,
      asBufferSource(blob.ciphertext),
    ),
  );
  return decodeTokenSet(plain);
}

/** Test helper: 32 random bytes as base64. Never use in production config files. */
export function generateTestEncryptionKeyBase64(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
}

export function assertNoTokenLeak(haystack: string): void {
  if (/ya29\.|sl\.[A-Za-z0-9_-]{20,}|access_token["']?\s*[:=]/i.test(haystack)) {
    throw new Error("token_leak_detected");
  }
}
