# STRIPE-LIVE-SMOKE — Runbook

**Cuenta autorizada:** `acct_1TSg2hAAPiPo60kj`  
**Worker:** `suhuella` · **Origin:** https://suhuella.com  
**Fecha probes automáticos:** 2026-09-24

---

## 1. Probes automáticos (sin pago)

```bash
npm run smoke:stripe-live-checkout
```

| Probe | Resultado 2026-09-24 |
|-------|----------------------|
| `GET /checkout/monthly` | **PASS** — 302 → `checkout.stripe.com` / `cs_live_…` |
| `GET /checkout/lifetime` | **PASS** — 302 → `cs_live_…` |
| `GET /checkout/business` | **PASS** — 200 |
| `GET /partners` | **PASS** — 200 |
| `POST /api/stripe/webhook` sin firma | **PASS** — 400 `invalid_signature` |
| `POST /api/business/checkout` sin proof | **PASS** — 401 (gate abierto) |
| `POST /api/partners/checkout` sin sesión | **PASS** — 401 (gate abierto) |
| `POST /api/lifetime-upgrade/checkout` | **PASS** — 403 `checkout_closed` |
| PAN guard | **PASS** — 400 `card_data_not_accepted` |
| Verify-session forged | **PASS** — 400 `invalid_session` |

Suite local: `npm run test:stripe-live-readiness` — **PASS**.

Navegador: `/checkout/monthly` abre **Stripe Checkout Live** (título «Stripe Checkout», URL `cs_live_…`).

---

## 2. E2E humano — una compra por producto

No automatizable sin tarjeta real en Live. Usar email de prueba autorizado; registrar `session_id` / `customer` en Dashboard.

### A — Personal Monthly

1. Web → Settings → License → Monthly (o `https://suhuella.com/checkout/monthly`).
2. Pagar en Stripe Hosted Checkout.
3. Return URL → Settings con licencia **Personal · Active**.
4. Dashboard Stripe → Webhooks → evento `checkout.session.completed` **2xx**.
5. D1 (opcional): fila en `license_grant` con edition `personal_monthly`.
6. Desktop: mismo email → activar / check license offline.

### B — Personal Lifetime

1. `https://suhuella.com/checkout/lifetime` → pagar.
2. Mismo flujo activación; edition `personal_lifetime`.
3. Webhook 2xx; grant D1.

### C — Business

1. `https://suhuella.com/checkout/business`.
2. Email titular → OTP → proof → plazas (mín. 20) → Stripe Checkout.
3. Return → org en Settings (Business section).
4. Webhook `checkout.session.completed` + subscription events **2xx**.
5. D1: `business_account`, `business_seat`, `license_grant` titular.
6. Si org no aparece: `POST /api/business/reconcile` con proof `BUSINESS_CHECKOUT` + `sessionId` (no basta session_id solo).

### D — Partner Platform

1. `https://suhuella.com/partners` → Apply (email verificado).
2. Checkout anual → pago.
3. Portal `/partners/portal` — entitlement activo.
4. D1: `partner`, `partner_entitlement`, `partner_stripe_fulfillment`.

### E — Cerrados (no smoke)

| Producto | Esperado |
|----------|----------|
| Lifetime Upgrade | 403 `checkout_closed` |
| Partner gift | Sin Stripe — `npm run test:partner-gift-portal` |

---

## 3. Dashboard Live — checklist operador

En **modo Live** cuenta `acct_1TSg2hAAPiPo60kj` (no Linkeram):

| Item | Valor |
|------|-------|
| Webhook URL | `https://suhuella.com/api/stripe/webhook` |
| Scope | Your account |
| Eventos (8) | `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.resumed` |
| Signing secret | = `STRIPE_WEBHOOK_SECRET` en Worker (`wrangler secret put`) |

Prices confirmar activos:

| Producto | Price ID documentado |
|----------|---------------------|
| Monthly | `price_1UIAU8AAPiPo60kjL0s2civu` |
| Lifetime | `price_1UIAUyAAPiPo60kj4KFgwyxZ` |
| Business | secret → `prod_VIm3Wl67GcHe2v` |
| Partner | secret → `prod_VIm3GgwggtElq9` |

**MCP Stripe en CI/agent:** conectado solo a Linkeram — verificación catálogo/webhook = Dashboard manual.

---

## 4. Criterio de cierre

| Nivel | Criterio |
|-------|----------|
| **Automático** | `smoke:stripe-live-checkout` PASS + `test:stripe-live-readiness` PASS |
| **E2E Live** | 4 pagos reales (Monthly, Lifetime, Business, Partner) + webhook 2xx + grant D1 + activación cliente |
| **Operaciones** | Dashboard webhook + Prices verificados en `acct_1TSg2hAAPiPo60kj` |

Estado 2026-09-24: **automático PASS · E2E pago humano pendiente · Dashboard webhook no verificado desde agente**.
