import {
  isLifetimeUpgradeCheckoutEnvEnabled,
  isStripeLiveSecret,
  isStripeTestSecret,
  type EnvLike,
} from "./paid-checkout.ts";

/** Server catalog. Price ids come from the environment, never from the browser. */
export type CatalogProduct =
  | "monthly"
  | "lifetime"
  | "business"
  | "partner"
  | "lifetime_upgrade";

export type CatalogPriceRule = {
  product: CatalogProduct;
  envName: string;
  currency: "eur";
  /** Null means the amount is the Stripe price itself. Do not invent one. */
  unitAmountCents: number | null;
  interval: "month" | "year" | null;
  /** Public Checkout Session. Lifetime Upgrade stays off until generation enforcement exists. */
  checkoutEnabled: boolean;
};

export const STRIPE_CATALOG: Record<CatalogProduct, CatalogPriceRule> = {
  monthly: {
    product: "monthly",
    envName: "STRIPE_MONTHLY_PRICE_ID",
    currency: "eur",
    unitAmountCents: 500,
    interval: "month",
    checkoutEnabled: true,
  },
  lifetime: {
    product: "lifetime",
    envName: "STRIPE_LIFETIME_PRICE_ID",
    currency: "eur",
    unitAmountCents: null,
    interval: null,
    checkoutEnabled: true,
  },
  business: {
    product: "business",
    envName: "STRIPE_BUSINESS_PRICE_ID",
    currency: "eur",
    unitAmountCents: 200,
    interval: "month",
    checkoutEnabled: true,
  },
  partner: {
    product: "partner",
    envName: "STRIPE_PARTNER_PRICE_ID",
    currency: "eur",
    unitAmountCents: 100_000,
    interval: "year",
    checkoutEnabled: true,
  },
  lifetime_upgrade: {
    product: "lifetime_upgrade",
    envName: "STRIPE_LIFETIME_UPGRADE_PRICE_ID",
    currency: "eur",
    unitAmountCents: 500,
    interval: null,
    checkoutEnabled: false,
  },
};

export const BUSINESS_MIN_SEATS = 20;

/**
 * Lifetime Upgrade stays closed until operator sets LIFETIME_UPGRADE_CHECKOUT_ENABLED=true
 * and generation enforcement + maps are configured. A Stripe product alone is not enough.
 */
export function lifetimeUpgradeSaleEnabled(env: EnvLike = process.env): boolean {
  return isLifetimeUpgradeCheckoutEnvEnabled(env);
}

/** Catalog gate mirrors the commercial switch — not a separate public bypass. */
export function isLifetimeUpgradeCatalogEnabled(env: EnvLike = process.env): boolean {
  return lifetimeUpgradeSaleEnabled(env);
}

export type StripePriceObject = {
  id?: string;
  livemode?: boolean;
  currency?: string;
  unit_amount?: number | null;
  type?: string;
  recurring?: { interval?: string } | null;
};

export type CatalogPrice = {
  product: CatalogProduct;
  priceId: string;
  currency: "eur";
  unitAmountCents: number;
  interval: "month" | "year" | null;
  livemode: boolean;
};

function readPriceId(name: string): string {
  const id = process.env[name]?.trim() ?? "";
  return id.startsWith("price_") ? id : "";
}

export function configuredPriceId(product: CatalogProduct): string {
  return readPriceId(STRIPE_CATALOG[product].envName);
}

export function secretMode(secretKey: string): "test" | "live" | null {
  if (isStripeTestSecret(secretKey)) return "test";
  if (isStripeLiveSecret(secretKey)) return "live";
  return null;
}

export function validateCatalogPrice(
  product: CatalogProduct,
  price: StripePriceObject,
  secretKey: string,
): { ok: true; price: CatalogPrice } | { ok: false; reason: string } {
  const rule = STRIPE_CATALOG[product];
  const mode = secretMode(secretKey);
  const priceId = price.id?.trim() ?? "";
  const expectedId = configuredPriceId(product);
  if (!mode) return { ok: false, reason: "secret_mode" };
  if (!expectedId || priceId !== expectedId) return { ok: false, reason: "price_id" };
  if (typeof price.livemode !== "boolean") return { ok: false, reason: "livemode" };
  if (mode === "test" && price.livemode) return { ok: false, reason: "test_live_mismatch" };
  if (mode === "live" && !price.livemode) return { ok: false, reason: "test_live_mismatch" };
  if ((price.currency ?? "").toLowerCase() !== rule.currency) return { ok: false, reason: "currency" };
  if (typeof price.unit_amount !== "number" || !Number.isInteger(price.unit_amount) || price.unit_amount <= 0) {
    return { ok: false, reason: "amount" };
  }
  if (rule.unitAmountCents !== null && price.unit_amount !== rule.unitAmountCents) {
    return { ok: false, reason: "amount" };
  }
  const interval = price.recurring?.interval ?? null;
  if (rule.interval === null) {
    if (price.type !== "one_time" || interval) return { ok: false, reason: "interval" };
  } else if (price.type !== "recurring" || interval !== rule.interval) {
    return { ok: false, reason: "interval" };
  }
  return {
    ok: true,
    price: {
      product,
      priceId,
      currency: "eur",
      unitAmountCents: price.unit_amount,
      interval: rule.interval,
      livemode: price.livemode,
    },
  };
}

export async function loadCatalogPrice(
  product: CatalogProduct,
  secretKey: string,
): Promise<{ ok: true; price: CatalogPrice } | { ok: false; reason: string }> {
  const priceId = configuredPriceId(product);
  const key = secretKey.trim();
  if (!priceId || !secretMode(key)) return { ok: false, reason: "price_id" };
  let response: Response;
  try {
    response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "stripe_unavailable" };
  }
  if (response.status >= 500) return { ok: false, reason: "stripe_unavailable" };
  if (!response.ok) return { ok: false, reason: "price_id" };
  const body = (await response.json()) as StripePriceObject;
  return validateCatalogPrice(product, body, key);
}
