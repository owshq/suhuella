import type { CheckoutPlan } from "./checkout.ts";
import { withLicensePersistence } from "./license-persistence/store.ts";
import type { ActivationAttempt } from "./license-persistence/types.ts";

const ATTEMPT_TTL_MS = 60 * 60 * 1000;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `aat_${crypto.randomUUID()}`;
  }
  return `aat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createActivationAttempt(input: {
  deviceId: string;
  plan?: CheckoutPlan | null;
}): Promise<{ ok: true; activationAttemptId: string } | { ok: false; error: "invalid_request" }> {
  const deviceId = input.deviceId?.trim() ?? "";
  if (!deviceId) return { ok: false, error: "invalid_request" };

  const now = Date.now();
  const attempt: ActivationAttempt = {
    id: createId(),
    checkoutSessionId: null,
    deviceId,
    plan: input.plan ?? null,
    expiresAt: new Date(now + ATTEMPT_TTL_MS).toISOString(),
    consumedAt: null,
    createdAt: new Date(now).toISOString(),
  };

  await withLicensePersistence((document) => {
    document.activationAttempts.push(attempt);
  });

  return { ok: true, activationAttemptId: attempt.id };
}

export async function bindActivationAttemptToCheckout(input: {
  activationAttemptId: string;
  checkoutSessionId: string;
}): Promise<void> {
  const activationAttemptId = input.activationAttemptId?.trim() ?? "";
  const checkoutSessionId = input.checkoutSessionId?.trim() ?? "";
  if (!activationAttemptId || !checkoutSessionId) return;

  await withLicensePersistence((document) => {
    const attempt = document.activationAttempts.find((item) => item.id === activationAttemptId);
    if (!attempt || attempt.consumedAt) return;
    attempt.checkoutSessionId = checkoutSessionId;
  });
}

export async function consumeActivationAttempt(input: {
  activationAttemptId: string;
  deviceId: string;
  checkoutSessionId: string;
}): Promise<{ ok: true } | { ok: false; error: "invalid_attempt" | "expired" }> {
  const activationAttemptId = input.activationAttemptId?.trim() ?? "";
  const deviceId = input.deviceId?.trim() ?? "";
  const checkoutSessionId = input.checkoutSessionId?.trim() ?? "";
  if (!activationAttemptId || !deviceId || !checkoutSessionId) {
    return { ok: false, error: "invalid_attempt" };
  }

  const now = Date.now();
  let valid = false;

  await withLicensePersistence((document) => {
    const attempt = document.activationAttempts.find((item) => item.id === activationAttemptId);
    if (!attempt || attempt.consumedAt) return;
    if (attempt.deviceId !== deviceId) return;
    if (Date.parse(attempt.expiresAt) <= now) return;
    if (!attempt.checkoutSessionId || attempt.checkoutSessionId !== checkoutSessionId) return;
    attempt.consumedAt = new Date(now).toISOString();
    valid = true;
  });

  if (!valid) {
    const expired = await withLicensePersistence((document) => {
      const attempt = document.activationAttempts.find((item) => item.id === activationAttemptId);
      return Boolean(attempt && Date.parse(attempt.expiresAt) <= now);
    });
    return { ok: false, error: expired ? "expired" : "invalid_attempt" };
  }

  return { ok: true };
}
