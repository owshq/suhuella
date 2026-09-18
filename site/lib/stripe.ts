/**
 * Payment Link for Windows/macOS download buttons.
 * Price and currency are shown only in Stripe Checkout (Adaptive Pricing).
 * Base price: €5 EUR — configured in the Stripe Dashboard, not in this repo.
 */
export const STRIPE_CHECKOUT_URL =
  process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK?.trim() ||
  "https://buy.stripe.com/test_8x23cub7o20c9ahenqgIo00";
