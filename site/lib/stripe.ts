const DEV_FALLBACK_CHECKOUT_URL =
  "https://buy.stripe.com/test_8x23cub7o20c9ahenqgIo00";

/** Read at runtime on the server (Worker vars/secrets) or at build for NEXT_PUBLIC_*. */
export function getStripeCheckoutUrl(): string {
  const configured =
    process.env.STRIPE_PAYMENT_LINK?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK?.trim() ||
    "";

  if (configured) return configured;

  if (process.env.NODE_ENV === "development") {
    return DEV_FALLBACK_CHECKOUT_URL;
  }

  return "";
}

export function isStripeCheckoutConfigured(): boolean {
  return getStripeCheckoutUrl().length > 0;
}
