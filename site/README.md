# SuHuella site

Next.js public site: landing, Stripe checkout return, verified download, privacy, terms. Roadmap and agent rules: [../README.md](../README.md).

## Delivery pipeline

```text
suhuella.com
  → /checkout/{plan}  (only if PAID_CHECKOUT_ENABLED=true AND BrandConfig allows it)
  → Stripe Checkout Session (STRIPE_*_PRICE_ID + STRIPE_SECRET_KEY, server only)
  → success → /license/success or /settings?prefs=license
  → GET /api/verify-session (STRIPE_SECRET_KEY, server only, fail-closed)
  → paid + complete session writes a LICENSE_DB grant
```

Public selling stays **off** until `PAID_CHECKOUT_ENABLED` is exactly `true`. Payment Links are a gated helper, not the production path. See [../CHECKOUT-PRODUCTION-ENABLEMENT-001.md](../CHECKOUT-PRODUCTION-ENABLEMENT-001.md).

Public manifest for the desktop updater (same source):

```text
GET /api/release → release.json
```

| Route | Purpose |
| --- | --- |
| `/home` | SuHuella Home (app entry · no overlay) |
| `/` | App shell + landing overlay (`LandingContent`) |
| `/license` | App shell + plans overlay (`LicensePlansPage`) |
| `/download` | App shell + downloads overlay (`DownloadCatalogContent`) |
| `/license/success?session_id={CHECKOUT_SESSION_ID}` | App shell + success overlay · verify payment when session present |
| `/search` | SuHuella Search |
| `/organise` | SuHuella Organise |
| `/sources` | SuHuella Sources |
| `/activity` | SuHuella Activity |
| `/settings` | SuHuella Settings |
| `/app` | Permanent redirect → `/home` |
| `/checkout/lifetime` | Stripe Checkout Session when selling is on; otherwise unavailable |
| `/checkout/monthly` | Monthly Checkout Session when selling is on; otherwise unavailable |
| `/checkout/business` | Contact sales |
| `/api/release` | Current stable release manifest (`release.json`) |
| `/api/license/activate` | Email + device → signed `LicenseContext` |
| `/api/license/check` | Refresh a signed licence |
| `/api/license/deactivate` | Release this computer |
| `/api/license/organisation` | Business admin organisation view and seat actions (license token) |
| `/api/business/pricing` | Configurable Business price (min 20 seats, €2 / seat) |
| `/api/admin/business` | Existing Business account API (superadmin) |
| `/api/operations/state` | Operations console snapshot |
| `/api/operations/actions` | Auditable Operations mutations (reason required) |
| `/api/business/seats` | Business owner/admin seat management |
| `/privacy`, `/terms` | Legal |
| `ops.suhuella.com/` | OPERATIONS console — Cloudflare Access · superadmin. `/admin` and `/_ops` on suhuella.com redirect here |
| `/success`, `/descarga-exitosa` | Redirect → `/license/success` (query preserved) |

Route-backed overlays (close → `/home`):

| Route | Overlay content |
| --- | --- |
| `/` | Landing |
| `/license` | Plans · checkout off in pre-RC |
| `/download` | Version catalog · Web available · Desktop when installers exist |
| `/license/success` | Post-checkout verification when session present |

Closing any overlay navigates to `/home`. No `?modal=` query UX.

## Environment variables

