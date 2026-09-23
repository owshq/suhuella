# SUHUELLA-STRIPE-CLOUDFLARE-PRODUCTION-READINESS-001

**Status:** Gate A **PASS**. Gate B **PASS** (secrets loaded, deploy with sales off). Gate C pending. Live sales **OFF**.  
**Date:** 2026-09-21  
**Scope:** SuHuella + Stripe + Cloudflare Worker `suhuella` + D1 `LICENSE_DB`.  
**Not in scope:** Stripe Connect, Partner checkout, Business public checkout, Lifetime Upgrade, indexer / DMG / releases / download aliases.

### Gate B execution (2026-09-21)

| Item | Result |
|---|---|
| Worker secrets (names only) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_LIFETIME_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`, `STRIPE_PARTNER_PRICE_ID`, `STRIPE_LIFETIME_UPGRADE_PRICE_ID` present |
| Deployed Version ID | `0d62496a-9cb3-4c3f-8c76-bf37b84e5dcd` |
| `PAID_CHECKOUT_ENABLED` | `"false"` (wrangler + live binding) |
| Post-deploy health | `GET /api/service-health` → NORMAL |
| Checkout Monthly / Lifetime | Closed (302 → suhuella.com, not Stripe) |
| Bad webhook signature | 400 `invalid_signature` |
| Live purchases / Gate C | Not executed |

Catalog amount rules enforced in code: Monthly 500, Lifetime from Stripe Price (not hardcoded), Business 200, Partner 100000, Upgrade 500; Business min 20; Partner off `/license`; Upgrade closed.

### Gate B preparation (ready to execute manually)

Cuenta Stripe Live objetivo: `acct_1TSg2hAAPiPo60kj` (SuHuella). No usar Linkeram ni otra cuenta.

#### Dónde lee el Worker cada variable

| Variable | Lectura |
|---|---|
| `STRIPE_SECRET_KEY` | `checkout-session.ts`, `verify-session` route, webhook route, `license-service.ts`, `business-billing.ts` |
| `STRIPE_WEBHOOK_SECRET` | `app/api/stripe/webhook/route.ts` (firma HMAC del cuerpo crudo) |
| `STRIPE_MONTHLY_PRICE_ID` | `stripe-catalog.ts` → `configuredPriceId("monthly")` |
| `STRIPE_LIFETIME_PRICE_ID` | `stripe-catalog.ts` → `configuredPriceId("lifetime")` |
| `STRIPE_BUSINESS_PRICE_ID` | catálogo Business self-serve (gated by `PAID_CHECKOUT_ENABLED`) |
| `STRIPE_PARTNER_PRICE_ID` | catálogo (fuera de `/license`, checkout **off**) |
| `STRIPE_LIFETIME_UPGRADE_PRICE_ID` | catálogo (`lifetimeUpgradeSaleEnabled() === false`) |
| `PAID_CHECKOUT_ENABLED` | `paid-checkout.ts` + `wrangler.jsonc` var → debe seguir `"false"` |

#### Precios Live conocidos (solo IDs; sin secretos)

| Producto | Product | Price | Validación esperada |
|---|---|---|---|
| Personal Monthly | `prod_VIm2F0TK5J0UlO` | `price_1UIAU8AAPiPo60kjL0s2civu` | EUR 500 céntimos / month / livemode |
| Personal Lifetime | `prod_VIm3jnbMdSpK8Q` | `price_1UIAUyAAPiPo60kj4KFgwyxZ` | EUR one_time; importe el del Price (100 EUR en Live) |

#### Precios pendientes — cómo copiarlos (no inventar)

En Dashboard Live → cuenta `acct_1TSg2hAAPiPo60kj`:

1. **Product catalog** → abrir el producto.
2. Sección **Pricing** → abrir el price activo.
3. Copiar el id `price_…`.
4. Comprobar: currency `eur`, `livemode` Live, importe y ciclo:

| Env | Product | Esperado |
|---|---|---|
| `STRIPE_BUSINESS_PRICE_ID` | `prod_VIm3Wl67GcHe2v` | 200 céntimos / month (por plaza; mín. 20 en servidor) |
| `STRIPE_PARTNER_PRICE_ID` | `prod_VIm3GgwggtElq9` | 100000 céntimos / year |
| `STRIPE_LIFETIME_UPGRADE_PRICE_ID` | `prod_VIm4qjQfxoTmNA` | 500 céntimos one_time (venta cerrada) |

No escribas placeholders `REPLACE_WITH_LIVE_*` en el Worker.

#### Webhook Live (crear en Dashboard; no enviar eventos de prueba todavía)

1. Developers → **Webhooks** → Add endpoint (modo **Live**).
2. URL: `https://suhuella.com/api/stripe/webhook`
3. Eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.resumed`
4. Copiar el **Signing secret** (`whsec_…`) solo a Wrangler (paso siguiente). Nunca al chat ni a Git.
5. Dejar el destino Sandbox sin usar para producción.

El Worker ya: firma con `STRIPE_WEBHOOK_SECRET`, rechaza `livemode` incompatible con `sk_live_`/`sk_test_`, valida Price EUR/importe/ciclo, idempotencia `stripe_event.event_id`, grant sin retorno a success, `invoice.payment_failed` → `past_due` sin grant nuevo, Upgrade cerrado.

#### Comandos Wrangler (tú los ejecutas; interactivos; sin pegar valores en chat)

**Antes:** rota cualquier `sk_live_` que haya aparecido en chat. Usa solo la clave nueva.

```bash
cd /Users/narcisclavell/Documents/suhuella/site

