import { readFileSync } from "node:fs";
import { stripeLiveFixtureSecret, stripeTestFixtureSecret } from "./test/stripe-fixture-secret.ts";
import { join } from "node:path";
import { createMemoryBusinessBillingClient } from "./business-billing.ts";
import { applyBusinessCheckoutWebhook, isBusinessCheckoutEvent } from "./business-checkout-webhook.ts";
import {
  createBusinessCheckoutSession,
  isBusinessCheckoutPubliclyEnabled,
  validateBusinessSeatQuantity,
} from "./business/checkout.ts";
import { createBusinessService } from "./business-service.ts";
import { createMemoryBusinessStore } from "./business-store.ts";
import { businessCheckoutUrl } from "./checkout.ts";
import { createStripeCheckoutSession } from "./checkout-session.ts";
import { createPartnerCheckoutSession } from "./partners/checkout.ts";
import { isPartnerCheckoutPubliclyEnabled } from "./partners/program-journey.ts";
import { isPersonalCheckoutEvent } from "./personal-checkout-webhook.ts";
import { rawCardRejection } from "./raw-card-guard.ts";
import {
  evaluateLifetimeUpgradeCheckout,
  lifetimeUpgradeCheckoutBlocked,
} from "./lifetime-upgrade-audit.ts";
import { lifetimeUpgradeSaleEnabled, STRIPE_CATALOG } from "./stripe-catalog.ts";
import { isPaidCheckoutPubliclyEnabled } from "./paid-checkout.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function businessEvent(input: {
  id: string;
  sessionId: string;
  email: string;
  organisationName: string;
  seats: number;
  paymentStatus?: string;
  priceId?: string;
}) {
  return {
    id: input.id,
    type: "checkout.session.completed",
    livemode: false,
    data: {
      object: {
        id: input.sessionId,
        object: "checkout.session",
        payment_status: input.paymentStatus ?? "paid",
        metadata: {
          plan: "business",
          productType: "business_seats",
          email: input.email,
          organisationName: input.organisationName,
          seatQuantity: String(input.seats),
        },
      },
    },
  };
}

