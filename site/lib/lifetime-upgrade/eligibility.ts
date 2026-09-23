import type {
  CommercialGenerationPriceBinding,
  CommercialGenerationRecord,
  LicenseAcquisitionRecord,
} from "../commercial-generations/types.ts";
import { normalizeEmail, type LicenseGrant } from "../license-context.ts";
import {
  isValidUpgradePath,
  readCommercialGenerationUpgradeMapFromEnv,
  resolveTargetGenerationForUpgradePrice,
} from "./generation-path.ts";
import type {
  CommercialGenerationUpgradePath,
  LifetimeUpgradeEligibilityError,
} from "./types.ts";

export type LifetimeUpgradeEligibilityResult =
  | { ok: true; sourceGenerationId: string; targetGenerationId: string }
  | { ok: false; error: LifetimeUpgradeEligibilityError };

function generationAlreadyAcquired(
  acquisitions: LicenseAcquisitionRecord[],
  targetGenerationId: string,
  grant: LicenseGrant,
): boolean {
  if (grant.commercialGenerationId === targetGenerationId) return true;
  return acquisitions.some(
    (row) =>
      row.kind === "upgrade" &&
      row.commercialGenerationId === targetGenerationId &&
      row.licenseId === grant.licenseId,
  );
}

/** Lifetime holder with a purchased source generation may buy the mapped target once. */
export function evaluateLifetimeUpgradeEligibility(input: {
  grant: LicenseGrant;
  holderEmail: string;
  acquisitions: LicenseAcquisitionRecord[];
  registry: CommercialGenerationRecord[];
  priceMap: CommercialGenerationPriceBinding[];
  upgradeMap?: CommercialGenerationUpgradePath[];
  now?: Date;
}): LifetimeUpgradeEligibilityResult {
  const holder = normalizeEmail(input.holderEmail);
  const grant = input.grant;
  const upgradeMap = input.upgradeMap ?? readCommercialGenerationUpgradeMapFromEnv();

  if (grant.edition !== "personal_lifetime") return { ok: false, error: "not_lifetime" };
  if (grant.status !== "active") return { ok: false, error: "inactive_license" };
  if (holder !== normalizeEmail(grant.email)) return { ok: false, error: "wrong_holder" };

  const sourceGenerationId = grant.commercialGenerationId?.trim() ?? "";
  if (!sourceGenerationId || grant.generationAccessMode === "legacy_unassigned") {
    return { ok: false, error: "legacy_unassigned" };
  }

  const targetGenerationId = resolveTargetGenerationForUpgradePrice({
    priceMap: input.priceMap,
    registry: input.registry,
    now: input.now,
  });
  if (!targetGenerationId) return { ok: false, error: "no_upgrade_path" };

  if (generationAlreadyAcquired(input.acquisitions, targetGenerationId, grant)) {
    return { ok: false, error: "generation_already_acquired" };
  }

  if (!isValidUpgradePath(sourceGenerationId, targetGenerationId, upgradeMap)) {
    return { ok: false, error: "no_upgrade_path" };
  }

  const targetGeneration = input.registry.find((row) => row.id === targetGenerationId);
  if (!targetGeneration?.effectiveFrom) return { ok: false, error: "target_not_effective" };
  const now = input.now ?? new Date();
  if (Date.parse(targetGeneration.effectiveFrom) > now.getTime()) {
    return { ok: false, error: "target_not_effective" };
  }

  return { ok: true, sourceGenerationId, targetGenerationId };
}
