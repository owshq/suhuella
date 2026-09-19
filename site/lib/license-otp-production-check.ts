import {
  consumeVerifiedEmailProof,
  verifyEmailVerificationCode,
} from "./email-verification.ts";
import {
  bindActivationAttemptToCheckout,
  consumeActivationAttempt,
  createActivationAttempt,
} from "./activation-attempt.ts";
import {
  resetLicensePersistenceStoreForTests,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import { rejectIfDurableLicenseStateUnavailable } from "./service-capability-guard.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function hashCode(challengeId: string, code: string): Promise<string> {
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim() || "dev-email-code-secret";
  const payload = new TextEncoder().encode(`${challengeId}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Buffer.from(digest).toString("base64url");
}

async function runLicenseOtpProductionCheck(): Promise<void> {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_SIGNING_SECRET: process.env.LICENSE_SIGNING_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
  };

  try {
    process.env.NODE_ENV = "development";
    process.env.LICENSE_SIGNING_SECRET = "otp-production-check-secret";
    process.env.LICENSE_STORE_PATH = `${process.cwd()}/.data/license-otp-production-check.json`;
    resetLicensePersistenceStoreForTests();

    const challengeId = "evc_otp_production_check";
    const code = "482913";
    const now = Date.now();
    const codeHash = await hashCode(challengeId, code);
    assert(codeHash !== code, "OTP hash is not plaintext");

    await withLicensePersistence((document) => {
      document.challenges = [];
      document.proofs = [];
      document.challenges.push({
        id: challengeId,
        normalizedEmail: "otp-smoke@example.com",
        purpose: "LICENSE_ACTIVATION",
        deviceId: "dev_otp_check",
        codeHash,
        expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
        attemptCount: 0,
        sendCount: 1,
        consumedAt: null,
        createdAt: new Date(now).toISOString(),
      });
    });

    const wrong = await verifyEmailVerificationCode({ challengeId, code: "000000" });
    assert(wrong.ok === false && wrong.error === "invalid_code", "wrong code fails");

    const verified = await verifyEmailVerificationCode({ challengeId, code });
    assert(verified.ok === true, "correct code issues a proof");

    const replayChallenge = await verifyEmailVerificationCode({ challengeId, code });
    assert(replayChallenge.ok === false, "consumed challenge cannot be reused");

    const first = await consumeVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "LICENSE_ACTIVATION",
      deviceId: "dev_otp_check",
    });
    assert(first.ok === true && first.email === "otp-smoke@example.com", "proof consumes once");

    const second = await consumeVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "LICENSE_ACTIVATION",
      deviceId: "dev_otp_check",
    });
    assert(second.ok === false && second.error === "invalid_proof", "replayed proof fails");

    const unbound = await createActivationAttempt({ deviceId: "dev_otp_check", plan: "lifetime" });
    assert(unbound.ok === true, "activation attempt can be created");
    const stolen = await consumeActivationAttempt({
      activationAttemptId: unbound.ok ? unbound.activationAttemptId : "",
      deviceId: "dev_otp_check",
      checkoutSessionId: "cs_test_captured_session",
    });
    assert(stolen.ok === false, "unbound attempt cannot consume a captured checkout session");

    const bound = await createActivationAttempt({ deviceId: "dev_otp_check", plan: "lifetime" });
    assert(bound.ok === true, "bound attempt can be created");
    if (bound.ok) {
      await bindActivationAttemptToCheckout({
        activationAttemptId: bound.activationAttemptId,
        checkoutSessionId: "cs_test_bound_session",
      });
      const consumed = await consumeActivationAttempt({
        activationAttemptId: bound.activationAttemptId,
        deviceId: "dev_otp_check",
        checkoutSessionId: "cs_test_bound_session",
      });
      assert(consumed.ok === true, "bound attempt consumes only its checkout session");
      const replay = await consumeActivationAttempt({
        activationAttemptId: bound.activationAttemptId,
        deviceId: "dev_otp_check",
        checkoutSessionId: "cs_test_bound_session",
      });
      assert(replay.ok === false, "consumed attempt cannot be replayed");
    }

    process.env.NODE_ENV = "production";
    resetLicensePersistenceStoreForTests();
    const durable = await rejectIfDurableLicenseStateUnavailable("license-recovery");
    assert(durable !== null && durable.status === 503, "production without D1 fails at recovery boundary");
    const activation = await rejectIfDurableLicenseStateUnavailable("license-activation");
    assert(activation !== null && activation.status === 503, "production without D1 fails at activation boundary");
    const check = await rejectIfDurableLicenseStateUnavailable("license-check");
    assert(check !== null && check.status === 503, "production without D1 fails at check boundary");
    const checkout = await rejectIfDurableLicenseStateUnavailable("checkout");
    assert(checkout !== null && checkout.status === 503, "production without D1 fails at checkout fulfillment boundary");
    const landing = await rejectIfDurableLicenseStateUnavailable("release-manifest");
    assert(landing === null, "missing LICENSE_DB does not take down unrelated capabilities");
  } finally {
    resetLicensePersistenceStoreForTests();
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.LICENSE_SIGNING_SECRET === undefined) delete process.env.LICENSE_SIGNING_SECRET;
    else process.env.LICENSE_SIGNING_SECRET = previous.LICENSE_SIGNING_SECRET;
    if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
  }

  console.log("LICENSE-OTP-PRODUCTION-ENABLEMENT-001 check passed");
}

void runLicenseOtpProductionCheck();
