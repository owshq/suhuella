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

The landing **never shows a price**. Copy uses “Descargar vX.Y.Z”; Windows/macOS buttons open a single Payment Link. Stripe Checkout shows the amount and currency.

Payment Link **after payment** URL:

```text
https://suhuella.com/download?session_id={CHECKOUT_SESSION_ID}
```

Flow:

```text
Landing → Download buttons → Stripe Checkout → /download?session_id=cs_… → verify → installers
```

Verification: `app/api/verify-session/route.ts` uses `STRIPE_SECRET_KEY` server-side. Installers shown only when session exists, `mode === "payment"`, and `payment_status === "paid"`. Missing or invalid session → error, no download links. Installer URLs (`INSTALLER_WINDOWS_URL`, `INSTALLER_MAC_URL`) are server-only and returned only from `/api/verify-session` after successful verification — never exposed as public env vars.

### Pricing & currency (Adaptive Pricing)

One product, one Payment Link, **EUR base price for Spain/EU**:

| Setting | Value |
| --- | --- |
| Base currency | **EUR** |
| Base price (minimum) | **€5.00** one-time |
| Adaptive Pricing | **On** (Stripe Dashboard → Payment Link → Adaptive pricing) |
| Landing copy | No amounts — legal text says price is shown at checkout |

Why this setup:

- **Spain / EU customers** see **€5** at checkout (your floor price).
- **Other countries** see a local amount converted by Stripe Adaptive Pricing from the EUR base.
- **Price changes** happen only in Stripe — no code or landing updates.

Do **not** create separate Payment Links per currency. Do **not** hardcode prices in `dictionary.ts` or components.

Stripe Dashboard checklist:

1. Product → one-time price **€5.00 EUR**
2. Payment Link → enable **Adaptive pricing**
3. After payment URL → `https://suhuella.com/download?session_id={CHECKOUT_SESSION_ID}`
4. Copy live link → `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` (build variable + `.env.local`)

### Sandbox test

1. `sk_test_...` + test Payment Link (Adaptive pricing can stay on)
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
| Deploy command | `npm run cf:deploy` (uses root `wrangler.jsonc`) |

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

**Important:** the build must compile OpenNext inside `site/`. Deploy uses the root `wrangler.jsonc`, which points at `site/.open-next/`.

### www.suhuella.com

Delete the DNS record `www CNAME suhuella.com` first, then redeploy so Wrangler can attach `www` as a Worker custom domain.

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
| `NEXT_PUBLIC_APP_VERSION` | Public (build time) | Landing badge + “Descargar vX.Y.Z” — sync with `desktop/package.json` |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | Public (build time) | Download buttons → Stripe Checkout |
| `STRIPE_SECRET_KEY` | Server only | `/api/verify-session` |
| `INSTALLER_WINDOWS_URL` | Server only | Windows `.exe` after verified payment |
| `INSTALLER_MAC_URL` | Server only | macOS `.dmg` after verified payment |

`NEXT_PUBLIC_*` vars must be set as **Cloudflare build variables** (Workers Git → Settings → Build variables), not only as runtime Worker vars — Next.js inlines them at build time.

Example build variables:

```text
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...
```

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