npx wrangler secret put STRIPE_SECRET_KEY
# pega sk_live_… (rotada)

npx wrangler secret put STRIPE_WEBHOOK_SECRET
# pega whsec_… del endpoint Live

npx wrangler secret put STRIPE_MONTHLY_PRICE_ID
# price_1UIAU8AAPiPo60kjL0s2civu

npx wrangler secret put STRIPE_LIFETIME_PRICE_ID
# price_1UIAUyAAPiPo60kj4KFgwyxZ

npx wrangler secret put STRIPE_BUSINESS_PRICE_ID
# price_… copiado del producto Business

npx wrangler secret put STRIPE_PARTNER_PRICE_ID
# price_… copiado del producto Partner

npx wrangler secret put STRIPE_LIFETIME_UPGRADE_PRICE_ID
# price_… copiado del producto Lifetime Upgrade
```

Comprobar nombres (no valores):

```bash
npx wrangler secret list --config wrangler.jsonc
```

Confirmar var pública:

```bash
# en wrangler.jsonc debe seguir:
# "PAID_CHECKOUT_ENABLED": "false"
```

#### Después de secretos + webhook (aún no es Gate C)

1. Redeploy del Worker **con ventas off** (otro paso explícito; no mezclar con secret put).
2. Smoke Live **manual** controlado (tú pagas; el agente no compra).
3. Solo entonces Gate C: flip `PAID_CHECKOUT_ENABLED` a `true` con aprobación humana.

#### Gate B checklist

| Ítem | Estado |
|---|---|
| Código reconciliador + livemode + PAN reject | Listo |
| Tests checkout/webhook/durability/license/business | PASS (última corrida) |
| `PAID_CHECKOUT_ENABLED=false` | Confirmado en `wrangler.jsonc` |
| Monthly / Lifetime price IDs conocidos | Listos para `secret put` |
| Business / Partner / Upgrade price IDs | **Pendiente** (copiar del Dashboard) |
| Webhook Live creado | **Pendiente** (Dashboard) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` en Worker | **Pendiente** (Wrangler interactivo; rotar si filtró) |
| Deploy post-secretos | No aún |
| Compras reales / Gate C | No |

**Gate B: BLOCKED** hasta completar precios pendientes + webhook Live + `secret put` (clave rotada).

### Gate A execution (2026-09-21)

| Item | Result |
|---|---|
| Deployed Worker version | `492669e1-89c8-47bb-9dfa-b83dbb9cc63e` |
| App version var | `0.1.0-pre-rc` |
| Migration applied | `0005_stripe_event.sql` on remote `suhuella-license` (`a4c8e624-977f-4498-b6c0-7024f3ed5672`) |
| Table | `stripe_event (event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL)` |
| `PAID_CHECKOUT_ENABLED` | `"false"` (wrangler + live binding) |
| Stripe secrets on Worker | Still absent (`LICENSE_SIGNING_SECRET`, `RESEND_API_KEY` only) |
| Stripe events to suhuella.com | None sent |
| Gate B / Gate C | Not executed |

