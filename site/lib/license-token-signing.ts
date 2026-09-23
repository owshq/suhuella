import { createHmac, createPrivateKey, sign } from "node:crypto";
import {
  formatSignedLicenseToken,
  parseLicenseToken,
  textToBase64Url,
  verifyEd25519LicenseTokenSignature,
  type LicenseTokenSignatureAlgorithm,
} from "@suhuella/product/lib/license-token-crypto.ts";

const DEFAULT_ALGORITHM: LicenseTokenSignatureAlgorithm = "ed25519";

function signingPrivateKeyPkcs8(): string {
  return process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim() || "";
}

function legacyHmacSecret(): string {
  return process.env.LICENSE_SIGNING_SECRET?.trim() || "";
}

export function licenseSigningPublicKeys(): string[] {
  const combined =
    process.env.LICENSE_SIGNING_PUBLIC_KEYS?.trim() ||
    process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim() ||
    process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEY?.trim() ||
    "";
  return combined
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function signEd25519LicenseTokenBody(body: string, privateKeyPkcs8Base64: string): string {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyPkcs8Base64, "base64url"),
    format: "der",
    type: "pkcs8",
  });
  const signature = sign(null, Buffer.from(body, "utf8"), key).toString("base64url");
  return formatSignedLicenseToken(DEFAULT_ALGORITHM, body, signature);
}

async function verifyLegacyHmac(body: string, signature: string, secret: string): Promise<boolean> {
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  return expected === signature;
}

export async function signLicenseTokenBody(body: string): Promise<string> {
  const privateKey = signingPrivateKeyPkcs8();
  if (privateKey) return signEd25519LicenseTokenBody(body, privateKey);
  const secret = legacyHmacSecret();
  if (!secret) throw new Error("LICENSE_SIGNING_PRIVATE_KEY or LICENSE_SIGNING_SECRET is not configured");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export async function verifyLicenseTokenSignature(licenseToken: string): Promise<{ ok: true; body: string } | { ok: false }> {
  const parsed = parseLicenseToken(licenseToken);
  if (!parsed) return { ok: false };

  if (parsed.algorithm === "ed25519") {
    for (const publicKey of licenseSigningPublicKeys()) {
      const verified = await verifyEd25519LicenseTokenSignature({
        body: parsed.body,
        signature: parsed.signature,
        publicKeySpkiBase64: publicKey,
      });
      if (verified) return { ok: true, body: parsed.body };
    }
    return { ok: false };
  }

  const secret = legacyHmacSecret();
  if (!secret) return { ok: false };
  const verified = await verifyLegacyHmac(parsed.body, parsed.signature, secret);
  return verified ? { ok: true, body: parsed.body } : { ok: false };
}

export { textToBase64Url };
