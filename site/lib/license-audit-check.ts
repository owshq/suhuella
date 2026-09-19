import {
  checkoutReturnUrls,
  checkoutUrlForPlan,
  isCheckoutPlan,
  lifetimeCheckoutUrl,
  monthlyCheckoutUrl,
  unavailableCheckoutUrl,
  withCheckoutContext,
} from "./checkout.ts";
import { hasDownloadableInstaller, visibleInstallers } from "./installer-availability.ts";
import { editionFromCheckout, fulfillLicenseFromCheckout } from "./license-fulfillment.ts";
import { publicReleasePayload } from "./installer-availability.ts";
import { findGrantByEmail } from "./license-store.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { isValidSessionId } from "./verify-stripe-session.ts";
import {
  assertAdminCanRevokeLicense,
  classifyLicenseGrant,
  inferIsRevocableByAdmin,
  notRevocableError,
  paidRevokeError,
  parseLicenseGrant,
  validUntilForEdition,
} from "./license-entitlement.ts";
import type { LicenseGrant } from "./license-context.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function grant(partial: Partial<LicenseGrant> & Pick<LicenseGrant, "origin" | "edition">): LicenseGrant {
  return {
    email: "ada@example.com",
    customerId: "cust_1",
    licenseId: "lic_1",
    status: "active",
    ...partial,
  };
}

