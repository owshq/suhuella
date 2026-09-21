# COMBINED-PRE-RC-SMOKE-001

```text
STATUS = CLOSED · PASS
TYPE = Compatibility smoke
SCOPE = SUHUELLA ONLY
DATE = 2026-09-19 (post-deploy rerun)
PRODUCTION = https://suhuella.com
WORKER = 688364c5-7834-4b5c-9069-27c7ddc17026
```

Fix slices before this rerun: **APP-MODAL-SHELL-001** (replaces **DOWNLOAD-PAGE-SEMANTICS-001**), deployed in **APP-MODAL-SHELL-PRODUCTION-DEPLOY-001**. No checkout enablement, Stripe selling, Resend, or license model changes.

Previous run (2026-09-19, Worker `77f0b96c`) closed **BLOCKED** on `/download` post-purchase copy and `verify-session` 500. Deploy closed **PASS**; this rerun confirms blockers resolved on production.

---

## Precondition

All required tracks were closed before this run:

| Precondition | State |
| --- | --- |
| `CHECKOUT-PRODUCTION-ENABLEMENT-001` | CLOSED · READY FOR STRIPE |
| `PUBLIC_CHECKOUT_ENABLED` | NO |
| `RESEND-PRODUCTION-001` | CLOSED · OTP PRODUCTION PROVEN |
| `RESEND-LIVE-INBOX-VERIFY-001` | CLOSED · PASS |
| `VERSION-CONSISTENCY-001` | CLOSED · PASS WITH FIXES |
| `DESKTOP-RELEASE-DISTRIBUTION-001` | CLOSED · PASS · STRATEGY B |
| `LICENSE-PAID-GRANT-DURABILITY-001` | CLOSED · PASS |
| `APP-MODAL-SHELL-001` | CLOSED · PASS |
| `APP-MODAL-SHELL-PRODUCTION-DEPLOY-001` | CLOSED · PASS |
| `RESEND-LIVE-OTP-PROOF-001` | CLOSED · PASS |
| Desktop not public in RC | yes |
| Browser `/home` public entry | yes |

---

## Verdict

```text
COMBINED-PRE-RC-SMOKE-001 — CLOSED · PASS
```

**Next:** [FIRST-IMPRESSION-TEST-001.md](tracks/archive/FIRST-IMPRESSION-TEST-001.md) may open (3 sessions).

---

## Section results

### 1. Public entry — PASS

Production landing (`/`):

- Primary CTA → `/home` (`Abrir SuHuella`)
- Secondary → `/license` (`Ver planes`)
- Badge `v0.1.0-pre-rc`
- Copy: browser now, desktop later, local-first
- No Mac/Windows installer buttons as primary CTA
- No public Download CTA as primary promise

`DESKTOP_IN_RC = NO`

### 2. Download page — PASS

Production `GET /download`:

- HTTP **200** · app shell + downloads overlay
- No post-purchase copy (“Confirmando tu pago”, “Gracias por tu compra…”)
- Downloads catalog in route-backed overlay (Web available, Desktop unavailable pre-RC)
- No `?modal=` query UX

`npm run verify:production` — **PASS**

### 3. Routes — PASS

| Route | Production | Expected |
| --- | --- | --- |
| `/` | 200 · app shell + landing overlay | 200 |
| `/license` | 200 · app shell + plans overlay | 200 |
| `/home` | 200 · app only | 200 |
| `/search` | 200 | 200 |
| `/sources` | 200 | 200 |
| `/organise` | 200 | 200 |
| `/activity` | 200 | 200 |
| `/settings` | 200 | 200 |
| `/download` | 200 · app shell + downloads overlay | 200 |
| `/app` | 308 → `/home` | 308 → `/home` |
| `/checkout/lifetime` | 302 → unavailable plans | unavailable |
| `/checkout/monthly` | 302 → unavailable plans | unavailable |
| `/checkout/business` | 302 → `mailto:sales@suhuella.com` | Contact Sales |

API POST sanity:

- `/api/license/email-code/request` → 400 JSON (not HTML fallback)
- `/api/license/email-code/verify` → 400 JSON (not HTML fallback)

### 4. Release / version — PASS

`GET /api/release`:

```json
{
  "version": "0.1.0-pre-rc",
  "minimumVersion": "0.1.0-pre-rc",
  "channel": "stable",
  "mandatory": false
}
```

- No installer URLs in release payload
- Landing badge: `v0.1.0-pre-rc`

### 5. Checkout — PASS

Production checkout paths behave as ready-but-off:

- Lifetime / Monthly redirect to unavailable license state
- Business → `mailto:sales@suhuella.com`
- Plans modal framing; no Stripe test links in public fetch

`GET /api/verify-session?session_id=cs_test_forged`

```json
{ "ok": false, "error": "invalid_session" }
```

HTTP **400**. No entitlement granted.

`GET /api/verify-session?session_id=fake` → **400 `invalid_session`**

```text
READY_FOR_STRIPE = YES
PUBLIC_CHECKOUT_ENABLED = NO
SELLING = NO
```

### 6. Resend — PASS

Documentation state unchanged and proven on record. Tests:

- `npm run test:resend-dns -- --require` → **PASS**
- `npm run test:otp-production` → **PASS**

No new OTP requested in this smoke rerun.

### 7. License durability — PASS

- `npm run test:grant-durability` → **PASS**
- `npm run test:license` → **PASS**

### 8. Browser app entry — PASS (HTTP smoke)

Production app routes return **200** for Home, Sources, Search, Organise, Activity, Settings shells. Route-backed overlays (`/`, `/license`, `/download`) return **200** with app shell. No `?modal=` URLs.

### 9. Local-first copy — PASS

Landing and plans modal emphasize local/browser use and desktop later. No production selling or upload-as-product promise on landing fetch.

### 10. Product promises — PASS

Landing and download journey align with Strategy B. `/download` no longer implies post-purchase install flow.

---

## Tests run (post-deploy rerun)

| Test | Result |
| --- | --- |
| `npm run verify:production` | **PASS** |
| `npm run check:app-host` | **PASS** |
| `npm run test:service-health` | **PASS** |
| `npm run test:license` | **PASS** |
| `npm run test:grant-durability` | **PASS** |
| `npm run test:email` | **PASS** |
| `npm run test:otp-production` | **PASS** |
| `npm run test:resend-dns -- --require` | **PASS** |
| `npm run test:app-modal-shell` | **PASS** |
| `npm run test:checkout` | **PASS** |
| `npm run build` | **PASS** |

---

## Previous blockers (resolved)

1. **`/download` post-purchase semantics** — fixed by **APP-MODAL-SHELL-001** (route-backed downloads overlay, no payment-gated copy).
2. **`verify-session` forged id returned 500** — fixed by error classification in `checkoutVerificationAllowed` + route handler (now **400 `invalid_session`**).

**DOWNLOAD-PAGE-SEMANTICS-001** was not opened; superseded by **APP-MODAL-SHELL-001**.

---

## Next action

Open **FIRST-IMPRESSION-TEST-001** (sessions: [first-impression/](first-impression/), summary: [FIRST-IMPRESSION-SUMMARY-001.md](tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md)). Do **not** open **PRIVATE-BETA-001** until summary PASS and product freeze.
