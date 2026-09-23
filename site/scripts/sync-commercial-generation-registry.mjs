#!/usr/bin/env node
/** Sync COMMERCIAL_GENERATION_* secrets from env into LICENSE_DB / file persistence. */
import { syncCommercialGenerationRegistryFromEnv } from "../lib/commercial-generations/sync-registry-from-env.ts";

const result = await syncCommercialGenerationRegistryFromEnv(process.env);
if (!result.ok) {
  console.error(`sync failed: ${result.reason}`);
  console.error("Set COMMERCIAL_GENERATION_REGISTRY and COMMERCIAL_GENERATION_PRICE_MAP secrets first.");
  process.exit(1);
}
console.log(
  `synced ${result.generationCount} generations and ${result.priceCount} price bindings`,
);
