import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  bindActivationAttemptToCheckout,
  consumeActivationAttempt,
  createActivationAttempt,
} from "./activation-attempt.ts";
import { stripeCustomerImpliesPaidGrant, fulfillLicenseFromCheckout } from "./license-fulfillment.ts";
import { resetLicensePersistenceStoreForTests } from "./license-persistence/store.ts";
import { LicensePersistenceUnavailableError } from "./license-persistence/types.ts";
import {
  activateFromVerifiedCheckout,
  checkLicense,
} from "./license-service.ts";
import {
  findGrantByEmail,
  findGrantByLicenseId,
  listEnvLicenseGrants,
  revokeGrant,
  upsertStoredGrant,
} from "./license-store.ts";
import { isValidSessionId, verifyStripeCheckoutSession } from "./verify-stripe-session.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runLicenseGrantDurabilityCheck(): Promise<void> {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    LICENSE_GRANTS: process.env.LICENSE_GRANTS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  };
  const storePath = `${process.cwd()}/.data/license-grant-durability-check.json`;

  try {
    process.env.NODE_ENV = "development";
    process.env.LICENSE_SIGNING_SECRET = "grant-durability-check-secret";
    process.env.LICENSE_STORE_PATH = storePath;
    delete process.env.STRIPE_SECRET_KEY;
    resetLicensePersistenceStoreForTests();

    const migration = readFileSync(join(process.cwd(), "migrations/0004_license_grant.sql"), "utf8");
    assert(migration.includes("CREATE TABLE IF NOT EXISTS license_grant"), "0004 creates license_grant");
    assert(migration.includes("idx_license_grant_email"), "0004 indexes normalized email");
    assert(migration.includes("idx_license_grant_stripe_customer"), "0004 indexes Stripe customer");
    assert(migration.includes("idx_license_grant_stripe_subscription"), "0004 indexes Stripe subscription");
    assert(!migration.includes("DROP TABLE"), "0004 is not destructive");

    assert(stripeCustomerImpliesPaidGrant(true, false) === false, "Stripe customer alone is not Lifetime");
    assert(stripeCustomerImpliesPaidGrant(true, true) === false, "Stripe customer + subscription still invents nothing");

    const session = {
      sessionId: "cs_test_durable_lifetime",
      email: "paid@example.com",
      customerId: "cus_durable_1",
      mode: "payment" as const,
    };
    const fulfilled = await fulfillLicenseFromCheckout(session);
    assert(fulfilled?.edition === "personal_lifetime", "verified checkout writes a lifetime grant");
    const written = await findGrantByEmail("paid@example.com");
    assert(written?.origin === "stripe" && written.isPaid === true, "fulfillment persists a paid grant");
    assert(written?.licenseId, "fulfillment assigns a durable licenseId");

    const activated = await activateFromVerifiedCheckout(session, {
      deviceId: "dev_durable_1",
      deviceName: "Desk",
      platform: "darwin",
      appVersion: "0.1.0",
    });
    assert(activated.ok === true, "activation against the durable grant succeeds");
    const token = activated.ok ? activated.session?.context.licenseToken ?? "" : "";
    assert(token.includes("."), "activation issues a signed token");

    resetLicensePersistenceStoreForTests();
    const afterRestart = await findGrantByEmail("paid@example.com");
    assert(afterRestart?.licenseId === written?.licenseId, "isolate restart still reads the paid grant");
    const checked = await checkLicense({ deviceId: "dev_durable_1", licenseToken: token });
    assert(checked.ok === true, "checkLicense reads the durable grant after isolate restart");
    assert(checked.ok && checked.session?.context.edition === "personal_lifetime", "checkLicense edition stays lifetime");

    const missing = await findGrantByEmail("stripe-customer-only@example.com");
    assert(missing === undefined, "Stripe customer without a durable grant has no entitlement");

    const monthlySession = {
      sessionId: "cs_test_monthly_cancel",
      email: "cancelled@example.com",
      customerId: "cus_cancelled",
      mode: "subscription" as const,
      subscriptionId: "sub_cancelled",
    };
    const monthlyActivated = await activateFromVerifiedCheckout(monthlySession, {
      deviceId: "dev_cancel",
      deviceName: "Desk",
    });
    assert(monthlyActivated.ok === true, "monthly checkout can activate");
    const monthlyToken = monthlyActivated.ok ? monthlyActivated.session?.context.licenseToken ?? "" : "";
    const monthlyId = monthlyActivated.ok ? monthlyActivated.session?.context.licenseId ?? "" : "";
    const monthlyGrant = await findGrantByLicenseId(monthlyId);
    assert(monthlyGrant, "monthly grant was written");
    await upsertStoredGrant({
      ...monthlyGrant,
      status: "expired",
      edition: "personal_monthly",
      validUntil: "2020-01-01T00:00:00.000Z",
    });
    resetLicensePersistenceStoreForTests();
    const cancelledGrant = await findGrantByLicenseId(monthlyId);
    assert(cancelledGrant?.edition === "personal_monthly", "cancelled monthly does not become Lifetime");
    const cancelledCheck = await checkLicense({ deviceId: "dev_cancel", licenseToken: monthlyToken });
    assert(cancelledCheck.ok === false && cancelledCheck.error === "expired", "cancelled monthly fails closed");

    const gift = await upsertStoredGrant({
      email: "gift@example.com",
      customerId: "cust_gift_durable",
      licenseId: "lic_gift_durable",
      edition: "personal_lifetime",
      origin: "gift",
      status: "active",
      isPaid: false,
      isGifted: true,
    });
    resetLicensePersistenceStoreForTests();
    const giftAfterRestart = await findGrantByLicenseId(gift.licenseId);
    assert(giftAfterRestart?.origin === "gift", "gift/manual grants are durable");

    const revokedActivated = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_test_revoke",
        email: "revoke@example.com",
        customerId: "cus_revoke",
        mode: "payment",
      },
      { deviceId: "dev_revoke", deviceName: "Desk" },
    );
    assert(revokedActivated.ok === true, "revocation fixture activates");
    const revokeToken = revokedActivated.ok ? revokedActivated.session?.context.licenseToken ?? "" : "";
    const revokeGrantId = revokedActivated.ok ? revokedActivated.session?.context.licenseId ?? "" : "";
    await revokeGrant(revokeGrantId, { revokedBy: "ops@example.com", revocationReason: "test" });
    resetLicensePersistenceStoreForTests();
    const revokedCheck = await checkLicense({ deviceId: "dev_revoke", licenseToken: revokeToken });
    assert(revokedCheck.ok === false && revokedCheck.error === "revoked", "revoked grant fails closed");

    const limited = await upsertStoredGrant({
      email: "limit@example.com",
      customerId: "cus_limit",
      licenseId: "lic_limit",
      edition: "personal_lifetime",
      origin: "stripe",
      status: "active",
      isPaid: true,
      deviceLimit: 1,
    });
    const firstDevice = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_test_limit",
        email: limited.email,
        customerId: limited.customerId,
        mode: "payment",
      },
      { deviceId: "dev_limit_1", deviceName: "One" },
    );
    assert(firstDevice.ok === true, "first device activates within the limit");
    const secondDevice = await activateFromVerifiedCheckout(
      {
        sessionId: "cs_test_limit",
        email: limited.email,
        customerId: limited.customerId,
        mode: "payment",
      },
      { deviceId: "dev_limit_2", deviceName: "Two" },
    );
    assert(secondDevice.ok === false && secondDevice.error === "device_limit", "device limit still applies");

    assert(isValidSessionId("fake") === false, "forged success token is not a Stripe session");
    const forged = await verifyStripeCheckoutSession("not-a-session", "sk_test_dummy");
    assert(forged.ok === false && forged.error === "invalid_session", "forged success session fails");

    const unbound = await createActivationAttempt({ deviceId: "dev_unbound", plan: "lifetime" });
    assert(unbound.ok === true, "activation attempt can be created");
    const stolen = await consumeActivationAttempt({
      activationAttemptId: unbound.ok ? unbound.activationAttemptId : "",
      deviceId: "dev_unbound",
      checkoutSessionId: "cs_test_captured_session",
    });
    assert(stolen.ok === false, "unbound attempt cannot consume a captured checkout session");
    const bound = await createActivationAttempt({ deviceId: "dev_bound", plan: "lifetime" });
    assert(bound.ok === true, "bound attempt can be created");
    if (bound.ok) {
      await bindActivationAttemptToCheckout({
        activationAttemptId: bound.activationAttemptId,
        checkoutSessionId: "cs_test_bound_session",
      });
      const consumed = await consumeActivationAttempt({
        activationAttemptId: bound.activationAttemptId,
        deviceId: "dev_bound",
        checkoutSessionId: "cs_test_bound_session",
      });
      assert(consumed.ok === true, "bound attempt still consumes its checkout session");
    }

    process.env.LICENSE_GRANTS = JSON.stringify([
      {
        email: "env@example.com",
        customerId: "cust_env",
        licenseId: "lic_env",
        edition: "personal_lifetime",
        origin: "manual",
        status: "active",
      },
    ]);
    process.env.NODE_ENV = "production";
    assert(listEnvLicenseGrants().length === 0, "production ignores LICENSE_GRANTS env");
    resetLicensePersistenceStoreForTests();
    let productionWriteFailed = false;
    try {
      await upsertStoredGrant({
        email: "prod-memory@example.com",
        customerId: "cust_prod_memory",
        licenseId: "lic_prod_memory",
        edition: "personal_lifetime",
        origin: "stripe",
        status: "active",
        isPaid: true,
      });
    } catch (error) {
      productionWriteFailed = error instanceof LicensePersistenceUnavailableError;
    }
    assert(productionWriteFailed, "production without D1 cannot write a paid grant to process memory");
  } finally {
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
    try {
      unlinkSync(storePath);
    } catch {
      // The isolated fixture is disposable.
    }
  }

  console.log("LICENSE-PAID-GRANT-DURABILITY-001 check passed");
}

void runLicenseGrantDurabilityCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
