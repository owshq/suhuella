import type { GenerationAccessMode, LicenseEdition, LicenseGrant } from "../license-context.ts";
import type { CheckoutGenerationBinding } from "./types.ts";
import { isLicenseVersionModelActive } from "./version-model.ts";

export type GrantVersionClassification =
  | {
      kind: "recognized_pre_model_legacy";
      generationAccessMode: "legacy_unassigned";
    }
  | {
      kind: "post_model_valid";
      generationAccessMode: GenerationAccessMode;
      commercialGenerationId: string | null;
    }
  | {
      kind: "post_model_incomplete";
      reason: "binding_missing" | "version_unresolved" | "version_binding_required";
    };

/**
 * Classifies a grant from persisted server checkout evidence — never from registry order,
 * install version, login, or browser metadata.
 */
export function classifyGrantVersionFromBinding(input: {
  edition: LicenseEdition;
  existing: LicenseGrant | undefined;
  boundGenerationId: string | null;
  binding: CheckoutGenerationBinding | null;
}): GrantVersionClassification {
  const { boundGenerationId, binding } = input;

  if (boundGenerationId?.trim()) {
    const mode: GenerationAccessMode =
      input.edition === "personal_lifetime" ? "purchased_generation" : "active_subscription";
    return {
      kind: "post_model_valid",
      generationAccessMode: mode,
      commercialGenerationId: input.edition === "personal_lifetime" ? boundGenerationId.trim() : null,
    };
  }

  if (binding) {
    if (!binding.versionModelActiveAtBind) {
      return { kind: "recognized_pre_model_legacy", generationAccessMode: "legacy_unassigned" };
    }
    return { kind: "post_model_incomplete", reason: "version_unresolved" };
  }

  if (input.existing?.generationAccessMode === "legacy_unassigned") {
    return { kind: "recognized_pre_model_legacy", generationAccessMode: "legacy_unassigned" };
  }

  if (!isLicenseVersionModelActive()) {
    return { kind: "recognized_pre_model_legacy", generationAccessMode: "legacy_unassigned" };
  }

  return { kind: "post_model_incomplete", reason: "binding_missing" };
}