Smoke tests after deploy:

| Smoke | Result |
|---|---|
| GET `/api/service-health` | PASS `NORMAL` |
| Checkout Monthly closed | PASS 302 → suhuella.com (not Stripe) |
| Checkout Lifetime closed | PASS 302 → suhuella.com (not Stripe) |
| Invalid webhook signature | PASS 400 `invalid_signature` |
| Duplicate event not applied twice | PASS via `test:personal-checkout-webhook` (no production Stripe events) |
| `invoice.payment_failed` → `past_due`, no new grant | PASS via `test:personal-checkout-webhook` |
| Absent Stripe secrets fail-closed | PASS `verify-session` → 400 `invalid_session` |
| `card[number]` on checkout | PASS 400 `card_data_not_accepted` |
| `verify:production` | PASS |

**Expected state after Gate A:** Gate A PASS · Gate B pending · Gate C pending · Ventas Live cerradas · Stripe Live sin configurar.

---

## Absolute rules (confirmed)

| Rule | State |
|---|---|
| Live sales | Off |
| `PAID_CHECKOUT_ENABLED` in production (`site/wrangler.jsonc`) | `"false"` |
| `sk_live_` / Live price IDs | Not used; not present as code defaults |
| Secrets in Git / logs / chat | Not stored. `.env*` and `.dev.vars*` are gitignored |
| Full card numbers to any API | No path. `payment_pages` confirm is Stripe-hosted Checkout only |
| Checkout path | Server creates Checkout Sessions; card entry on Stripe-hosted page |
| Connect / Partner / Business public / Upgrade | Closed |

---

## 1. Code audited and changes

### Authority of each datum

| Datum | Authority |
|---|---|
| Public sales switch | Env `PAID_CHECKOUT_ENABLED` must be exactly `"true"` **and** SuHuella `paidCheckoutEnabled` |
| Price ID | Server env only (`STRIPE_*_PRICE_ID`). Browser never supplies a price |
| Price amount / currency / interval / livemode | Stripe Price object via `GET /v1/prices/{id}` + `validateCatalogPrice` |
| Lifetime amount | Whatever Stripe returns for the configured Lifetime price. Code does **not** hardcode EUR amount |
| Paid grant | `LICENSE_DB.license_grant` in production (D1). Local `npm run dev` uses file store |
| Webhook authenticity | HMAC of **raw body** with `STRIPE_WEBHOOK_SECRET` |
| Brand entitlement | New platform Stripe grants: `issuedByOperator=platform`, `acceptedBrands=["suhuella"]` |
| Manual / gift / non-stripe grant | Never converted by Checkout fulfillment (`origin !== "stripe"` → no write) |

### Flow: Checkout → webhook → grant

```
GET /checkout/{lifetime|monthly}
  → createStripeCheckoutSession (allowed price only)
  → https://checkout.stripe.com/...   (card stays on Stripe)

Stripe event checkout.session.completed
  → POST /api/stripe/webhook (signature on raw body)
  → applyPersonalStripeWebhook
  → reconcilePaidCheckoutSession
  → verify session paid + catalog price
  → fulfillLicenseFromCheckout → one license_grant

Also (same reconciler):
  GET /api/verify-session?session_id=
  POST /api/license/activate-from-checkout
```

Monthly renewals / cancel / fail:

- `invoice.paid` / `invoice.payment_succeeded` → re-fetch subscription → update existing `personal_monthly` Stripe grant  
- `invoice.payment_failed` → mark existing grant `entitlementStatus=past_due` (does not create a grant)  
- `customer.subscription.*` → update or expire existing Stripe monthly only; never invent Lifetime  

### Stripe HTTP surfaces (server)

Only:

- `POST /v1/checkout/sessions`
- `GET /v1/prices/{id}`
- `GET /v1/subscriptions` / `GET /v1/subscriptions/{id}`
- `POST /v1/subscription_items/{id}` (Business seat quantity; not public checkout)

**Not present in repo:** `card[number]`, `payment_method_data[card]`, `source[number]`, `/v1/payment_methods` creation from PAN, `/v1/payment_intents` confirm with PAN, `/v1/payment_pages` calls from SuHuella code.

`POST /v1/payment_pages/{cs}/confirm` with HTTP 402 is Stripe Checkout’s own confirm path after a failed hosted payment attempt. It is **not** a Worker route and must not be deleted. Temporary buy control is `PAID_CHECKOUT_ENABLED`, not removing `payment_pages`.

