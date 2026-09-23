import { licenseTokenSignatureAlgorithm } from "@suhuella/product/lib/license-token-crypto.ts";
import type { LicenseActivation } from "./license-context.ts";

export type LicenseTokenAlgorithmMetric = "ed25519" | "legacy-hmac-sha256" | "unknown";

export function presentedTokenAlgorithmFromLicenseToken(
  licenseToken: string,
): LicenseTokenAlgorithmMetric {
  const algorithm = licenseTokenSignatureAlgorithm(licenseToken);
  if (algorithm === "ed25519" || algorithm === "legacy-hmac-sha256") return algorithm;
  return "unknown";
}

export function countActiveActivationsByPresentedAlgorithm(
  activations: LicenseActivation[],
): Record<LicenseTokenAlgorithmMetric, number> {
  const counts: Record<LicenseTokenAlgorithmMetric, number> = {
    ed25519: 0,
    "legacy-hmac-sha256": 0,
    unknown: 0,
  };
  for (const activation of activations) {
    if (activation.status !== "active") continue;
    const algorithm = activation.lastPresentedTokenAlgorithm ?? "unknown";
    if (algorithm in counts) counts[algorithm as LicenseTokenAlgorithmMetric] += 1;
    else counts.unknown += 1;
  }
  return counts;
}

/** Objective 2B pre-close signal: no active device has presented HMAC within the lookback window. */
export function hmacPresentationsRemaining(
  activations: LicenseActivation[],
  options: { now?: Date; lookbackDays?: number } = {},
): number {
  const now = options.now ?? new Date();
  const lookbackMs = (options.lookbackDays ?? 30) * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - lookbackMs;
  return activations.filter((activation) => {
    if (activation.status !== "active") return false;
    if (activation.lastPresentedTokenAlgorithm !== "legacy-hmac-sha256") return false;
    const lastSeen = Date.parse(activation.lastSeen);
    return Number.isFinite(lastSeen) && lastSeen >= cutoff;
  }).length;
}
