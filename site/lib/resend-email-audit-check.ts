import { brand, licenseOtpFromDisplay, licenseOtpReplyTo } from "@suhuella/brand";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMAIL_CODE_SEND_LIMIT_PER_EMAIL,
  EMAIL_CODE_SEND_LIMIT_PER_IP,
  requestEmailVerificationCode,
} from "./email-verification.ts";
import {
  productionLicensePersistenceReady,
  resetLicensePersistenceStoreForTests,
} from "./license-persistence/store.ts";
import { upsertStoredGrant } from "./license-store.ts";
import {
  collectSpfRecords,
  dkimPresence,
  dmarcPresence,
  flattenTxtAnswers,
  spfStatus,
} from "./resend-dns.ts";
import {
  isEmailTransportConfigured,
  isLicenseOtpMailReady,
  isResendFromAligned,
  isTransientResendStatus,
  RESEND_TRANSIENT_RETRY_COUNT,
  sendVerificationCodeEmail,
  VERIFICATION_CODE_TTL_MINUTES,
  verificationEmailHtml,
  verificationEmailSubject,
  verificationEmailText,
} from "./resend-mail.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runResendEmailAuditCheck(): Promise<void> {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    LICENSE_EMAIL_OTP_SECRET: process.env.LICENSE_EMAIL_OTP_SECRET,
    LICENSE_STORE_PATH: process.env.LICENSE_STORE_PATH,
  };
  const storePath = `${process.cwd()}/.data/resend-email-audit-check.json`;

  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    assert(isEmailTransportConfigured() === false, "empty Resend env is not configured");
    assert(isLicenseOtpMailReady() === false, "empty Resend env is not mail-ready");

    process.env.NODE_ENV = "production";
    const productionMissing = await sendVerificationCodeEmail({
      to: "audit@example.com",
      code: "123456",
    });
    assert(productionMissing.ok === false, "production without Resend must not claim send");
    assert(productionMissing.error === "not_configured", "production without Resend fails closed");

    resetLicensePersistenceStoreForTests();
    process.env.LICENSE_STORE_PATH = storePath;
    const productionRequest = await requestEmailVerificationCode({
      email: "audit@example.com",
      purpose: "LICENSE_ACTIVATION",
    });
    assert(productionRequest.ok === false, "production request without transport fails closed");
    assert(productionRequest.error === "server_error", "missing transport is server_error");

    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "Other <other@example.com>";
    assert(isEmailTransportConfigured() === true, "both Resend vars mark transport configured");
    assert(isResendFromAligned() === false, "foreign From is not BrandConfig-aligned");
    assert(isLicenseOtpMailReady() === false, "misaligned From is not mail-ready");
    const misaligned = await sendVerificationCodeEmail({
      to: "audit@example.com",
      code: "123456",
    });
    assert(misaligned.ok === false && misaligned.error === "not_configured", "misaligned From fails closed");

    process.env.RESEND_FROM = "SuHuella <licenses@suhuella.com>";
    process.env.LICENSE_EMAIL_OTP_SECRET = "test-email-otp-secret";
    resetLicensePersistenceStoreForTests();
    const productionNoD1 = await requestEmailVerificationCode({
      email: "audit@example.com",
      purpose: "LICENSE_ACTIVATION",
    });
    assert(productionNoD1.ok === false, "production request without LICENSE_DB fails closed");
    assert(productionNoD1.error === "server_error", "missing D1 is server_error");
    assert((await productionLicensePersistenceReady()) === false, "production without D1 is not durable");
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.LICENSE_EMAIL_OTP_SECRET;
    resetLicensePersistenceStoreForTests();

    process.env.NODE_ENV = "development";
    const developmentMissing = await sendVerificationCodeEmail({
      to: "audit@example.com",
      code: "654321",
    });
    assert(developmentMissing.ok === true, "development without Resend may use console fallback");

    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "SuHuella <licenses@suhuella.com>";
    assert(isEmailTransportConfigured() === true, "aligned Resend vars mark transport configured");
    assert(isResendFromAligned() === true, "BrandConfig From is aligned");
    assert(isLicenseOtpMailReady() === true, "aligned SuHuella mail is ready");

    assert(verificationEmailSubject() === "Your SuHuella verification code", "subject stays BrandConfig");
    assert(licenseOtpFromDisplay() === "SuHuella <licenses@suhuella.com>", "From display stays BrandConfig");
    assert(licenseOtpReplyTo() === "support@suhuella.com", "Reply-To stays BrandConfig support");
    assert(brand.emails?.licenses === "licenses@suhuella.com", "licenses mailbox is frozen");
    assert(VERIFICATION_CODE_TTL_MINUTES === 10, "OTP TTL stays 10 minutes");
    assert(EMAIL_CODE_SEND_LIMIT_PER_EMAIL === 3, "3 sends per email per window");
    assert(EMAIL_CODE_SEND_LIMIT_PER_IP === 6, "6 sends per IP per window");
    assert(RESEND_TRANSIENT_RETRY_COUNT === 1, "one retry on transient Resend failure");
    assert(isTransientResendStatus(429) === true, "429 is retried");
    assert(isTransientResendStatus(503) === true, "503 is retried");
    assert(isTransientResendStatus(400) === false, "400 is not retried");

    const text = verificationEmailText({ code: "482913" });
    const html = verificationEmailHtml({ code: "482913" });
    assert(text.includes("482913"), "text template includes the code");
    assert(html.includes("482913"), "html template includes the code");
    assert(text.includes("10 minutes"), "text template states expiry");
    assert(html.includes("10 minutes"), "html template states expiry");
    assert(text.includes("support@suhuella.com"), "text template names Reply-To");
    assert(html.includes("support@suhuella.com"), "html template names Reply-To");
    assert(text.includes("SuHuella"), "text template is SuHuella-only");
    assert(html.includes("SuHuella"), "html template is SuHuella-only");
    assert(!text.toLowerCase().includes("stripe"), "text template does not sell");
    assert(!html.toLowerCase().includes("stripe"), "html template does not sell");
    assert(!text.toLowerCase().includes("download"), "text template does not mention download");
    assert(!html.toLowerCase().includes("installer"), "html template does not mention installers");
    assert(!text.toLowerCase().includes("noreply"), "text template does not use noreply");
    assert(!html.toLowerCase().includes("noreply"), "html template does not use noreply");

    let fetchCalls = 0;
    const retryFetch: typeof fetch = async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    };
    const retried = await sendVerificationCodeEmail(
      { to: "audit@example.com", code: "482913" },
      { fetch: retryFetch },
    );
    assert(retried.ok === true, "transient Resend failure is retried once");
    assert(fetchCalls === 2, "retry uses exactly one extra attempt");

    let permanentCalls = 0;
    const permanentFetch: typeof fetch = async () => {
      permanentCalls += 1;
      return new Response("bad", { status: 400 });
    };
    const permanent = await sendVerificationCodeEmail(
      { to: "audit@example.com", code: "482913" },
      { fetch: permanentFetch },
    );
    assert(permanent.ok === false && permanent.error === "delivery_failed", "400 is not retried as success");
    assert(permanentCalls === 1, "permanent Resend errors are not retried");

    process.env.NODE_ENV = "development";
    process.env.LICENSE_EMAIL_OTP_SECRET = "resend-email-audit-secret";
    process.env.LICENSE_STORE_PATH = storePath;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    resetLicensePersistenceStoreForTests();

    await upsertStoredGrant({
      email: "otp-gift@example.com",
      customerId: "cust_otp_gift",
      licenseId: "lic_otp_gift",
      edition: "personal_lifetime",
      origin: "gift",
      status: "active",
    });

    const unknown = await requestEmailVerificationCode({
      email: "nobody@example.com",
      purpose: "LICENSE_RECOVERY",
    });
    assert(unknown.ok === true, "unknown email uses the same success envelope");

    for (let index = 0; index < EMAIL_CODE_SEND_LIMIT_PER_EMAIL; index += 1) {
      const sent = await requestEmailVerificationCode({
        email: "otp-gift@example.com",
        purpose: "LICENSE_RECOVERY",
        clientIp: "203.0.113.10",
      });
      assert(sent.ok === true, `gift grant send ${index + 1} is allowed`);
    }
    const limited = await requestEmailVerificationCode({
      email: "otp-gift@example.com",
      purpose: "LICENSE_RECOVERY",
      clientIp: "203.0.113.10",
    });
    assert(limited.ok === false && limited.error === "rate_limited", "fourth send is rate limited");

    assert(spfStatus([]) === "missing", "empty TXT is missing SPF");
    assert(spfStatus(["v=spf1 include:_spf.mx.cloudflare.net ~all"]) === "ok", "one SPF is ok");
    assert(
      spfStatus(["v=spf1 include:example.com ~all", "v=spf1 include:other.example ~all"]) === "multiple",
      "two SPF records at one name are rejected",
    );
    assert(collectSpfRecords(["hello", "v=SPF1 include:example.com -all"]).length === 1, "SPF match is case-insensitive");
    assert(dmarcPresence(["v=DMARC1; p=quarantine"]) === "present", "DMARC parser accepts v=DMARC1");
    assert(dmarcPresence(["something else"]) === "missing", "non-DMARC TXT is not accepted");
    assert(
      dkimPresence({ txtRecords: ["v=DKIM1; k=rsa; p=public"], cnameTargets: [] }) === "present",
      "DKIM TXT is accepted without inventing a production key",
    );
    assert(
      dkimPresence({ txtRecords: ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC"], cnameTargets: [] }) === "present",
      "DKIM p= without v= is accepted (RFC default)",
    );
    assert(dkimPresence({ txtRecords: [], cnameTargets: ["resend._domainkey.example."] }) === "present", "DKIM CNAME counts");
    assert(dkimPresence({ txtRecords: ["hello"], cnameTargets: [] }) === "missing", "unrelated TXT is not DKIM");
    assert(flattenTxtAnswers([["v=spf1 ", "include:example.com"]]).join("") === "v=spf1 include:example.com", "TXT chunks flatten");

    const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    assert(wrangler.includes('"RESEND_FROM": "SuHuella <licenses@suhuella.com>"'), "Worker From matches BrandConfig");
    assert(!wrangler.includes("RESEND_API_KEY"), "Worker config does not embed the Resend secret");
    assert(wrangler.includes("licenses@suhuella.com"), "Worker mail config is SuHuella-only");

    const mailSource = readFileSync(join(process.cwd(), "lib/resend-mail.ts"), "utf8");
    assert(mailSource.includes("reply_to"), "Resend payload sets reply_to");
    assert(mailSource.includes("html:"), "Resend payload includes html");
    assert(mailSource.includes("text:"), "Resend payload includes text");
    assert(mailSource.includes("licenseOtpFromDisplay") || mailSource.includes("isResendFromAligned"), "mail source aligns From with BrandConfig");
  } finally {
    resetLicensePersistenceStoreForTests();
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
    if (previous.RESEND_FROM === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = previous.RESEND_FROM;
    if (previous.LICENSE_EMAIL_OTP_SECRET === undefined) delete process.env.LICENSE_EMAIL_OTP_SECRET;
    else process.env.LICENSE_EMAIL_OTP_SECRET = previous.LICENSE_EMAIL_OTP_SECRET;
    if (previous.LICENSE_STORE_PATH === undefined) delete process.env.LICENSE_STORE_PATH;
    else process.env.LICENSE_STORE_PATH = previous.LICENSE_STORE_PATH;
  }

  console.log("RESEND-EMAIL-DELIVERY-PRODUCTION-AUDIT-001 check passed");
}

void runResendEmailAuditCheck().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
