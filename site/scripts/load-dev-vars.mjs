import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Parse wrangler-style .dev.vars into process.env (does not override existing). */
export function loadDevVars(siteDir) {
  const file = path.join(siteDir, ".dev.vars");
  if (!existsSync(file)) return false;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
  return true;
}

export function applyLocalDevDefaults() {
  if (process.env.NODE_ENV === "production" || process.env.NEXTJS_ENV === "production") return;
  if (!process.env.LICENSE_SIGNING_SECRET?.trim()) {
    process.env.LICENSE_SIGNING_SECRET = "suhuella-local-dev-signing-secret";
  }
  if (!process.env.LICENSE_EMAIL_OTP_SECRET?.trim()) {
    process.env.LICENSE_EMAIL_OTP_SECRET = "suhuella-local-dev-email-otp-secret";
  }
  if (!process.env.PARTNER_SESSION_SECRET?.trim()) {
    process.env.PARTNER_SESSION_SECRET = "suhuella-local-dev-partner-session-secret";
  }
  if (!process.env.CLOUDFLARE_SAAS_CNAME_TARGET?.trim()) {
    process.env.CLOUDFLARE_SAAS_CNAME_TARGET = "partners-fallback.local.dev";
  }
}
