import { isLicenseOtpMailReady, sendVerificationCodeEmail } from "./resend-mail.ts";
import { isValidEmail, normalizeEmail } from "./license-context.ts";
import { findBusinessGrantByEmail } from "./business-service.ts";
import { findGrantByEmail } from "./license-store.ts";
import {
  productionLicensePersistenceReady,
  readLicensePersistence,
  withLicensePersistence,
} from "./license-persistence/store.ts";
import type {
  EmailVerificationPurpose,
  VerifiedEmailProof,
} from "./license-persistence/types.ts";
import { isRateLimited, recordRateLimitEvent } from "./rate-limit.ts";

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_PROOF_TTL_MS = 15 * 60 * 1000;
export const EMAIL_CODE_MAX_VERIFY_ATTEMPTS = 5;
export const EMAIL_CODE_SEND_LIMIT_PER_EMAIL = 3;
export const EMAIL_CODE_SEND_LIMIT_PER_IP = EMAIL_CODE_SEND_LIMIT_PER_EMAIL * 2;

const CODE_TTL_MS = EMAIL_CODE_TTL_MS;
const PROOF_TTL_MS = EMAIL_CODE_PROOF_TTL_MS;
const MAX_VERIFY_ATTEMPTS = EMAIL_CODE_MAX_VERIFY_ATTEMPTS;
const MAX_SENDS_PER_EMAIL = EMAIL_CODE_SEND_LIMIT_PER_EMAIL;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function otpSecret(): string | null {
  const secret = process.env.LICENSE_EMAIL_OTP_SECRET?.trim();
  if (secret) return secret;
  if (!isProductionRuntime()) return "dev-email-code-secret";
  return null;
}

function productionDeliveryReady(): boolean {
  if (!isProductionRuntime()) return true;
  return isLicenseOtpMailReady() && Boolean(otpSecret());
}

function randomSixDigitCode(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return (bytes[0] % 1_000_000).toString().padStart(6, "0");
}

