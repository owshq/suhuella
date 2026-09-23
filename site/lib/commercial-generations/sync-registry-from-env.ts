import { readProductionCommercialConfig } from "./production-config.ts";
import { seedCommercialGenerationRegistryForTests } from "./persistence.ts";

/** One-time or window sync: persist production registry rows from Worker secrets into D1/file store. */
export async function syncCommercialGenerationRegistryFromEnv(
  env: Record<string, string | undefined> = process.env,
): Promise<{ ok: true; generationCount: number; priceCount: number } | { ok: false; reason: string }> {
  const config = readProductionCommercialConfig(env);
  if (!config) return { ok: false, reason: "production_config_missing" };
  await seedCommercialGenerationRegistryForTests(config.registry, config.priceMap);
  return {
    ok: true,
    generationCount: config.registry.length,
    priceCount: config.priceMap.length,
  };
}
