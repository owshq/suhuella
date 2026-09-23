import {
  appVersionAffectsGenerationRights,
  isGenerationEnforcementActive,
} from "@suhuella/product/lib/generation-rights.ts";

/**
 * Commercial generation enforcement is intentionally off until operator decisions land.
 * Shared evaluator: packages/product/src/lib/generation-rights.ts
 */
export function commercialGenerationEnforcementActive(): boolean {
  return isGenerationEnforcementActive();
}

export { appVersionAffectsGenerationRights };

/**
 * Policy intent: security patches and mandatory fixes are never sold as version upgrades.
 * Real release flows must prove this — this constant alone is not enforcement.
 */
export function securityPatchBypassesGenerationGate(): true {
  return true;
}
