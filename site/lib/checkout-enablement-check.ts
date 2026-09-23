import { readdirSync, readFileSync, statSync } from "node:fs";
import { stripeLiveFixtureSecret, stripeTestFixtureSecret } from "./test/stripe-fixture-secret.ts";
import { join } from "node:path";
import {
  bindActivationAttemptToCheckout,
  consumeActivationAttempt,
  createActivationAttempt,
} from "./activation-attempt.ts";
import { createStripeCheckoutSession } from "./checkout-session.ts";
import {
  businessCheckoutUrl,
  checkoutReturnUrls,
  lifetimeCheckoutUrl,
  monthlyCheckoutUrl,
} from "./checkout.ts";
import { fulfillLicenseFromCheckout, stripeCustomerImpliesPaidGrant } from "./license-fulfillment.ts";
import { isPartnerCheckoutPubliclyEnabled } from "./partners/program-journey.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { withLicensePersistence } from "./license-persistence/store.ts";
import { findGrantByEmail } from "./license-store.ts";
import {
  isPaidCheckoutPubliclyEnabled,
  isPartnerCheckoutEnvEnabled,
  isStripeLiveSecret,
  isStripeLiveSessionId,
  isStripeTestSecret,
  isStripeTestSessionId,
  stripeSecretAllowedForOrigin,
  stripeSessionAllowedForOrigin,
  stripeSessionMatchesSecret,
  stripeWebhookLivemodeAllowed,
} from "./paid-checkout.ts";
import { rawCardRejection } from "./raw-card-guard.ts";
import { verificationEmailSubject } from "./resend-mail.ts";
import {
  checkoutVerificationAllowed,
  isValidSessionId,
  verifyStripeCheckoutSession,
} from "./verify-stripe-session.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertNoMatch(haystack: string, pattern: RegExp, message: string): void {
  assert(!pattern.test(haystack), message);
}

