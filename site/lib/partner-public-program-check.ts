import { execSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  consumeVerifiedEmailProof,
  peekVerifiedEmailProof,
  verifyEmailVerificationCode,
} from "./email-verification.ts";
import {
  resetLicensePersistenceStoreForTests,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import { isPartnerCheckoutEnvEnabled } from "./paid-checkout.ts";
import { approvePartnerApplication } from "./partners/approve-application.ts";
import {
  createPartnerApplicationStoreFromDatabase,
  createMemoryPartnerApplicationStore,
  getPartnerApplicationStore,
  PartnerApplicationStoreUnavailableError,
  resetPartnerApplicationStoreForTests,
  setPartnerApplicationStoreForTests,
  submitPartnerApplication,
  type PartnerApplicationStore,
} from "./partners/application-store.ts";
import { rejectClientAuthorityFields } from "./partners/http-actor.ts";
import { legacyApplicationMigrationReport } from "./partners/legacy-application-migration.ts";
import { isPlatformPublicPartnerApiHost } from "./partners/platform-public-api.ts";
import { isPartnerCheckoutPubliclyEnabled } from "./partners/program-journey.ts";
import {
  createMemoryPartnerStore,
  getPartnerStore,
  resetPartnerStoreForTests,
  setPartnerStoreForTests,
} from "./partners/index.ts";
import { parseOperationsAction } from "./operations/actions.ts";
import { openFreshLocalD1Adapter } from "./test/local-d1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function hashCode(challengeId: string, code: string): Promise<string> {
  const secret = process.env.LICENSE_EMAIL_OTP_SECRET?.trim() || "dev-email-code-secret";
  const payload = new TextEncoder().encode(`${challengeId}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Buffer.from(digest).toString("base64url");
}

async function seedPartnerApplicationChallenge(input: {
  challengeId: string;
  email: string;
  code: string;
}): Promise<void> {
  const codeHash = await hashCode(input.challengeId, input.code);
  const now = Date.now();
  await withLicensePersistence((document) => {
    document.challenges.push({
      id: input.challengeId,
      normalizedEmail: input.email,
      purpose: "PARTNER_APPLICATION",
      deviceId: null,
      codeHash,
      expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
      attemptCount: 0,
      sendCount: 1,
      consumedAt: null,
      createdAt: new Date(now).toISOString(),
    });
  });
}

async function runPartnerPublicProgramCheck(): Promise<void> {
  const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    LICENSE_EMAIL_OTP_SECRET: process.env.LICENSE_EMAIL_OTP_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
    PAID_CHECKOUT_ENABLED: process.env.PAID_CHECKOUT_ENABLED,
    PARTNER_CHECKOUT_ENABLED: process.env.PARTNER_CHECKOUT_ENABLED,
  };

  process.env.NODE_ENV = "development";
  process.env.LICENSE_EMAIL_OTP_SECRET = "partner-public-program-check-secret";
  const licenseStorePath = path.join(siteRoot, ".data/partner-public-program-check.json");
  process.env.LICENSE_STORE_PATH = licenseStorePath;
  process.env.PAID_CHECKOUT_ENABLED = "false";
  process.env.PARTNER_CHECKOUT_ENABLED = "false";

  try {
    unlinkSync(licenseStorePath);
  } catch {
    // fresh run
  }
  resetLicensePersistenceStoreForTests();
  resetPartnerStoreForTests();
  resetPartnerApplicationStoreForTests();

  const migration = readFileSync(path.join(siteRoot, "migrations/0009_partner_application.sql"), "utf8");
  assert(migration.includes("CREATE TABLE IF NOT EXISTS partner_application"), "0009 migration exists");
  assert(migration.includes("normalized_email TEXT NOT NULL UNIQUE"), "0009 unique email");

  assert(
    legacyApplicationMigrationReport().length > 0,
    "legacy migration report runs",
  );

  assert(isPartnerCheckoutEnvEnabled() === false, "partner checkout env off by default");
  assert(
    isPartnerCheckoutPubliclyEnabled({ PAID_CHECKOUT_ENABLED: "true", PARTNER_CHECKOUT_ENABLED: "false" }) ===
      false,
    "personal checkout on does not open partner checkout",
  );

  {
    const headers = new Headers({ host: "app.partner.example" });
    assert(isPlatformPublicPartnerApiHost(headers) === false, "partner hostname rejected for public API");
    const platform = new Headers({ host: "suhuella.com" });
    assert(isPlatformPublicPartnerApiHost(platform) === true, "platform host allowed");
  }

  {
    const appStore = createMemoryPartnerApplicationStore();
    await appStore.submitInterest({ email: "persist@example.com", displayName: "Persist Co" });
    const restarted = createMemoryPartnerApplicationStore();
    const lost = await restarted.findByEmail("persist@example.com");
    assert(lost === null, "memory store does not survive process restart without D1");
  }

  {
    const appStore = createMemoryPartnerApplicationStore();
    setPartnerApplicationStoreForTests(appStore);
    const saved = await submitPartnerApplication({
      email: "applicant@example.com",
      displayName: "Acme Cloud",
    });
    assert(saved.status === "pending", "submit creates pending application");
    const again = await submitPartnerApplication({
      email: "applicant@example.com",
      displayName: "Acme Cloud Updated",
    });
    assert(again.applicationId === saved.applicationId, "repeat submit upserts same row");

    await appStore.setStatus({
      applicationId: saved.applicationId,
      status: "rejected",
      reviewedBy: "ops@test",
      rejectionReason: "policy",
    });
    let rejectedBlocked = false;
    try {
      await submitPartnerApplication({ email: "applicant@example.com", displayName: "Retry" });
    } catch (error) {
      rejectedBlocked =
        error instanceof Error && error.message.toLowerCase().includes("rejected");
    }
    assert(rejectedBlocked, "rejected applications are not auto-reopened");
  }

  resetPartnerApplicationStoreForTests();
  resetLicensePersistenceStoreForTests();
  try {
    unlinkSync(licenseStorePath);
  } catch {
    // ignore
  }

  {
    const challengeId = "evc_partner_app_otp";
    const code = "918273";
    await seedPartnerApplicationChallenge({
      challengeId,
      email: "otp@example.com",
      code,
    });
    const expiredChallengeId = "evc_partner_app_expired";
    await seedPartnerApplicationChallenge({
      challengeId: expiredChallengeId,
      email: "expired@example.com",
      code: "111111",
    });
    await withLicensePersistence((document) => {
      const row = document.challenges.find((item) => item.id === expiredChallengeId);
      if (row) row.expiresAt = new Date(Date.now() - 60_000).toISOString();
    });
    const expired = await verifyEmailVerificationCode({
      challengeId: expiredChallengeId,
      code: "111111",
    });
    assert(expired.ok === false && expired.error === "expired", "expired OTP rejected");

    const wrong = await verifyEmailVerificationCode({ challengeId, code: "000000" });
    assert(wrong.ok === false, "wrong OTP rejected");
    const verified = await verifyEmailVerificationCode({ challengeId, code });
    assert(verified.ok === true, "correct OTP verified");
    const cross = await consumeVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_ONBOARDING",
    });
    assert(cross.ok === false, "PARTNER_APPLICATION proof cannot accept onboarding");
  }

  resetPartnerApplicationStoreForTests();
  resetLicensePersistenceStoreForTests();
  try {
    unlinkSync(licenseStorePath);
  } catch {
    // ignore
  }

  {
    setPartnerApplicationStoreForTests(createMemoryPartnerApplicationStore());
    const challengeId = "evc_partner_app_order";
    const code = "564738";
    await seedPartnerApplicationChallenge({
      challengeId,
      email: "proof-order@example.com",
      code,
    });
    const verified = await verifyEmailVerificationCode({ challengeId, code });
    assert(verified.ok, "proof-order verified");
    const peekBefore = await peekVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_APPLICATION",
    });
    assert(peekBefore.ok, "proof peek before persist");
    await submitPartnerApplication({
      email: peekBefore.email,
      displayName: "Proof Order Co",
    });
    const consumed = await consumeVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_APPLICATION",
    });
    assert(consumed.ok, "proof consumed after D1 success only");
  }

  resetPartnerApplicationStoreForTests();
  resetLicensePersistenceStoreForTests();
  try {
    unlinkSync(licenseStorePath);
  } catch {
    // ignore
  }

  {
    const base = createMemoryPartnerApplicationStore();
    let failNext = true;
    const flaky = {
      ...base,
      kind: base.kind,
      submitInterest: async (input: { email: string; displayName: string }) => {
        if (failNext) {
          failNext = false;
          throw new Error("simulated_d1_failure");
        }
        return base.submitInterest(input);
      },
      findByEmail: base.findByEmail.bind(base),
      findById: base.findById.bind(base),
      list: base.list.bind(base),
      setStatus: base.setStatus.bind(base),
      claimForApproval: base.claimForApproval.bind(base),
      completeApproval: base.completeApproval.bind(base),
      releaseApprovalClaim: base.releaseApprovalClaim.bind(base),
    };
    setPartnerApplicationStoreForTests(flaky);
    const challengeId = "evc_partner_app_retry";
    const code = "102938";
    await seedPartnerApplicationChallenge({
      challengeId,
      email: "retry@example.com",
      code,
    });
    const verified = await verifyEmailVerificationCode({ challengeId, code });
    assert(verified.ok, "retry flow verified");
    const peek = await peekVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_APPLICATION",
    });
    assert(peek.ok, "proof valid before persist");
    let failed = false;
    try {
      await submitPartnerApplication({ email: peek.email, displayName: "Retry Co" });
    } catch {
      failed = true;
    }
    assert(failed, "first persist failure surfaces error");
    const peekAfterFail = await peekVerifiedEmailProof({
      proofId: verified.proofId,
      purpose: "PARTNER_APPLICATION",
    });
    assert(peekAfterFail.ok, "proof reusable after D1 failure");
    const saved = await submitPartnerApplication({ email: peek.email, displayName: "Retry Co" });
    assert(saved.status === "pending", "retry persist succeeds");
  }

  {
    assert(
      rejectClientAuthorityFields({ action: "submit_interest", partnerId: "ptr_x", proofId: "p" }) ===
        "invalid_request",
      "apply rejects client partnerId",
    );
    assert(
      rejectClientAuthorityFields({ action: "submit_interest", role: "partner_admin" }) ===
        "invalid_request",
      "apply rejects client role",
    );
    const applyRoute = readFileSync(
      path.join(siteRoot, "app/api/partners/apply/route.ts"),
      "utf8",
    );
    assert(applyRoute.includes("body.origin != null"), "apply rejects client origin");
    const onboardingRoute = readFileSync(
      path.join(siteRoot, "app/api/partners/onboarding/route.ts"),
      "utf8",
    );
    assert(
      onboardingRoute.includes("isPlatformPublicPartnerApiHost"),
      "onboarding API guarded to platform host",
    );
    const completePage = readFileSync(
      path.join(siteRoot, "app/(suhuella)/partners/onboarding/complete/page.tsx"),
      "utf8",
    );
    assert(completePage.includes('redirect("/partners")'), "setup complete redirects without session");
    const meRoute = readFileSync(path.join(siteRoot, "app/api/partners/me/route.ts"), "utf8");
    assert(meRoute.includes("resolvePartnerHttpActor"), "/api/partners/me uses session gate");

    let opsStripeBlocked = false;
    try {
      parseOperationsAction({
        action: "approve_partner_application",
        reason: "test",
        applicationId: "ptr_app_x",
        slug: "x",
        origin: "stripe",
      });
    } catch {
      opsStripeBlocked = true;
    }
    assert(opsStripeBlocked, "Ops approve rejects stripe origin");
  }

  {
    const unavailableStore: PartnerApplicationStore = {
      kind: "d1",
      submitInterest: async () => {
        throw new PartnerApplicationStoreUnavailableError();
      },
      findByEmail: async () => {
        throw new PartnerApplicationStoreUnavailableError();
      },
      findById: async () => {
        throw new PartnerApplicationStoreUnavailableError();
      },
      list: async () => {
        throw new PartnerApplicationStoreUnavailableError();
      },
      setStatus: async () => {
        throw new PartnerApplicationStoreUnavailableError();
      },
      claimForApproval: async () => null,
      completeApproval: async () => {
        throw new PartnerApplicationStoreUnavailableError();
      },
      releaseApprovalClaim: async () => {},
    };
    setPartnerApplicationStoreForTests(unavailableStore);
    let unavailable = false;
    try {
      await submitPartnerApplication({ email: "down@example.com", displayName: "Down Co" });
    } catch (error) {
      unavailable = error instanceof PartnerApplicationStoreUnavailableError;
    }
    assert(unavailable, "storage unavailable fails closed on submit");
  }

  {
    setPartnerApplicationStoreForTests(null);
    process.env.NODE_ENV = "production";
    process.env.SUHUELLA_DEV_OPENNEXT = "0";
    const store = await getPartnerApplicationStore();
    assert(store.kind === "d1", "production without D1 uses unavailable d1 store");
    let prodUnavailable = false;
    try {
      await store.submitInterest({ email: "prod@example.com", displayName: "Prod Co" });
    } catch (error) {
      prodUnavailable = error instanceof PartnerApplicationStoreUnavailableError;
    }
    assert(prodUnavailable, "production runtime rejects submit without D1");
    process.env.NODE_ENV = "development";
    delete process.env.SUHUELLA_DEV_OPENNEXT;
    resetPartnerApplicationStoreForTests();
  }

  resetPartnerStoreForTests();
  resetPartnerApplicationStoreForTests();
  setPartnerStoreForTests(createMemoryPartnerStore());
  setPartnerApplicationStoreForTests(createMemoryPartnerApplicationStore());

  {
    const platform = { kind: "platform" as const, email: "ops@suhuella.com" };
    const appStore = createMemoryPartnerApplicationStore();
    setPartnerApplicationStoreForTests(appStore);
    const application = await appStore.submitInterest({
      email: "approve@example.com",
      displayName: "Approve Co",
    });
    const approved = await approvePartnerApplication(platform, {
      applicationId: application.applicationId,
      slug: "approve-co",
      origin: "manual",
      reason: "partner-public-program-check approval",
    });
    assert(approved.partnerId, "approval creates partner");
    assert(approved.invitePath?.includes("/partners/onboarding/"), "approval reuses createPartner invite");
    const doc = await getPartnerStore().then((store) => store.read());
    assert(doc.invites.length === 1, "single invite from createPartner");
    const idempotent = await approvePartnerApplication(platform, {
      applicationId: application.applicationId,
      slug: "approve-co",
      origin: "manual",
      reason: "partner-public-program-check idempotent",
    });
    assert(idempotent.idempotent === true, "second approval is idempotent");
    const docAfter = await getPartnerStore().then((store) => store.read());
    assert(docAfter.partners.length === 1, "idempotent approval does not duplicate partner");

    const concurrent = await appStore.submitInterest({
      email: "concurrent@example.com",
      displayName: "Concurrent Co",
    });
    const attemptA = `ptr_appr_a_${Date.now()}`;
    const attemptB = `ptr_appr_b_${Date.now()}`;
    const claimA = await appStore.claimForApproval({
      applicationId: concurrent.applicationId,
      reviewedBy: "ops-a@test",
      approvalAttemptId: attemptA,
    });
    assert(claimA?.status === "approving", "first concurrent claim wins");
    const claimB = await appStore.claimForApproval({
      applicationId: concurrent.applicationId,
      reviewedBy: "ops-b@test",
      approvalAttemptId: attemptB,
    });
    assert(claimB === null, "second concurrent claim fails");
  }

  {
    const { db, adapter } = openFreshLocalD1Adapter(siteRoot);
    const storeA = createPartnerApplicationStoreFromDatabase(adapter);
    const saved = await storeA.submitInterest({
      email: "d1local@example.com",
      displayName: "Local D1 Co",
    });
    db.close();
    const { adapter: adapterB } = openFreshLocalD1Adapter(siteRoot);
    const storeB = createPartnerApplicationStoreFromDatabase(adapterB);
    const loaded = await storeB.findByEmail("d1local@example.com");
    assert(loaded?.applicationId === saved.applicationId, "local D1 survives new adapter instance");
    let duplicateRejected = false;
    try {
      execSync(
        `npx wrangler d1 execute suhuella-license --local --command "INSERT INTO partner_application (application_id, normalized_email, display_name, status, created_at, updated_at) VALUES ('ptr_app_dup', 'd1local@example.com', 'Dup', 'pending', datetime('now'), datetime('now'))"`,
        { cwd: siteRoot, stdio: "pipe" },
      );
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "local D1 enforces unique normalized_email");
  }

  const wrangler = readFileSync(path.join(siteRoot, "wrangler.jsonc"), "utf8");
  assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "false"'), "partner checkout flag stays false");
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "personal checkout stays off");

  if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previous.NODE_ENV;
  if (previous.LICENSE_EMAIL_OTP_SECRET === undefined) delete process.env.LICENSE_EMAIL_OTP_SECRET;
  else process.env.LICENSE_EMAIL_OTP_SECRET = previous.LICENSE_EMAIL_OTP_SECRET;
  if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
  else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
  if (previous.PAID_CHECKOUT_ENABLED === undefined) delete process.env.PAID_CHECKOUT_ENABLED;
  else process.env.PAID_CHECKOUT_ENABLED = previous.PAID_CHECKOUT_ENABLED;
  if (previous.PARTNER_CHECKOUT_ENABLED === undefined) delete process.env.PARTNER_CHECKOUT_ENABLED;
  else process.env.PARTNER_CHECKOUT_ENABLED = previous.PARTNER_CHECKOUT_ENABLED;

  console.log("PARTNER-PUBLIC-PROGRAM-001 check passed");
}

void runPartnerPublicProgramCheck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
