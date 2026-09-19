type AccessJwk = JsonWebKey & { kid?: string };

type AccessCerts = {
  keys?: AccessJwk[];
};

const certCache = new Map<string, { keys: AccessJwk[]; fetchedAt: number }>();
const CERT_TTL_MS = 60 * 60 * 1000;

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parseJsonPart(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function normalizeTeamDomain(teamDomain: string): string {
  return teamDomain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

async function getAccessKeys(teamDomain: string): Promise<AccessJwk[]> {
  const host = normalizeTeamDomain(teamDomain);
  const cached = certCache.get(host);
  if (cached && Date.now() - cached.fetchedAt < CERT_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(`https://${host}/cdn-cgi/access/certs`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("access_certs_unavailable");
  }

  const body = (await response.json()) as AccessCerts;
  const keys = Array.isArray(body.keys) ? body.keys : [];
  certCache.set(host, { keys, fetchedAt: Date.now() });
  return keys;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  return Array.isArray(aud) && aud.includes(expected);
}

export async function verifyCloudflareAccessJwt(
  token: string,
  teamDomain: string,
  audience: string,
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = parseJsonPart(headerPart);
  const payload = parseJsonPart(payloadPart);
  if (!header || !payload) return null;
  if (header.alg !== "RS256") return null;

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email) return null;

  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (!exp || exp * 1000 < Date.now()) return null;

  if (!audienceMatches(payload.aud, audience)) return null;

  const keys = await getAccessKeys(teamDomain);
  const kid = typeof header.kid === "string" ? header.kid : "";
  const jwk = keys.find((key) => key.kid === kid) ?? keys[0];
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signature = decodeBase64Url(signaturePart);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature.buffer.slice(
      signature.byteOffset,
      signature.byteOffset + signature.byteLength,
    ) as ArrayBuffer,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );

  return ok ? email : null;
}
