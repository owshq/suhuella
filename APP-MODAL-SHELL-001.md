# APP-MODAL-SHELL-001

```text
STATUS = CLOSED · PASS
TYPE = UX consolidation fix (correction)
SCOPE = SuHuella Web only
DATE = 2026-09-19
```

## Objective

Consolidate the public SuHuella Web experience around `/home`. Landing, plans, downloads, and post-checkout states appear as dismissible overlays inside the browser app shell — using **clean routes**, not query-string modals.

```text
/home = main app entry (no overlay by default)
/ = app shell + existing landing content as overlay
/license = app shell + existing plans content as overlay
/download = app shell + existing downloads content as overlay
/license/success (or /success) = app shell + existing success content as overlay
Closing any overlay navigates to /home
```

## Route map

| Route | Behaviour |
| --- | --- |
| `/home` | Browser app only · no overlay |
| `/` | App shell + `LandingContent` overlay |
| `/license` | App shell + `LicensePlansPage` overlay · checkout off |
| `/download` | App shell + `DownloadCatalogContent` overlay · Web available · Desktop unavailable pre-RC |
| `/license/success` | App shell + `SuccessContent` overlay · verify session when present |
| `/success`, `/descarga-exitosa` | Redirect → `/license/success` (query preserved) |
| `/app` | 308 → `/home` |
| `/privacy`, `/terms` | unchanged |

**Not used:** `/home?modal=…` query-string modal UX.

## Content reuse

Overlays reuse existing route components — no invented welcome popup or new marketing copy.

| Overlay | Component |
| --- | --- |
| Landing | `LandingContent` (embedded) |
| Plans | `LicensePlansPage` (embedded) |
| Downloads | `DownloadCatalogContent` (embedded) |
| Success | `SuccessContent` (embedded) |

Escape closes overlay. Close button returns to `/home`.

Browser sidebar download button navigates to `/download`.

## Combined smoke blockers fixed

From **COMBINED-PRE-RC-SMOKE-001**:

1. **`/download`** — public downloads catalog, not post-payment. No payment-gated copy. Desktop unavailable pre-RC when installer URLs are absent.
2. **`GET /api/verify-session?session_id=cs_test_forged`** — returns **400 `invalid_session`** when `STRIPE_SECRET_KEY` is absent (not **500 `server_error`**). No grant created. Checkout remains off.

## Frozen (unchanged)

License model, checkout enablement switch, Stripe secrets, Resend, Desktop distribution (Strategy B), `/api/release` truthfulness, activation rules, pricing.

## Tests

- `npm run test:app-modal-shell --prefix site`
- `npm run test:download-page --prefix site`
- `npm run test:checkout --prefix site` (verify-session classification)
- `npm run build --prefix site`
- `npm run check:app-host --prefix site`
- `npm run test:license --prefix site`
- `npm run test:service-health --prefix site`
- `npm run verify:production --prefix site` (after deploy)

## Meaning

```text
/home is the browser app entry.
Public pages are route-backed overlays inside the app shell.
/download means downloads catalog, not post-payment gate.
/license means plans overlay, not separate checkout site.
Desktop remains out of RC.
Checkout remains off.
```
