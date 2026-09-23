import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { businessCheckoutUrl } from "./checkout.ts";
import { fulfillLicenseFromCheckout } from "./license-fulfillment.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import {
  applyTestLicenseSigningEnv,
  generateTestLicenseSigningKeypair,
} from "./test/license-signing-fixtures.ts";
import { stripeTestFixtureSecret } from "./test/stripe-fixture-secret.ts";
import {
  effectiveAcceptedBrands,
  effectiveIssuedByOperator,
  grantAllowsPresentationBrand,
  PLATFORM_OPERATOR,
} from "./license-presentation.ts";
import { activateFromVerifiedCheckout, checkLicense } from "./license-service.ts";
import { findGrantByEmail, upsertStoredGrant } from "./license-store.ts";
import { isPaidCheckoutPubliclyEnabled } from "./paid-checkout.ts";
import {
  applyPersonalCheckoutWebhook,
  applyPersonalStripeWebhook,
  applyPersonalSubscriptionWebhook,
  isPersonalCheckoutEvent,
} from "./personal-checkout-webhook.ts";
import { commercialPlanCards } from "../../packages/product/src/lib/license-plans.ts";
import { lifetimeUpgradeSaleEnabled } from "./stripe-catalog.ts";
import { verifyStripeWebhookSignature } from "./business-webhooks.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function paidSession(id: string, email: string, priceId = "price_test_lifetime") {
  return {
    id,
    payment_status: "paid",
    status: "complete",
    mode: "payment",
    customer: "cus_personal_webhook",
    customer_details: { email },
    metadata: { edition: "personal_lifetime", plan: "lifetime" },
    line_items: { data: [{ quantity: 1, price: { id: priceId } }] },
  };
}

function catalogPrice(id: string, kind: "lifetime" | "monthly" | "wrong") {
  if (kind === "monthly") {
    return {
      id,
      livemode: false,
      currency: "eur",
      unit_amount: 500,
      type: "recurring",
      recurring: { interval: "month" },
    };
  }
  if (kind === "wrong") {
    return {
      id,
      livemode: false,
      currency: "eur",
      unit_amount: 999,
      type: "recurring",
      recurring: { interval: "month" },
    };
  }
  return {
    id,
    livemode: false,
    currency: "eur",
    unit_amount: 4200,
    type: "one_time",
    recurring: null,
  };
}

