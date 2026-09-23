import { brand } from "@suhuella/brand";
import { isBusinessCheckoutPubliclyEnabled } from "./business/checkout.ts";
import { isPaidCheckoutPubliclyEnabled, type EnvLike } from "./paid-checkout.ts";

export type CheckoutPlan = "lifetime" | "monthly" | "business";

function readUrl(value: string | undefined): string {
  const url = value?.trim() ?? "";
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "mailto:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return value === "lifetime" || value === "monthly" || value === "business";
}

/** Lifetime Payment Link only. Never used unless public checkout is enabled. */
export function lifetimeCheckoutUrl(env: EnvLike = process.env): string {
  if (!isPaidCheckoutPubliclyEnabled(env)) return "";
  return readUrl(env.STRIPE_LIFETIME_PAYMENT_LINK);
}

/** Monthly Payment Link only. Never used unless public checkout is enabled. */
export function monthlyCheckoutUrl(env: EnvLike = process.env): string {
  if (!isPaidCheckoutPubliclyEnabled(env)) return "";
  return readUrl(env.STRIPE_MONTHLY_PAYMENT_LINK);
}

/** Business self-serve checkout page. Empty while the commercial switch is off. */
export function businessCheckoutUrl(env: EnvLike = process.env): string {
  if (!isBusinessCheckoutPubliclyEnabled(env)) return "";
  return "/checkout/business";
}

export function checkoutUrlForPlan(plan: CheckoutPlan): string {
  if (plan === "lifetime") return lifetimeCheckoutUrl();
  if (plan === "monthly") return monthlyCheckoutUrl();
  return businessCheckoutUrl();
}

export type CheckoutReturnTo = "settings" | "desktop" | "public";

export function isCheckoutReturnTo(value: string): value is CheckoutReturnTo {
  return value === "settings" || value === "desktop" || value === "public";
}

export function checkoutReturnUrls(
  origin: string,
  returnTo: CheckoutReturnTo,
): { successUrl: string; cancelUrl: string } {
  if (returnTo === "settings") {
    return {
      successUrl: `${origin}/settings?prefs=license&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/settings?prefs=license&checkout=canceled`,
    };
  }
  if (returnTo === "desktop") {
    return {
      successUrl: `${origin}/license/success?from=desktop&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/license/success?from=desktop&checkout=canceled`,
    };
  }
  return {
    successUrl: `${origin}/license/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/license?checkout=canceled`,
  };
}

export function unavailableCheckoutUrl(
  origin: string,
  returnTo: CheckoutReturnTo,
  plan?: CheckoutPlan,
): string {
  const planQuery = plan === "lifetime" || plan === "monthly" ? `&plan=${plan}` : "";
  if (returnTo === "settings") {
    return `${origin}/settings?prefs=license&checkout=unavailable${planQuery}`;
  }
  if (returnTo === "desktop") {
    return `${origin}/license/success?from=desktop&checkout=unavailable${planQuery}`;
  }
  return `${origin}/license?checkout=unavailable${planQuery}`;
}

export function withCheckoutContext(
  checkoutUrl: string,
  input: { email?: string; platform?: string; returnUrl?: string },
): string {
  if (!checkoutUrl || checkoutUrl.startsWith("mailto:")) return checkoutUrl;

  const url = new URL(checkoutUrl);
  if (input.email) url.searchParams.set("prefilled_email", input.email);
  if (input.platform) url.searchParams.set("client_reference_id", input.platform);
  if (input.returnUrl) url.searchParams.set("success_url", input.returnUrl);
  return url.toString();
}