Use these four delivery variables:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `PAID_CHECKOUT_ENABLED` | Server | Public sales switch. Must be exactly `true` to sell. Missing / any other value stays off |
| `STRIPE_LIFETIME_PAYMENT_LINK` | Public | Gated helper. Unused while selling is off. Prefer Checkout Sessions |
| `STRIPE_MONTHLY_PAYMENT_LINK` | Public | Gated helper. Unused while selling is off. Prefer Checkout Sessions |
| `STRIPE_LIFETIME_PRICE_ID` | Secret | Creates a Checkout Session (`success_url` is a return, not proof) |
| `STRIPE_MONTHLY_PRICE_ID` | Secret | Monthly Checkout Session |
| `STRIPE_BUSINESS_PAYMENT_LINK` | Public | Optional Business checkout |
| `BUSINESS_CONTACT_URL` | Public | Business contact if there is no Business checkout |
| `STRIPE_SECRET_KEY` | Secret | `/api/verify-session` — never expose to the browser |
| `RELEASE_MANIFEST_URL` | Server only | HTTPS URL to `release.json` in R2 (preferred) |
| `INSTALLER_WINDOWS_URL` | Server only | Legacy fallback if manifest is unavailable |
| `INSTALLER_MAC_URL` | Server only | Legacy fallback if manifest is unavailable |
| `LICENSE_SIGNING_SECRET` | Secret | HMAC for `LicenseContext` tokens |
| `LICENSE_GRANTS` | Secret JSON | Optional seed grants (Operations can also create grants) |
| `SUPERADMIN_EMAILS` | Server | Superadmin allowlist (example: `admin@suhuella.com`) |
| `SUPERADMIN_TOKEN` | Secret | Machine Bearer token for `/api/admin/business` only — not a console login |
| `OPERATIONS_ALLOW_DEV_ACCESS` | Local only | Optional: `true` for non-localhost dev hosts (LAN IP). `localhost` / `127.0.0.1` need no login |
| `OPERATIONS_DEV_EMAIL` | Local only | With `OPERATIONS_ALLOW_DEV_ACCESS`, must be in `SUPERADMIN_EMAILS` |
| `OPERATIONS_WORKER_ID` | Production | Optional worker/deployment id shown in the Operations panel |
| `CF_ACCESS_TEAM_DOMAIN` | Production | Cloudflare Access team host for JWT verification |
| `CF_ACCESS_AUD` | Production | Cloudflare Access application audience |
| `BUSINESS_MIN_SEATS` | Server | Minimum Business seats (default 20) |
| `BUSINESS_SEAT_PRICE_CENTS` | Server | Price per seat per month in cents (default 200 = €2) |
| `BUSINESS_CURRENCY` | Server | Business currency (default `eur`) |
| `BUSINESS_MIN_MONTHLY_CENTS` | Server | Minimum monthly amount (default 4000 = €40) |
| `BUSINESS_STORE_PATH` | Server | Optional JSON file for Business accounts (local / Node) |

Local files (gitignored):

```bash
cd site
cp .dev.vars.example .dev.vars
```

Required values in `site/.dev.vars`:

```text
STRIPE_SECRET_KEY=
RELEASE_MANIFEST_URL=
INSTALLER_WINDOWS_URL=
INSTALLER_MAC_URL=
STRIPE_LIFETIME_PAYMENT_LINK=
STRIPE_MONTHLY_PAYMENT_LINK=
SUPERADMIN_EMAILS=admin@suhuella.com
OPERATIONS_ALLOW_DEV_ACCESS=true
OPERATIONS_DEV_EMAIL=admin@suhuella.com
BUSINESS_MIN_SEATS=20
BUSINESS_SEAT_PRICE_CENTS=200
BUSINESS_CURRENCY=eur
BUSINESS_MIN_MONTHLY_CENTS=4000
```

For `npm run dev`, mirror the same values in `site/.env.local` (from `.env.example`).

Do **not** use `NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL` or `NEXT_PUBLIC_DOWNLOAD_MAC_URL`.

## Manual Stripe steps

Do **not** start selling from Payment Links. Production uses Checkout Sessions created by `/checkout/{plan}`.

1. Create live Lifetime (one-time) and Monthly (subscription) prices in the SuHuella Stripe account.
2. Store `STRIPE_SECRET_KEY`, `STRIPE_LIFETIME_PRICE_ID`, and `STRIPE_MONTHLY_PRICE_ID` as Wrangler secrets.
3. Leave `PAID_CHECKOUT_ENABLED=false` in `wrangler.jsonc` until a human decides to sell.
4. Local test only: `PAID_CHECKOUT_ENABLED=true` with `sk_test_` keys. Never put test keys on suhuella.com.
5. Success/cancel URLs are set in code (`/license/success`, `/settings?prefs=license`, `/license?checkout=canceled`).
6. Optional later: Stripe Dashboard receipts. Do **not** connect Resend for checkout.

`{CHECKOUT_SESSION_ID}` in success URLs is literal — Stripe replaces it with `cs_test_…` or `cs_live_…`.