async function hashCode(challengeId: string, code: string): Promise<string> {
  const secret = otpSecret();
  if (!secret) return "unavailable";
  const payload = new TextEncoder().encode(`${challengeId}:${code}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Buffer.from(digest).toString("base64url");
}

function isPurpose(value: string): value is EmailVerificationPurpose {
  return (
    value === "LICENSE_ACTIVATION" ||
    value === "LICENSE_RECOVERY" ||
    value === "BUSINESS_OWNER_VERIFICATION" ||
    value === "BUSINESS_CHECKOUT" ||
    value === "LIFETIME_UPGRADE" ||
    value === "PARTNER_ONBOARDING" ||
    value === "PARTNER_APPLICATION" ||
    value === "PARTNER_PORTAL"
  );
}

async function lifetimeUpgradeEligible(email: string): Promise<boolean> {
  const grant = await findGrantByEmail(email);
  if (!grant || grant.edition !== "personal_lifetime" || grant.status !== "active") return false;
  if (!grant.commercialGenerationId?.trim()) return false;
  return grant.generationAccessMode !== "legacy_unassigned";
}

async function eligibleEmailExists(email: string): Promise<boolean> {
  return Boolean((await findGrantByEmail(email)) || findBusinessGrantByEmail(email));
}

export async function requestEmailVerificationCode(input: {
  email: string;
  purpose: string;
  deviceId?: string;
  clientIp?: string;
}): Promise<
  | { ok: true; challengeId: string; message: string }
  | { ok: false; error: "invalid_request" | "rate_limited" | "server_error" | "no_membership" }
> {
  const email = normalizeEmail(input.email ?? "");
  const purpose = input.purpose?.trim() ?? "";
  const deviceId = input.deviceId?.trim() || null;

  if (!isValidEmail(email) || !isPurpose(purpose)) {
    return { ok: false, error: "invalid_request" };
  }

  if (!productionDeliveryReady() || !(await productionLicensePersistenceReady())) {
    return { ok: false, error: "server_error" };
  }

  const emailBucket = `email-code:send:${email}`;
  const ipBucket = input.clientIp ? `email-code:send:ip:${input.clientIp}` : null;
  if (await isRateLimited(emailBucket, MAX_SENDS_PER_EMAIL)) {
    return { ok: false, error: "rate_limited" };
  }
  if (ipBucket && (await isRateLimited(ipBucket, EMAIL_CODE_SEND_LIMIT_PER_IP))) {
    return { ok: false, error: "rate_limited" };
  }

  const exists =
    purpose === "PARTNER_ONBOARDING"
      ? await (async () => {
          const { hasOpenPartnerInviteForEmail } = await import("./partners/service.ts");
          return hasOpenPartnerInviteForEmail(email);
        })()
      : purpose === "LIFETIME_UPGRADE"
        ? await lifetimeUpgradeEligible(email)
      : purpose === "PARTNER_APPLICATION" || purpose === "BUSINESS_CHECKOUT"
        ? true
        : purpose === "PARTNER_PORTAL"
          ? await (async () => {
              const { hasPartnerPortalAccess } = await import("./partners/service.ts");
              return hasPartnerPortalAccess(email);
            })()
          : await eligibleEmailExists(email);

  if (purpose === "PARTNER_PORTAL" && !exists) {
    return { ok: false, error: "no_membership" };
  }

  const code = randomSixDigitCode();
  const challengeId = createId("evc");
  const now = Date.now();
  const codeHash = await hashCode(challengeId, code);

  await withLicensePersistence((document) => {
    document.challenges = document.challenges.filter(
      (item) =>
        !(
          item.normalizedEmail === email &&
          item.purpose === purpose &&
          item.consumedAt === null &&
          Date.parse(item.expiresAt) > now
        ),
    );
    document.challenges.push({
      id: challengeId,
      normalizedEmail: email,
      purpose,
      deviceId,
      codeHash,
      expiresAt: new Date(now + CODE_TTL_MS).toISOString(),
      attemptCount: 0,
      sendCount: 1,
      consumedAt: null,
      createdAt: new Date(now).toISOString(),
    });
  });

  if (exists) {
    const delivered = await sendVerificationCodeEmail({ to: email, code });
    if (!delivered.ok) return { ok: false, error: "server_error" };
  }

  await recordRateLimitEvent(emailBucket);
  if (ipBucket) await recordRateLimitEvent(ipBucket);

  return {
    ok: true,
    challengeId,
    message:
      purpose === "PARTNER_ONBOARDING"
        ? "If this email has an open partner invite, we've sent a verification code."
          : purpose === "LIFETIME_UPGRADE"
            ? "If this Lifetime license is eligible for an upgrade, we've sent a verification code."
          : purpose === "PARTNER_APPLICATION" || purpose === "BUSINESS_CHECKOUT"
          ? "If this email is valid, we've sent a verification code."
          : purpose === "PARTNER_PORTAL"
            ? "We sent a verification code to this authorized partner email."
            : "If an eligible license exists for this email, we've sent a verification code.",
  };
}

export async function verifyEmailVerificationCode(input: {
  challengeId: string;
  code: string;
}): Promise<
  | { ok: true; proofId: string; expiresAt: string }
  | { ok: false; error: "invalid_request" | "invalid_code" | "expired" | "rate_limited" }
> {
  const challengeId = input.challengeId?.trim() ?? "";
  const code = input.code?.trim() ?? "";
  if (!challengeId || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "invalid_request" };
  }
  if (!(await productionLicensePersistenceReady())) {
    return { ok: false, error: "invalid_code" };
  }

  const now = Date.now();
  const actualHash = await hashCode(challengeId, code);
  let proof: VerifiedEmailProof | null = null;
  let failure: "invalid_code" | "expired" | "rate_limited" | null = null;

  await withLicensePersistence((document) => {
    const challenge = document.challenges.find((item) => item.id === challengeId);
    if (!challenge || challenge.consumedAt) {
      failure = "invalid_code";
      return;
    }
    if (Date.parse(challenge.expiresAt) <= now) {
      failure = "expired";
      return;
    }
    if (challenge.attemptCount >= MAX_VERIFY_ATTEMPTS) {
      failure = "rate_limited";
      return;
    }

    challenge.attemptCount += 1;
    if (actualHash !== challenge.codeHash) {
      failure = "invalid_code";
      return;
    }

    challenge.consumedAt = new Date(now).toISOString();
    const p = {
      id: createId("vep"),
      normalizedEmail: challenge.normalizedEmail,
      purpose: challenge.purpose,
      deviceId: challenge.deviceId,
      expiresAt: new Date(now + PROOF_TTL_MS).toISOString(),
      consumedAt: null,
      createdAt: new Date(now).toISOString(),
    };
    proof = p;
    document.proofs.push(p);
  });

  if (failure) return { ok: false, error: failure };
  if (!proof) return { ok: false, error: "invalid_code" };
  const p = proof as { id: string; expiresAt: string };
  return { ok: true, proofId: p.id, expiresAt: p.expiresAt };
}

export async function peekVerifiedEmailProof(input: {
  proofId: string;
  purpose: EmailVerificationPurpose;
}): Promise<{ ok: true; email: string } | { ok: false; error: "invalid_proof" | "expired" }> {
  const proofId = input.proofId?.trim() ?? "";
  if (!proofId) return { ok: false, error: "invalid_proof" };

  const now = Date.now();
  const document = await readLicensePersistence();
  const proof = document.proofs.find((item) => item.id === proofId);
  if (!proof || proof.consumedAt || proof.purpose !== input.purpose) {
    return { ok: false, error: "invalid_proof" };
  }
  if (Date.parse(proof.expiresAt) <= now) return { ok: false, error: "expired" };
  return { ok: true, email: proof.normalizedEmail };
}

export async function consumeVerifiedEmailProof(input: {
  proofId: string;
  purpose: EmailVerificationPurpose;
  deviceId?: string;
}): Promise<{ ok: true; email: string } | { ok: false; error: "invalid_proof" | "expired" }> {
  const proofId = input.proofId?.trim() ?? "";
  const deviceId = input.deviceId?.trim() || null;
  if (!proofId) return { ok: false, error: "invalid_proof" };

  let email: string | null = null;
  const now = Date.now();
  let valid = false;

  await withLicensePersistence((document) => {
    const proof = document.proofs.find((item) => item.id === proofId);
    if (!proof || proof.consumedAt || proof.purpose !== input.purpose) return;
    if (Date.parse(proof.expiresAt) <= now) return;
    if (proof.deviceId && deviceId && proof.deviceId !== deviceId) return;
    proof.consumedAt = new Date(now).toISOString();
    email = proof.normalizedEmail;
    valid = true;
  });

  if (!valid || !email) return { ok: false, error: "invalid_proof" };
  return { ok: true, email };
}
