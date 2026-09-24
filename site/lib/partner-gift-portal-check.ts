import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  consumeVerifiedEmailProof,
  requestEmailVerificationCode,
  verifyEmailVerificationCode,
} from "./email-verification.ts";
import { withLicensePersistence, resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { upsertStoredGrant } from "./license-store.ts";
import { isPersonalCheckoutEvent } from "./personal-checkout-webhook.ts";
import { decidePartnerHostnameGate } from "./partners/middleware-gate.ts";
import { createPartnerCheckoutSession } from "./partners/checkout.ts";
import { listPartnerCustomerLicenses } from "./partners/customer-licenses.ts";
import { SUHUELLA_STRIPE_ACCOUNT_ID } from "./partners/stripe-account.ts";
import { applyPartnerStripeWebhook } from "./partners/stripe-fulfillment.ts";
import {
  createMemoryPartnerStripeLedger,
  createPartnerStripeLedgerFromDatabase,
  setPartnerStripeLedgerForTests,
} from "./partners/stripe-ledger.ts";
import { resolvePartnerHttpActor } from "./partners/http-actor.ts";
import {
  createPartner,
  openPartnerPortalForVerifiedEmail,
  suspendStripePartnerSubscription,
} from "./partners/service.ts";
import {
  partnerSessionCookieHeader,
  signPartnerSession,
} from "./partners/session.ts";
import {
  createMemoryPartnerStore,
  createPartnerStoreFromDatabase,
  getPartnerStore,
  resetPartnerStoreForTests,
  setPartnerStoreForTests,
} from "./partners/store.ts";
import {
  createMemoryPartnerApplicationStore,
  resetPartnerApplicationStoreForTests,
  setPartnerApplicationStoreForTests,
} from "./partners/application-store.ts";
import { openIsolatedSqliteAdapter } from "./test/local-d1.ts";
import { isPartnerCheckoutPubliclyEnabled } from "./partners/program-journey.ts";
import { stripeLiveFixtureSecret } from "./test/stripe-fixture-secret.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICE_ID = "price_partnerlivefixture01";
const LIVE_SECRET = stripeLiveFixtureSecret("partnerfixturekey01");

async function hashCode(challengeId: string, code: string): Promise<string> {
  const secret = process.env.LICENSE_EMAIL_OTP_SECRET?.trim() || "dev-email-code-secret";
  const payload = new TextEncoder().encode(`${challengeId}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Buffer.from(digest).toString("base64url");
}

async function seedChallenge(input: {
  challengeId: string;
  email: string;
  code: string;
  purpose: "PARTNER_PORTAL" | "PARTNER_APPLICATION" | "PARTNER_ONBOARDING";
  expiresAt?: string;
}): Promise<void> {
  const codeHash = await hashCode(input.challengeId, input.code);
  const now = Date.now();
  await withLicensePersistence((document) => {
    document.challenges.push({
      id: input.challengeId,
      normalizedEmail: input.email,
      purpose: input.purpose,
      deviceId: null,
      codeHash,
      expiresAt: input.expiresAt ?? new Date(now + 10 * 60 * 1000).toISOString(),
      attemptCount: 0,
      sendCount: 1,
      consumedAt: null,
      createdAt: new Date(now).toISOString(),
    });
  });
}

function partnerEvent(input: {
  id: string;
  type: string;
  paymentStatus?: string;
  subscriptionId?: string;
  email?: string;
  status?: string;
}) {
  const email = input.email ?? "owner@gift.example";
  const subscriptionId = input.subscriptionId ?? "sub_partner_paid";
  return {
    id: input.id,
    type: input.type,
    livemode: true,
    account: SUHUELLA_STRIPE_ACCOUNT_ID,
    data: {
      object:
        input.type === "checkout.session.completed"
          ? {
              id: "cs_live_partnerpaid01",
              object: "checkout.session",
              payment_status: input.paymentStatus ?? "paid",
              metadata: {
                productType: "operator_license",
                plan: "partner_annual",
                email,
              },
            }
          : input.type.startsWith("invoice.")
            ? {
                id: `in_${input.id}`,
                object: "invoice",
                subscription: subscriptionId,
                metadata: { productType: "operator_license", plan: "partner_annual", email },
              }
            : {
                id: subscriptionId,
                object: "subscription",
                status: input.status ?? "canceled",
                metadata: { productType: "operator_license", plan: "partner_annual", email },
              },
    },
  };
}

function installStripeFetch(mode: "paid" | "unpaid" | "bad-account" | "bad-amount" | "session") {
  let sessionPosts = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/v1/account")) {
      return Response.json(
        mode === "bad-account"
          ? { id: "acct_other", livemode: true }
          : { id: SUHUELLA_STRIPE_ACCOUNT_ID, livemode: true },
      );
    }
    if (url.includes("/v1/prices/")) {
      return Response.json({
        id: PRICE_ID,
        livemode: true,
        currency: "eur",
        unit_amount: mode === "bad-amount" ? 100 : 100_000,
        type: "recurring",
        recurring: { interval: "year" },
        product: {
          metadata: { productType: "operator_license", planId: "partner_annual" },
        },
      });
    }
    if (url.includes("/v1/checkout/sessions") && init?.method === "POST") {
      sessionPosts += 1;
      return Response.json({
        id: "cs_live_partnercheckout1",
        url: "https://checkout.stripe.com/c/pay/cs_live_partnercheckout1",
      });
    }
    if (url.includes("/v1/checkout/sessions/")) {
      const paid = mode !== "unpaid";
      return Response.json({
        id: "cs_live_partnerpaid01",
        payment_status: paid ? "paid" : "unpaid",
        metadata: {
          productType: "operator_license",
          plan: "partner_annual",
          email: "paid-owner@example.com",
        },
        customer: "cus_partner_paid",
        customer_email: "paid-owner@example.com",
        subscription: {
          id: "sub_partner_paid",
          status: "active",
          current_period_end: 1_900_000_000,
          customer: "cus_partner_paid",
          metadata: {
            productType: "operator_license",
            plan: "partner_annual",
            email: "paid-owner@example.com",
          },
        },
        line_items: { data: [{ price: { id: PRICE_ID }, quantity: 1 }] },
      });
    }
    if (url.includes("/v1/subscriptions/")) {
      return Response.json({
        id: "sub_partner_paid",
        status: "active",
        customer: "cus_partner_paid",
        current_period_end: 1_950_000_000,
        metadata: {
          productType: "operator_license",
          plan: "partner_annual",
          email: "paid-owner@example.com",
        },
      });
    }
    return new Response("unexpected", { status: 500 });
  };
  return {
    fetchImpl,
    sessionPosts: () => sessionPosts,
  };
}

async function run(): Promise<void> {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_EMAIL_OTP_SECRET: process.env.LICENSE_EMAIL_OTP_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PARTNER_PRICE_ID: process.env.STRIPE_PARTNER_PRICE_ID,
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
    PARTNER_CHECKOUT_ENABLED: process.env.PARTNER_CHECKOUT_ENABLED,
  };
  process.env.NODE_ENV = "development";
  process.env.LICENSE_EMAIL_OTP_SECRET = "partner-gift-portal-check-secret";
  const licenseStorePath = path.join(siteRoot, ".data/partner-gift-portal-check.json");
  process.env.LICENSE_STORE_PATH = licenseStorePath;
  process.env.PAID_CHECKOUT_ENABLED = "false";
  process.env.PARTNER_CHECKOUT_ENABLED = "false";
  process.env.STRIPE_PARTNER_PRICE_ID = PRICE_ID;
  process.env.STRIPE_SECRET_KEY = LIVE_SECRET;
  try {
    unlinkSync(licenseStorePath);
  } catch {
    // fresh
  }

  resetLicensePersistenceStoreForTests();
  resetPartnerStoreForTests();
  resetPartnerApplicationStoreForTests();
  setPartnerStripeLedgerForTests(createMemoryPartnerStripeLedger());
  setPartnerApplicationStoreForTests(createMemoryPartnerApplicationStore());

  const wrangler = readFileSync(path.join(siteRoot, "wrangler.jsonc"), "utf8");
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "personal checkout is on");
  assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "true"'), "partner checkout flag is enabled in wrangler");
  assert(isPartnerCheckoutPubliclyEnabled() === false, "partner checkout is not public");

  const checkoutRoute = readFileSync(path.join(siteRoot, "app/api/partners/checkout/route.ts"), "utf8");
  assert(checkoutRoute.includes("CARD_FIELDS"), "checkout route rejects card fields");
  assert(!checkoutRoute.includes("testUnlock"), "HTTP checkout has no flag bypass");
  assert(checkoutRoute.includes("readPartnerApplicantSession"), "checkout uses applicant identity");

  const identity = JSON.parse(readFileSync(path.join(siteRoot, "../brands/dbasenet/identity.json"), "utf8")) as {
    emails: unknown;
    supportEmail: unknown;
    primaryDomain: string;
  };
  assert(identity.emails === null && identity.supportEmail === null, "Dbasenet has no invented owner email");
  assert(identity.primaryDomain === "dbasenet.com", "Dbasenet primary domain is recorded");

  let fetches = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetches += 1;
    throw new Error("stripe_should_not_be_called");
  };

  const closed = await createPartnerCheckoutSession({
    email: "closed@example.com",
    origin: "https://suhuella.com",
  });
  assert(closed.ok === false && closed.error === "checkout_closed", "flags closed block checkout");
  assert(fetches === 0, "closed checkout does not call Stripe");

  const platform = { kind: "platform" as const, email: "ops@suhuella.com" };
  const gift = await createPartner(platform, {
    slug: "gift-co",
    displayName: "Gift Co",
    ownerEmail: "owner@gift.example",
    origin: "gift",
    reason: "partner gift portal check",
  });
  assert(gift.summary.entitlement?.origin === "gift", "gift origin is preserved");
  assert(gift.summary.entitlement?.stripeSubscriptionId === null, "gift has no Stripe subscription");
  assert(fetches === 0, "gift create does not call Stripe");

  const blocked = await openPartnerPortalForVerifiedEmail("stranger@example.com");
  assert(blocked.ok === false, "applicant without membership cannot open the portal");

  const strangerCode = await requestEmailVerificationCode({
    email: "stranger@example.com",
    purpose: "PARTNER_PORTAL",
  });
  assert(strangerCode.ok === false && strangerCode.error === "no_membership", "unknown email cannot request portal OTP");

  const giftCode = await requestEmailVerificationCode({
    email: "owner@gift.example",
    purpose: "PARTNER_PORTAL",
  });
  assert(giftCode.ok === true, "gift owner can request portal OTP");

  const expiredId = "evc_portal_expired";
  await seedChallenge({
    challengeId: expiredId,
    email: "owner@gift.example",
    code: "111111",
    purpose: "PARTNER_PORTAL",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const expired = await verifyEmailVerificationCode({ challengeId: expiredId, code: "111111" });
  assert(expired.ok === false && expired.error === "expired", "expired portal OTP rejected");

  const appChallenge = "evc_portal_cross";
  await seedChallenge({
    challengeId: appChallenge,
    email: "owner@gift.example",
    code: "222222",
    purpose: "PARTNER_APPLICATION",
  });
  const appVerified = await verifyEmailVerificationCode({ challengeId: appChallenge, code: "222222" });
  assert(appVerified.ok, "application OTP verifies");
  const cross = await consumeVerifiedEmailProof({
    proofId: appVerified.proofId,
    purpose: "PARTNER_PORTAL",
  });
  assert(cross.ok === false, "application proof cannot open the portal");

  const wrong = await verifyEmailVerificationCode({ challengeId: "evc_missing", code: "000000" });
  assert(wrong.ok === false, "invalid portal OTP rejected");

  const opened = await openPartnerPortalForVerifiedEmail("owner@gift.example");
  assert(opened.ok === true, "gift owner enters without Stripe");
  if (opened.ok) {
    assert(opened.role === "partner_admin", "owner is partner admin");
    const again = await openPartnerPortalForVerifiedEmail("owner@gift.example");
    assert(again.ok === true, "owner can return without the invite link");
  }
  const doc = await getPartnerStore().then((store) => store.read());
  const giftEntitlement = doc.entitlements.find((item) => item.partnerId === gift.summary.partner.partnerId && item.origin === "gift");
  assert(giftEntitlement?.status === "active", "portal login activates the gift entitlement");
  assert(fetches === 0, "portal login does not call Stripe");

  const dbasenetGift = await createPartner(platform, {
    slug: "dbasenet",
    displayName: "Dbasenet",
    ownerEmail: "info.linkeram@gmail.com",
    origin: "gift",
    reason: "dbasenet partner gift local fixture",
  });
  assert(dbasenetGift.summary.entitlement?.origin === "gift", "dbasenet gift keeps gift origin");
  assert(dbasenetGift.summary.entitlement?.stripeSubscriptionId === null, "dbasenet gift has no Stripe subscription");
  const dbasenetPortal = await openPartnerPortalForVerifiedEmail("info.linkeram@gmail.com");
  assert(dbasenetPortal.ok === true, "dbasenet gift owner opens portal without payment");
  const dbasenetCheckout = await createPartnerCheckoutSession({
    email: "info.linkeram@gmail.com",
    origin: "https://suhuella.com",
    testUnlock: true,
  });
  assert(
    dbasenetCheckout.ok === false && dbasenetCheckout.error === "already_covered",
    "dbasenet gift owner is not sent to Stripe checkout",
  );
  assert(fetches === 0, "dbasenet gift path never calls Stripe");

  await upsertStoredGrant({
    email: "customer-a@gift.example",
    customerId: "cus_local_a",
    licenseId: "lic_gift_customer_a",
    edition: "personal_lifetime",
    origin: "gift",
    status: "active",
    issuedByOperator: gift.summary.partner.partnerId,
    isPaid: false,
  });
  const other = await createPartner(platform, {
    slug: "other-co",
    displayName: "Other Co",
    ownerEmail: "owner@other.example",
    origin: "gift",
    reason: "isolation partner gift check",
  });
  await upsertStoredGrant({
    email: "customer-b@other.example",
    customerId: "cus_local_b",
    licenseId: "lic_other_customer_b",
    edition: "personal_monthly",
    origin: "manual",
    status: "active",
    issuedByOperator: other.summary.partner.partnerId,
    isPaid: false,
  });
  const page = await listPartnerCustomerLicenses(
    {
      kind: "partner",
      email: "owner@gift.example",
      partnerId: gift.summary.partner.partnerId,
      role: "partner_admin",
    },
    { partnerId: gift.summary.partner.partnerId, limit: 1 },
  );
  assert(page.licenses.length === 1, "partner sees only its customer license");
  assert(page.licenses[0]?.origin === "gift", "customer grant keeps gift origin");
  assert(page.licenses[0]?.licenseId === "lic_gift_customer_a", "license id is the partner's customer");
  let leaked = false;
  try {
    await listPartnerCustomerLicenses(
      {
        kind: "partner",
        email: "owner@gift.example",
        partnerId: gift.summary.partner.partnerId,
        role: "partner_admin",
      },
      { partnerId: other.summary.partner.partnerId },
    );
  } catch {
    leaked = true;
  }
  assert(leaked, "partner cannot list another partner's licenses");

  assert(
    decidePartnerHostnameGate({ hostname: "documents.example.com", pathname: "/", status: "pending" }).action ===
      "rewrite_status",
    "unverified hostname does not serve the brand",
  );

  globalThis.fetch = originalFetch;

  const badAccount = installStripeFetch("bad-account");
  globalThis.fetch = badAccount.fetchImpl;
  const accountResult = await createPartnerCheckoutSession({
    email: "new-paid@example.com",
    origin: "https://suhuella.com",
    fetchImpl: badAccount.fetchImpl,
    testUnlock: true,
  });
  assert(accountResult.ok === false && accountResult.error === "invalid_account", "wrong Stripe account fails closed");
  assert(badAccount.sessionPosts() === 0, "wrong account does not create a session");

  const badAmount = installStripeFetch("bad-amount");
  globalThis.fetch = badAmount.fetchImpl;
  const amountResult = await createPartnerCheckoutSession({
    email: "new-paid@example.com",
    origin: "https://suhuella.com",
    fetchImpl: badAmount.fetchImpl,
    testUnlock: true,
  });
  assert(amountResult.ok === false && amountResult.error === "invalid_price", "wrong amount fails closed");
  assert(badAmount.sessionPosts() === 0, "wrong price does not create a session");

  const sessionFetch = installStripeFetch("session");
  globalThis.fetch = sessionFetch.fetchImpl;
  setPartnerStripeLedgerForTests(createMemoryPartnerStripeLedger());
  const first = await createPartnerCheckoutSession({
    email: "checkout-user@example.com",
    origin: "https://suhuella.com",
    fetchImpl: sessionFetch.fetchImpl,
    testUnlock: true,
  });
  const second = await createPartnerCheckoutSession({
    email: "checkout-user@example.com",
    origin: "https://suhuella.com",
    fetchImpl: sessionFetch.fetchImpl,
    testUnlock: true,
  });
  assert(first.ok && second.ok && second.reused, "second click reuses the open Checkout session");
  assert(sessionFetch.sessionPosts() === 1, "duplicate click does not create a second session");

  const covered = await createPartnerCheckoutSession({
    email: "owner@gift.example",
    origin: "https://suhuella.com",
    fetchImpl: sessionFetch.fetchImpl,
    testUnlock: true,
  });
  assert(covered.ok === false && covered.error === "already_covered", "active gift partner is not sent to Checkout");

  resetPartnerStoreForTests();
  setPartnerStoreForTests(createMemoryPartnerStore());
  setPartnerStripeLedgerForTests(createMemoryPartnerStripeLedger());
  setPartnerApplicationStoreForTests(createMemoryPartnerApplicationStore());
  const unpaidFetch = installStripeFetch("unpaid");
  globalThis.fetch = unpaidFetch.fetchImpl;
  const unpaid = await applyPartnerStripeWebhook(partnerEvent({ id: "evt_unpaid", type: "checkout.session.completed", paymentStatus: "unpaid", email: "paid-owner@example.com" }), {
    secretKey: LIVE_SECRET,
    fetchImpl: unpaidFetch.fetchImpl,
  });
  assert(unpaid.ok && unpaid.fulfilled === false, "unpaid session does not grant a partner");
  const afterUnpaid = await getPartnerStore().then((store) => store.read());
  assert(afterUnpaid.partners.length === 0, "unpaid session creates no partner");

  const paidFetch = installStripeFetch("paid");
  globalThis.fetch = paidFetch.fetchImpl;
  const paid = await applyPartnerStripeWebhook(
    partnerEvent({ id: "evt_paid", type: "checkout.session.completed", email: "paid-owner@example.com" }),
    { secretKey: LIVE_SECRET, fetchImpl: paidFetch.fetchImpl },
  );
  assert(paid.ok && paid.fulfilled === true, "paid session grants a partner without a browser return");
  const replay = await applyPartnerStripeWebhook(
    partnerEvent({ id: "evt_paid", type: "checkout.session.completed", email: "paid-owner@example.com" }),
    { secretKey: LIVE_SECRET, fetchImpl: paidFetch.fetchImpl },
  );
  assert(replay.ok && replay.duplicate === true, "same event is a duplicate");
  const renewal = await applyPartnerStripeWebhook(
    partnerEvent({ id: "evt_invoice", type: "invoice.paid", email: "paid-owner@example.com" }),
    { secretKey: LIVE_SECRET, fetchImpl: paidFetch.fetchImpl },
  );
  assert(renewal.ok && renewal.fulfilled === true, "renewal invoice updates the same purchase");
  const paidDoc = await getPartnerStore().then((store) => store.read());
  assert(paidDoc.partners.length === 1, "one partner for one subscription");
  const stripeEntitlements = paidDoc.entitlements.filter((item) => item.origin === "stripe");
  assert(stripeEntitlements.length === 1, "one stripe entitlement");
  assert(stripeEntitlements[0]?.validUntil !== null, "renewal stores the period end");

  const failed = await applyPartnerStripeWebhook(
    partnerEvent({ id: "evt_failed", type: "invoice.payment_failed", email: "paid-owner@example.com" }),
    { secretKey: LIVE_SECRET, fetchImpl: paidFetch.fetchImpl },
  );
  assert(failed.ok && failed.fulfilled === false, "payment failure does not invent a suspension");
  const stillActive = await getPartnerStore().then((store) => store.read());
  assert(stillActive.entitlements[0]?.status === "active", "entitlement stays active on payment_failed");
  assert(stillActive.domains.length === 0, "billing does not create or delete domains");

  await suspendStripePartnerSubscription("sub_partner_paid");
  const suspended = await getPartnerStore().then((store) => store.read());
  assert(suspended.entitlements[0]?.status === "suspended", "ended subscription suspends only the stripe entitlement");
  assert(suspended.brands.length === 1, "brand remains after subscription end");

  resetPartnerStoreForTests();
  setPartnerStoreForTests(createMemoryPartnerStore());
  setPartnerStripeLedgerForTests(createMemoryPartnerStripeLedger());
  const raceFetch = installStripeFetch("paid");
  globalThis.fetch = raceFetch.fetchImpl;
  const raced = await Promise.all([
    applyPartnerStripeWebhook(
      partnerEvent({ id: "evt_race_a", type: "checkout.session.completed", email: "paid-owner@example.com" }),
      { secretKey: LIVE_SECRET, fetchImpl: raceFetch.fetchImpl },
    ),
    applyPartnerStripeWebhook(
      partnerEvent({ id: "evt_race_b", type: "checkout.session.completed", email: "paid-owner@example.com" }),
      { secretKey: LIVE_SECRET, fetchImpl: raceFetch.fetchImpl },
    ),
  ]);
  assert(raced.some((item) => item.ok && item.fulfilled), "one concurrent payment fulfills");
  const racedDoc = await getPartnerStore().then((store) => store.read());
  assert(racedDoc.partners.length === 1, "concurrent events do not create two partners");
  assert(
    racedDoc.entitlements.filter((item) => item.stripeSubscriptionId === "sub_partner_paid").length === 1,
    "concurrent events do not create two entitlements",
  );

  assert(isPersonalCheckoutEvent({ id: "evt_m", type: "checkout.session.completed", data: { object: { metadata: { plan: "monthly", edition: "personal_monthly" } } } }) === true, "monthly checkout stays personal");
  assert(isPersonalCheckoutEvent({ id: "evt_p", type: "checkout.session.completed", data: { object: { metadata: { plan: "partner_annual", productType: "operator_license" } } } }) === false, "partner checkout is not a personal grant");
  assert(isPersonalCheckoutEvent({ id: "evt_b", type: "checkout.session.completed", data: { object: { metadata: { plan: "business" } } } }) === false, "business stays out of personal checkout");
  assert(isPersonalCheckoutEvent({ id: "evt_u", type: "checkout.session.completed", data: { object: { metadata: { plan: "lifetime_upgrade" } } } }) === false, "lifetime upgrade stays closed");

  const sqlitePath = path.join(siteRoot, ".data/partner-gift-portal.sqlite");
  try {
    unlinkSync(sqlitePath);
  } catch {
    // fresh
  }
  const isolated = openIsolatedSqliteAdapter(sqlitePath);
  const migrations = ["0007_partners.sql", "0008_partner_domain.sql", "0009_partner_application.sql", "0010_partner_stripe_ledger.sql"];
  for (const file of migrations) {
    isolated.db.exec(readFileSync(path.join(siteRoot, "migrations", file), "utf8"));
  }
  const d1Store = createPartnerStoreFromDatabase(isolated.adapter);
  setPartnerStoreForTests(d1Store);
  setPartnerStripeLedgerForTests(createPartnerStripeLedgerFromDatabase(isolated.adapter));
  const durableGift = await createPartner(platform, {
    slug: "durable-gift",
    displayName: "Durable Gift",
    ownerEmail: "durable@gift.example",
    origin: "gift",
    reason: "local sqlite gift durability",
  });
  isolated.db.close();
  const reopened = openIsolatedSqliteAdapter(sqlitePath);
  setPartnerStoreForTests(createPartnerStoreFromDatabase(reopened.adapter));
  const loaded = await getPartnerStore().then((store) => store.read());
  assert(
    loaded.partners.some((item) => item.partnerId === durableGift.summary.partner.partnerId),
    "gift partner survives a new sqlite connection",
  );
  const portal = await openPartnerPortalForVerifiedEmail("durable@gift.example");
  assert(portal.ok === true, "gift owner can enter after the store is reopened");
  reopened.db.close();

  process.env.PARTNER_SESSION_SECRET = "partner-gift-portal-http-actor-secret";
  resetPartnerStoreForTests();
  const httpActorGift = await createPartner(platform, {
    slug: "http-actor-gift",
    displayName: "Http Actor Gift",
    ownerEmail: "owner@http-actor.test",
    origin: "gift",
    reason: "localhost session wins over ops auto-auth",
  });
  const httpActorPortal = await openPartnerPortalForVerifiedEmail("owner@http-actor.test");
  assert(httpActorPortal.ok === true, "gift owner is active before localhost session test");
  const sessionToken = await signPartnerSession({
    email: "owner@http-actor.test",
    partnerId: httpActorGift.summary.partner.partnerId,
    role: "partner_admin",
  });
  const localhostRequest = {
    headers: new Headers({
      host: "localhost:3000",
      cookie: partnerSessionCookieHeader(sessionToken),
    }),
  };
  const httpActorGate = await resolvePartnerHttpActor(localhostRequest);
  assert(httpActorGate.ok === true, "partner session resolves on localhost");
  if (httpActorGate.ok) {
    assert(httpActorGate.via === "partner_session", "localhost prefers partner cookie over ops auth");
    assert(httpActorGate.actor.kind === "partner", "localhost partner session is not platform actor");
    assert(
      httpActorGate.actor.partnerId === httpActorGift.summary.partner.partnerId,
      "localhost session binds to the gift partner",
    );
  }

  globalThis.fetch = originalFetch;
  if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previous.NODE_ENV;
  if (previous.LICENSE_EMAIL_OTP_SECRET === undefined) delete process.env.LICENSE_EMAIL_OTP_SECRET;
  else process.env.LICENSE_EMAIL_OTP_SECRET = previous.LICENSE_EMAIL_OTP_SECRET;
  if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
  else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
  if (previous.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previous.STRIPE_SECRET_KEY;
  if (previous.STRIPE_PARTNER_PRICE_ID === undefined) delete process.env.STRIPE_PARTNER_PRICE_ID;
  else process.env.STRIPE_PARTNER_PRICE_ID = previous.STRIPE_PARTNER_PRICE_ID;
  if (previous.PAID_CHECKOUT_ENABLED === undefined) delete process.env.PAID_CHECKOUT_ENABLED;
  else process.env.PAID_CHECKOUT_ENABLED = previous.PAID_CHECKOUT_ENABLED;
  if (previous.PARTNER_CHECKOUT_ENABLED === undefined) delete process.env.PARTNER_CHECKOUT_ENABLED;
  else process.env.PARTNER_CHECKOUT_ENABLED = previous.PARTNER_CHECKOUT_ENABLED;

  console.log("PARTNER-GIFT-PORTAL check passed");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
