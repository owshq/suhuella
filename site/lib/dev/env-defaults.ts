/** Dev-only defaults so partner portal + OTP work without a committed .dev.vars file. */
export const LOCAL_DEV_LICENSE_SIGNING_SECRET = "suhuella-local-dev-signing-secret";
export const LOCAL_DEV_LICENSE_EMAIL_OTP_SECRET = "suhuella-local-dev-email-otp-secret";
export const LOCAL_DEV_PARTNER_SESSION_SECRET = "suhuella-local-dev-partner-session-secret";
export const LOCAL_DEV_PARTNER_CNAME_TARGET = "partners-fallback.local.dev";

export function isNonProductionRuntime(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXTJS_ENV !== "production";
}

export function applyLocalDevEnvDefaults(): void {
  if (!isNonProductionRuntime()) return;
  if (!process.env.LICENSE_SIGNING_SECRET?.trim()) {
    process.env.LICENSE_SIGNING_SECRET = LOCAL_DEV_LICENSE_SIGNING_SECRET;
  }
  if (!process.env.LICENSE_EMAIL_OTP_SECRET?.trim()) {
    process.env.LICENSE_EMAIL_OTP_SECRET = LOCAL_DEV_LICENSE_EMAIL_OTP_SECRET;
  }
  if (!process.env.PARTNER_SESSION_SECRET?.trim()) {
    process.env.PARTNER_SESSION_SECRET = LOCAL_DEV_PARTNER_SESSION_SECRET;
  }
  if (!process.env.CLOUDFLARE_SAAS_CNAME_TARGET?.trim()) {
    process.env.CLOUDFLARE_SAAS_CNAME_TARGET = LOCAL_DEV_PARTNER_CNAME_TARGET;
  }
}
