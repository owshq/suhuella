# RESEND-LIVE-OTP-PROOF-001

```text
STATUS = CLOSED · PASS
TYPE = Operator production proof
SCOPE = SUHUELLA ONLY
CURSOR = NO (reports only, after operator proof)
CLOSED = 2026-09-19
```

**Not a code implementation track. Not checkout. Not combined smoke.**

Moves [RESEND-PRODUCTION-001.md](RESEND-PRODUCTION-001.md) from **PREPARED · LIVE SEND MANUAL** to **CLOSED · OTP PRODUCTION PROVEN**.

Supersedes the operator checklist in [RESEND-LIVE-INBOX-VERIFY-001.md](RESEND-LIVE-INBOX-VERIFY-001.md) (same proof, canonical name).

---

## Objective

Prove that SuHuella can send a production OTP to a real inbox and that the received code verifies successfully.

---

## Current state (2026-09-19)

| Track | Status |
| --- | --- |
| `CHECKOUT-PRODUCTION-ENABLEMENT-001` | CLOSED · READY FOR STRIPE · `PUBLIC_CHECKOUT_ENABLED = NO` |
| `VERSION-CONSISTENCY-001` | CLOSED · PASS WITH FIXES · `0.1.0-pre-rc` |
| `RESEND-PRODUCTION-001` | **CLOSED · OTP PRODUCTION PROVEN** |

Proof record (no secrets):

- Resend dashboard verified: **yes**
- DNS require check: **pass**
- Worker secret present: **yes**
- Durable grant existed: **yes**
- Real inbox received OTP: **yes** (controlled provider: `gmail.com`)
- OTP verified: **yes** (`2026-09-19T02:27:14Z`)
- Worker version: `dabfa9aa-545f-40bb-80a9-ebcc8bbb46da`
- From / Reply-To / subject / body: **correct**
- OTP code and full private email: **not recorded**

---

## Rule

HTTP 200 is not proof.

Resend accepted is not proof.

DNS PASS alone is not proof.

The track closes only when:

1. `suhuella.com` is verified in the SuHuella Resend dashboard
2. SPF / DKIM / DMARC are publicly visible and match the dashboard
3. `RESEND_API_KEY` is present as a Worker secret
4. A durable gift / manual / test grant exists for a controlled inbox
5. The real inbox receives the OTP email
6. The received OTP code verifies successfully
7. `test:resend-otp-proof` prints `STATUS=VERIFIED`

---

## Authority

| Field | Value |
| --- | --- |
| Sending domain | `suhuella.com` |
| Resend domain | `suhuella.com` |
| From | `SuHuella <licenses@suhuella.com>` |
| Reply-To | `support@suhuella.com` |
| Grant authority | `LICENSE_DB` |
| Controlled test inbox | operator-controlled address |

An external inbox is only the destination of the proof. It is not the Resend domain, grant domain, or SuHuella authority.

---

## Operator runbook

### Step 1 — Resend dashboard

Open the **SuHuella-only** Resend account. Add or inspect `suhuella.com`. Copy **exact** DNS records from the dashboard. Do not invent values. Do not reuse another project or account. Cloudflare CNAMEs from Resend must be DNS-only.

### Step 2 — DNS

Publish records. Then:

```bash
npm run test:resend-dns -- --require --prefix site
```

Expected: **PASS**. If FAIL: fix DNS per dashboard only. Do not change code. Do not weaken the checker unless objectively wrong.

### Step 3 — Worker secret

```bash
cd site
npx wrangler secret put RESEND_API_KEY
```

Do not commit the key. Do not write it in `wrangler.jsonc` or reports.

### Step 4 — Durable grant

Use Operations to create a gift / manual / test grant for a controlled inbox. No Stripe. No checkout. No `LICENSE_GRANTS`. Grant must exist in production `LICENSE_DB`.

### Step 5 — Request OTP

```bash
RESEND_OTP_PROOF_EMAIL=you@example.com npm run test:resend-otp-proof --prefix site
```

Expected: `STATUS=REQUESTED`. Not sufficient to close alone.

### Step 6 — Inbox check

Confirm manually: Inbox, Spam, Promotions, Updates.

Required identity:

- From: `SuHuella <licenses@suhuella.com>`
- Reply-To: `support@suhuella.com`
- Subject: `Your SuHuella verification code`
- Body: OTP code, 10-minute expiry, support reply instruction
- Body must not include: checkout, installer, sales, noreply, unrelated brand

If no email arrives: `RESEND-PRODUCTION-001` stays **PREPARED · LIVE SEND MANUAL**. Do not run combined smoke.

### Step 7 — Verify code

```bash
RESEND_OTP_PROOF_EMAIL=you@example.com RESEND_OTP_PROOF_CODE=123456 npm run test:resend-otp-proof --prefix site
```

Expected: `STATUS=VERIFIED`. Do not commit or paste the real code.

### Step 8 — Post-verify tests

After `STATUS=VERIFIED`:

```bash
npm run test:resend-dns -- --require --prefix site
npm run test:email --prefix site
npm run test:otp-production --prefix site
npm run test:license --prefix site
npm run test:service-health --prefix site
npm run build --prefix site
```

Do not run checkout unless checkout was touched.

### Step 9 — Update reports

Only after `STATUS=VERIFIED`, update:

- `RESEND-PRODUCTION-001.md`
- `PRE-RC-TRACKS-001.md`
- `README.md` (if Resend status is listed)

Set: **RESEND-PRODUCTION-001 — CLOSED · OTP PRODUCTION PROVEN**

---

## Out of scope

Do **not**: enable paid checkout, configure Stripe, edit checkout/pricing, Desktop distribution, version authority, license model, Multibrand, BYOK, Connections, Automations, `COMBINED-PRE-RC-SMOKE-001`, `FIRST-RUN-EXPERIENCE-001`, `PRODUCTION-READINESS-001`, or tag rc1.

---

## Definition of Done

All seven close criteria met. Reports updated. No checkout, Stripe, Desktop, or architecture touched.

---

## Next after close

```text
RESEND-LIVE-OTP-PROOF-001   CLOSED · PASS
        ↓
COMBINED-PRE-RC-SMOKE-001   (compatibility only; one coordinated gate)
        ↓
FIRST-RUN-EXPERIENCE-001    (WAIT until combined smoke PASS)
```

Do **not** open combined smoke while Resend remains **PREPARED · LIVE SEND MANUAL**.
