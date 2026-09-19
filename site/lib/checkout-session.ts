import { bindActivationAttemptToCheckout } from "./activation-attempt.ts";
import {
  checkoutReturnUrls,
  checkoutUrlForPlan,
  type CheckoutPlan,
  type CheckoutReturnTo,
} from "./checkout.ts";
import {
  isPaidCheckoutPubliclyEnabled,
  stripeSecretAllowedForOrigin,
} from "./paid-checkout.ts";

function readPriceId(value: string | undefined): string {
  const id = value?.trim() ?? "";
  return id.startsWith("price_") ? id : "";
}

export function lifetimePriceId(): string {
  return readPriceId(process.env.STRIPE_LIFETIME_PRICE_ID);
}

export function monthlyPriceId(): string {
  return readPriceId(process.env.STRIPE_MONTHLY_PRICE_ID);
}

export function priceIdForPlan(plan: CheckoutPlan): string {
  if (plan === "lifetime") return lifetimePriceId();
  if (plan === "monthly") return monthlyPriceId();
  return "";
}

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export async function createStripeCheckoutSession(input: {
  plan: CheckoutPlan;
  origin: string;
  returnTo: CheckoutReturnTo;
  email?: string;
  platform?: string;
  activationAttemptId?: string;
}): Promise<string> {
  if (input.plan === "business") return checkoutUrlForPlan("business");
  if (!isPaidCheckoutPubliclyEnabled()) return "";

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const priceId = priceIdForPlan(input.plan);
  const { successUrl, cancelUrl } = checkoutReturnUrls(input.origin, input.returnTo);
  if (!secretKey || !priceId || !stripeSecretAllowedForOrigin(secretKey, input.origin)) {
    return "";
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody({
      mode: input.plan === "monthly" ? "subscription" : "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[plan]": input.plan,
      "metadata[edition]": input.plan === "monthly" ? "personal_monthly" : "personal_lifetime",
      ...(input.email ? { customer_email: input.email } : {}),
      ...(input.platform ? { client_reference_id: input.platform.slice(0, 200) } : {}),
      ...(input.activationAttemptId
        ? { "metadata[activation_attempt_id]": input.activationAttemptId.slice(0, 200) }
        : {}),
    }),
    cache: "no-store",
  });
  if (response.ok) {
    const session = (await response.json()) as { id?: string; url?: string };
    if (session.url?.startsWith("https://checkout.stripe.com/")) {
      if (input.activationAttemptId && session.id) {
        await bindActivationAttemptToCheckout({
          activationAttemptId: input.activationAttemptId,
          checkoutSessionId: session.id,
        });
      }
      return session.url;
    }
  }

  return "";
}