### Test / live separation

- `suhuella.com` / `www.suhuella.com` reject `sk_test_` and `cs_test_`
- Session id mode must match secret mode (`cs_test_` ↔ `sk_test_`, `cs_live_` ↔ `sk_live_`)
- Price `livemode` must match secret mode

### Idempotency

- Grant upsert by email / existing Stripe grant (replay keeps one `licenseId`)
- Event receipts in persistence `stripeEvents` / D1 `stripe_event` (0005)
- Event id remembered **only after** handler success → Stripe can retry on failure
- Concurrent duplicate delivery: one grant; second call returns not re-fulfilled

### Local vs production store

| Runtime | Store |
|---|---|
| `npm run dev` (UI mode) | File `site/.data/license-state.json` (or `LICENSE_STORE_PATH`). **Skips D1** |
| `npm run dev:cf` / Wrangler | Local D1 `suhuella-license` via `LICENSE_DB` + `.dev.vars` |
| Production Worker `suhuella` | Remote D1 `suhuella-license` (`database_id` `a4c8e624-977f-4498-b6c0-7024f3ed5672`), binding `LICENSE_DB` |

### Changes in this readiness track

| Change | Why |
|---|---|
| `site/lib/raw-card-guard.ts` + checkout/verify/activate/attempt routes | Reject `card[number]` / related fields before Stripe |
| `invoice.payment_failed` on personal monthly | Mark existing Stripe monthly `past_due` |
| `site/.env.example` lists webhook + price env names (placeholders only) | Document required secrets without values |
| Checkout enablement check scans for raw-card Stripe paths | Regression lock |

Sandbox price IDs are **not** hardcoded as production defaults.

---

## 2. Tests executed and result

| Test | Result |
|---|---|
| `npm run test:checkout` | PASS (`CHECKOUT-PRODUCTION-ENABLEMENT-001 check passed`) including raw-card rejection, price-only session body, wrangler sales off |
| `npm run test:personal-checkout-webhook` | PASS — unpaid, wrong price, manual not converted, upgrade ignored, duplicate/concurrent, bad signature, invoice paid, invoice failed, subscription deleted, brand gates |
| `npm run test:grant-durability` (`--prefix site`) | PASS |
| Sandbox Lifetime hosted Checkout (prior local proof) | Paid 100 EUR; webhook 200; grant in file store |
| Sandbox Monthly hosted Checkout (prior local proof) | Paid 5 EUR; webhook 200; grant in file store |
| Close browser before success | Covered by webhook grant without success return (unit + prior local proof) |
| Events to `https://suhuella.com` | **Not sent** (forbidden until reconciler deploy) |

Mandatory matrix mapping:

| Case | Coverage |
|---|---|
| Monthly / Lifetime Sandbox | Prior real Checkout + local webhook 200 |
| Browser closed before success | Webhook path grants without return |
| Duplicate / concurrent webhook | `test:personal-checkout-webhook` |
| Invalid signature | Same |
| Wrong price | Same |
| Test/live mismatch | `test:checkout` origin/secret guards |
| Payment pending | Unpaid session → no grant |
| Invoice paid / failed | Same (failed → `past_due`) |
| Subscription canceled | Same → monthly expires, not Lifetime |
| DB failure retry | Event remembered only after success; missing 0005 does not break grant write |
| Manual not converted | Same |
| Lifetime Upgrade rejected | Same + `lifetimeUpgradeSaleEnabled() === false` |
| Disallowed price | Same |
| `card[number]` rejected, no Stripe call | `test:checkout` + route guards |

---

## 3. Local state

| Item | State |
|---|---|
| `site/.env.local` `PAID_CHECKOUT_ENABLED` | `false` |
| Local Stripe key mode | `sk_test_` (value not recorded here) |
| Sandbox price IDs in `.env.local` | Monthly + Lifetime from Sandbox catalog (local only) |
| Local listener `whsec_` | Was for CLI listen; not the Dashboard destination secret |
| Local grants from Sandbox proof | `sandbox-lifetime-local@example.com` (`personal_lifetime`), `sandbox-monthly-local@example.com` (`personal_monthly`) in `site/.data/license-state.json` |
| Local D1 | Migrations **not** applied in the local Wrangler D1 state inspected for this audit; `license_grant` table absent locally until `wrangler d1 migrations apply … --local` |
| Stripe CLI | Installed at `~/.local/bin/stripe` (no Homebrew on this Mac) |