Full enablement playbook: [../CHECKOUT-PRODUCTION-ENABLEMENT-001.md](../CHECKOUT-PRODUCTION-ENABLEMENT-001.md).

## Cloudflare setup

| Setting | Value |
| --- | --- |
| Worker name | `suhuella` |
| Domain | `suhuella.com` |
| Runtime | Cloudflare Workers |
| Adapter | `@opennextjs/cloudflare` |

Plan-specific checkout vars (never a generic first-configured product):

- `STRIPE_LIFETIME_PRICE_ID` (required to sell Lifetime)
- `STRIPE_MONTHLY_PRICE_ID` (required to sell Monthly)
- Payment Links stay optional helpers and stay unused while `PAID_CHECKOUT_ENABLED` is not `true`

Secrets (never commit):

```bash
cd site
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put RELEASE_MANIFEST_URL
npx wrangler secret put INSTALLER_WINDOWS_URL
npx wrangler secret put INSTALLER_MAC_URL
npx wrangler secret put LICENSE_SIGNING_SECRET
npx wrangler secret put LICENSE_GRANTS
npx wrangler secret put RESEND_API_KEY
```

Non-secret Worker var: `RESEND_FROM=SuHuella <licenses@suhuella.com>` (in `wrangler.jsonc`).

## SuHuella email foundation (before Resend)

Complete inbound setup **before** connecting Resend. Full map: [docs/architecture/product/suhuella-email-foundation.md](../docs/architecture/product/suhuella-email-foundation.md).

1. Enable Cloudflare Email Routing on `suhuella.com`.
2. Verify one or two real destination inboxes.
3. Forward all operational aliases (`licenses@`, `support@`, `sales@`, …).
4. Send a real test to each alias and confirm delivery.
5. Only then verify `suhuella.com` in Resend and add `RESEND_API_KEY`.

```bash
cd site
SUPPORT_DEST=you@example.com SALES_DEST=you@example.com node scripts/suhuella-email-routing-setup.mjs
```

SuHuella mail is scoped to suhuella.com only. Do not mix DNS or Resend accounts with another project.

## SuHuella production email setup (Resend + D1)

OTP recovery uses Resend only as transport. Durable challenge/proof/activation-attempt/activation **and paid grant** state lives in D1 `LICENSE_DB`. Process memory is not an OTP or paid-entitlement authority. Apply `0004_license_grant.sql` with the same migrate command. License OTP uses **From: licenses@**, **Reply-To: support@** (see BrandConfig).

| Item | Value |
| --- | --- |
| Worker | `suhuella` |
| Domain | `suhuella.com` |
| D1 | `suhuella-license` bound as `LICENSE_DB` |
| Sender | `SuHuella <licenses@suhuella.com>` |

Create / migrate D1 (once):

```bash
cd site
npx wrangler d1 create suhuella-license --location weur
# bind LICENSE_DB in wrangler.jsonc with the printed database_id
npx wrangler d1 migrations apply suhuella-license --remote --config wrangler.jsonc
```

Required production secrets (names only — never commit or log values):

```bash
cd site
npx wrangler secret put LICENSE_SIGNING_SECRET
npx wrangler secret put RESEND_API_KEY
```

`RESEND_FROM` is already in `wrangler.jsonc`. Do not deploy and claim email ready until `suhuella.com` is verified in the Operator Resend account. Copy DNS records from the Resend dashboard exactly (Cloudflare CNAME records must be DNS-only). Do not invent record values.

Smoke (authorized inbox only, no sale):

1. Create an Operations gift / manual / test grant for an inbox you control. Production ignores `LICENSE_GRANTS` env. Do not use Stripe checkout.
2. `RESEND_OTP_PROOF_EMAIL=you@example.com npm run test:resend-otp-proof`
3. HTTP 200 is not delivery. The Worker stores a challenge even when no grant exists and no mail is sent.
4. Confirm the inbox received the code (From `licenses@`, Reply-To `support@`).
5. Re-run with `RESEND_OTP_PROOF_CODE` to verify, then `POST /api/license/activate` with the proof if you need activation.
6. Replay the proof — second use must fail.

