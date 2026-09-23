export { bindCommercialGenerationForCheckoutSession } from "./bind-at-checkout.ts";
export {
  commercialGenerationEnforcementActive,
  securityPatchBypassesGenerationGate,
} from "./enforcement.ts";
export { applyCommercialGenerationOnFulfillment, resolveBoundCommercialGeneration } from "./grant-application.ts";
export {
  findCheckoutGenerationBinding,
  listLicenseAcquisitions,
  readCommercialGenerationPriceMap,
  readCommercialGenerationRegistry,
  recordCheckoutGenerationBinding,
  recordLicenseAcquisition,
  seedCommercialGenerationRegistryForTests,
} from "./persistence.ts";
export {
  fixtureRegistryForTests,
  generationEffectiveForCheckout,
  mergeCommercialGenerationRegistry,
  readCommercialGenerationPriceMapFromEnv,
  resolveCommercialGenerationForCheckout,
} from "./registry.ts";
export {
  FIXTURE_COMMERCIAL_GENERATION,
  FIXTURE_COMMERCIAL_GENERATION_B,
  type CheckoutGenerationBinding,
  type CommercialGenerationId,
  type CommercialGenerationPriceBinding,
  type CommercialGenerationRecord,
  type GenerationAccessMode,
  type LicenseAcquisitionKind,
  type LicenseAcquisitionRecord,
} from "./types.ts";
