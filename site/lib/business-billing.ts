import type { BusinessError } from "./business-types.ts";

/**
 * Seat quantity updates use Stripe's default create_prorations.
 * No product proration policy is published yet — do not invent next-invoice-only
 * or scheduled changes here. End users never see this Stripe term.
 */
export const BUSINESS_SEAT_PRORATION = "create_prorations" as const;

export type StripeSubscriptionSnapshot = {
  subscriptionId: string;
  subscriptionItemId: string;
  customerId: string;
  quantity: number;
  status: string;
  currentPeriodEnd: string | null;
  amountCents: number;
  currency: string;
  interval: "month" | "year" | null;
  priceId: string | null;
};

export type BillingError = Extract<
  BusinessError,
  | "subscription_missing"
  | "subscription_item_missing"
  | "stale_stripe_reference"
  | "stripe_unavailable"
  | "stripe_timeout"
  | "billing_mismatch"
>;

export type BillingResult<T> = { ok: true; value: T } | { ok: false; error: BillingError };

export type BusinessBillingClient = {
  readSubscription(input: {
    subscriptionId?: string | null;
    customerId?: string | null;
  }): Promise<BillingResult<StripeSubscriptionSnapshot>>;
  updateQuantity(input: {
    subscriptionId: string;
    subscriptionItemId: string;
    quantity: number;
    idempotencyKey: string;
  }): Promise<BillingResult<StripeSubscriptionSnapshot>>;
};

type StripeSubscriptionJson = {
  id?: string;
  status?: string;
  customer?: string;
  current_period_end?: number;
  items?: {
    data?: Array<{
      id?: string;
      quantity?: number;
      price?: {
        id?: string;
        unit_amount?: number | null;
        currency?: string;
        recurring?: { interval?: string };
      };
    }>;
  };
};

function formBody(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function periodEndIso(unix: number | undefined): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString();
}

export function snapshotFromStripeSubscription(
  body: StripeSubscriptionJson,
): BillingResult<StripeSubscriptionSnapshot> {
  const item = body.items?.data?.[0];
  if (!body.id) return { ok: false, error: "subscription_missing" };
  if (!item?.id) return { ok: false, error: "subscription_item_missing" };
  const quantity = item.quantity ?? 0;
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: "billing_mismatch" };
  }
  const unit = item.price?.unit_amount ?? 0;
  const interval = item.price?.recurring?.interval;
  return {
    ok: true,
    value: {
      subscriptionId: body.id,
      subscriptionItemId: item.id,
      customerId: typeof body.customer === "string" ? body.customer : "",
      quantity,
      status: body.status ?? "unknown",
      currentPeriodEnd: periodEndIso(body.current_period_end),
      amountCents: Math.max(0, unit) * quantity,
      currency: (item.price?.currency ?? "eur").toLowerCase(),
      interval: interval === "year" ? "year" : interval === "month" ? "month" : null,
      priceId: item.price?.id ?? null,
    },
  };
}

async function stripeRequest(
  path: string,
  init?: { method?: string; body?: Record<string, string>; idempotencyKey?: string },
): Promise<BillingResult<StripeSubscriptionJson>> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!secret) return { ok: false, error: "stripe_unavailable" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(init?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(init?.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
      },
      body: init?.body ? formBody(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status >= 500) return { ok: false, error: "stripe_unavailable" };
    if (!response.ok) {
      if (response.status === 404) return { ok: false, error: "stale_stripe_reference" };
      return { ok: false, error: "stripe_unavailable" };
    }
    return { ok: true, value: (await response.json()) as StripeSubscriptionJson };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "stripe_timeout" };
    }
    return { ok: false, error: "stripe_unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export function createStripeBusinessBillingClient(): BusinessBillingClient {
  return {
    async readSubscription(input) {
      if (input.subscriptionId?.startsWith("sub_")) {
        const read = await stripeRequest(`subscriptions/${encodeURIComponent(input.subscriptionId)}`);
        if (!read.ok) return read;
        return snapshotFromStripeSubscription(read.value);
      }
      if (input.customerId?.startsWith("cus_")) {
        const list = await stripeRequest(
          `subscriptions?customer=${encodeURIComponent(input.customerId)}&status=all&limit=5`,
        );
        if (!list.ok) return list;
        const first = (list.value as { data?: StripeSubscriptionJson[] }).data?.find(
          (item) => item.status === "active" || item.status === "trialing" || item.status === "past_due",
        );
        if (!first) return { ok: false, error: "subscription_missing" };
        return snapshotFromStripeSubscription(first);
      }
      return { ok: false, error: "subscription_missing" };
    },
    async updateQuantity(input) {
      const updated = await stripeRequest(`subscription_items/${encodeURIComponent(input.subscriptionItemId)}`, {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: {
          quantity: String(input.quantity),
          proration_behavior: BUSINESS_SEAT_PRORATION,
        },
      });
      if (!updated.ok) return updated;
      const read = await stripeRequest(`subscriptions/${encodeURIComponent(input.subscriptionId)}`);
      if (!read.ok) return read;
      const snapshot = snapshotFromStripeSubscription(read.value);
      if (snapshot.ok && snapshot.value.quantity !== input.quantity) {
        return { ok: false, error: "billing_mismatch" };
      }
      return snapshot;
    },
  };
}

export function createMemoryBusinessBillingClient(seed?: StripeSubscriptionSnapshot | null) {
  const client = {
    current: seed ?? null as StripeSubscriptionSnapshot | null,
    failNext: null as BillingError | null,
    updates: 0,
    async readSubscription(): Promise<BillingResult<StripeSubscriptionSnapshot>> {
      if (client.failNext) {
        const error = client.failNext;
        client.failNext = null;
        return { ok: false, error };
      }
      if (!client.current) return { ok: false, error: "subscription_missing" };
      return { ok: true, value: client.current };
    },
    async updateQuantity(input: {
      subscriptionId: string;
      subscriptionItemId: string;
      quantity: number;
      idempotencyKey: string;
    }): Promise<BillingResult<StripeSubscriptionSnapshot>> {
      if (client.failNext) {
        const error = client.failNext;
        client.failNext = null;
        return { ok: false, error };
      }
      if (!client.current) return { ok: false, error: "subscription_missing" };
      if (client.current.subscriptionId !== input.subscriptionId) {
        return { ok: false, error: "stale_stripe_reference" };
      }
      if (client.current.subscriptionItemId !== input.subscriptionItemId) {
        return { ok: false, error: "subscription_item_missing" };
      }
      client.updates += 1;
      const unit =
        client.current.quantity > 0 ? client.current.amountCents / client.current.quantity : 0;
      client.current = {
        ...client.current,
        quantity: input.quantity,
        amountCents: Math.round(unit * input.quantity),
      };
      return { ok: true, value: client.current };
    },
  };
  return client;
}

export const defaultBusinessBillingClient = createStripeBusinessBillingClient();