async function runPersonalCheckoutWebhookCheck(): Promise<void> {
  const keypair = generateTestLicenseSigningKeypair();
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_PRIVATE_KEY: process.env.LICENSE_SIGNING_PRIVATE_KEY,
    LICENSE_SIGNING_PUBLIC_KEYS: process.env.LICENSE_SIGNING_PUBLIC_KEYS,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    LICENSE_GRANTS: process.env.LICENSE_GRANTS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_LIFETIME_PRICE_ID: process.env.STRIPE_LIFETIME_PRICE_ID,
    STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID,
    STRIPE_LIFETIME_UPGRADE_PRICE_ID: process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID,
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
  };
  const storePath = `${process.cwd()}/.data/personal-checkout-webhook-check.json`;
  const originalFetch = globalThis.fetch;

  process.env.NODE_ENV = "development";
  applyTestLicenseSigningEnv(keypair);
  process.env.LICENSE_STORE_PATH = storePath;
  process.env.STRIPE_SECRET_KEY = stripeTestFixtureSecret("PersonalWebhookChk01");
  process.env.STRIPE_LIFETIME_PRICE_ID = "price_test_lifetime";
  process.env.STRIPE_MONTHLY_PRICE_ID = "price_test_monthly";
  process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID = "price_test_upgrade";
  process.env.PAID_CHECKOUT_ENABLED = "false";
  delete process.env.LICENSE_GRANTS;
  resetLicensePersistenceStoreForTests();
  let renewalPeriodEnd = Math.floor(Date.now() / 1000) + 86_400 * 30;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/v1/prices/price_test_lifetime")) {
      return new Response(JSON.stringify(catalogPrice("price_test_lifetime", "lifetime")), { status: 200 });
    }
    if (url.includes("/v1/prices/price_test_monthly")) {
      return new Response(JSON.stringify(catalogPrice("price_test_monthly", "monthly")), { status: 200 });
    }
    if (url.includes("/v1/prices/price_test_wrong")) {
      return new Response(JSON.stringify(catalogPrice("price_test_wrong", "wrong")), { status: 200 });
    }
    if (url.includes("/v1/checkout/sessions/cs_test_personallifetime")) {
      return new Response(JSON.stringify(paidSession("cs_test_personallifetime", "buyer@example.com")), {
        status: 200,
      });
    }
    if (url.includes("/v1/checkout/sessions/cs_test_personalunpaid")) {
      return new Response(
        JSON.stringify({
          ...paidSession("cs_test_personalunpaid", "unpaid@example.com"),
          payment_status: "unpaid",
          status: "open",
        }),
        { status: 200 },
      );
    }
    if (url.includes("/v1/checkout/sessions/cs_test_personalmanual")) {
      return new Response(JSON.stringify(paidSession("cs_test_personalmanual", "manual@example.com")), {
        status: 200,
      });
    }
    if (url.includes("/v1/checkout/sessions/cs_test_wrongprice")) {
      return new Response(
        JSON.stringify(paidSession("cs_test_wrongprice", "wrong-price@example.com", "price_test_wrong")),
        { status: 200 },
      );
    }
    if (url.includes("/v1/subscriptions/sub_personal_monthly")) {
      return new Response(
        JSON.stringify({
          id: "sub_personal_monthly",
          object: "subscription",
          status: "active",
          customer: "cus_monthly",
          current_period_end: renewalPeriodEnd,
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;

  try {
    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "commercial checkout switch stays off in wrangler");
    assert(isPaidCheckoutPubliclyEnabled() === false, "this check does not enable public checkout");

    const dbasenet = JSON.parse(
      readFileSync(join(process.cwd(), "../brands/dbasenet/identity.json"), "utf8"),
    ) as { paidCheckoutEnabled?: boolean; primaryDomain?: string };
    assert(dbasenet.paidCheckoutEnabled === false, "Dbasenet commerce stays off");
    assert(dbasenet.primaryDomain === "dbasenet.com", "Dbasenet remains the first partner domain");

    const planIds = commercialPlanCards("free", "public").map((plan) => plan.id);
    assert(planIds.join(",") === "free,lifetime,monthly,business", "public plans stay Free, Lifetime, Monthly, Business");
    assert(!planIds.includes("partner" as never), "partner plan stays off /license");
    assert(businessCheckoutUrl() === "", "Business checkout page stays closed while flags are off");

    assert(effectiveIssuedByOperator({}) === PLATFORM_OPERATOR, "missing issuer is Platform");
    assert(
      effectiveIssuedByOperator({ origin: "partner" }) === PLATFORM_OPERATOR,
      "LicenseOrigin partner is not an operator",
    );
    assert(
      effectiveAcceptedBrands({}).join(",") === "suhuella",
      "legacy grant is SuHuella only",
    );
    assert(grantAllowsPresentationBrand({}, "suhuella"), "legacy grant activates on SuHuella");
    assert(!grantAllowsPresentationBrand({}, "dbasenet"), "legacy grant does not activate on Dbasenet");
    assert(
      grantAllowsPresentationBrand({ acceptedBrands: ["suhuella", "dbasenet"] }, "dbasenet"),
      "an explicit bundle can include Dbasenet",
    );
    assert(
      !grantAllowsPresentationBrand({ acceptedBrands: ["dbasenet"] }, "suhuella"),
      "a Dbasenet-only grant does not activate on SuHuella",
    );
    assert(
      effectiveAcceptedBrands({ acceptedBrands: ["not-a-brand"] }).length === 0,
      "unknown brand ids fail closed",
    );

    const completed = {
      id: "evt_personal_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_personallifetime",
          object: "checkout.session",
          metadata: { edition: "personal_lifetime", plan: "lifetime" },
        },
      },
    };
    assert(isPersonalCheckoutEvent(completed), "paid personal checkout is a personal event");
    assert(
      !isPersonalCheckoutEvent({
        id: "evt_partner",
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_partner", metadata: { productType: "operator_license", plan: "partner_annual" } } },
      }),
      "partner license checkout is not a personal grant",
    );
    assert(
      !isPersonalCheckoutEvent({
        id: "evt_business",
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_business", metadata: { edition: "business", plan: "business" } } },
      }),
      "business checkout is not a personal grant",
    );

    const missingSecret = await applyPersonalCheckoutWebhook(completed, { secretKey: "" });
    assert(missingSecret.ok === false, "missing Stripe secret does not grant");
    assert(!(await findGrantByEmail("buyer@example.com")), "missing secret writes nothing");

    const unpaid = await applyPersonalCheckoutWebhook(
      {
        id: "evt_unpaid",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_personalunpaid",
            metadata: { edition: "personal_lifetime", plan: "lifetime" },
          },
        },
      },
      { secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"), origin: "http://localhost:3000" },
    );
    assert(unpaid.ok === true && unpaid.fulfilled === false, "unpaid checkout does not grant");
    assert(!(await findGrantByEmail("unpaid@example.com")), "unpaid email has no grant");

    const paid = await applyPersonalCheckoutWebhook(completed, {
      secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"),
      origin: "http://localhost:3000",
    });
    assert(paid.ok === true && paid.fulfilled === true, "verified personal checkout writes a grant without the success return");
    const written = await findGrantByEmail("buyer@example.com");
    assert(written?.origin === "stripe" && written.isPaid === true, "webhook grant is a Stripe paid grant");
    assert(written?.issuedByOperator === "platform", "platform checkout is issued by the platform");
    assert(written?.acceptedBrands?.join(",") === "suhuella", "platform checkout accepts SuHuella");
    const replay = await applyPersonalCheckoutWebhook(completed, {
      secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"),
      origin: "http://localhost:3000",
    });
    assert(replay.ok === true && replay.fulfilled === true, "replayed checkout updates the same grant");
    assert((await findGrantByEmail("buyer@example.com"))?.licenseId === written?.licenseId, "replay keeps one license");

    await upsertStoredGrant({
      email: "manual@example.com",
      customerId: "cust_manual",
      licenseId: "lic_manual",
      edition: "personal_lifetime",
      origin: "manual",
      status: "active",
      isPaid: false,
      createdAt: new Date().toISOString(),
    });
    const converted = await applyPersonalCheckoutWebhook(
      {
        id: "evt_manual",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_personalmanual",
            metadata: { edition: "personal_lifetime", plan: "lifetime" },
          },
        },
      },
      { secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"), origin: "http://localhost:3000" },
    );
    assert(converted.ok === true && converted.fulfilled === false, "manual license is not fulfilled as Stripe");
    const manual = await findGrantByEmail("manual@example.com");
    assert(manual?.origin === "manual" && manual.isPaid !== true, "manual license stays manual");

    const route = readFileSync(join(process.cwd(), "app/checkout/[plan]/route.ts"), "utf8");
    assert(!route.includes("price_id"), "checkout route does not read a browser price id");
    assert(lifetimeUpgradeSaleEnabled() === false, "Lifetime Upgrade stays closed without generation enforcement");
    assert(
      !isPersonalCheckoutEvent({
        id: "evt_upgrade",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_upgrade",
            metadata: { plan: "lifetime_upgrade", edition: "personal_lifetime", productType: "lifetime_upgrade" },
          },
        },
      }),
      "upgrade checkout does not create a personal grant",
    );
    const wrongPrice = await applyPersonalCheckoutWebhook(
      {
        id: "evt_wrong_price",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_wrongprice",
            metadata: { edition: "personal_lifetime", plan: "lifetime" },
          },
        },
      },
      { secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"), origin: "http://localhost:3000" },
    );
    assert(wrongPrice.ok === true && wrongPrice.fulfilled === false, "a session priced outside the catalog does not grant");
    assert(!(await findGrantByEmail("wrong-price@example.com")), "wrong price writes no grant");

    const signed = await verifyStripeWebhookSignature("{}", "t=1,v1=deadbeef", "whsec_test");
    assert(signed === false, "a bad webhook signature is rejected");

    const concurrent = {
      id: "evt_concurrent",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_personallifetime",
          object: "checkout.session",
          metadata: { edition: "personal_lifetime", plan: "lifetime" },
        },
      },
    };
    const pair = await Promise.all([
      applyPersonalStripeWebhook(concurrent, {
        secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"),
        origin: "http://localhost:3000",
      }),
      applyPersonalStripeWebhook(concurrent, {
        secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"),
        origin: "http://localhost:3000",
      }),
    ]);
    assert(pair.every((item) => item.ok), "concurrent delivery does not fail the grant");
    const concurrentGrant = await findGrantByEmail("buyer@example.com");
    assert(concurrentGrant?.licenseId === written?.licenseId, "concurrent events keep one license");
    const duplicate = await applyPersonalStripeWebhook(concurrent, {
      secretKey: stripeTestFixtureSecret("PersonalWebhookChk01"),
      origin: "http://localhost:3000",
    });
    assert(duplicate.ok === true && duplicate.fulfilled === false, "a stored event is not applied twice");

    const periodEnd = Math.floor(Date.now() / 1000) + 86_400;
    await fulfillLicenseFromCheckout({
      sessionId: "cs_test_monthly_existing",
      email: "monthly@example.com",
      customerId: "cus_monthly",
      mode: "subscription",
      edition: "personal_monthly",
      subscriptionId: "sub_personal_monthly",
      currentPeriodEnd: new Date(periodEnd * 1000).toISOString(),
    });
    const ended = await applyPersonalSubscriptionWebhook({
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_personal_monthly",
          object: "subscription",
          status: "canceled",
          customer: "cus_monthly",
          current_period_end: Math.floor(Date.now() / 1000) - 60,
        },
      },
    });
    assert(ended.ok === true && ended.fulfilled === true, "deleted subscription updates the existing monthly grant");
    const monthly = await findGrantByEmail("monthly@example.com");
    assert(monthly?.edition === "personal_monthly", "cancelled monthly does not become lifetime");
    assert(monthly?.status === "expired", "ended monthly fails closed");
    assert(monthly?.origin === "stripe", "subscription update does not rewrite origin");

    const renewedUntil = new Date(renewalPeriodEnd * 1000).toISOString();
    await upsertStoredGrant({
      ...monthly!,
      status: "active",
      edition: "personal_monthly",
      validUntil: new Date(periodEnd * 1000).toISOString(),
    });
    const renewed = await applyPersonalSubscriptionWebhook(
      {
        id: "evt_invoice_paid",
        type: "invoice.payment_succeeded",
        data: { object: { id: "in_test", object: "invoice", subscription: "sub_personal_monthly" } },
      },
      { secretKey: stripeTestFixtureSecret("PersonalWebhookChk01") },
    );
    assert(renewed.ok === true && renewed.fulfilled === true, "a paid invoice renews the existing monthly grant");
    const afterRenewal = await findGrantByEmail("monthly@example.com");
    assert(afterRenewal?.edition === "personal_monthly", "renewal stays monthly");
    assert(afterRenewal?.status === "active", "renewal keeps the right active");
    assert(afterRenewal?.validUntil === renewedUntil, "renewal stores the subscription period end");

    const failed = await applyPersonalSubscriptionWebhook({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: { object: { id: "in_failed", object: "invoice", subscription: "sub_personal_monthly" } },
    });
    assert(failed.ok === true && failed.fulfilled === true, "a failed invoice marks the existing monthly grant");
    const afterFailure = await findGrantByEmail("monthly@example.com");
    assert(afterFailure?.edition === "personal_monthly", "failed invoice stays monthly");
    assert(afterFailure?.origin === "stripe", "failed invoice does not rewrite origin");
    assert(afterFailure?.entitlementStatus === "past_due", "failed invoice is past_due");
    assert(afterFailure?.status === "active", "failed invoice keeps the period open until Stripe ends it");

    const invented = await applyPersonalStripeWebhook(
      {
        id: "evt_stranger",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_unknown",
            object: "subscription",
            status: "canceled",
            customer: "cus_unknown",
          },
        },
      },
      { secretKey: stripeTestFixtureSecret("PersonalWebhookChk01") },
    );
    assert(invented.ok === true && invented.fulfilled === false, "a subscription event does not create a grant");
    assert(!(await findGrantByEmail("cus_unknown")), "unknown Stripe customer is not a license");

    const activated = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_test_personallifetime",
        email: "buyer@example.com",
        customerId: "cus_personal_webhook",
        mode: "payment",
        edition: "personal_lifetime",
      },
      { deviceId: "dev_brand_gate", deviceName: "Desk" },
    );
    assert(activated.ok === true, "SuHuella can activate a platform grant");
    const token = activated.ok ? activated.session?.context.licenseToken ?? "" : "";
    const legacyGrant = await findGrantByEmail("buyer@example.com");
    assert(legacyGrant, "platform grant still exists");
    const { acceptedBrands: _ignored, ...legacy } = legacyGrant;
    await upsertStoredGrant({ ...legacy, acceptedBrands: undefined });
    const legacyCheck = await checkLicense({ deviceId: "dev_brand_gate", licenseToken: token });
    assert(legacyCheck.ok === true, "a grant without acceptedBrands still checks on SuHuella");

    await upsertStoredGrant({ ...legacy, acceptedBrands: ["dbasenet"] });
    const denied = await checkLicense({ deviceId: "dev_brand_gate", licenseToken: token });
    assert(denied.ok === false && denied.error === "no_license", "SuHuella rejects a Dbasenet-only grant");

    await upsertStoredGrant({ ...legacy, acceptedBrands: ["suhuella", "dbasenet"] });
    const bundled = await checkLicense({ deviceId: "dev_brand_gate", licenseToken: token });
    assert(bundled.ok === true, "an explicit SuHuella + Dbasenet bundle checks on SuHuella");
  } finally {
    globalThis.fetch = originalFetch;
    resetLicensePersistenceStoreForTests();
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.LICENSE_SIGNING_SECRET === undefined) delete process.env.LICENSE_SIGNING_SECRET;
    else process.env.LICENSE_SIGNING_SECRET = previous.LICENSE_SIGNING_SECRET;
    if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
    if (previous.LICENSE_GRANTS === undefined) delete process.env.LICENSE_GRANTS;
    else process.env.LICENSE_GRANTS = previous.LICENSE_GRANTS;
    if (previous.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.STRIPE_SECRET_KEY;
    if (previous.STRIPE_LIFETIME_PRICE_ID === undefined) delete process.env.STRIPE_LIFETIME_PRICE_ID;
    else process.env.STRIPE_LIFETIME_PRICE_ID = previous.STRIPE_LIFETIME_PRICE_ID;
    if (previous.STRIPE_MONTHLY_PRICE_ID === undefined) delete process.env.STRIPE_MONTHLY_PRICE_ID;
    else process.env.STRIPE_MONTHLY_PRICE_ID = previous.STRIPE_MONTHLY_PRICE_ID;
    if (previous.STRIPE_LIFETIME_UPGRADE_PRICE_ID === undefined) delete process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID;
    else process.env.STRIPE_LIFETIME_UPGRADE_PRICE_ID = previous.STRIPE_LIFETIME_UPGRADE_PRICE_ID;
    if (previous.PAID_CHECKOUT_ENABLED === undefined) delete process.env.PAID_CHECKOUT_ENABLED;
    else process.env.PAID_CHECKOUT_ENABLED = previous.PAID_CHECKOUT_ENABLED;
    try {
      unlinkSync(storePath);
    } catch {
      /* already gone */
    }
  }
}

runPersonalCheckoutWebhookCheck().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
