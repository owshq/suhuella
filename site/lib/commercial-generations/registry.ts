import { configuredPriceId, type CatalogProduct } from "../stripe-catalog.ts";
import {
  FIXTURE_COMMERCIAL_GENERATION,
  type CommercialGenerationId,
  type CommercialGenerationPriceBinding,
  type CommercialGenerationRecord,
} from "./types.ts";

function catalogProductForPlan(plan: string): CatalogProduct | null {
  if (plan === "lifetime" || plan === "monthly") return plan;
  if (plan === "lifetime_upgrade") return "lifetime_upgrade";
  return null;
}

export function readCommercialGenerationPriceMapFromEnv(): CommercialGenerationPriceBinding[] {
  const raw = process.env.COMMERCIAL_GENERATION_PRICE_MAP?.trim() ?? "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const priceId = typeof record.priceId === "string" ? record.priceId.trim() : "";
      const commercialGenerationId =
        typeof record.commercialGenerationId === "string" ? record.commercialGenerationId.trim() : "";
      const product = record.product;
      if (!priceId.startsWith("price_") || !commercialGenerationId) return [];
      if (
        product !== "lifetime" &&
        product !== "monthly" &&
        product !== "business" &&
        product !== "lifetime_upgrade"
      ) {
        return [];
      }
      return [{ priceId, commercialGenerationId, product }];
    });
  } catch {
    return [];
  }
}

export function mergeCommercialGenerationRegistry(
  persisted: CommercialGenerationRecord[],
): CommercialGenerationRecord[] {
  const byId = new Map<string, CommercialGenerationRecord>();
  for (const row of persisted) {
    if (row.id?.trim()) byId.set(row.id.trim(), row);
  }
  return [...byId.values()];
}

export function resolveCommercialGenerationForCheckout(input: {
  plan: string;
  priceId: string;
  registry: CommercialGenerationRecord[];
  priceMap: CommercialGenerationPriceBinding[];
  now?: Date;
}): CommercialGenerationId | null {
  const priceId = input.priceId.trim();
  const product = catalogProductForPlan(input.plan);
  if (!product || !priceId.startsWith("price_")) return null;

  const expectedCatalogPrice = configuredPriceId(product);
  if (!expectedCatalogPrice || expectedCatalogPrice !== priceId) return null;

  const mapped =
    input.priceMap.find((row) => row.priceId === priceId && row.product === product) ??
    input.priceMap.find((row) => row.priceId === priceId);
  if (!mapped) {
    const checkoutId = process.env.COMMERCIAL_GENERATION_CHECKOUT_ID?.trim() ?? "";
    if (!checkoutId) return null;
    const generation = input.registry.find((row) => row.id === checkoutId);
    if (!generation) return null;
    if (!generationEffectiveForCheckout(generation, input.now ?? new Date())) return null;
    return checkoutId;
  }

  const generation = input.registry.find((row) => row.id === mapped.commercialGenerationId);
  if (!generation) return null;
  if (!generationEffectiveForCheckout(generation, input.now ?? new Date())) return null;
  return mapped.commercialGenerationId;
}

export function generationEffectiveForCheckout(
  generation: CommercialGenerationRecord,
  now: Date,
): boolean {
  if (!generation.effectiveFrom) return false;
  return Date.parse(generation.effectiveFrom) <= now.getTime();
}

export function fixtureRegistryForTests(): CommercialGenerationRecord[] {
  return [FIXTURE_COMMERCIAL_GENERATION];
}
