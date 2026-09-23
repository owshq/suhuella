import type { GenerationAccessMode, LicenseEdition, LicenseGrant } from "../license-context.ts";
import type { FulfilledCheckoutSession } from "../verify-stripe-session.ts";
import { classifyGrantVersionFromBinding } from "./grant-classification.ts";
import {
  findCheckoutGenerationBinding,
  recordLicenseAcquisition,
} from "./persistence.ts";

export type CommercialGenerationGrantUpdate =
  | {
      generationAccessMode: GenerationAccessMode;
      commercialGenerationId?: string | null;
    }
  | {
      deferReconciliation: true;
      reason: "binding_missing" | "version_unresolved" | "version_binding_required";
    };

/**
 * Resolves generation for fulfillment from server checkout binding only.
 * Stripe session metadata is not authoritative (browser cannot set it; ops must not rely on it alone).
 */
export async function resolveBoundCommercialGeneration(
  checkoutSessionId: string,
): Promise<string | null> {
  const binding = await findCheckoutGenerationBinding(checkoutSessionId);
  return binding?.commercialGenerationId ?? null;
}

/**
 * Applies generation fields to a grant without overwriting a Lifetime purchase generation id.
 * Cumulative upgrade rights live in license_acquisition — not by replacing the initial version field.
 */
export async function applyCommercialGenerationOnFulfillment(input: {
  session: FulfilledCheckoutSession;
  edition: LicenseEdition;
  existing: LicenseGrant | undefined;
  licenseId: string;
  stripeEventId?: string;
}): Promise<CommercialGenerationGrantUpdate> {
  const binding = await findCheckoutGenerationBinding(input.session.sessionId);
  const boundGenerationId = binding?.commercialGenerationId ?? null;

  await recordLicenseAcquisition({
    licenseId: input.licenseId,
    email: input.session.email,
    kind: "initial_purchase",
    commercialGenerationId: boundGenerationId,
    checkoutSessionId: input.session.sessionId,
    stripeEventId: input.stripeEventId ?? null,
    edition: input.edition,
  });

  if (input.existing?.commercialGenerationId && input.edition === "personal_lifetime") {
    return {
      generationAccessMode:
        input.existing.generationAccessMode ??
        (input.existing.commercialGenerationId ? "purchased_generation" : "legacy_unassigned"),
    };
  }

  const classification = classifyGrantVersionFromBinding({
    edition: input.edition,
    existing: input.existing,
    boundGenerationId,
    binding,
  });

  if (classification.kind === "post_model_incomplete") {
    return { deferReconciliation: true, reason: classification.reason };
  }

  if (classification.kind === "recognized_pre_model_legacy") {
    return { generationAccessMode: classification.generationAccessMode };
  }

  return {
    generationAccessMode: classification.generationAccessMode,
    commercialGenerationId: classification.commercialGenerationId,
  };
}
