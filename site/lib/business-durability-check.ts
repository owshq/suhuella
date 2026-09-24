import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createBusinessCheckoutSession } from "./business/checkout.ts";
import { isBusinessCheckoutGateEnabled, isBusinessCheckoutPubliclyEnabled } from "./business/checkout-gate.ts";
import { applyBusinessCheckoutWebhook } from "./business-checkout-webhook.ts";
import {
  isBusinessPersistenceReady,
  readBusinessPersistence,
  resetBusinessPersistenceStoreForTests,
  setBusinessPersistenceDatabaseForTests,
  withBusinessService,
} from "./business-persistence/store.ts";
import { BusinessPersistenceUnavailableError } from "./business-persistence/types.ts";
import { reconcileBusinessCheckoutForOwner } from "./business-reconciliation.ts";
import { createStripeCheckoutSession } from "./checkout-session.ts";
import { isPaidCheckoutPubliclyEnabled } from "./paid-checkout.ts";
import { applyPersonalStripeWebhook, isPersonalCheckoutEvent } from "./personal-checkout-webhook.ts";
import {
  beginStripeEventProcessing,
  completeStripeEventProcessing,
  failStripeEventProcessing,
  resetStripeEventProcessingForTests,
} from "./stripe-event-processing.ts";
import { stripeTestFixtureSecret } from "./test/stripe-fixture-secret.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";
import {
  resetLicensePersistenceStoreForTests,
  setLicensePersistenceDatabaseForTests,
} from "./license-persistence/store.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runBusinessDurabilityCheck(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const siteRoot = process.cwd();
  const previous = {
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
    BUSINESS_CHECKOUT_ENABLED: process.env.BUSINESS_CHECKOUT_ENABLED,
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
  };
  try {
  const stripeEventStorePath = join(siteRoot, ".data", "business-durability-stripe-events.json");
  try {
    unlinkSync(stripeEventStorePath);
  } catch {
    /* first run */
  }
  process.env.LICENSE_STORE_PATH = stripeEventStorePath;
  process.env.PAID_CHECKOUT_ENABLED = "true";
  process.env.BUSINESS_CHECKOUT_ENABLED = "false";
  process.env.NODE_ENV = "development";
  resetLicensePersistenceStoreForTests();
  resetBusinessPersistenceStoreForTests();
  resetStripeEventProcessingForTests();

  assert(isPaidCheckoutPubliclyEnabled() === true, "personal checkout stays open");
  assert(isBusinessCheckoutGateEnabled() === false, "business gate is closed");
  assert(isBusinessCheckoutPubliclyEnabled() === false, "business checkout is closed");

  let fetchCount = 0;
  const blockedFetch = (async () => {
    fetchCount += 1;
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  const closed = await createBusinessCheckoutSession({
    email: "owner@acme.test",
    organisationName: "ACME",
    seats: 25,
    origin: "https://suhuella.com",
    fetchImpl: blockedFetch,
  });
  assert(closed.ok === false && closed.error === "checkout_closed", "closed business checkout rejects before Stripe");
  assert(fetchCount === 0, "closed business checkout makes zero Stripe calls");

  const monthlyFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/v1/checkout/sessions")) {
      fetchCount += 1;
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_monthly" }), {
        status: 200,
      });
    }
    if (url.includes("/v1/prices/")) {
      return new Response(
        JSON.stringify({
          id: "price_monthly",
          active: true,
          livemode: false,
          currency: "eur",
          unit_amount: 500,
          type: "recurring",
          recurring: { interval: "month" },
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  process.env.STRIPE_SECRET_KEY = stripeTestFixtureSecret("BusinessDurability001");
  process.env.STRIPE_MONTHLY_PRICE_ID = "price_monthly";
  globalThis.fetch = monthlyFetch;
  const monthly = await createStripeCheckoutSession({
    plan: "monthly",
    origin: "http://localhost:3000",
    returnTo: "public",
  });
  assert(monthly.startsWith("https://checkout.stripe.com/"), "monthly checkout still opens when business is closed");

  const wrangler = readFileSync(join(siteRoot, "wrangler.jsonc"), "utf8");
  assert(wrangler.includes('"BUSINESS_CHECKOUT_ENABLED": "true"'), "wrangler exposes business gate (env override closes in test)");
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "wrangler keeps personal checkout on");

  const migration = readFileSync(
    join(siteRoot, "migrations/0014_business_store_and_stripe_event_processing.sql"),
    "utf8",
  );
  assert(migration.includes("CREATE TABLE IF NOT EXISTS business_account"), "0014 creates business_account");
  assert(migration.includes("CREATE TABLE IF NOT EXISTS stripe_event_handler"), "0014 creates stripe_event_handler");
  assert(!migration.includes("DROP TABLE license_grant"), "0014 is non-destructive to grants");

  resetBusinessPersistenceStoreForTests();
  resetLicensePersistenceStoreForTests();
  const { db, adapter } = openFreshLocalD1Adapter(siteRoot);
  setBusinessPersistenceDatabaseForTests(adapter);
  setLicensePersistenceDatabaseForTests(adapter);
  assert(await isBusinessPersistenceReady(), "local D1 business persistence is ready after 0014");

  const durableSuffix = Date.now().toString(36);
  const durableOwnerEmail = `owner-${durableSuffix}@acme.test`;
  const durableSessionId = `cs_test_business_durable_${durableSuffix}`;
  const durableSubscriptionId = `sub_durable_${durableSuffix}`;
  const durableCustomerId = `cus_durable_${durableSuffix}`;
  const durablePaidEventId = `evt_business_durable_paid_${durableSuffix}`;

  const sessionFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(`/v1/checkout/sessions/${durableSessionId}`)) {
      return new Response(
        JSON.stringify({
          id: durableSessionId,
          payment_status: "paid",
          customer_email: durableOwnerEmail,
          metadata: {
            plan: "business",
            productType: "business_seats",
            email: durableOwnerEmail,
            organisationName: "ACME Durable",
            seatQuantity: "25",
          },
          subscription: {
            id: durableSubscriptionId,
            customer: durableCustomerId,
            status: "active",
            current_period_end: Math.floor(Date.parse("2026-12-01T00:00:00.000Z") / 1000),
            items: {
              data: [
                {
                  id: "si_durable",
                  quantity: 25,
                  price: { id: "price_business", unit_amount: 200, currency: "eur", recurring: { interval: "month" } },
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
    if (url.includes("/v1/prices/")) {
      return new Response(
        JSON.stringify({
          id: "price_business",
          active: true,
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

  process.env.STRIPE_BUSINESS_PRICE_ID = "price_business";
  globalThis.fetch = sessionFetch;
  const paid = await applyBusinessCheckoutWebhook(
    {
      id: durablePaidEventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: durableSessionId,
          metadata: { plan: "business", productType: "business_seats" },
        },
      },
    },
    {
      secretKey: stripeTestFixtureSecret("BusinessDurability001"),
      fetchImpl: sessionFetch,
    },
  );
  assert(
    paid.ok && paid.fulfilled === true,
    `business checkout webhook provisions to D1 (${JSON.stringify(paid)})`,
  );

  const organisationId = (await readBusinessPersistence()).accounts[0]?.organisationId ?? "";
  assert(organisationId, "organisation id persisted");

  await withBusinessService(async (active) => {
    const invited = active.inviteSeat(
      { kind: "superadmin" },
      organisationId,
      `member-${durableSuffix}@acme.test`,
      "member",
    );
    assert(invited.ok, "business admin can invite a seat by email");
    return invited;
  });

  const beforeClose = await readBusinessPersistence();
  assert(
    beforeClose.accounts.some((account) => account.stripeCheckoutSessionId === durableSessionId),
    "org persisted to local D1",
  );
  assert(beforeClose.seats.length >= 1, "seats persisted to local D1");
  // Seat grants upsert asynchronously to the shared D1 adapter; wait before closing the handle.
  await new Promise((resolve) => setTimeout(resolve, 250));
  db.close();
  resetBusinessPersistenceStoreForTests();
  resetLicensePersistenceStoreForTests();

  const { adapter: adapterB } = openFreshLocalD1Adapter(siteRoot);
  setBusinessPersistenceDatabaseForTests(adapterB);
  setLicensePersistenceDatabaseForTests(adapterB);
  const afterReopen = await readBusinessPersistence();
  assert(
    afterReopen.accounts.some((account) => account.stripeCheckoutSessionId === durableSessionId),
    "organisation survives D1 reopen",
  );
  assert(
    afterReopen.seats.some((seat) => seat.email === `member-${durableSuffix}@acme.test`),
    "invited seat survives D1 reopen",
  );

  resetStripeEventProcessingForTests();
  const concurrentEventId = `evt_concurrent_business_${durableSuffix}`;
  const first = await beginStripeEventProcessing(concurrentEventId, "business_checkout");
  const second = await beginStripeEventProcessing(concurrentEventId, "business_checkout");
  assert(first.action === "process" && second.action === "busy", "concurrent duplicate claim is busy");
  await failStripeEventProcessing(concurrentEventId, "simulated_crash");
  const retry = await beginStripeEventProcessing(concurrentEventId, "business_checkout");
  assert(retry.action === "process", "retryable lease can be reclaimed");
  await completeStripeEventProcessing(concurrentEventId);

  const duplicate = await applyBusinessCheckoutWebhook(
    {
      id: durablePaidEventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: durableSessionId,
          metadata: { plan: "business", productType: "business_seats" },
        },
      },
    },
    {
      secretKey: stripeTestFixtureSecret("BusinessDurability001"),
      fetchImpl: sessionFetch,
    },
  );
  assert(duplicate.ok && duplicate.duplicate === true, "completed handler event is duplicate");

  const reconcile = await reconcileBusinessCheckoutForOwner({
    sessionId: durableSessionId,
    ownerEmail: durableOwnerEmail,
    secretKey: stripeTestFixtureSecret("BusinessDurability001"),
    fetchImpl: sessionFetch,
  });
  assert(reconcile.ok && reconcile.duplicate === true, "owner reconcile is idempotent");

  assert(
    isPersonalCheckoutEvent({
      id: "evt_personal",
      type: "checkout.session.completed",
      data: { object: { metadata: { plan: "monthly" } } },
    }),
    "personal checkout classifier unchanged",
  );
  const personal = await applyPersonalStripeWebhook(
    {
      id: "evt_personal_durability",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_personal", metadata: { plan: "monthly", edition: "personal_monthly" } } },
    },
    { secretKey: stripeTestFixtureSecret("BusinessDurability001") },
  );
  assert(personal.ok === true, "personal webhook path still executes under new event processing");

  process.env.NODE_ENV = "production";
  resetBusinessPersistenceStoreForTests();
  setBusinessPersistenceDatabaseForTests(null);
  let unavailable = false;
  try {
    await withBusinessService(async () => true);
  } catch (error) {
    unavailable = error instanceof BusinessPersistenceUnavailableError;
  }
  assert(unavailable, "production without D1 fails closed instead of memory fallback");

  console.log("BUSINESS-DURABILITY-AND-WEBHOOK-RECOVERY-001 check passed");
  } finally {
    globalThis.fetch = originalFetch;
    setBusinessPersistenceDatabaseForTests(null);
    setLicensePersistenceDatabaseForTests(null);
    resetBusinessPersistenceStoreForTests();
    resetLicensePersistenceStoreForTests();
    resetStripeEventProcessingForTests();
    for (const key of Object.keys(previous) as (keyof typeof previous)[]) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

void runBusinessDurabilityCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
