import { generateKeyPairSync } from "node:crypto";

export type TestLicenseSigningKeypair = {
  privateKeyPkcs8Base64: string;
  publicKeySpkiBase64: string;
};

export function generateTestLicenseSigningKeypair(): TestLicenseSigningKeypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPkcs8Base64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url"),
    publicKeySpkiBase64: publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
  };
}

export function applyTestLicenseSigningEnv(
  keypair: TestLicenseSigningKeypair,
): {
  LICENSE_SIGNING_PRIVATE_KEY: string;
  LICENSE_SIGNING_PUBLIC_KEYS: string;
  SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS: string;
} {
  process.env.LICENSE_SIGNING_PRIVATE_KEY = keypair.privateKeyPkcs8Base64;
  process.env.LICENSE_SIGNING_PUBLIC_KEYS = keypair.publicKeySpkiBase64;
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64;
  delete process.env.LICENSE_SIGNING_SECRET;
  return {
    LICENSE_SIGNING_PRIVATE_KEY: keypair.privateKeyPkcs8Base64,
    LICENSE_SIGNING_PUBLIC_KEYS: keypair.publicKeySpkiBase64,
    SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS: keypair.publicKeySpkiBase64,
  };
}