Public DNS inspect (no secrets): `npm run test:resend-dns`. After registrar records exist: `npm run test:resend-dns -- --require`.

Rollback / retry: `wrangler rollback` restores Worker code, not D1 rows. Re-apply migrations only if a new migration exists. Rotate `RESEND_API_KEY` or `LICENSE_SIGNING_SECRET` with `wrangler secret put` (each put deploys a new Worker version).

Future (not implemented here):

```text
External Operator:
    own Resend account/key
    own deployment secret
    own verified sender domain

No Partner Portal required.
```


Deploy from `site/`:

```bash
npm run deploy          # build:worker → wrangler deploy → verify:production
npm run preview         # local worker preview after build:worker
npm run verify:production
```

Production Worker vars (root `wrangler.jsonc`): `NEXT_PRIVATE_MINIMAL_MODE=1` (required for OpenNext on Cloudflare Workers). Build strips native `sharp` before bundling (`scripts/strip-sharp-from-standalone.mjs`).

`npm run deploy` builds the OpenNext worker, publishes to Cloudflare, then runs `npm run verify:production` (fails on any 404 for app routes).

Canonical product URLs: `/home` · `/search` · `/organise` · `/sources` · `/activity` · `/settings`. `/app` redirects permanently to `/home`.

**DEPLOYMENT-PIPELINE-001** (Operations): **OPEN**. Product routing is done; production may still 404 until the worker bundle publishes. Blockers: OpenNext monorepo standalone path · middleware trace · `sharp` native bindings.

Attach `suhuella.com` in Cloudflare Dashboard → Workers & Pages → `suhuella` → Domains & Routes if not already done.

**Never send customers to `*.workers.dev`.** Production Stripe redirects must use `https://suhuella.com`.

## R2 setup

Bucket: `suhuella-downloads`

Expected object names:

```text
release.json
SuHuella-Setup-0.1.0-pre-rc.exe
SuHuella-0.1.0-pre-rc.dmg
```

### release.json

Source of truth in the repo: `site/release.json`. Upload after every release:

```bash
cd site
npm run r2:upload:manifest
```

`windows` and `mac` stay empty until real installer files are uploaded. Do not put placeholder hostnames in those fields. Example after upload:

```json
{
  "version": "0.1.0-pre-rc",
  "channel": "stable",
  "minimumVersion": "0.1.0-pre-rc",
  "mandatory": false,
  "windows": "https://pub-XXXX.r2.dev/SuHuella-Setup-0.1.0-pre-rc.exe",
  "mac": "https://pub-XXXX.r2.dev/SuHuella-0.1.0-pre-rc.dmg"
}
```

Set `RELEASE_MANIFEST_URL` to the public HTTPS URL of that object, for example:

```text
https://pub-XXXX.r2.dev/release.json
```

Resolution order: `RELEASE_MANIFEST_URL` → bundled `site/release.json` → legacy `INSTALLER_*_URL`. A source with empty `windows` / `mac` is skipped so the next source can supply real URLs. If every source is empty, verify-session still confirms payment and the download page says the installer is not ready.

Create the bucket:

```bash
cd site
npm run r2:create
```

Upload after building on the matching OS (`desktop/.build/suhuella/release/`):

```bash
npx wrangler r2 object put suhuella-downloads/SuHuella-Setup-0.1.0-pre-rc.exe --file "../desktop/.build/suhuella/release/SuHuella-Setup-0.1.0-pre-rc.exe"
npx wrangler r2 object put suhuella-downloads/SuHuella-0.1.0-pre-rc.dmg --file "../desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg"
```

Do not upload fake installers.

### Installer URL options

**Test (quick):** enable public access on the R2 bucket and use the `r2.dev` URLs:

```text
https://pub-XXXX.r2.dev/SuHuella-Setup-0.1.0-pre-rc.exe
https://pub-XXXX.r2.dev/SuHuella-0.1.0-pre-rc.dmg
```

**Production (later):** attach a custom domain such as `downloads.suhuella.com` in R2 settings, then set:

```text
https://downloads.suhuella.com/SuHuella-Setup-0.1.0-pre-rc.exe
https://downloads.suhuella.com/SuHuella-0.1.0-pre-rc.dmg
```

