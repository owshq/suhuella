import { readProductionCommercialConfig } from "./production-config.ts";
import {
  readCommercialGenerationPriceMap,
  readCommercialGenerationRegistry,
  recordCheckoutGenerationBinding,
} from "./persistence.ts";
import {
  mergeCommercialGenerationRegistry,
  readCommercialGenerationPriceMapFromEnv,
  resolveCommercialGenerationForCheckout,
} from "./registry.ts";

/** Binds generation at Stripe session creation. Authoritative for delayed webhooks. */
export async function bindCommercialGenerationForCheckoutSession(input: {
  checkoutSessionId: string;
  plan: string;
  priceId: string;
  commercialGenerationId?: string | null;
}): Promise<{ commercialGenerationId: string | null; versionModelActiveAtBind: boolean }> {
  const checkoutSessionId = input.checkoutSessionId.trim();
  const priceId = input.priceId.trim();
  const { isLicenseVersionModelActive } = await import("./version-model.ts");
  const versionModelActiveAtBind = isLicenseVersionModelActive();
  if (!checkoutSessionId || !priceId.startsWith("price_")) {
    return { commercialGenerationId: null, versionModelActiveAtBind };
  }

  const [persistedRegistry, persistedPrices] = await Promise.all([
    readCommercialGenerationRegistry(),
    readCommercialGenerationPriceMap(),
  ]);
  const production = readProductionCommercialConfig();
  const registry = mergeCommercialGenerationRegistry([
    ...persistedRegistry,
    ...(production?.registry ?? []),
  ]);
  const priceMap = [...persistedPrices, ...(production?.priceMap ?? [])];
  for (const row of readCommercialGenerationPriceMapFromEnv()) {
    if (!priceMap.some((item) => item.priceId === row.priceId && item.product === row.product)) {
      priceMap.push(row);
    }
  }

  const commercialGenerationId =
    input.commercialGenerationId !== undefined
      ? input.commercialGenerationId
      : resolveCommercialGenerationForCheckout({
          plan: input.plan,
          priceId,
          registry,
          priceMap,
        });

  await recordCheckoutGenerationBinding({
    checkoutSessionId,
    commercialGenerationId,
    priceId,
    plan: input.plan,
    versionModelActiveAtBind,
  });
  return { commercialGenerationId, versionModelActiveAtBind };
}