---

## 4. Remote D1 state

| Item | State |
|---|---|
| Worker | `suhuella` |
| Binding | `LICENSE_DB` |
| Database name | `suhuella-license` |
| Database id | `a4c8e624-977f-4498-b6c0-7024f3ed5672` |
| Applied remote migrations | `0001` … `0004` (including `0004_license_grant.sql`) |
| Pending remote migration | **`0005_stripe_event.sql` only** |
| Worker secrets present (names only) | `LICENSE_SIGNING_SECRET`, `RESEND_API_KEY` |
| Stripe secrets on Worker | **Absent** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` not set) |
| `PAID_CHECKOUT_ENABLED` var | `"false"` in `wrangler.jsonc` |

No remote migration was applied in this track.

---

## 5. Pending migrations

### Creates / modifies `LICENSE_DB.license_grant`

| Migration | Role |
|---|---|
| `site/migrations/0004_license_grant.sql` | **Creates** `license_grant` (+ indexes). **Already applied remotely.** |
| `site/migrations/0005_stripe_event.sql` | Creates `stripe_event` receipts. **Pending remotely.** Does not alter `license_grant`. |

### Exact apply command for the pending migration (do not run until Gate A)

```bash
cd /Users/narcisclavell/Documents/suhuella/site
npx wrangler d1 migrations apply suhuella-license --remote --config wrangler.jsonc
```

Only `0005_stripe_event.sql` should apply.

SQL (0005):

```sql
CREATE TABLE IF NOT EXISTS stripe_event (
  event_id TEXT PRIMARY KEY,
  processed_at TEXT NOT NULL
);
```

Verification:

```bash
npx wrangler d1 execute suhuella-license --remote --config wrangler.jsonc \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('license_grant','stripe_event') ORDER BY name;"
```

Rollback: no down migration. Safe rollback is `DROP TABLE IF EXISTS stripe_event;` (grants remain; duplicates may reprocess until receipts are restored). Prefer leaving the table once applied.

---

## 6. Secrets required (names only — no values)

### Local (`.env.local` for `npm run dev`; `.dev.vars` for `dev:cf`)

| Name | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` only |
| `STRIPE_WEBHOOK_SECRET` | CLI listen `whsec_…` for local forward; **not** the Dashboard destination secret |
| `STRIPE_MONTHLY_PRICE_ID` | Sandbox price |
| `STRIPE_LIFETIME_PRICE_ID` | Sandbox price |
| `PAID_CHECKOUT_ENABLED` | `true` only during local proof; restore `false` after |

Optional catalog (not for public checkout): `STRIPE_BUSINESS_PRICE_ID`, `STRIPE_PARTNER_PRICE_ID`, `STRIPE_LIFETIME_UPGRADE_PRICE_ID`.

### Future production Worker secrets / vars

| Name | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` only when Live catalog + Live webhook exist |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the **Live** endpoint (never Sandbox Dashboard / never CLI listen) |
| `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_LIFETIME_PRICE_ID` | **New Live** price IDs (not Sandbox IDs) |
| `PAID_CHECKOUT_ENABLED` | Stay `"false"` until Gate C |

Do not put Sandbox `whsec_` or `sk_test_` on the production Worker. Do not put Live secrets in Git.

---

## 7. Sandbox webhook destination and events

| Field | Value |
|---|---|
| Destination | `we_1UI9HKA85Kt268TVW3FyJTg3` |
| URL | `https://suhuella.com/api/stripe/webhook` |
| Scope | Your account |
| Events | `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.resumed` |
| Dashboard signing secret | Not in repo / not in chat |
| Use now | **Do not** send test events to production until Gate A + deployed reconciler |

Local proof used Stripe CLI listen → `localhost:3000` with the CLI’s own `whsec_`.

---

## 8. Product status

