# APP-MODAL-SHELL-PRODUCTION-DEPLOY-001

```text
STATUS = CLOSED · PASS
TYPE = Production deploy + verification
SCOPE = SuHuella Web only (deploy/verify — no new behaviour)
DATE = 2026-09-19
PRODUCTION = https://suhuella.com
```

## Objective

Deploy **APP-MODAL-SHELL-001** fixes to production and verify the combined-smoke blockers are resolved on https://suhuella.com:

1. `/download` must not show post-purchase copy; must show Web available, Desktop not in RC.
2. `GET /api/verify-session?session_id=cs_test_forged` must return **400 `invalid_session`** (not **500**).

## Deploy

| Field | Value |
| --- | --- |
| Command | `npm run deploy --prefix site` |
| Build (pre-deploy) | `npm run build --prefix site` → **PASS** |
| Deploy result | **PASS** |
| Production URL | https://suhuella.com |
| Deploy timestamp (UTC) | 2026-09-19T02:55:55.574Z |

### Worker versions

| Phase | Version ID | Notes |
| --- | --- | --- |
| **BEFORE** | `77f0b96c-39c5-4781-b046-4c58f1e924ac` | Deployed 2026-09-19T02:49:48.862Z; already had modal-shell fixes |
| **AFTER** | `688364c5-7834-4b5c-9069-27c7ddc17026` | Deployed 2026-09-19T02:55:55.574Z; fresh redeploy of current repo |

OpenNext uploaded 8 modified static assets. Worker bindings unchanged (`PAID_CHECKOUT_ENABLED=false`, D1, R2 assets).

## Production route verification

Manual curl + `npm run verify:production --prefix site` after deploy:

| Route | Production | Expected | Result |
| --- | --- | --- | --- |
| `/` | 200 · app shell (`data-suhuella-app`) | app entry | **PASS** |
| `/home` | 200 | 200 | **PASS** |
| `/license` | 200 · app shell | plans modal shell | **PASS** |
| `/download` | 200 · app shell · `overlay=download` | downloads catalog, no post-purchase | **PASS** |
| `/app` | 308 → `/home` | 308 → `/home` | **PASS** |
| `/search` | 200 | 200 | **PASS** |
| `/sources` | 200 | 200 | **PASS** |
| `/organise` | 200 | 200 | **PASS** |
| `/activity` | 200 | 200 | **PASS** |
| `/settings` | 200 | 200 | **PASS** |
| `/checkout/lifetime` | 302 → unavailable plans | unavailable | **PASS** |
| `/checkout/monthly` | 302 → unavailable plans | unavailable | **PASS** |
| `/checkout/business` | 302 → `mailto:sales@suhuella.com` | Contact Sales | **PASS** |
| POST `/api/license/email-code/request` | 400 JSON | 4xx JSON | **PASS** |
| POST `/api/license/email-code/verify` | 400 JSON | 4xx JSON | **PASS** |

### `/download` semantics — PASS

Production `GET /download`:

- HTTP **200** (app shell at canonical URL; no `?modal=` query exposed in HTML)
- Contains `data-suhuella-app="true"` and `overlay="download"`
- Meta: *"Aquí aparecerán las versiones públicas de SuHuella Desktop cuando estén disponibles. Mientras tanto, puedes usar SuHuella Web en este navegador."*
- `desktopDownloadAvailable: false`, empty installer URLs
- **No** forbidden phrases: "Confirmando tu pago", "Gracias por tu compra", "solo después de pagar", etc.

### `/api/verify-session` — PASS

```http
GET /api/verify-session?session_id=cs_test_forged
```

```json
{ "ok": false, "error": "invalid_session" }
```

HTTP **400**. No entitlement granted.

### `/api/release` — PASS

```json
{
  "ok": true,
  "release": {
    "version": "0.1.0-pre-rc",
    "channel": "stable",
    "minimumVersion": "0.1.0-pre-rc",
    "mandatory": false
  }
}
```

No public installer URLs in payload.

## Post-deploy tests

| Test | Result |
| --- | --- |
| `npm run verify:production --prefix site` | **PASS** |
| `npm run check:app-host --prefix site` | **PASS** |
| `npm run test:service-health --prefix site` | **PASS** |
| `npm run test:license --prefix site` | **PASS** |
| `npm run test:grant-durability --prefix site` | **PASS** |
| `npm run test:email --prefix site` | **PASS** |
| `npm run test:otp-production --prefix site` | **PASS** |
| `npm run test:resend-dns -- --require --prefix site` | **PASS** |
| `npm run build --prefix site` | **PASS** |

## Blockers resolved

| Blocker (from combined smoke) | Status |
| --- | --- |
| `/download` post-purchase copy on production | **RESOLVED** |
| `verify-session` forged id returned 500 | **RESOLVED** (now 400 `invalid_session`) |

## Remaining limitations (unchanged)

- `PUBLIC_CHECKOUT_ENABLED = NO` — checkout remains off by design
- `DESKTOP_IN_RC = NO` — no public Desktop installer
- Resend SPF apex still missing (send subdomain OK; documented in DNS check)
- Browser `/home` is the public RC entry; Desktop distribution Strategy B unchanged

## Verdict

```text
APP-MODAL-SHELL-PRODUCTION-DEPLOY-001 — CLOSED · PASS
WORKER = 688364c5-7834-4b5c-9069-27c7ddc17026
```

## Next action

**COMBINED-PRE-RC-SMOKE-001** post-deploy rerun closed **PASS** (2026-09-19). Proceed to **FIRST-RUN-EXPERIENCE-001** (prep: [FIRST-RUN-EXPERIENCE-PREP-001.md](FIRST-RUN-EXPERIENCE-PREP-001.md)).

Do **not** enable checkout, tag rc1, or open new feature tracks from this deploy.