const RAW_CARD_SOURCE = /card\[number\]|payment_method_data\[card\]|source\[number\]|\/v1\/payment_methods|\/v1\/payment_intents|\/v1\/payment_pages|\/v1\/tokens|\/v1\/sources/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === ".next" ||
      name === ".open-next" ||
      name === ".data" ||
      name === ".wrangler"
    ) {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|mjs|cjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

async function assertRawCardDataIsRejected(): Promise<void> {
  const queries = [
    "card[number]=not-a-pan",
    "payment_method_data[card][number]=not-a-pan",
    "source[number]=not-a-pan",
  ];
  for (const query of queries) {
    const params = new URLSearchParams(query);
    const rejected = rawCardRejection({ searchParams: params });
    assert(rejected?.status === 400, `checkout query ${query.split("=")[0]} is rejected`);
    const payload = (await rejected!.json()) as { error?: string };
    assert(payload.error === "card_data_not_accepted", "card rejection uses a stable error");
    assert(!JSON.stringify(payload).includes("not-a-pan"), "card rejection does not echo the submitted value");
  }

  const bodies = [
    { card: { number: "not-a-pan" } },
    { payment_method_data: { card: { number: "not-a-pan", cvc: "not-a-cvc" } } },
    { source: { number: "not-a-pan" } },
  ];
  for (const body of bodies) {
    const rejected = rawCardRejection({ body });
    assert(rejected?.status === 400, "card JSON is rejected before Stripe");
    const payload = (await rejected!.json()) as { error?: string };
    assert(!JSON.stringify(payload).includes("not-a-pan"), "card JSON rejection does not echo the value");
  }

  const allowed = rawCardRejection({
    searchParams: new URLSearchParams("return=public&email=buyer@example.com"),
    body: { sessionId: "cs_test_ok", deviceId: "dev_ok", plan: "lifetime" },
  });
  assert(allowed === null, "checkout session ids and emails are not card data");

  const checkoutRoute = readFileSync(join(process.cwd(), "app/checkout/[plan]/route.ts"), "utf8");
  const guardCall = checkoutRoute.indexOf("rawCardRejection({");
  const sessionCall = checkoutRoute.indexOf("createStripeCheckoutSession({");
  assert(guardCall !== -1 && sessionCall !== -1 && guardCall < sessionCall, "checkout rejects card fields before creating a Checkout Session");
  for (const relative of [
    "app/api/verify-session/route.ts",
    "app/api/license/activate-from-checkout/route.ts",
    "app/api/license/checkout-attempt/route.ts",
    "app/api/business/checkout/route.ts",
  ]) {
    const source = readFileSync(join(process.cwd(), relative), "utf8");
    assert(source.includes("rawCardRejection"), `${relative} rejects raw card fields`);
  }

  const allowedStripe = /api\.stripe\.com\/v1\/(?:checkout\/sessions|prices\/|subscriptions)/;
  for (const file of sourceFiles(process.cwd())) {
    if (
      file.endsWith("raw-card-guard.ts") ||
      file.endsWith("checkout-enablement-check.ts") ||
      file.endsWith("checkout-complete-by-product-check.ts")
    ) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    assert(!RAW_CARD_SOURCE.test(source), `${file} does not send raw card data to Stripe`);
    if (!source.includes("api.stripe.com/v1/")) continue;
    if (file.endsWith("business-billing.ts")) {
      assert(source.includes("subscriptions/"), "business billing reads subscriptions");
      assert(source.includes("subscription_items/"), "business billing updates subscription items");
      assert(!source.includes("payment_method"), "business billing does not create payment methods");
      continue;
    }
    if (file.endsWith("partners/stripe-account.ts") || file.endsWith("business/stripe-account.ts")) {
      assert(source.includes("v1/account"), `${file} reads the platform Stripe account`);
      continue;
    }
    if (
      file.endsWith("business-checkout-webhook.ts") ||
      file.endsWith("business/checkout.ts") ||
      file.endsWith("partners/checkout.ts") ||
      file.endsWith("partners/stripe-fulfillment.ts")
    ) {
      assert(
        source.includes("checkout/sessions") || source.includes("subscriptions/"),
        `${file} creates or verifies Checkout Sessions and subscriptions only`,
      );
      assert(!source.includes("payment_method"), `${file} does not create payment methods`);
      continue;
    }
    assert(allowedStripe.test(source), `${file} only calls Checkout, Price, or Subscription APIs`);
  }
}

async function runCheckoutEnablementCheck(): Promise<void> {
  const previous = {
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_LIFETIME_PRICE_ID: process.env.STRIPE_LIFETIME_PRICE_ID,
    STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
  };
  const storePath = `${process.cwd()}/.data/checkout-enablement-check.json`;
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let lastStripeUrl = "";
  let lastStripeBody = "";
  let stripeCreateResponse: { id: string; url: string } | null = null;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0]);
    if (url.includes("api.stripe.com")) {
      fetchCount += 1;
      lastStripeUrl = url;
      lastStripeBody = typeof args[1]?.body === "string" ? args[1].body : "";
      if (url.includes("/v1/prices/")) {
        const lifetime = url.includes("price_live_lifetime");
        const monthly = url.includes("price_live_monthly");
        if (!lifetime && !monthly) return new Response("{}", { status: 404 });
        return new Response(
          JSON.stringify({
            id: lifetime ? "price_live_lifetime" : "price_live_monthly",
            livemode: true,
            currency: "eur",
            unit_amount: lifetime ? 12345 : 500,
            type: lifetime ? "one_time" : "recurring",
            recurring: lifetime ? null : { interval: "month" },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/checkout/sessions") && !url.includes("/v1/checkout/sessions/cs_")) {
        const session = stripeCreateResponse ?? {
          id: "cs_live_mocked",
          url: "https://checkout.stripe.com/c/pay/cs_live_mocked",
        };
        return new Response(JSON.stringify(session), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }
    fetchCount += 1;
    return originalFetch(...args);
  }) as typeof fetch;

  try {
    delete process.env.PAID_CHECKOUT_ENABLED;
    process.env.STRIPE_SECRET_KEY = stripeLiveFixtureSecret("ShouldNotBeUsed01");
    process.env.STRIPE_LIFETIME_PRICE_ID = "price_should_not_be_used";
    process.env.STRIPE_MONTHLY_PRICE_ID = "price_should_not_be_used";
    process.env.LICENSE_STORE_PATH = storePath;
    resetLicensePersistenceStoreForTests();

    assert(isPaidCheckoutPubliclyEnabled({}) === false, "missing switch is off");
    assert(isPaidCheckoutPubliclyEnabled({ PAID_CHECKOUT_ENABLED: "false" }) === false, "false switch is off");
    assert(isPaidCheckoutPubliclyEnabled({ PAID_CHECKOUT_ENABLED: "1" }) === false, "truthy-but-not-true is off");
    assert(
      isPaidCheckoutPubliclyEnabled({ PAID_CHECKOUT_ENABLED: "true" }) === true,
      "exact true enables public checkout for SuHuella",
    );
    assert(isPartnerCheckoutEnvEnabled({}) === false, "missing partner checkout switch is off");
    assert(isPartnerCheckoutEnvEnabled({ PARTNER_CHECKOUT_ENABLED: "false" }) === false, "partner switch off");
    assert(
      isPartnerCheckoutPubliclyEnabled({
        PAID_CHECKOUT_ENABLED: "true",
        PARTNER_CHECKOUT_ENABLED: "false",
      }) === false,
      "personal checkout on does not open partner checkout without partner switch",
    );
    const paidCheckoutSource = readFileSync(join(process.cwd(), "lib/paid-checkout.ts"), "utf8");
    assert(
      !paidCheckoutSource.includes("isPaidCheckoutOperational"),
      "no hostname bypass: checkout requires PAID_CHECKOUT_ENABLED on every origin",
    );

    fetchCount = 0;
    const disabledLifetime = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(disabledLifetime === "", "disabled lifetime checkout creates no session");
    assert(fetchCount === 0, "disabled lifetime checkout does not call Stripe");

    fetchCount = 0;
    const disabledMonthly = await createStripeCheckoutSession({
      plan: "monthly",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(disabledMonthly === "", "disabled monthly checkout creates no session");
    assert(fetchCount === 0, "disabled monthly checkout does not call Stripe");

    const business = await createStripeCheckoutSession({
      plan: "business",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(business === "", "business checkout stays closed while flags are off");
    assert(businessCheckoutUrl() === "", "business helper is empty while closed");
    assert(
      lifetimeCheckoutUrl({ STRIPE_LIFETIME_PAYMENT_LINK: "https://buy.stripe.com/test_hidden" }) === "",
      "payment links stay unused while checkout is off",
    );
    assert(
      monthlyCheckoutUrl({ STRIPE_MONTHLY_PAYMENT_LINK: "https://buy.stripe.com/test_hidden" }) === "",
      "monthly payment links stay unused while checkout is off",
    );

    assert(isValidSessionId("cs_test_forged") === true, "forged-looking id still needs Stripe");
    assert(isValidSessionId("not-a-session") === false, "success token is not a session");
    const forged = await verifyStripeCheckoutSession("not-a-session", stripeTestFixtureSecret("DummyNotReal00001"));
    assert(forged.ok === false && forged.error === "invalid_session", "forged verify-session fails");

    fetchCount = 0;
    const liveForged = await verifyStripeCheckoutSession(
      "cs_test_forged",
      stripeLiveFixtureSecret("DummyNotReal00001"),
      "https://suhuella.com",
    );
    assert(liveForged.ok === false && liveForged.error === "invalid_session", "test session on live origin fails");
    assert(fetchCount === 0, "test session on live origin does not call Stripe");

    fetchCount = 0;
    const testKeyOnLive = await verifyStripeCheckoutSession(
      "cs_live_forged",
      stripeTestFixtureSecret("DummyNotReal00001"),
      "https://suhuella.com",
    );
    assert(testKeyOnLive.ok === false && testKeyOnLive.error === "invalid_session", "test key on live origin fails closed");
    assert(fetchCount === 0, "test key on live origin does not call Stripe");

    fetchCount = 0;
    const mismatch = await verifyStripeCheckoutSession("cs_test_forged", stripeLiveFixtureSecret("DummyNotReal00001"));
    assert(mismatch.ok === false && mismatch.error === "invalid_session", "live key cannot verify a test session");
    assert(fetchCount === 0, "mode mismatch does not call Stripe");

    fetchCount = 0;
    const missingSecretTest = checkoutVerificationAllowed({
      sessionId: "cs_test_forged",
      secretKey: "",
      origin: "https://suhuella.com",
    });
    assert(
      missingSecretTest.ok === false && missingSecretTest.error === "invalid_session",
      "missing secret + forged test session is invalid_session",
    );
    assert(fetchCount === 0, "missing secret does not call Stripe");

    fetchCount = 0;
    const missingSecretFake = checkoutVerificationAllowed({
      sessionId: "not-a-session",
      secretKey: "",
    });
    assert(
      missingSecretFake.ok === false && missingSecretFake.error === "invalid_session",
      "missing secret + fake session is invalid_session",
    );

    fetchCount = 0;
    const missingSecretVerify = await verifyStripeCheckoutSession(
      "cs_test_forged",
      "",
      "https://suhuella.com",
    );
    assert(
      missingSecretVerify.ok === false && missingSecretVerify.error === "invalid_session",
      "verify with missing secret fails as invalid_session",
    );
    assert(fetchCount === 0, "missing secret verify does not call Stripe");

    const grantsBeforeMissingSecret = await findGrantByEmail("paid@example.com");
    assert(grantsBeforeMissingSecret?.checkoutSessionId === "cs_test_enablement_grant", "prior grant unchanged");
    assert(
      !(await findGrantByEmail("forged-missing-secret@example.com")),
      "missing Stripe config does not create a grant",
    );

    fetchCount = 0;
    const missingOnLive = checkoutVerificationAllowed({
      sessionId: "cs_live_forged",
      secretKey: "",
      origin: "https://suhuella.com",
    });
    assert(
      missingOnLive.ok === false && missingOnLive.error === "invalid_session",
      "missing secret fails closed as invalid_session",
    );

    fetchCount = 0;
    const localForged = await verifyStripeCheckoutSession(
      "cs_test_forged",
      stripeTestFixtureSecret("DummyNotReal00001"),
      "http://localhost:3000",
    );
    assert(localForged.ok === false && localForged.error === "invalid_session", "unknown test session fails closed locally");
    assert(fetchCount === 1, "local test verify may ask Stripe");
    assert(lastStripeUrl.includes("cs_test_forged"), "local verify asks Stripe for that session");

    const unbound = await createActivationAttempt({ deviceId: "dev_unbound", plan: "lifetime" });
    assert(unbound.ok === true, "attempt can be created");
    const stolen = await consumeActivationAttempt({
      activationAttemptId: unbound.ok ? unbound.activationAttemptId : "",
      deviceId: "dev_unbound",
      checkoutSessionId: "cs_test_captured",
    });
    assert(stolen.ok === false, "unbound attempt cannot consume a session");

    const bound = await createActivationAttempt({ deviceId: "dev_replay", plan: "lifetime" });
    assert(bound.ok === true, "bound attempt can be created");
    if (bound.ok) {
      await bindActivationAttemptToCheckout({
        activationAttemptId: bound.activationAttemptId,
        checkoutSessionId: "cs_test_replay",
      });
      const first = await consumeActivationAttempt({
        activationAttemptId: bound.activationAttemptId,
        deviceId: "dev_replay",
        checkoutSessionId: "cs_test_replay",
      });
      const replay = await consumeActivationAttempt({
        activationAttemptId: bound.activationAttemptId,
        deviceId: "dev_replay",
        checkoutSessionId: "cs_test_replay",
      });
      assert(first.ok === true, "bound attempt consumes once");
      assert(replay.ok === false, "replay of a consumed attempt fails");
    }

    const expiring = await createActivationAttempt({ deviceId: "dev_expired", plan: "lifetime" });
    assert(expiring.ok === true, "expiring attempt can be created");
    if (expiring.ok) {
      await bindActivationAttemptToCheckout({
        activationAttemptId: expiring.activationAttemptId,
        checkoutSessionId: "cs_test_expired",
      });
      await withLicensePersistence((document) => {
        const attempt = document.activationAttempts.find((item) => item.id === expiring.activationAttemptId);
        if (attempt) attempt.expiresAt = "2000-01-01T00:00:00.000Z";
      });
      const expired = await consumeActivationAttempt({
        activationAttemptId: expiring.activationAttemptId,
        deviceId: "dev_expired",
        checkoutSessionId: "cs_test_expired",
      });
      assert(expired.ok === false && expired.error === "expired", "expired attempt cannot activate");
    }

    const fulfilled = await fulfillLicenseFromCheckout({
      sessionId: "cs_test_enablement_grant",
      email: "paid@example.com",
      customerId: "cus_enablement",
      mode: "payment",
    });
    const stored = await findGrantByEmail("paid@example.com");
    assert(fulfilled?.edition === "personal_lifetime", "mocked verified session writes lifetime");
    assert(stored?.isPaid === true && stored.origin === "stripe", "mocked verified session writes a D1-backed grant");
    assert(stored?.checkoutSessionId === "cs_test_enablement_grant", "grant stores the checkout session");
    assert(stripeCustomerImpliesPaidGrant(true, false) === false, "Stripe customer alone creates no entitlement");
    assert(stripeCustomerImpliesPaidGrant(true, true) === false, "Stripe customer + subscription invents nothing");

    assert(isStripeTestSecret(stripeTestFixtureSecret("SyntCheckOnly0001")) === true, "test secret is recognized");
    assert(isStripeLiveSecret(stripeLiveFixtureSecret("SyntCheckOnly0001")) === true, "live secret is recognized");
    assert(isStripeTestSecret(stripeTestFixtureSecret("abc")) === false, "short test placeholder is rejected");
    assert(isStripeLiveSecret(stripeLiveFixtureSecret("abc")) === false, "short live placeholder is rejected");
    assert(isStripeTestSessionId("cs_test_abc") === true, "test session is recognized");
    assert(isStripeLiveSessionId("cs_live_abc") === true, "live session is recognized");
    assert(
      stripeSecretAllowedForOrigin(stripeTestFixtureSecret("SyntCheckOnly0001"), "https://suhuella.com") === false,
      "production origin rejects test Stripe keys",
    );
    assert(
      stripeSecretAllowedForOrigin(stripeLiveFixtureSecret("SyntCheckOnly0001"), "https://suhuella.com") === true,
      "production origin accepts live Stripe keys",
    );
    assert(
      stripeSessionAllowedForOrigin("cs_test_abc", "https://suhuella.com") === false,
      "production origin rejects test sessions",
    );
    assert(
      stripeSessionAllowedForOrigin("cs_live_abc", "https://www.suhuella.com") === true,
      "www production origin accepts live sessions",
    );
    assert(
      stripeSessionMatchesSecret("cs_test_abc", stripeTestFixtureSecret("SyntCheckOnly0001")) === true,
      "test secret matches test session",
    );
    assert(
      stripeSessionMatchesSecret("cs_live_abc", stripeTestFixtureSecret("SyntCheckOnly0001")) === false,
      "test secret does not match live session",
    );
    assert(
      stripeWebhookLivemodeAllowed({ livemode: true }, stripeLiveFixtureSecret("SyntCheckOnly0001")) === true,
      "live event + live secret is allowed",
    );
    assert(
      stripeWebhookLivemodeAllowed({ livemode: false }, stripeTestFixtureSecret("SyntCheckOnly0001")) === true,
      "test event + test secret is allowed",
    );
    assert(
      stripeWebhookLivemodeAllowed({ livemode: true }, stripeTestFixtureSecret("SyntCheckOnly0001")) === false,
      "live event + test secret is rejected",
    );
    assert(
      stripeWebhookLivemodeAllowed({ livemode: false }, stripeLiveFixtureSecret("SyntCheckOnly0001")) === false,
      "test event + live secret is rejected",
    );
    assert(
      stripeWebhookLivemodeAllowed({}, stripeLiveFixtureSecret("SyntCheckOnly0001")) === false,
      "missing livemode is rejected",
    );
    assert(stripeWebhookLivemodeAllowed({ livemode: true }, "") === false, "empty secret is rejected");
    assert(
      stripeWebhookLivemodeAllowed({ livemode: true }, stripeLiveFixtureSecret("abc")) === false,
      "placeholder live secret is rejected",
    );
    assert(
      stripeWebhookLivemodeAllowed({ livemode: false }, stripeTestFixtureSecret("abc")) === false,
      "placeholder test secret is rejected",
    );
    assert(
      stripeWebhookLivemodeAllowed({ livemode: true }, "whsec_live_not_a_secret_key") === false,
      "webhook signing secret is not a mode secret",
    );

    const publicReturn = checkoutReturnUrls("https://suhuella.com", "public");
    assert(publicReturn.successUrl.includes("/license/success?session_id={CHECKOUT_SESSION_ID}"), "public success returns to license success");
    assert(publicReturn.cancelUrl.includes("/license?checkout=canceled"), "public cancel returns to plans");
    const settingsReturn = checkoutReturnUrls("https://suhuella.com", "settings");
    assert(settingsReturn.successUrl.includes("/settings?prefs=license"), "settings success returns to License");
    assert(settingsReturn.successUrl.includes("session_id={CHECKOUT_SESSION_ID}"), "settings success carries session");
    assert(!settingsReturn.cancelUrl.includes("session_id"), "settings cancel does not claim a session");
    const desktopReturn = checkoutReturnUrls("https://suhuella.com", "desktop");
    assert(desktopReturn.successUrl.includes("/license/success?from=desktop"), "desktop success stays on license success");
    assert(desktopReturn.cancelUrl.includes("checkout=canceled"), "desktop cancel is explicit");

    process.env.PAID_CHECKOUT_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = stripeTestFixtureSecret("ShouldNotBeUsed01");
    fetchCount = 0;
    const testOnLive = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(testOnLive === "", "enabled checkout still refuses test key on suhuella.com");
    assert(fetchCount === 0, "test key on live origin does not create a Stripe session");

    process.env.STRIPE_SECRET_KEY = stripeLiveFixtureSecret("ReadyNotReal000001");
    delete process.env.STRIPE_LIFETIME_PRICE_ID;
    fetchCount = 0;
    const enabledWithoutPrice = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(enabledWithoutPrice === "", "enabled checkout without a price id creates no session");
    assert(fetchCount === 0, "missing price id does not call Stripe");
    assert(
      lifetimeCheckoutUrl({
        PAID_CHECKOUT_ENABLED: "true",
        STRIPE_LIFETIME_PAYMENT_LINK: "https://buy.stripe.com/test_hidden",
      }) === "https://buy.stripe.com/test_hidden",
      "payment link helper is ready when the switch is on",
    );

    process.env.STRIPE_LIFETIME_PRICE_ID = "price_live_lifetime";
    process.env.STRIPE_MONTHLY_PRICE_ID = "price_live_monthly";
    stripeCreateResponse = {
      id: "cs_live_ready",
      url: "https://checkout.stripe.com/c/pay/cs_live_ready",
    };
    fetchCount = 0;
    const readyLifetime = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(readyLifetime === "https://checkout.stripe.com/c/pay/cs_live_ready", "live key + price can create a Checkout Session");
    assert(fetchCount === 2, "ready lifetime checkout reads the price and then creates a session");
    assert(lastStripeBody.includes("mode=payment"), "lifetime session is one-time payment");
    assert(
      lastStripeBody.includes(encodeURIComponent("https://suhuella.com/license/success?session_id={CHECKOUT_SESSION_ID}")),
      "lifetime success url stays in product",
    );
    assert(
      lastStripeBody.includes(encodeURIComponent("https://suhuella.com/license?checkout=canceled")),
      "lifetime cancel url stays in product",
    );
    assert(!lastStripeBody.includes("buy.stripe.com"), "Checkout Session path does not use Payment Links");
    assert(
      lastStripeBody.includes(`${encodeURIComponent("line_items[0][price]")}=price_live_lifetime`),
      "Checkout Session uses the server price id",
    );
    assertNoMatch(
      lastStripeBody,
      /card%5Bnumber%5D|card\[number\]|payment_method_data|source%5Bnumber%5D|source\[number\]|payment_methods|payment_intents/,
      "Checkout Session body carries no card data",
    );

    stripeCreateResponse = {
      id: "cs_live_monthly",
      url: "https://checkout.stripe.com/c/pay/cs_live_monthly",
    };
    fetchCount = 0;
    const readyMonthly = await createStripeCheckoutSession({
      plan: "monthly",
      origin: "https://suhuella.com",
      returnTo: "settings",
    });
    assert(readyMonthly.startsWith("https://checkout.stripe.com/"), "monthly can create a Checkout Session");
    assert(lastStripeBody.includes("mode=subscription"), "monthly session is a subscription");
    assert(lastStripeBody.includes(encodeURIComponent("/settings?prefs=license")), "settings return stays on License");

    const previousCreateResponse = stripeCreateResponse;
    stripeCreateResponse = { id: "cs_live_broken", url: "https://example.com/not-stripe" };
    fetchCount = 0;
    const stripeUrlRejected = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "settings",
    });
    assert(stripeUrlRejected === "", "non-Stripe Checkout URL is rejected");
    stripeCreateResponse = previousCreateResponse;

    const checkoutRouteSource = readFileSync(join(process.cwd(), "app/checkout/[plan]/route.ts"), "utf8");
    assert(
      checkoutRouteSource.includes("unavailableCheckoutUrl(origin, returnTo, plan)"),
      "Stripe session failure redirects to an unavailable URL",
    );
    assert(
      checkoutRouteSource.includes("createStripeCheckoutSession({"),
      "checkout routes create sessions on the server",
    );
    assert(
      !checkoutRouteSource.includes("priceId") && !checkoutRouteSource.includes("price_id"),
      "checkout route does not accept client price ids",
    );

    process.env.PAID_CHECKOUT_ENABLED = "false";
    fetchCount = 0;
    const flippedOff = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(flippedOff === "", "turning the switch off stops session creation");
    assert(fetchCount === 0, "disabled switch does not call Stripe even with live material present");

    await assertRawCardDataIsRejected();

    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "commercial checkout switch is on in wrangler");
    assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "false"'), "partner checkout switch is explicitly off");
    assert(wrangler.includes('"CLOUD_INTEGRATIONS_ENABLED": "false"'), "cloud integrations stay gated off");
    assertNoMatch(wrangler, /buy\.stripe\.com/, "wrangler has no Payment Links");
    assertNoMatch(wrangler, /sk_test_|sk_live_|whsec_/, "wrangler has no Stripe secrets");
    assertNoMatch(wrangler, /price_/, "wrangler has no Stripe price IDs");

    const landing = readFileSync(join(process.cwd(), "lib/i18n/dictionary.ts"), "utf8");
    assertNoMatch(landing, /buy\.stripe\.com/, "landing copy has no Stripe Payment Links");
    assert(landing.includes("Lifetime and Monthly are paid on Stripe Checkout"), "landing offers personal paid plans");
    assert(!landing.includes("Paid plans are not available yet"), "landing does not say personal checkout is closed");

    const licensePage = readFileSync(join(process.cwd(), "app/(suhuella)/license/page.tsx"), "utf8");
    assert(licensePage.includes("SuhuellaLicenseOverlayPage"), "license route opens plans overlay in app shell");
    const licensePlans = readFileSync(join(process.cwd(), "components/LicensePlansPage.tsx"), "utf8");
    assert(licensePlans.includes('checkout === "unavailable"'), "license plans handle unavailable checkout returns");
    assert(licensePlans.includes("paidPlanUnavailableCta"), "license plans use Not available yet while gated");
    assert(licensePlans.includes("paidCheckoutClosedMessage"), "license plans explain closed checkout");
    assert(
      licensePlans.includes("not signed or notarized yet"),
      "license plans explain unsigned desktop installers before purchase",
    );
    assert(licensePlans.includes("disabled"), "gated lifetime/monthly CTAs are disabled buttons");
    assert(licensePlans.includes('checkoutPath(planId, { returnTo: "public" })'), "enabled plans navigate via checkoutPath");
    assert(licensePlans.includes('planId === "business"'), "Business uses its own checkout path");
    assert(licensePlans.includes('href="/partners"'), "Partner stays on its own program, not personal checkout");
    assert(!licensePlans.includes('checkoutPath("partner"'), "Partner is not a personal Checkout plan");
    assert(!licensePlans.includes("Coming soon"), "gated CTAs no longer say Coming soon");

    const licensePanel = readFileSync(
      join(process.cwd(), "../packages/product/src/components/LicenseStatusPanel.tsx"),
      "utf8",
    );
    assert(licensePanel.includes("readPaidCheckoutEnabled"), "settings license reads PAID_CHECKOUT_ENABLED");
    assert(licensePanel.includes("paidPlanUnavailableCta"), "settings shows Not available yet while gated");
    assert(licensePanel.includes("paidCheckoutClosedMessage"), "settings explains closed checkout");
    assert(licensePanel.includes("personalPaidClosed"), "settings disables lifetime/monthly while gated");
    assert(
      licensePanel.includes("plan !== 'business' && !checkoutOpen"),
      "settings buyPlan does not open personal checkout while gated",
    );
    assert(licensePanel.includes("unavailablePlanMessage"), "Stripe unavailable return shows a visible message");
    assert(licensePanel.includes('role="status"'), "closed checkout message is accessible");

    const overlayApp = readFileSync(join(process.cwd(), "components/web/SuhuellaOverlayApp.tsx"), "utf8");
    assert(
      overlayApp.includes("window.__suhuellaPaidCheckoutEnabled = paidCheckoutEnabled === true"),
      "web shell publishes PAID_CHECKOUT_ENABLED to settings",
    );
    const appShell = readFileSync(join(process.cwd(), "components/web/SuhuellaApp.tsx"), "utf8");
    assert(
      appShell.includes("window.__suhuellaPaidCheckoutEnabled = paidCheckoutEnabled === true"),
      "settings shell publishes PAID_CHECKOUT_ENABLED",
    );
    const shellPage = readFileSync(join(process.cwd(), "lib/suhuella-shell.tsx"), "utf8");
    assert(shellPage.includes("paidCheckoutEnabled={props.paidCheckoutEnabled}"), "settings page passes the checkout switch");

    const planHelpers = readFileSync(
      join(process.cwd(), "../packages/product/src/lib/license-plans.ts"),
      "utf8",
    );
    assert(planHelpers.includes("Aún no disponible"), "Spanish unavailable CTA is present");
    assert(planHelpers.includes("Not available yet"), "English unavailable CTA is present");
    assert(planHelpers.includes("cta: 'Get Business'"), "Business CTA targets checkout");
    assert(planHelpers.includes("checkoutPath"), "checkoutPath builds /checkout/{plan}");
    assert(planHelpers.includes("/checkout/${plan}"), "checkout paths stay server-side session routes");

    const { checkoutPath, readPaidCheckoutEnabled, paidPlanUnavailableCta } = await import(
      "@suhuella/product/lib/license-plans.ts",
    );
    assert(checkoutPath("lifetime") === "/checkout/lifetime", "lifetime CTA navigates to /checkout/lifetime");
    assert(checkoutPath("monthly") === "/checkout/monthly", "monthly CTA navigates to /checkout/monthly");
    assert(readPaidCheckoutEnabled(false) === false, "explicit false keeps checkout closed");
    assert(readPaidCheckoutEnabled(true) === true, "explicit true opens checkout CTAs");
    assert(paidPlanUnavailableCta("es") === "Aún no disponible", "Spanish gated CTA label");
    assert(paidPlanUnavailableCta("en") === "Not available yet", "English gated CTA label");

    const verifyRoute = readFileSync(join(process.cwd(), "app/api/verify-session/route.ts"), "utf8");
    assert(verifyRoute.includes("request.nextUrl.origin"), "verify-session applies origin guards");
    const activateRoute = readFileSync(join(process.cwd(), "app/api/license/activate-from-checkout/route.ts"), "utf8");
    assert(activateRoute.includes("origin: request.nextUrl.origin"), "activate-from-checkout applies origin guards");

    const mail = readFileSync(join(process.cwd(), "lib/resend-mail.ts"), "utf8");
    assertNoMatch(mail, /download|installer|buy\.stripe\.com|Desktop/i, "OTP mail does not promise Desktop download");
    assert(verificationEmailSubject("SuHuella") === "Your SuHuella verification code", "OTP subject stays BrandConfig");
    assert(mail.includes("licenseOtpReplyTo"), "OTP reply-to comes from BrandConfig");
    assert(
      mail.includes('mailbox.startsWith("noreply@")'),
      "OTP mail rejects noreply senders",
    );
  } finally {
    globalThis.fetch = originalFetch;
    resetLicensePersistenceStoreForTests();
    if (previous.PAID_CHECKOUT_ENABLED === undefined) delete process.env.PAID_CHECKOUT_ENABLED;
    else process.env.PAID_CHECKOUT_ENABLED = previous.PAID_CHECKOUT_ENABLED;
    if (previous.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.STRIPE_SECRET_KEY;
    if (previous.STRIPE_LIFETIME_PRICE_ID === undefined) delete process.env.STRIPE_LIFETIME_PRICE_ID;
    else process.env.STRIPE_LIFETIME_PRICE_ID = previous.STRIPE_LIFETIME_PRICE_ID;
    if (previous.STRIPE_MONTHLY_PRICE_ID === undefined) delete process.env.STRIPE_MONTHLY_PRICE_ID;
    else process.env.STRIPE_MONTHLY_PRICE_ID = previous.STRIPE_MONTHLY_PRICE_ID;
    if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
  }

  console.log("CHECKOUT-PRODUCTION-ENABLEMENT-001 check passed");
}

void runCheckoutEnablementCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
