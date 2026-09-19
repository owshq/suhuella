/**
 * Live OTP delivery proof against a running origin.
 * Does not sell, does not print codes or API keys, does not create grants.
 *
 * Prerequisite: Operations gift / manual / test / promo / internal grant
 * for an inbox you control. Production ignores LICENSE_GRANTS env.
 *
 *   RESEND_OTP_PROOF_EMAIL=you@example.com npm run test:resend-otp-proof
 *
 * Optional:
 *   SUHUELLA_ORIGIN=https://suhuella.com
 *   RESEND_OTP_PROOF_CODE=123456   (verify after you read the inbox)
 */

const email = process.env.RESEND_OTP_PROOF_EMAIL?.trim().toLowerCase() ?? "";
const origin = (process.env.SUHUELLA_ORIGIN?.trim() || "https://suhuella.com").replace(/\/$/, "");
const code = process.env.RESEND_OTP_PROOF_CODE?.trim() ?? "";
const purpose = "LICENSE_RECOVERY";

if (!email || !email.includes("@")) {
  console.log(`# Resend OTP live proof — no sell path
#
# 1. Operations Console → Gifts / Manual → create a gift (or manual/test)
#    license for an inbox you control. Do not use Stripe checkout.
# 2. Run:
#      RESEND_OTP_PROOF_EMAIL=you@example.com npm run test:resend-otp-proof --prefix site
# 3. HTTP 200 is not delivery. Check the inbox (From licenses@, Reply-To support@).
# 4. Then verify:
#      RESEND_OTP_PROOF_EMAIL=you@example.com RESEND_OTP_PROOF_CODE=123456 \\
#        npm run test:resend-otp-proof --prefix site
`);
  process.exit(2);
}

const requestUrl = `${origin}/api/license/email-code/request`;
const request = await fetch(requestUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, purpose }),
});
const requestBody = await request.json().catch(() => ({}));

console.log(`origin=${origin}`);
console.log(`request_status=${request.status}`);
console.log(`request_ok=${requestBody?.ok === true}`);
if (requestBody?.challengeId) console.log(`challengeId=${requestBody.challengeId}`);
if (requestBody?.error) console.log(`request_error=${requestBody.error}`);
console.log(
  "HTTP 200 is not delivery proof. The Worker creates a challenge even when no grant exists and no mail is sent.",
);

if (!request.ok || requestBody?.ok !== true) {
  process.exit(1);
}

if (!code) {
  console.log("STATUS=REQUESTED");
  console.log("Check the authorized inbox, then re-run with RESEND_OTP_PROOF_CODE.");
  process.exit(0);
}

const verifyUrl = `${origin}/api/license/email-code/verify`;
const verify = await fetch(verifyUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ challengeId: requestBody.challengeId, code }),
});
const verifyBody = await verify.json().catch(() => ({}));
console.log(`verify_status=${verify.status}`);
console.log(`verify_ok=${verifyBody?.ok === true}`);
if (verifyBody?.error) console.log(`verify_error=${verifyBody.error}`);
if (verifyBody?.ok === true) {
  console.log("STATUS=VERIFIED");
  console.log("Inbox delivery + verify succeeded. Do not commit the code.");
  process.exit(0);
}
process.exit(1);
