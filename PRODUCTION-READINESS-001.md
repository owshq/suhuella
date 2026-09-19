# PRODUCTION-READINESS-001

```text
STATUS = BLOCKED
RELEASE_VERDICT = NOT READY FOR RC
TYPE = Release Candidate Production Gate
RERUN_AFTER = LICENSE-PAID-GRANT-DURABILITY-001 — CLOSED · PASS
```

This gate decides whether SuHuella can be called **RC1**. It does not change architecture, product model, Multibrand, BYOK, Connections, or Automations.

```text
P0_BLOCKERS = 2
P1_POST_LAUNCH = 4
ACCEPTED_LIMITATIONS = 10
HIGHEST_RISK_REMAINING_ITEM = Advertised Desktop download with empty installer URLs
NEXT_RECOMMENDED_ACTION = RC-DOWNLOAD-JOURNEY-001
```

---

## Verdict

**NOT READY FOR RC.**

A real user can open the website and the browser app. They cannot install the advertised Desktop product. The live Worker is still the 2026-09-18 build, so production has not taken the paid-grant durability code. Those two facts are enough to refuse rc1.

```text
READY FOR RC = NO
```

---

## Preconditions

| Check | Result |
| --- | --- |
| `0004_license_grant.sql` applied remotely | **PASS** — applied during this gate |
| `LICENSE_DB` bound | **PASS** — remote `suhuella-license` (`a4c8e624-977f-4498-b6c0-7024f3ed5672`) |
| `license_grant` table present | **PASS** — 0 rows |
| Activation / OTP / proof / attempt tables present | **PASS** |
| Worker deployed after or with `0004` | **FAIL** — latest production deploy 2026-09-18; durability code is local, not live |
| Production process-memory paid authority absent | **NOT VERIFIED LIVE** — live Worker predates the durability close |

`D1_MIGRATIONS` = **PASS** (no longer UNKNOWN).

Remote D1 counts at gate time: grants 0 · activations 0 · attempts 0 · proofs 0. There is no durable paid customer to re-issue.

This gate did **not** deploy the Worker. Deploying a dirty tree is not a classification step. The next production deploy must include the closed durability code now that `0004` exists.

---

## Paid grant durability (code vs live)

Local / test authority after LICENSE-PAID-GRANT-DURABILITY-001:

```text
PAID_ENTITLEMENT_DURABILITY = PASS
PROCESS_MEMORY_PAID_ENTITLEMENT_AUTHORITY = ABSENT
STRIPE_CUSTOMER_FALLBACK_INVENTS_LIFETIME = NO
CHECK_LICENSE_USES_DURABLE_GRANT = PASS
```

Production live Worker (2026-09-18):

```text
PAID_ENTITLEMENT_DURABILITY = NOT DEPLOYED
```

`lookupStripeGrant` is gone in current source. `LICENSE_GRANTS` is ignored in production. `checkLicense` reads durable grants only. Checkout fulfillment upserts D1. That is the local close. It is not the live close until deploy.

---

## Section results

### 1. Production routes — PASS

`https://suhuella.com`

| Route | Result |
| --- | --- |
| `/` `/license` `/home` `/search` `/sources` `/organise` `/activity` `/settings` | 200 |
| `/app` | 308 → `/home` |
| PWA `start_url` | `/home` |
| User-facing `/app` links | none found on landing |

### 2. Public landing — PASS WITH GAPS

Landing explains the product: folder suggestion at save, local, user stays in control. CTA pair is **Descargar SuHuella** + **Ver planes** + **Open SuHuella** (browser).

No test Stripe URLs. No `/app` product links. No Sync product promise in visible copy (HTML “Sync” hits are runtime/library noise). Privacy line is local: documents stay on the computer. BYOK is not promised.

Gaps: primary CTA is Download while installers are unavailable; “Compra única / el importe se muestra antes de pagar” while paid checkout is unavailable.

### 3. Download journey — FAIL · **P0**

```json
{"ok":true,"release":{"version":"0.1.0","channel":"stable","minimumVersion":"0.1.0","mandatory":false,"windows":"","mac":""}}
```

- Windows / Mac buttons are visible and marked “Aún no disponible”
- Hero still says **Descargar SuHuella**
- FAQ tells the user what to do after installing
- Local `release.json` / packages are `0.1.0-pre-rc`; live `/api/release` is `0.1.0`

Desktop is part of this RC. Empty installer URLs behind a visible Download CTA is a P0.

`DOWNLOAD_JOURNEY = FAIL`  
`VERSION_CONSISTENCY = FAIL`

### 4. Clean first run — NOT EXECUTED

| Host | Result |
| --- | --- |
| Browser interactive (clean profile, Connect, index, six screens) | **NOT EXECUTED** — no browser automation in this session |
| Desktop clean install / clean app data | **NOT EXECUTED** |

HTTP 200 on app shells is not a first-run. This is not hidden as PASS.

### 5–11. Product screens / host parity — CODE REGRESSION ONLY

Organise remains CLOSED · PROVEN in source. Home asks what SuHuella knows. Browser Sources use **Connect**; Desktop uses **Add**. Settings uses **License**.

Interactive production click-through of Sources / Home / Search / Organise / Activity / Settings was not executed. Do not treat as PASS.

### 12. License / paid grants — CODE PASS · LIVE NOT DEPLOYED

See Preconditions. Tests prove isolate-loss durability locally. Live Worker does not run that code. Remote `license_grant` is empty and unused by the live Worker.

Forged `session_id=fake` and `cs_test_forged` → `400 invalid_session`. Empty activate/check → `400 invalid_request`. Unbound-attempt fail-closed still passes in tests.

### 13. Stripe / checkout — INTENTIONALLY_PARTIAL · PASS for that intent

