import { licenseTokenSignatureAlgorithm } from "@suhuella/product/lib/license-token-crypto.ts";
import type { LicenseActivation } from "./license-context.ts";
import {
  countActiveActivationsByPresentedAlgorithm,
  hmacPresentationsRemaining,
  presentedTokenAlgorithmFromLicenseToken,
} from "./license-hmac-retirement-metrics.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function activation(partial: Partial<LicenseActivation> & Pick<LicenseActivation, "deviceId">): LicenseActivation {
  return {
    licenseId: "lic_metrics",
    deviceName: "Test",
    platform: "darwin",
    appVersion: "0.1.0-pre-rc",
    activatedAt: "2026-09-01T00:00:00.000Z",
    lastSeen: "2026-09-20T00:00:00.000Z",
    status: "active",
    ...partial,
  };
}

async function run(): Promise<void> {
  assert(
    licenseTokenSignatureAlgorithm("ed25519.body.sig") === "ed25519",
    "prefixed token parses as ed25519",
  );
  assert(
    licenseTokenSignatureAlgorithm("body.sig") === "legacy-hmac-sha256",
    "unprefixed token parses as legacy HMAC",
  );
  assert(licenseTokenSignatureAlgorithm("invalid") === null, "invalid token returns null");
  assert(
    presentedTokenAlgorithmFromLicenseToken("body.sig") === "legacy-hmac-sha256",
    "presented algorithm helper",
  );

  const activations: LicenseActivation[] = [
    activation({ deviceId: "dev_ed", lastPresentedTokenAlgorithm: "ed25519" }),
    activation({ deviceId: "dev_hmac", lastPresentedTokenAlgorithm: "legacy-hmac-sha256" }),
    activation({ deviceId: "dev_revoked", status: "revoked", lastPresentedTokenAlgorithm: "legacy-hmac-sha256" }),
  ];
  const counts = countActiveActivationsByPresentedAlgorithm(activations);
  assert(counts.ed25519 === 1, "counts ed25519 active");
  assert(counts["legacy-hmac-sha256"] === 1, "counts legacy active");
  assert(
    hmacPresentationsRemaining(activations, { now: new Date("2026-09-23T00:00:00.000Z"), lookbackDays: 30 }) === 1,
    "one recent HMAC presentation",
  );

  console.log("LICENSE-HMAC-RETIREMENT-2B check passed");
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
