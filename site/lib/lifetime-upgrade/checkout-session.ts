import { bindCommercialGenerationForCheckoutSession } from "../commercial-generations/bind-at-checkout.ts";
import {
  listLicenseAcquisitions,
  readCommercialGenerationPriceMap,
  readCommercialGenerationRegistry,
} from "../commercial-generations/index.ts";
import { mergeCommercialGenerationRegistry } from "../commercial-generations/registry.ts";
import type { CheckoutReturnTo } from "../checkout.ts";
import { consumeVerifiedEmailProof } from "../email-verification.ts";
import { evaluateLifetimeUpgradeCheckout } from "../lifetime-upgrade-audit.ts";
import { findGrantByLicenseId } from "../license-store.ts";
import { isPaidCheckoutPubliclyEnabled, stripeSecretAllowedForOrigin } from "../paid-checkout.ts";
import { configuredPriceId, loadCatalogPrice } from "../stripe-catalog.ts";
import { evaluateLifetimeUpgradeEligibility } from "./eligibility.ts";
import {
  attachCheckoutSessionToUpgradeIntent,
  createOrReuseLifetimeUpgradeIntent,
  findActiveLifetimeUpgradeIntent,
} from "./intent-persistence.ts";
import type { LifetimeUpgradeCheckoutError } from "./types.ts";

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function lifetimeUpgradeReturnUrls(
  origin: string,
  returnTo: CheckoutReturnTo,
): { successUrl: string; cancelUrl: string } {
  if (returnTo === "settings") {
    return {
      successUrl: `${origin}/settings?prefs=license&upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/settings?prefs=license&upgrade=canceled`,
    };
  }
  if (returnTo === "desktop") {
    return {
      successUrl: `${origin}/license/success?from=desktop&upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/license/success?from=desktop&upgrade=canceled`,
    };
  }
  return {
    successUrl: `${origin}/license/success?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/license?upgrade=canceled`,
  };
}

export async function createLifetimeUpgradeCheckoutSession(input: {
  proofId: string;
  licenseId: string;
  origin: string;
  returnTo?: CheckoutReturnTo;
  /** Test-only bypass of commercial gates. Never set from HTTP routes. */
  bypassCommercialGateForTests?: boolean;
}): Promise<
  | { ok: true; url: string; intentId: string; checkoutSessionId: string }
  | { ok: false; error: LifetimeUpgradeCheckoutError }
> {
  if (!input.bypassCommercialGateForTests) {
    const gate = evaluateLifetimeUpgradeCheckout();
    if (!gate.allowed) return { ok: false, error: "checkout_closed" };
    if (!isPaidCheckoutPubliclyEnabled()) return { ok: false, error: "checkout_closed" };
  }

  const proof = await consumeVerifiedEmailProof({
    proofId: input.proofId,
    purpose: "LIFETIME_UPGRADE",
  });
  if (!proof.ok) return { ok: false, error: "invalid_proof" };

  const licenseId = input.licenseId.trim();
  if (!licenseId) return { ok: false, error: "invalid_request" };

  const grant = await findGrantByLicenseId(licenseId);
  if (!grant) return { ok: false, error: "not_eligible" };

  const [persistedRegistry, persistedPrices, acquisitions] = await Promise.all([
    readCommercialGenerationRegistry(),
    readCommercialGenerationPriceMap(),
    listLicenseAcquisitions(licenseId),
  ]);
  const registry = mergeCommercialGenerationRegistry(persistedRegistry);

  const eligibility = evaluateLifetimeUpgradeEligibility({
    grant,
    holderEmail: proof.email,
    acquisitions,
    registry,
    priceMap: persistedPrices,
  });
  if (!eligibility.ok) return { ok: false, error: "not_eligible" };

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const origin = input.origin.trim();
  if (!secretKey || !configuredPriceId("lifetime_upgrade") || !stripeSecretAllowedForOrigin(secretKey, origin)) {
    return { ok: false, error: "checkout_closed" };
  }

  const price = await loadCatalogPrice("lifetime_upgrade", secretKey);
  if (!price.ok) {
    return { ok: false, error: price.reason === "stripe_unavailable" ? "stripe_unavailable" : "price_invalid" };
  }

  const active = await findActiveLifetimeUpgradeIntent({
    licenseId,
    targetGenerationId: eligibility.targetGenerationId,
  });
  if (active?.checkoutSessionId && active.status === "checkout_created") {
    return { ok: false, error: "checkout_in_progress" };
  }

  const { intent } = await createOrReuseLifetimeUpgradeIntent({
    licenseId,
    normalizedEmail: proof.email,
    sourceGenerationId: eligibility.sourceGenerationId,
    targetGenerationId: eligibility.targetGenerationId,
  });

  const returnTo = input.returnTo ?? "settings";
  const { successUrl, cancelUrl } = lifetimeUpgradeReturnUrls(origin, returnTo);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody({
      mode: "payment",
      customer_email: proof.email,
      "line_items[0][price]": price.price.priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[plan]": "lifetime_upgrade",
      "metadata[productType]": "lifetime_upgrade",
      "metadata[edition]": "personal_lifetime",
      "metadata[licenseId]": licenseId,
      "metadata[intentId]": intent.id,
      "metadata[sourceGenerationId]": eligibility.sourceGenerationId,
      "metadata[targetGenerationId]": eligibility.targetGenerationId,
    }),
    cache: "no-store",
  });

  if (!response.ok) return { ok: false, error: "stripe_unavailable" };

  const session = (await response.json()) as { id?: string; url?: string };
  if (!session.id || !session.url?.startsWith("https://checkout.stripe.com/")) {
    return { ok: false, error: "server_error" };
  }

  await bindCommercialGenerationForCheckoutSession({
    checkoutSessionId: session.id,
    plan: "lifetime_upgrade",
    priceId: price.price.priceId,
  });

  await attachCheckoutSessionToUpgradeIntent({
    intentId: intent.id,
    checkoutSessionId: session.id,
  });

  return {
    ok: true,
    url: session.url,
    intentId: intent.id,
    checkoutSessionId: session.id,
  };
}