async function runCheckoutCompleteByProductCheck(): Promise<void> {
  assert(isPaidCheckoutPubliclyEnabled() === false, "checks run with checkout flags off");
  assert(isBusinessCheckoutPubliclyEnabled() === false, "business checkout closed by default");
  assert(isPartnerCheckoutPubliclyEnabled() === false, "partner checkout closed by default");
  assert(lifetimeUpgradeSaleEnabled() === false, "lifetime upgrade stays closed");
  assert(STRIPE_CATALOG.business.checkoutEnabled === true, "business catalog prepared");
  assert(STRIPE_CATALOG.partner.checkoutEnabled === true, "partner catalog prepared");
  assert(STRIPE_CATALOG.lifetime_upgrade.checkoutEnabled === false, "upgrade catalog stays off");
  assert(lifetimeUpgradeCheckoutBlocked() === true, "upgrade checkout guard stays closed");
  const upgradeDecision = evaluateLifetimeUpgradeCheckout();
  assert(!upgradeDecision.allowed && upgradeDecision.reasons.includes("sale_switch_off"), "upgrade sale switch blocks");
  assert(upgradeDecision.reasons.includes("catalog_disabled"), "upgrade catalog blocks");

  assert(validateBusinessSeatQuantity(19).ok === false, "19 seats rejected");
  assert(
    !validateBusinessSeatQuantity(19).ok &&
      validateBusinessSeatQuantity(19).error === "below_minimum",
    "19 is below minimum",
  );
  assert(validateBusinessSeatQuantity(20).ok === true, "20 seats accepted");
  assert(validateBusinessSeatQuantity(20.5).ok === false, "decimals rejected");
  assert(validateBusinessSeatQuantity(-1).ok === false, "negative rejected");

  assert(businessCheckoutUrl() === "", "business URL empty while closed");
  const businessRedirect = await createStripeCheckoutSession({
    plan: "business",
    origin: "http://localhost:3000",
    returnTo: "public",
  });
  assert(businessRedirect === "", "business session route stays closed");

  let fetchCount = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    fetchCount += 1;
    const url = String(input);
    if (url.includes("/v1/checkout/sessions")) {
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/business_test" }), {
        status: 200,
      });
    }
    if (url.includes("/v1/account")) {
      return new Response(JSON.stringify({ id: "acct_1TSg2hAAPiPo60kj", livemode: true }), { status: 200 });
    }
    if (url.includes("/v1/prices/")) {
      return new Response(
        JSON.stringify({
          id: "price_business",
          livemode: true,
          currency: "eur",
          unit_amount: 200,
          type: "recurring",
          recurring: { interval: "month" },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  process.env.STRIPE_SECRET_KEY = stripeLiveFixtureSecret("CheckoutComplete001");
  process.env.STRIPE_BUSINESS_PRICE_ID = "price_business";
  const closed = await createBusinessCheckoutSession({
    email: "owner@acme.test",
    organisationName: "ACME Ltd",
    seats: 25,
    origin: "http://localhost:3000",
    fetchImpl,
  });
  assert(!closed.ok && closed.error === "checkout_closed", "business API closed without flag");
  assert(fetchCount === 0, "closed business checkout does not call Stripe");

  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  let unlocked;
  try {
    unlocked = await createBusinessCheckoutSession({
      email: "owner@acme.test",
      organisationName: "ACME Ltd",
      seats: 25,
      origin: "http://localhost:3000",
      fetchImpl,
      testUnlock: true,
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert(unlocked.ok && unlocked.url.startsWith("https://checkout.stripe.com/"), "business session when unlocked");

  fetchCount = 0;
  const partnerClosed = await createPartnerCheckoutSession({
    email: "partner@example.com",
    origin: "http://localhost:3000",
    fetchImpl,
  });
  assert(!partnerClosed.ok && partnerClosed.error === "checkout_closed", "partner closed without flags");
  assert(fetchCount === 0, "partner closed makes no Stripe calls");

  assert(
    isPersonalCheckoutEvent(
      businessEvent({
        id: "evt_b",
        sessionId: "cs_test_b",
        email: "owner@acme.test",
        organisationName: "ACME",
        seats: 25,
      }),
    ) === false,
    "business checkout is not personal",
  );
  assert(
    isBusinessCheckoutEvent(
      businessEvent({
        id: "evt_b",
        sessionId: "cs_test_b",
        email: "owner@acme.test",
        organisationName: "ACME",
        seats: 25,
      }),
    ),
    "business event recognized",
  );

  const store = createMemoryBusinessStore();
  const billing = createMemoryBusinessBillingClient({
    subscriptionId: "sub_new",
    subscriptionItemId: "si_new",
    customerId: "cus_new",
    quantity: 25,
    status: "active",
    currentPeriodEnd: "2027-01-01T00:00:00.000Z",
    amountCents: 5000,
    currency: "eur",
    interval: "month",
    priceId: "price_business",
  });
  const service = createBusinessService({ store, billing });
  process.env.STRIPE_BUSINESS_PRICE_ID = "price_business";

  const sessionFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("checkout/sessions/cs_test_business_unpaid")) {
      return new Response(
        JSON.stringify({
          id: "cs_test_business_unpaid",
          payment_status: "unpaid",
          metadata: { plan: "business", productType: "business_seats", email: "owner@acme.test" },
        }),
        { status: 200 },
      );
    }
    if (url.includes("checkout/sessions/cs_test_business_paid")) {
      return new Response(
        JSON.stringify({
          id: "cs_test_business_paid",
          payment_status: "paid",
          customer_email: "owner@acme.test",
          metadata: {
            plan: "business",
            productType: "business_seats",
            email: "owner@acme.test",
            organisationName: "ACME Ltd",
            seatQuantity: "25",
          },
          subscription: {
            id: "sub_new",
            customer: "cus_new",
            status: "active",
            current_period_end: Math.floor(Date.parse("2027-01-01T00:00:00.000Z") / 1000),
            items: {
              data: [
                {
                  id: "si_new",
                  quantity: 25,
                  price: {
                    id: "price_business",
                    unit_amount: 200,
                    currency: "eur",
                    recurring: { interval: "month" },
                  },
                },
              ],
            },
          },
          line_items: {
            data: [{ quantity: 25, price: { id: "price_business" } }],
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/v1/prices/price_business")) {
      return new Response(
        JSON.stringify({
          id: "price_business",
          livemode: false,
          currency: "eur",
          unit_amount: 200,
          type: "recurring",
          recurring: { interval: "month" },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  globalThis.fetch = sessionFetch;
  const unpaid = await applyBusinessCheckoutWebhook(
    businessEvent({
      id: "evt_unpaid",
      sessionId: "cs_test_business_unpaid",
      email: "owner@acme.test",
      organisationName: "ACME",
      seats: 25,
      paymentStatus: "unpaid",
    }),
    { secretKey: stripeTestFixtureSecret("CheckoutComplete001"), fetchImpl: sessionFetch, service },
  );
  assert(unpaid.ok && unpaid.fulfilled === false, "unpaid business checkout grants nothing");

  const paid = await applyBusinessCheckoutWebhook(
    businessEvent({
      id: "evt_paid",
      sessionId: "cs_test_business_paid",
      email: "owner@acme.test",
      organisationName: "ACME Ltd",
      seats: 25,
    }),
    { secretKey: stripeTestFixtureSecret("CheckoutComplete001"), fetchImpl: sessionFetch, service },
  );
  assert(paid.ok && paid.fulfilled === true, "paid business checkout provisions org");

  const duplicate = await applyBusinessCheckoutWebhook(
    businessEvent({
      id: "evt_paid",
      sessionId: "cs_test_business_paid",
      email: "owner@acme.test",
      organisationName: "ACME Ltd",
      seats: 25,
    }),
    { secretKey: stripeTestFixtureSecret("CheckoutComplete001"), fetchImpl: sessionFetch, service },
  );
  assert(duplicate.ok && duplicate.duplicate === true, "duplicate business webhook is idempotent");

  const accounts = service.listAccounts({ kind: "superadmin" });
  assert(accounts.ok && accounts.value.length === 1, "one business org after checkout");
  assert(accounts.value[0]?.seatLimit === 25, "seat limit matches subscription quantity");

  const rejected = rawCardRejection({
    searchParams: new URLSearchParams("card[number]=not-a-pan"),
  });
  assert(rejected?.status === 400, "PAN rejected on checkout routes");

  const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "commercial switch is on in wrangler");
  assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "false"'), "partner switch stays off in wrangler");

  const doc = readFileSync(join(process.cwd(), "../CHECKOUT-COMPLETE-BY-PRODUCT-001.md"), "utf8");
  assert(doc.includes("Lifetime Upgrade"), "delivery doc covers upgrade status");
  assert(doc.includes("Dbasenet"), "delivery doc covers gift path");
}

void runCheckoutCompleteByProductCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
