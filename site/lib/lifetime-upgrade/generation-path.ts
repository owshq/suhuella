import type {
  CommercialGenerationPriceBinding,
  CommercialGenerationRecord,
} from "../commercial-generations/types.ts";
import { configuredPriceId } from "../stripe-catalog.ts";
import type { CommercialGenerationUpgradePath } from "./types.ts";

export function readCommercialGenerationUpgradeMapFromEnv(): CommercialGenerationUpgradePath[] {
  const raw = process.env.COMMERCIAL_GENERATION_UPGRADE_MAP?.trim() ?? "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const from = typeof record.from === "string" ? record.from.trim() : "";
      const to = typeof record.to === "string" ? record.to.trim() : "";
      if (!from || !to || from === to) return [];
      return [{ from, to }];
    });
  } catch {
    return [];
  }
}

export function resolveTargetGenerationForUpgradePrice(input: {
  priceMap: CommercialGenerationPriceBinding[];
  registry: CommercialGenerationRecord[];
  now?: Date;
}): string | null {
  const priceId = configuredPriceId("lifetime_upgrade");
  if (!priceId) return null;
  const mapped = input.priceMap.find(
    (row) => row.priceId === priceId && row.product === "lifetime_upgrade",
  );
  if (!mapped?.commercialGenerationId) return null;
  const generation = input.registry.find((row) => row.id === mapped.commercialGenerationId);
  if (!generation?.effectiveFrom) return null;
  const now = input.now ?? new Date();
  if (Date.parse(generation.effectiveFrom) > now.getTime()) return null;
  return mapped.commercialGenerationId;
}

export function isValidUpgradePath(
  sourceGenerationId: string,
  targetGenerationId: string,
  upgradeMap: CommercialGenerationUpgradePath[],
): boolean {
  return upgradeMap.some((row) => row.from === sourceGenerationId && row.to === targetGenerationId);
}
