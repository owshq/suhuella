/** PKCE (S256) + CSRF state for cloud OAuth. Not used by Cloudflare Access. */

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function randomOAuthState(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function randomCodeVerifier(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function randomNonce(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
