import { configuredPriceId, type CatalogProduct } from "../stripe-catalog.ts";
import {
  readCommercialGenerationPriceMap,
  readCommercialGenerationRegistry,
} from "./persistence.ts";
import {
  mergeCommercialGenerationRegistry,
  readCommercialGenerationPriceMapFromEnv,
  resolveCommercialGenerationForCheckout,
} from "./registry.ts";
import { isLicenseVersionModelActive } from "./version-model.ts";

export type PersonalCheckoutVersionResolution =
  | { ok: true; commercialGenerationId: string; priceId: string }
  | { ok: false; reason: "model_inactive" | "price_mismatch" | "version_unresolved" | "registry_incomplete" };

function catalogProductForPlan(plan: string): CatalogProduct | null {
  if (plan === "lifetime" || plan === "monthly") return plan;
  return null;
}

export async function resolvePersonalCheckoutVersionBinding(input: {
  plan: string;
  priceId: string;
  now?: Date;
}): Promise<PersonalCheckoutVersionResolution> {
  const priceId = input.priceId.trim();
  const product = catalogProductForPlan(input.plan);
  if (!product || !priceId.startsWith("price_")) {
    return { ok: false, reason: "price_mismatch" };
  }
  const expected = configuredPriceId(product);
  if (!expected || expected !== priceId) {
    return { ok: false, reason: "price_mismatch" };
  }

  const [persistedRegistry, persistedPrices] = await Promise.all([
    readCommercialGenerationRegistry(),
    readCommercialGenerationPriceMap(),
  ]);
  const registry = mergeCommercialGenerationRegistry(persistedRegistry);
  const priceMap = [...persistedPrices];
  for (const row of readCommercialGenerationPriceMapFromEnv()) {
    if (!priceMap.some((item) => item.priceId === row.priceId && item.product === row.product)) {
      priceMap.push(row);
    }
  }
  if (registry.length === 0 || priceMap.length === 0) {
    return { ok: false, reason: "registry_incomplete" };
  }

  const commercialGenerationId = resolveCommercialGenerationForCheckout({
    plan: input.plan,
    priceId,
    registry,
    priceMap,
    now: input.now,
  });
  if (!commercialGenerationId) {
    return { ok: false, reason: "version_unresolved" };
  }

  return { ok: true, commercialGenerationId, priceId };
}

/** When the version model is active, Stripe must not open without a resolvable license version. */
export async function validatePersonalCheckoutBeforeStripe(input: {
  plan: string;
  priceId: string;
}): Promise<PersonalCheckoutVersionResolution> {
  if (!isLicenseVersionModelActive()) {
    return { ok: false, reason: "model_inactive" };
  }
  return resolvePersonalCheckoutVersionBinding(input);
}
