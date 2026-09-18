# SuHuella site

Next.js public site: landing, Stripe checkout return, verified download, privacy, terms. Roadmap and agent rules: [../README.md](../README.md).

## Landing

| Route | Purpose |
| --- | --- |
| `/` | Landing + buy CTA |
| `/download?session_id={CHECKOUT_SESSION_ID}` | Post-payment download |
| `/privacy`, `/terms` | Legal |
| `/success`, `/descarga-exitosa` | Redirect → `/download` (query preserved) |
| `/privacidad`, `/terminos` | Redirect → English legal routes |

Download page must say the app runs quietly in the system tray. No 30-second video — image or 8–10s GIF is enough.

Do not add auth, database, user accounts, or email storage.

```text
site/
├── app/           Pages + API routes
├── components/
├── lib/           Stripe, verification, i18n
├── public/
└── package.json
```

## Stripe

Payment Link **after payment** URL:

```text
https://suhuella.com/download?session_id={CHECKOUT_SESSION_ID}
```

Flow:

```text
Checkout → /download?session_id=cs_… → GET /api/verify-session → installer buttons
```

Verification: `app/api/verify-session/route.ts` uses `STRIPE_SECRET_KEY` server-side. Installers shown only when session exists, `mode === "payment"`, and `payment_status === "paid"`. Missing or invalid session → error, no download links. Installer URLs (`INSTALLER_WINDOWS_URL`, `INSTALLER_MAC_URL`) are server-only and returned only from `/api/verify-session` after successful verification — never exposed as public env vars.

### Sandbox test

1. `sk_test_...` + test Payment Link
2. Complete checkout → redirect with `cs_test_...`
3. Page shows “Verifying payment…”, then Windows / Mac buttons
4. `/download` without `session_id` → buttons hidden

## Cloudflare

Deployed as a **Cloudflare Worker** named `suhuella` via `@opennextjs/cloudflare` (not static Pages export).

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker name, bindings, compatibility flags |
| `open-next.config.ts` | OpenNext adapter config |
| `.dev.vars.example` | Local/preview secrets template |

### Deploy

From the repo root (Cloudflare Git integration, root directory `/`):

| Setting | Value |
| --- | --- |
| Build command | `npm run cf:build` |
| Deploy command | `npm run cf:deploy` |

Equivalent manual commands:

```bash
cd site && npm ci && npx opennextjs-cloudflare build   # build
cd site && npx wrangler deploy                         # deploy
```

Local one-shot:

```bash
cd site
npm run deploy    # Build + deploy to Cloudflare Workers
```

**Important:** both build and deploy must run inside `site/`. Deploying from the repo root publishes the wrong app (the desktop `index.html`).

### Custom domain

1. Cloudflare Dashboard → Workers & Pages → `suhuella` → Settings → Domains & Routes
2. Add `suhuella.com` and `www.suhuella.com`
3. Update Stripe redirect to `https://suhuella.com/download?session_id={CHECKOUT_SESSION_ID}`

### Production secrets

Set via Wrangler (never commit values):

```bash
cd site
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put INSTALLER_WINDOWS_URL
npx wrangler secret put INSTALLER_MAC_URL
```

Public vars can go in `wrangler.jsonc` under `vars` or the dashboard.

## Deployment

| Setting | Value |
| --- | --- |
| Package | `site/` |
| Adapter | `@opennextjs/cloudflare` |
| Worker | `suhuella` |
| Deploy | `npm run deploy` from `site/` |
| Domain | `suhuella.com` (attach in dashboard) |
| Stripe redirect | `https://suhuella.com/download?session_id={CHECKOUT_SESSION_ID}` |

## Environment variables

Copy from `.env.example` into `.env.local` (Next.js dev) or `.dev.vars` (Wrangler preview). Production secrets via `wrangler secret put` (see Cloudflare section).

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | Public | Buy CTA href |
| `STRIPE_SECRET_KEY` | Server only | `/api/verify-session` |
| `INSTALLER_WINDOWS_URL` | Server only | Windows `.exe` after verified payment |
| `INSTALLER_MAC_URL` | Server only | macOS `.dmg` after verified payment |

## Development

Local commands and preview URLs only — never send customers here.

```bash
cd site
cp .env.example .env.local   # or copy .dev.vars.example → .dev.vars for Wrangler preview
npm install
npm run dev       # Next.js dev server (http://localhost:3000)
npm run preview   # Workers runtime locally (http://localhost:8787)
npm run build
```

After `npm run deploy`, the Workers preview URL is `https://suhuella.<account>.workers.dev`. Use it for smoke tests only.

**Never send customers to `*.pages.dev` or `*.workers.dev`.** Production traffic and Stripe redirects must use `https://suhuella.com` only.
