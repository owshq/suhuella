import { readFileSync } from "node:fs";
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
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { withLicensePersistence } from "./license-persistence/store.ts";
import { findGrantByEmail } from "./license-store.ts";
import {
  isPaidCheckoutPubliclyEnabled,
  isStripeLiveSecret,
  isStripeLiveSessionId,
  isStripeTestSecret,
  isStripeTestSessionId,
  stripeSecretAllowedForOrigin,
  stripeSessionAllowedForOrigin,
  stripeSessionMatchesSecret,
} from "./paid-checkout.ts";
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
    process.env.STRIPE_SECRET_KEY = "sk_live_should_not_be_used";
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
    assert(business.startsWith("mailto:sales@suhuella.com"), "business stays Contact Sales");
    assert(businessCheckoutUrl().startsWith("mailto:sales@suhuella.com"), "business helper is mailto");
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
    const forged = await verifyStripeCheckoutSession("not-a-session", "sk_test_dummy");
    assert(forged.ok === false && forged.error === "invalid_session", "forged verify-session fails");

    fetchCount = 0;
    const liveForged = await verifyStripeCheckoutSession(
      "cs_test_forged",
      "sk_live_dummy",
      "https://suhuella.com",
    );
    assert(liveForged.ok === false && liveForged.error === "invalid_session", "test session on live origin fails");
    assert(fetchCount === 0, "test session on live origin does not call Stripe");

    fetchCount = 0;
    const testKeyOnLive = await verifyStripeCheckoutSession(
      "cs_live_forged",
      "sk_test_dummy",
      "https://suhuella.com",
    );
    assert(testKeyOnLive.ok === false && testKeyOnLive.error === "invalid_session", "test key on live origin fails closed");
    assert(fetchCount === 0, "test key on live origin does not call Stripe");

    fetchCount = 0;
    const mismatch = await verifyStripeCheckoutSession("cs_test_forged", "sk_live_dummy");
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
      "sk_test_dummy",
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

    assert(isStripeTestSecret("sk_test_abc") === true, "test secret is recognized");
    assert(isStripeLiveSecret("sk_live_abc") === true, "live secret is recognized");
    assert(isStripeTestSessionId("cs_test_abc") === true, "test session is recognized");
    assert(isStripeLiveSessionId("cs_live_abc") === true, "live session is recognized");
    assert(
      stripeSecretAllowedForOrigin("sk_test_abc", "https://suhuella.com") === false,
      "production origin rejects test Stripe keys",
    );
    assert(
      stripeSecretAllowedForOrigin("sk_live_abc", "https://suhuella.com") === true,
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
      stripeSessionMatchesSecret("cs_test_abc", "sk_test_abc") === true,
      "test secret matches test session",
    );
    assert(
      stripeSessionMatchesSecret("cs_live_abc", "sk_test_abc") === false,
      "test secret does not match live session",
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
    process.env.STRIPE_SECRET_KEY = "sk_test_should_not_be_used";
    fetchCount = 0;
    const testOnLive = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(testOnLive === "", "enabled checkout still refuses test key on suhuella.com");
    assert(fetchCount === 0, "test key on live origin does not create a Stripe session");

    process.env.STRIPE_SECRET_KEY = "sk_live_ready";
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
    assert(fetchCount === 1, "ready lifetime checkout calls Stripe once");
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

    process.env.PAID_CHECKOUT_ENABLED = "false";
    fetchCount = 0;
    const flippedOff = await createStripeCheckoutSession({
      plan: "lifetime",
      origin: "https://suhuella.com",
      returnTo: "public",
    });
    assert(flippedOff === "", "turning the switch off stops session creation");
    assert(fetchCount === 0, "disabled switch does not call Stripe even with live material present");

    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "production var switch is explicitly off");
    assertNoMatch(wrangler, /buy\.stripe\.com/, "wrangler has no Payment Links");
    assertNoMatch(wrangler, /sk_test_|sk_live_|whsec_/, "wrangler has no Stripe secrets");
    assertNoMatch(wrangler, /price_/, "wrangler has no Stripe price IDs");

    const landing = readFileSync(join(process.cwd(), "lib/i18n/dictionary.ts"), "utf8");
    assertNoMatch(landing, /buy\.stripe\.com/, "landing copy has no Stripe Payment Links");
    assert(landing.includes("Paid plans are not available yet"), "landing does not sell paid checkout as live");

    const licensePage = readFileSync(join(process.cwd(), "app/(suhuella)/license/page.tsx"), "utf8");
    assert(licensePage.includes("SuhuellaLicenseOverlayPage"), "license route opens plans overlay in app shell");
    const licensePlans = readFileSync(join(process.cwd(), "components/LicensePlansPage.tsx"), "utf8");
    assert(licensePlans.includes("checkout=unavailable"), "license plans stay unavailable while gated");
    assert(licensePlans.includes("Coming soon"), "license plans do not present Buy while gated");

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