Set those URLs in `site/.dev.vars` locally and as Wrangler secrets in production.

## Local testing

Local web has two modes. This is Developer Experience, not product or release.

```text
UI mode (default)
    npm run dev
    Fast feedback for Home, Sources, Settings, layout, copy.
    No OpenNext/workerd/D1.

    If Next reports a slow filesystem under ~/Documents, keep the
    working copy at ~/Developer/suhuella. Turbopack cannot put .next
    outside the project path.

Full Cloudflare mode
    npm run dev:cf
    Slower startup (OpenNext/workerd + local D1).
    Required for license, OTP, service-health, worker parity.
```

Motion `color-mix` console warnings are P2 cleanup — do not treat as a Gate 6 or release blocker.

```bash
cd site
npm install
npm run dev                           # UI-only — http://localhost:3000
npm run dev:cf                        # Full Cloudflare/D1
npm run preview                       # Workers runtime — http://localhost:8787
npm run build
npm run check:business-license
npm run test:license
npm run test:checkout
npm run test:admin
```

Developer Sources on `/sources` — see [DEV-SOURCES.md](DEV-SOURCES.md).

Admin console manages access and support actions. Billing provider controls paid entitlement.

Paid licenses cannot be revoked from Operations. Gift, promo, manual, internal, and test licenses can be revoked with a reason. Device deactivation is not license revocation.

### Test cases

| URL | Expected |
| --- | --- |
| `/download` | Friendly error, no download buttons |
| `/download?session_id=invalid` | Friendly error, no download buttons |
| `/download?session_id=cs_test_…` (paid) | “Payment verified” + download buttons |
| `https://ops.suhuella.com/` without Cloudflare Access | Access login, not the product app |
| `http://localhost:3000/ops` in `next dev` | Superadmin console, no login |

API check without session:

```bash
curl -sS -D - "http://localhost:3000/api/verify-session"
curl -sS "http://localhost:3000/api/release" | jq .
```

Recover a completed test checkout without paying again:

```text
http://localhost:3000/download?session_id=cs_test_...
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Stripe shows its own “Thanks for your payment” page | Payment Link redirect not saved | Set after-payment URL in Stripe Dashboard and click **Update link** |
| `/download` shows verification error | Missing or wrong `STRIPE_SECRET_KEY` | Set secret in `.dev.vars` / Wrangler; use test key for test sessions |
| “Payment verified” but no download buttons | Manifest or legacy URLs missing | Upload `release.json` + installers to R2; set `RELEASE_MANIFEST_URL` |
| Download buttons link nowhere | Invalid or empty installer URL | Use public `https://` R2 URLs |
| Landing purchase CTA opens Stripe | Stale generic payment link | Generic CTAs must go to `/license`; plan buttons use `/checkout/{plan}` |
| Works locally but not on suhuella.com | Secrets not set on Worker | Run `wrangler secret put` for production Worker |

## Manual actions still required

- [ ] Store live `STRIPE_SECRET_KEY` + Lifetime/Monthly price IDs as Wrangler secrets (do not flip the sales switch yet)
- [ ] Keep `PAID_CHECKOUT_ENABLED=false` until a human decides to sell
- [ ] `cd desktop && npm run package:check` (version, icons, artifact names)
- [ ] Build Windows installer on Windows (`cd desktop && npm run package:win`)
- [ ] Build macOS installer on macOS (`cd desktop && npm run package:mac`)
- [ ] Create R2 bucket `suhuella-downloads` and enable public access (or custom domain)
- [ ] Upload `release.json` and installers to R2
- [ ] Set `RELEASE_MANIFEST_URL` (and legacy `INSTALLER_*_URL` only if needed)
- [ ] Attach `suhuella.com` in Cloudflare Dashboard if not already done
- [ ] Local test payment with `4242 4242 4242 4242` and test keys only
- [ ] Before production: rotate Stripe keys manually

## Development

```bash
cd site
cp .dev.vars.example .dev.vars
cp .env.example .env.local
npm install
npm run dev          # UI — http://localhost:3000
npm run dev:cf       # OpenNext/D1
```