| Product | Created (Sandbox) | Connected in code | Tested | Enabled public |
|---|---|---|---|---|
| Personal Monthly | Yes `price_1UI8GKA85Kt268TVDK8DN1iG` | Yes (env + catalog) | Yes (Sandbox + unit) | **No** |
| Personal Lifetime | Yes `price_1UI8N5A85Kt268TVR61K95HX` | Yes (env + catalog) | Yes (Sandbox + unit) | **No** |
| Business | Yes `price_1UI8R5A85Kt268TVJJqKiife` | Catalog only; checkout off; mailto sales | Seat billing unit tests | **No** public checkout |
| Partner | Yes `price_1UI8VSA85Kt268TVHN0vDO4i` | Catalog only; off `/license` | Unit asserts reserved | **No** |
| Lifetime Upgrade | Yes `price_1UGoWqA85Kt268TVFDThdCMX` | Hard-closed | Unit asserts ignored | **No** |

---

## 9. Remaining risks

1. **Remote `0005` not applied** — grant writes work; durable event receipts on D1 are incomplete until migration.  
2. **No Stripe secrets on production Worker** — production webhook cannot verify or fulfill yet (correct for now).  
3. **Sandbox destination points at production URL** — unused until deploy; risk of accidental Dashboard test send before Gate A. Prefer disabling or leaving idle.  
4. **No explicit `event.account` / fixed Stripe account id env check** — mitigated by webhook secret + catalog price livemode/id checks; optional hardening later.  
5. **`npm run dev` ≠ D1** — local file grants do not prove remote `license_grant`. Prove with `dev:cf` or post-deploy remote query.  
6. **Lifetime Upgrade / commercial generations** — intentionally absent; do not invent.  
7. **Ops production activation** — separate open track (`OPERATIONS-PRODUCTION-ACTIVATION-001`); Access secrets not this gate.  
8. **Old Lifetime grants without generation** — no migration invented.

---

## 10. Gate A — Deploy the reconciler

**Do in order; sales stay off.**

1. Confirm `site/wrangler.jsonc` still has `"PAID_CHECKOUT_ENABLED": "false"`.  
2. Deploy Worker code that includes shared `reconcilePaidCheckoutSession`, personal webhook, raw-card guards, and catalog validation.  
3. Apply **only** remote migration `0005_stripe_event.sql` with the command in §5.  
4. Verify tables `license_grant` and `stripe_event` exist remotely.  
5. Still **do not** put Sandbox webhook secret on the Worker.  
6. Still **do not** flip `PAID_CHECKOUT_ENABLED`.

Exit: production code + D1 receipts ready; sales still off; no Live Stripe material required yet for this gate alone (Live secrets wait for Gate B if production must accept Live events).

---

## 11. Gate B — Create Live webhook

**Only after Gate A.**

1. Create **Live** products/prices in Stripe (new Live price IDs — never reuse Sandbox IDs).  
2. Create a **Live** webhook destination to `https://suhuella.com/api/stripe/webhook` with the same eight events.  
3. `wrangler secret put STRIPE_SECRET_KEY` → `sk_live_…`  
4. `wrangler secret put STRIPE_WEBHOOK_SECRET` → Live endpoint signing secret only.  
5. Set Worker vars/secrets for **Live** `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_LIFETIME_PRICE_ID`.  
6. Keep `PAID_CHECKOUT_ENABLED=false`.  
7. Leave Sandbox destination unused for production fulfillment (or remove later). Do not copy Sandbox `whsec_` to the Worker.

Exit: Live verification path can run closed-loop tests without public selling.

---

## 12. Gate C — Activate `PAID_CHECKOUT_ENABLED`

**Only after Gates A and B, human commercial decision, and a Live smoke purchase that writes one remote `license_grant`.**

1. Confirm Live webhook deliveries succeed.  
2. Confirm one Live smoke grant row in remote `license_grant`.  
3. Confirm Business remains mailto; Partner off `/license`; Upgrade closed.  
4. Set production `PAID_CHECKOUT_ENABLED` to exactly `true` (and leave SuHuella brand eligibility on).  
5. Rollback: set `PAID_CHECKOUT_ENABLED=false` immediately if anything fails.

---

## Final leave-state (this track)

- `site/wrangler.jsonc` → `PAID_CHECKOUT_ENABLED: "false"`  
- `site/.env.local` → `PAID_CHECKOUT_ENABLED=false`  
- No Live activation performed  
- No remote migration applied  
- No test events sent to `https://suhuella.com`  
- `payment_pages` left as Stripe-hosted Checkout internals; public buy control remains the env switch  