| Path | Live |
| --- | --- |
| `/checkout/lifetime` | 302 → `/license?checkout=unavailable&plan=lifetime` |
| `/checkout/monthly` | 302 → `/license?checkout=unavailable&plan=monthly` |
| `/checkout/business` | 302 → `mailto:sales@suhuella.com` |
| `/api/verify-session?session_id=fake` | 400, no entitlement |
| Test Stripe Payment Links | absent from `wrangler.jsonc` and landing HTML |

Paid checkout is not enabled. That is accepted only if landing does not sell it as live. Current landing still talks as if purchase is available.

### 14. Email / OTP / Resend — STRUCTURAL PASS · DELIVERY NOT VERIFIED

OTP request/verify reject empty bodies with 400. Tests cover rate-limit / replay / missing transport fail-closed. `test:email` uses the **dev console fallback**, not production Resend.

`RESEND_PRODUCTION` delivery was **not** verified. Not a P0 while paid checkout is unavailable and first-run does not require email. Do not mark PASS.

### 15. D1 / migrations — PASS

Remote migrations applied. `0004_license_grant.sql` present. Existing activation / OTP / proof / attempt tables preserved.

### 16. Version consistency — FAIL · P1

| Surface | Version |
| --- | --- |
| `site/package.json` | `0.1.0-pre-rc` |
| `desktop/package.json` | `0.1.0-pre-rc` |
| `site/release.json` / brand release | `0.1.0-pre-rc` |
| Production `/api/release` | `0.1.0` |
| Production landing badge | `v0.1.0` |
| Browser host `license.ts` | `0.1.0-web` |
| Browser install-browser-host | `0.1.0` |
| Docs / RC label | `0.1.0-pre-rc` |

### 17. Error states — PARTIAL

Unavailable checkout explains. Missing installers show “Aún no disponible”. Forged session fails closed. Interactive missing-folder / permission-lost / offline-license / export / open-reveal were not executed.

### 18. Security / privacy — PASS WITH GAPS

No client-side paid authority in current source. Forged success does not grant. No production test Stripe links. PWA copy (“Documents never leave this computer”) matches the current no-BYOK product. Token tamper tests remain in the license suite.

Gap: live Worker is not the durability build.

---

## P0 blockers (2)

1. **Advertised Desktop download has no installers.** `/api/release` returns empty `windows` / `mac`. Landing primary CTA is Download. Desktop is part of RC.
2. **Durability Worker is not in production.** `0004` is applied. The 2026-09-18 Worker does not write or read `license_grant`. Live paid-grant authority is not the closed model.

## P1 post-launch (4)

1. Version drift (`0.1.0` vs `0.1.0-pre-rc` vs `0.1.0-web`).
2. Production Resend delivery not verified.
3. Landing still sells “compra única” while checkout is unavailable.
4. Windows / Edge / Desktop clean-install not verified.

## Accepted limitations (10)

1. Business automated checkout not launched — Contact Sales.
2. Business branding not launched.
3. Lifetime generations not implemented.
4. Multibrand not launched.
5. Partner / Stripe Connect not launched.
6. BYOK not product-promised.
7. Connections not launched.
8. Automations not launched.
9. Historical memory/env grants cannot be reconstructed — remote D1 has 0 grants, so nothing to re-issue from D1.
10. Paid Stripe checkout remains intentionally unavailable (lifetime / monthly). Must not stay contradicted by a live “buy now” story.

---

## Tests

Environment: macOS darwin 25.2.0 · local repo `74024bc` (2026-09-18) plus uncommitted durability work · production `https://suhuella.com` · Worker deploy 2026-09-18.

Site:

| Command | Result |
| --- | --- |
| `npm run test:grant-durability` | PASS |
| `npm run test:license` | PASS |
| `npm run test:otp-production` | PASS |
| `npm run test:email` | PASS (dev fallback, not live Resend) |
| `npm run test:admin` | PASS |
| `npm run test:service-health` | PASS |
| `npm run check:business-license` | PASS |
| `npm run check:app-host` | PASS |
| `npm run verify:production` | PASS |
| `npm run build` | PASS |

Desktop:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run check:knowledge-set` | PASS |
| `npm run test:license` | PASS |
| `npm run build` | PASS |

No narrow production-wiring fix was applied during this rerun except the remote D1 migration `0004`, which was a stated precondition.

---

## Production smoke

| Check | Result |
| --- | --- |
| Route script | PASS |
| Landing HTML | PASS WITH GAPS |
| `/api/release` | FAIL — empty installers, version `0.1.0` |
| Checkout lifetime / monthly | PASS — unavailable |
| Checkout business | PASS — mailto sales |
| Forged verify-session | PASS — no entitlement |
| Interactive six-screen click-through | NOT EXECUTED |
| Desktop launch | NOT EXECUTED |

---

## Highest risk remaining item

Advertised Desktop download with empty installer URLs.

A first visitor is told to download SuHuella. There is nothing to download. That is the user-facing break. The undeployed durability Worker is the authority break. They must ship in the **same** production train.

---

## Next recommended action

Open only:

```text
RC-DOWNLOAD-JOURNEY-001
```

One job: make the advertised download path true, or stop advertising it.

Required in that same deploy:

- real macOS URL if Mac download is shown
- real Windows URL if Windows download is shown
- `/api/release` version matches the build
- durability Worker from LICENSE-PAID-GRANT-DURABILITY-001 (table already exists)
- no new product domain

Then rerun this gate. Do not tag `0.1.0-rc1` from this report.

```text
PRODUCTION-READINESS-001 — BLOCKED
RELEASE_VERDICT = NOT READY FOR RC
NEXT_RECOMMENDED_ACTION = RC-DOWNLOAD-JOURNEY-001
```
