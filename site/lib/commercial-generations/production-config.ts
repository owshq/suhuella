import type {
  CommercialGenerationPriceBinding,
  CommercialGenerationRecord,
} from "./types.ts";
import type { CommercialGenerationUpgradePath } from "../lifetime-upgrade/types.ts";

export type ProductionCommercialConfig = {
  registry: CommercialGenerationRecord[];
  priceMap: CommercialGenerationPriceBinding[];
  upgradeMap: CommercialGenerationUpgradePath[];
};

function parseRegistry(raw: string): CommercialGenerationRecord[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!id || !label || id.startsWith("gen_fixture_")) return [];
    const requiredCapabilities = Array.isArray(row.requiredCapabilities)
      ? row.requiredCapabilities.filter(
          (cap): cap is string => typeof cap === "string" && cap.trim().length > 0,
        )
      : [];
    const effectiveFrom =
      typeof row.effectiveFrom === "string" && row.effectiveFrom.trim()
        ? row.effectiveFrom.trim()
        : null;
    const createdAt =
      typeof row.createdAt === "string" && row.createdAt.trim()
        ? row.createdAt.trim()
        : new Date().toISOString();
    return [{ id, label, requiredCapabilities, effectiveFrom, createdAt }];
  });
}

function parsePriceMap(raw: string): CommercialGenerationPriceBinding[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const priceId = typeof row.priceId === "string" ? row.priceId.trim() : "";
    const commercialGenerationId =
      typeof row.commercialGenerationId === "string" ? row.commercialGenerationId.trim() : "";
    const product = row.product;
    if (!priceId.startsWith("price_") || !commercialGenerationId) return [];
    if (
      product !== "lifetime" &&
      product !== "monthly" &&
      product !== "business" &&
      product !== "lifetime_upgrade"
    ) {
      return [];
    }
    if (commercialGenerationId.startsWith("gen_fixture_")) return [];
    return [{ priceId, commercialGenerationId, product }];
  });
}

function parseUpgradeMap(raw: string): CommercialGenerationUpgradePath[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const from = typeof row.from === "string" ? row.from.trim() : "";
    const to = typeof row.to === "string" ? row.to.trim() : "";
    if (!from || !to || from === to) return [];
    if (from.startsWith("gen_fixture_") || to.startsWith("gen_fixture_")) return [];
    return [{ from, to }];
  });
}

/** Production registry + maps from Worker secrets. Never from the browser. */
export function readProductionCommercialConfig(
  env: Record<string, string | undefined> = process.env,
): ProductionCommercialConfig | null {
  const registryRaw = env.COMMERCIAL_GENERATION_REGISTRY?.trim() ?? "";
  const priceRaw = env.COMMERCIAL_GENERATION_PRICE_MAP?.trim() ?? "";
  const upgradeRaw = env.COMMERCIAL_GENERATION_UPGRADE_MAP?.trim() ?? "";
  if (!registryRaw || !priceRaw || !upgradeRaw) return null;
  try {
    const registry = parseRegistry(registryRaw);
    const priceMap = parsePriceMap(priceRaw);
    const upgradeMap = parseUpgradeMap(upgradeRaw);
    if (registry.length === 0 || priceMap.length === 0 || upgradeMap.length === 0) return null;
    return { registry, priceMap, upgradeMap };
  } catch {
    return null;
  }
}

export type ProductionCommercialConfigIssue =
  | "registry_missing"
  | "price_map_missing"
  | "upgrade_map_missing"
  | "upgrade_price_unmapped"
  | "upgrade_path_orphan"
  | "lifetime_price_unmapped";

export function validateProductionCommercialConfig(
  config: ProductionCommercialConfig,
  upgradePriceId: string,
  lifetimePriceId: string,
): ProductionCommercialConfigIssue[] {
  const issues: ProductionCommercialConfigIssue[] = [];
  const registryIds = new Set(config.registry.map((row) => row.id));

  if (!lifetimePriceId || !config.priceMap.some((row) => row.priceId === lifetimePriceId && row.product === "lifetime")) {
    issues.push("lifetime_price_unmapped");
  }
  if (
    !upgradePriceId ||
    !config.priceMap.some((row) => row.priceId === upgradePriceId && row.product === "lifetime_upgrade")
  ) {
    issues.push("upgrade_price_unmapped");
  }

  for (const path of config.upgradeMap) {
    if (!registryIds.has(path.from) || !registryIds.has(path.to)) {
      issues.push("upgrade_path_orphan");
    }
  }

  return issues;
}