export async function runLicenseAuditCheck(): Promise<void> {
  const lifetimePaid = classifyLicenseGrant(
    grant({ origin: "stripe", edition: "personal_lifetime", validUntil: "2026-12-01T00:00:00.000Z" }),
  );
  assert(lifetimePaid.isPaid === true, "stripe lifetime is paid");
  assert(lifetimePaid.isGifted === false, "stripe lifetime is not gifted");
  assert(lifetimePaid.isRevocableByAdmin === false, "paid lifetime is not admin-revocable");
  assert(lifetimePaid.validUntil === null, "lifetime has no expiry");

  const monthlyPaid = classifyLicenseGrant(
    grant({
      origin: "stripe",
      edition: "personal_monthly",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    }),
  );
  assert(monthlyPaid.isPaid === true, "monthly stripe is paid");
  assert(monthlyPaid.isRevocableByAdmin === false, "monthly paid is not admin-revocable");
  assert(monthlyPaid.validUntil === "2026-10-01T00:00:00.000Z", "monthly uses billing period");

  const businessPaid = classifyLicenseGrant(grant({ origin: "business", edition: "business" }));
  assert(businessPaid.isPaid === true, "business origin is paid");
  assert(businessPaid.isRevocableByAdmin === false, "business license is not admin-revocable");

  const gift = classifyLicenseGrant(grant({ origin: "gift", edition: "personal_lifetime" }));
  assert(gift.isPaid === false, "gift is not paid");
  assert(gift.isGifted === true, "gift is gifted");
  assert(gift.isRevocableByAdmin === true, "gift is admin-revocable");
  assert(inferIsRevocableByAdmin("gift", false) === true, "gift origin revocable");
  assert(inferIsRevocableByAdmin("gift", true) === false, "paid flag wins over gift origin");

  const promo = classifyLicenseGrant(grant({ origin: "promo", edition: "personal_monthly" }));
  assert(promo.isRevocableByAdmin === true, "promo is admin-revocable");

  const manual = classifyLicenseGrant(grant({ origin: "manual", edition: "personal_lifetime" }));
  assert(manual.isRevocableByAdmin === true, "manual is admin-revocable");

  const partner = classifyLicenseGrant(grant({ origin: "partner", edition: "personal_lifetime" }));
  assert(partner.isGifted === true, "partner is gifted");
  assert(partner.isRevocableByAdmin === false, "partner is not in the admin-revocable origin set");

  let paidRevokeMessage = "";
  try {
    assertAdminCanRevokeLicense(grant({ origin: "stripe", edition: "personal_lifetime" }));
  } catch (error) {
    paidRevokeMessage = error instanceof Error ? error.message : "";
  }
  assert(paidRevokeMessage === paidRevokeError(), "paid revoke is rejected");

  let monthlyRevokeMessage = "";
  try {
    assertAdminCanRevokeLicense(grant({ origin: "stripe", edition: "personal_monthly" }));
  } catch (error) {
    monthlyRevokeMessage = error instanceof Error ? error.message : "";
  }
  assert(monthlyRevokeMessage === paidRevokeError(), "paid monthly revoke is rejected");

  let businessRevokeMessage = "";
  try {
    assertAdminCanRevokeLicense(grant({ origin: "business", edition: "business" }));
  } catch (error) {
    businessRevokeMessage = error instanceof Error ? error.message : "";
  }
  assert(businessRevokeMessage === paidRevokeError(), "paid business revoke is rejected");

  assertAdminCanRevokeLicense(grant({ origin: "gift", edition: "personal_lifetime" }));

  let partnerRevokeMessage = "";
  try {
    assertAdminCanRevokeLicense(grant({ origin: "partner", edition: "personal_lifetime" }));
  } catch (error) {
    partnerRevokeMessage = error instanceof Error ? error.message : "";
  }
  assert(partnerRevokeMessage === notRevocableError(), "non-revocable gift-class origin is rejected");

  const parsed = parseLicenseGrant({
    email: "gift@acme.test",
    customerId: "cust_gift",
    licenseId: "lic_gift",
    edition: "personal_lifetime",
    origin: "gift",
    status: "active",
  });
  assert(parsed?.isPaid === false, "parsed gift is not paid");
  assert(parsed?.isRevocableByAdmin === true, "parsed gift is revocable");
  assert(parsed?.validUntil === null, "parsed lifetime gift has no expiry");

  const parsedPaid = parseLicenseGrant({
    email: "paid@acme.test",
    customerId: "cus_123",
    licenseId: "lic_paid",
    edition: "personal_monthly",
    origin: "stripe",
    currentPeriodEnd: "2026-11-01T00:00:00.000Z",
  });
  assert(parsedPaid?.isPaid === true, "parsed stripe is paid");
  assert(parsedPaid?.isRevocableByAdmin === false, "parsed stripe is not revocable");
  assert(parsedPaid?.paymentProvider === "stripe", "parsed stripe has provider");

  assert(isCheckoutPlan("lifetime") === true, "lifetime is a checkout plan");
  assert(isCheckoutPlan("stripe") === false, "stripe is not a checkout plan id");
  assert(isCheckoutPlan("partner_annual") === false, "partner license is not an end-customer checkout plan");
  assert(isCheckoutPlan("operator") === false, "operator is not an end-customer checkout plan");
  assert(
    editionFromCheckout({
      sessionId: "cs_test_1",
      email: "ada@example.com",
      customerId: "cus_1",
      mode: "payment",
    }) === "personal_lifetime",
    "one-time checkout becomes lifetime",
  );
  assert(
    editionFromCheckout({
      sessionId: "cs_test_2",
      email: "ada@example.com",
      customerId: "cus_1",
      mode: "subscription",
    }) === "personal_monthly",
    "subscription checkout becomes monthly",
  );
  const checkout = withCheckoutContext("https://buy.stripe.com/test_example", {
    email: "ada@example.com",
    platform: "darwin",
  });
  assert(checkout.includes("prefilled_email=ada%40example.com"), "checkout can carry email");
  assert(!checkout.toLowerCase().includes("price_"), "checkout helper does not add price ids");
  assert(typeof checkoutUrlForPlan("business") === "string", "business checkout exists");
  assert(checkoutUrlForPlan("business").startsWith("mailto:"), "business is contact sales by default");
  assert(
    lifetimeCheckoutUrl({
      STRIPE_LIFETIME_PAYMENT_LINK: "https://buy.stripe.com/lifetime_only",
    }) === "",
    "lifetime payment link stays unused while public checkout is off",
  );
  assert(
    lifetimeCheckoutUrl({
      PAID_CHECKOUT_ENABLED: "true",
      STRIPE_LIFETIME_PAYMENT_LINK: "https://buy.stripe.com/lifetime_only",
      STRIPE_MONTHLY_PAYMENT_LINK: "https://buy.stripe.com/monthly_only",
      STRIPE_PAYMENT_LINK: "https://buy.stripe.com/generic_first",
    }) === "https://buy.stripe.com/lifetime_only",
    "lifetime resolver uses only the lifetime payment link",
  );
  assert(
    monthlyCheckoutUrl({
      PAID_CHECKOUT_ENABLED: "true",
      STRIPE_LIFETIME_PAYMENT_LINK: "https://buy.stripe.com/lifetime_only",
      STRIPE_MONTHLY_PAYMENT_LINK: "https://buy.stripe.com/monthly_only",
      STRIPE_PAYMENT_LINK: "https://buy.stripe.com/generic_first",
    }) === "https://buy.stripe.com/monthly_only",
    "monthly resolver uses only the monthly payment link",
  );
  assert(
    lifetimeCheckoutUrl({
      PAID_CHECKOUT_ENABLED: "true",
      STRIPE_MONTHLY_PAYMENT_LINK: "https://buy.stripe.com/monthly_only",
      STRIPE_PAYMENT_LINK: "https://buy.stripe.com/generic_first",
      NEXT_PUBLIC_STRIPE_PAYMENT_LINK: "https://buy.stripe.com/public_generic",
    }) === "",
    "lifetime does not fall back to monthly or a generic payment link",
  );
  assert(
    monthlyCheckoutUrl({
      PAID_CHECKOUT_ENABLED: "true",
      STRIPE_LIFETIME_PAYMENT_LINK: "https://buy.stripe.com/lifetime_only",
      STRIPE_PAYMENT_LINK: "https://buy.stripe.com/generic_first",
    }) === "",
    "monthly does not fall back to lifetime or a generic payment link",
  );
  const lifetimeUnavailable = unavailableCheckoutUrl("https://suhuella.com", "public", "lifetime");
  assert(lifetimeUnavailable.includes("checkout=unavailable"), "lifetime unavailable is truthful");
  assert(lifetimeUnavailable.includes("plan=lifetime"), "lifetime unavailable names lifetime");
  assert(!lifetimeUnavailable.includes("monthly"), "lifetime unavailable does not mention monthly");
  const monthlyUnavailable = unavailableCheckoutUrl("https://suhuella.com", "settings", "monthly");
  assert(monthlyUnavailable.includes("plan=monthly"), "monthly unavailable names monthly");
  assert(!monthlyUnavailable.includes("lifetime"), "monthly unavailable does not mention lifetime");
  assert(isValidSessionId("not-a-session") === false, "success url token is not a session");
  const settingsReturn = checkoutReturnUrls("https://suhuella.com", "settings");
  assert(settingsReturn.successUrl.includes("/settings?prefs=license"), "settings return lands on License");
  assert(settingsReturn.successUrl.includes("session_id={CHECKOUT_SESSION_ID}"), "settings return carries session ref");
  assert(settingsReturn.cancelUrl.includes("checkout=canceled"), "cancel returns to License");
  assert(!settingsReturn.cancelUrl.includes("session_id"), "cancel does not claim a session");

  assert(
    hasDownloadableInstaller({ windows: "", mac: "" }) === false,
    "empty installer URLs are not downloadable",
  );
  assert(
    visibleInstallers({ windows: "", mac: "https://example.com/SuHuella-0.1.0-pre-rc.dmg" }).windows === undefined,
    "empty Windows URL is omitted from visible installers",
  );
  const publicEmpty = publicReleasePayload({
    version: "0.1.0-pre-rc",
    channel: "stable",
    minimumVersion: "0.1.0-pre-rc",
    mandatory: false,
    windows: "",
    mac: "",
  });
  assert(!("windows" in publicEmpty) && !("mac" in publicEmpty), "public release omits empty installer URLs");
  assert(publicEmpty.version === "0.1.0-pre-rc", "public release keeps the pre-rc version");

  const replaySession = {
    sessionId: "cs_test_replay1",
    email: "replay@example.com",
    customerId: "cus_replay1",
    mode: "payment" as const,
  };
  const previousStore = process.env.LICENSE_STORE_PATH;
  process.env.LICENSE_STORE_PATH = `${process.cwd()}/.data/license-audit-check.json`;
  resetLicensePersistenceStoreForTests();
  try {
    const first = await fulfillLicenseFromCheckout(replaySession);
    const second = await fulfillLicenseFromCheckout(replaySession);
    const stored = await findGrantByEmail("replay@example.com");
    assert(first?.email === "replay@example.com", "fulfillment needs a verified session email");
    assert(second?.email === first?.email, "replay does not create another customer");
    assert(stored?.checkoutSessionId === "cs_test_replay1", "same checkout session updates one grant");
    assert(stored?.isPaid === true, "verified checkout creates a paid grant");
  } finally {
    resetLicensePersistenceStoreForTests();
    if (previousStore === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previousStore;
  }

  assert(validUntilForEdition("personal_lifetime", "2026-01-01T00:00:00.000Z") === null, "lifetime expiry stripped");
  assert(
    validUntilForEdition("personal_monthly", null, "2026-10-01T00:00:00.000Z") ===
      "2026-10-01T00:00:00.000Z",
    "monthly uses period end",
  );

  console.log("LICENSE-AUDIT-001 check passed");
}

void runLicenseAuditCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
