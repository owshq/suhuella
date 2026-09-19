# RESEND-PRODUCTION-001

```text
STATUS = CLOSED · OTP PRODUCTION PROVEN
TYPE = Pre-RC production email proof
SCOPE = SUHUELLA ONLY
LIVE_OTP = PROVEN
```

SuHuella only. No other project, brand, or company is part of this track.

Production OTP delivery is proven. A real controlled inbox received a SuHuella OTP from `licenses@suhuella.com`, and the received code verified successfully on production.

```text
From:                  SuHuella <licenses@suhuella.com>
Reply-To:              support@suhuella.com
Sending domain:        suhuella.com
Resend domain:         suhuella.com
Brand scope:           SuHuella only
Grant authority:       LICENSE_DB
Controlled test inbox: operator-controlled address (external mailbox allowed)
No noreply.
```

An external inbox is only the destination of the proof. It is not the grant domain, not the Resend domain, not DNS authority, and not SuHuella brand identity.

---

## Live OTP proof — CLOSED

Closed by [RESEND-LIVE-OTP-PROOF-001.md](RESEND-LIVE-OTP-PROOF-001.md) on 2026-09-19 (see also [RESEND-LIVE-INBOX-VERIFY-001.md](RESEND-LIVE-INBOX-VERIFY-001.md)).

| Checkpoint | Result |
| --- | --- |
| Durable grant | **Yes.** Gift / `personal_lifetime` / active in `LICENSE_DB`. No Stripe. No `LICENSE_GRANTS`. |
| Controlled test inbox | **Yes.** Provider `gmail.com`. External inbox only; sending domain stays `suhuella.com`. |
| Production OTP request | **Yes.** `request_status=200`. |
| Real inbox received | **Yes.** |
| From | **Yes.** `SuHuella <licenses@suhuella.com>` |
| Reply-To | **Yes.** `support@suhuella.com` (in body) |
| Subject | **Yes.** `Your SuHuella verification code` |
| Body | OTP present, 10-minute expiry, support reply instruction. No checkout, installer, sales, or noreply language. |
| OTP verified | **Yes.** Production verify returned `ok: true`. Challenge consumed `2026-09-19T02:27:14Z`. Proof `vep_8c04c0d3-683a-4fd8-91ed-44f5332668ca`. |
| `STATUS=VERIFIED` | **Yes.** |

Do not record the OTP code or full private email address in this report.

---

## Resend domain state

The stored key is **send-only**. `GET /domains` returns restricted-key and cannot read dashboard verification programmatically.

Live production delivery from `licenses@suhuella.com` confirms the send path works. Operator should still confirm in the SuHuella Resend dashboard that published SPF/DKIM match public DNS.

---

## Current DNS state

Public inspect 2026-09-19.

| Name | Result |
| --- | --- |
| Apex SPF (`TXT suhuella.com`) | Missing |
| `send.suhuella.com` SPF | Present (one `v=spf1`) |
| DKIM `resend._domainkey.suhuella.com` | Present (`p=` / RFC default v=DKIM1) |
| DMARC (`_dmarc.suhuella.com`) | Present |
| `send.suhuella.com` MX | `feedback.forge.rmta.net` |

`npm run test:resend-dns -- --require` → **PASS**.

---

## Worker secret state

| Item | State |
| --- | --- |
| `RESEND_API_KEY` | Present as Worker secret. Not in git. Not in `wrangler.jsonc` |
| `RESEND_FROM` | `SuHuella <licenses@suhuella.com>` in Worker vars |
| Production without key | Fail closed |
| Dev without key | Console fallback only |

Worker version at close: `dabfa9aa-545f-40bb-80a9-ebcc8bbb46da`.

---

## Rate limit / retry

Unchanged:

- 3 sends / email / 15 minutes
- 6 sends / IP / 15 minutes
- Events in `LICENSE_DB` (D1)
- One retry on Resend 429 / 5xx / network

OTP requires a durable grant. Production ignores `LICENSE_GRANTS`.

---

## Tests run

2026-09-19 close pass:

- `npm run test:resend-dns -- --require` → **PASS**
- `npm run test:email` → **PASS**
- `npm run test:otp-production` → **PASS**
- `npm run test:license` → **PASS**
- `npm run test:service-health` → **PASS**
- `npm run build` → **PASS**

Checkout was not run and not changed.

---

## Manual operator checkpoint

- [x] SuHuella-only scope
- [x] Live send from `licenses@suhuella.com` proven
- [x] Public send SPF present
- [x] Public DKIM `resend` selector present
- [x] DMARC present
- [x] `RESEND_API_KEY` stored as Worker secret
- [x] DNS check PASS / `--require` PASS
- [x] Gift grant in `LICENSE_DB` for controlled operator inbox
- [x] OTP received in a real inbox
- [x] Received OTP verifies (`STATUS=VERIFIED`)
- [ ] Resend dashboard SPF/DKIM values confirmed at login (send-only key cannot API-check)

---

## Remaining limitations

- Resend dashboard domain list is not available with the send-only API key. Live delivery is the production proof; dashboard record match remains a login-time sanity check.
- Apex SPF is still empty. If the Resend dashboard requires an apex SPF, copy it exactly and keep a single `v=spf1` TXT.
- `test:resend-otp-proof` re-requests OTP when verifying with `RESEND_OTP_PROOF_CODE`. For verify-after-read, call `/api/license/email-code/verify` with the original `challengeId`.

## Regression risk

Low. No checkout, Stripe, Desktop, BrandConfig architecture, or license-model change in this close.

---

## Impact on PRE-RC-TRACKS-001

Track 2 is **CLOSED · OTP PRODUCTION PROVEN**.

Next: **[COMBINED-PRE-RC-SMOKE-001.md](COMBINED-PRE-RC-SMOKE-001.md)** (compatibility only), then **FIRST-RUN-EXPERIENCE-001**.

PRODUCTION-READINESS-001 stays deferred. Do not tag `0.1.0-rc1`.
