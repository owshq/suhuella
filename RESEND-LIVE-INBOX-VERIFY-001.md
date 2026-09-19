# RESEND-LIVE-INBOX-VERIFY-001

```text
STATUS = CLOSED · PASS
TYPE = Manual operator proof
SCOPE = SUHUELLA ONLY
CURSOR = NO
CLOSED = 2026-09-19
```

**Superseded name:** [RESEND-LIVE-OTP-PROOF-001.md](RESEND-LIVE-OTP-PROOF-001.md) is the canonical operator runbook for the same proof.

**Not a coding task. Not a Cursor task. Operator verification only.**

Closes the remaining manual gap in [RESEND-PRODUCTION-001.md](RESEND-PRODUCTION-001.md).

Expected final status:

```text
RESEND-PRODUCTION-001 — CLOSED · OTP PRODUCTION PROVEN
```

---

## Current state

`RESEND-PRODUCTION-001` is now **CLOSED · OTP PRODUCTION PROVEN**.

Result:

- Controlled test inbox provider: `gmail.com`
- Inbox received: **yes**
- From / Reply-To / subject / body: **correct**
- OTP verified on production: **yes** (`2026-09-19T02:27:14Z`)
- Worker version: `dabfa9aa-545f-40bb-80a9-ebcc8bbb46da`
- OTP code and full email address were **not** recorded in reports

Already true before close:

- Sending domain = `suhuella.com`
- Resend domain = `suhuella.com`
- From = `SuHuella <licenses@suhuella.com>`
- Reply-To = `support@suhuella.com`
- Grant authority = `LICENSE_DB`
- Brand scope = SuHuella only
- Controlled test inbox = operator-controlled address
- `RESEND_API_KEY` exists as Worker secret
- DNS require check passes
- SPF / DKIM / DMARC are publicly visible
- Production fallback to console is disabled
- OTP requires durable grant
- Checkout was not touched
- Stripe was not touched

Still missing:

- Resend dashboard verification confirmation
- Real inbox receipt
- Received OTP code verification

---

## Rule

HTTP 200 is not proof.

Resend accepted is not proof.

DNS PASS is not proof.

Only this closes the track:

1. A real inbox receives the SuHuella OTP email
2. Email identity is correct
3. The received OTP code verifies successfully

---

## Step 1 — Resend dashboard check

Open the SuHuella Resend dashboard.

Confirm:

- [ ] `suhuella.com` is verified
- [ ] Dashboard SPF matches public DNS
- [ ] Dashboard DKIM matches public DNS
- [ ] No unrelated domain is used
- [ ] No unrelated account is used
- [ ] The account is SuHuella-only

Do not invent DNS values. Do not modify DNS unless the Resend dashboard shows a mismatch.

---

## Step 2 — Confirm durable grant

Confirm a durable grant exists in production `LICENSE_DB` for the controlled operator inbox.

Rules:

- no Stripe
- no checkout
- no `LICENSE_GRANTS`
- no customer email without permission
- inbox may be external
- external inbox domain is only the destination
- external inbox domain is not SuHuella authority

Correct wording:

```text
Controlled test inbox = operator-controlled address
```

Never write:

```text
grant domain = external domain
```

---

## Step 3 — Request OTP

Run:

```bash
RESEND_OTP_PROOF_EMAIL=you@example.com npm run test:resend-otp-proof --prefix site
```

Expected:

```text
STATUS=REQUESTED
```

This is not enough to close the track.

If it fails:

- classify root cause
- do not bypass eligibility
- do not weaken rate limits
- do not use dev fallback

---

## Step 4 — Inbox check

Open the controlled inbox manually.

Check Inbox, Spam, Promotions, Updates, and quarantine if relevant.

Required email identity:

```text
From:     SuHuella <licenses@suhuella.com>
Reply-To: support@suhuella.com
Subject:  Your SuHuella verification code
```

Body must include:

- OTP code
- 10-minute expiry
- support reply instruction

Body must NOT include:

- checkout copy
- installer copy
- sales copy
- noreply language
- unrelated project
- unrelated brand
- external domain as authority

If no email is received: status remains **PREPARED · LIVE SEND MANUAL**. Do not close.

---

## Step 5 — Verify received code

Run:

```bash
RESEND_OTP_PROOF_EMAIL=you@example.com RESEND_OTP_PROOF_CODE=123456 npm run test:resend-otp-proof --prefix site
```

Expected:

```text
STATUS=VERIFIED
```

Do not commit the code. Do not paste the code into reports. Do not paste the full private email address unless explicitly allowed.

Record only:

- controlled inbox domain or provider
- received yes/no
- verified yes/no
- timestamp
- Worker version

---

## Step 6 — Post-verify tests

After successful verification, run:

```bash
npm run test:resend-dns -- --require --prefix site
npm run test:email --prefix site
npm run test:otp-production --prefix site
npm run test:license --prefix site
npm run test:service-health --prefix site
npm run build --prefix site
```

Do not run checkout unless touched. Do not touch checkout.

---

## Step 7 — Update reports

**Only if `STATUS=VERIFIED`:**

Update:

- [RESEND-PRODUCTION-001.md](RESEND-PRODUCTION-001.md)
- [PRE-RC-TRACKS-001.md](PRE-RC-TRACKS-001.md)

Set:

```text
RESEND-PRODUCTION-001 — CLOSED · OTP PRODUCTION PROVEN
```

Record:

- Resend dashboard verified: yes
- DNS require check: pass
- Worker secret present: yes
- Durable grant existed: yes
- Real inbox received OTP: yes
- OTP verified: yes
- Worker version
- tests run

Do not include:

- API key
- OTP code
- full private email address
- unrelated domains as authority

---

## Out of scope

Do NOT:

- edit code
- enable paid checkout
- configure Stripe
- edit checkout
- edit pricing
- edit Desktop distribution
- edit version authority
- change license model
- open Multibrand
- open BYOK
- open Connections
- open Automations
- run PRODUCTION-READINESS-001
- run COMBINED-PRE-RC-SMOKE-001
- tag rc1

---

## Definition of done

Close only when:

- Resend dashboard confirms `suhuella.com` verified
- DNS require check passes
- durable grant exists for controlled inbox
- real inbox receives OTP
- From is `SuHuella <licenses@suhuella.com>`
- Reply-To is `support@suhuella.com`
- subject is `Your SuHuella verification code`
- received code verifies successfully
- `test:resend-otp-proof` prints `STATUS=VERIFIED`
- reports are updated
- no code, checkout, Stripe, Desktop, Multibrand, BYOK, Connections, Automations, or architecture was touched

Expected closing status:

```text
RESEND-PRODUCTION-001 — CLOSED · OTP PRODUCTION PROVEN
```

---

## After this

Only after OTP is verified, open **COMBINED-PRE-RC-SMOKE-001**.

That smoke does not implement anything. It confirms Checkout, Version, Desktop-out, Resend, and the browser entry remain compatible before **FIRST-RUN-EXPERIENCE-001**.
