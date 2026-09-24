# STRIPE-LIVE-FINAL-READINESS — SuHuella

```text
STATUS = IMPLEMENTADO · PASS LOCAL · VERIFICADO LIVE (parcial) · GATE C PENDIENTE
DATE = 2026-09-24 (contraste código ↔ prod ↔ tests, sin informes previos como prueba)
ACCOUNT = acct_1TSg2hAAPiPo60kj (SuHuella Live — única autorizada)
WORKER = suhuella · D1 suhuella-license (a4c8e624-977f-4498-b6c0-7024f3ed5672)
DEPLOYED VERSION = 209055aa-082a-4111-b23c-ee6357683f5c
PARTNER = closed · LIFETIME UPGRADE = closed
OUT OF SCOPE = instaladores, aliases, Ed25519 key rotation, certificados comerciales
```

Contraste **código ↔ producción ↔ tests ejecutados hoy**. La presencia de secretos no demuestra un producto probado.

---

## 1. Resumen ejecutivo

| Área | Estado |
| --- | --- |
| Cuenta Stripe SuHuella vía MCP/API | **BLOQUEADO** — MCP conectado solo a Linkeram (`acct_1UIAErPCxG2kbkFO`) |
| Catálogo Live (Prices API) | **PENDIENTE** — requiere Dashboard Live SuHuella |
| Webhook destino + entregas | **PENDIENTE** — requiere Dashboard Live SuHuella |
| Worker + flags + D1 0013 | **VERIFICADO LIVE** |
| Personal grant D1 | **IMPLEMENTADO** · **PASS LOCAL** |
| Business webhook idempotencia D1 | **IMPLEMENTADO** · desplegado en 209055aa… |
| Business org/plazas persistencia | **BLOQUEADO** — store efímero en Worker (ver §6) |
| Smoke compra Monthly + activación Desktop | **PENDIENTE** — intervención humana |

**Corrección aplicada en este cierre:** los webhooks Business (`checkout.session.completed` y suscripción) usaban idempotencia **en memoria del isolate** (`business-store.stripeEvents`). Ahora reclaman eventos en D1 `stripe_event` con `INSERT OR IGNORE` (mismo patrón que Partner/Personal).

**Defecto abierto:** metadatos de organización Business (cuentas, plazas, refs Stripe) siguen en memoria del isolate — no sobreviven cold start ni deploy. El grant del titular puede persistir en `license_grant`, pero la org no es recuperable de forma fiable. Requiere migración D1 dedicada (0014 propuesta) **sin aplicar** hasta autorización.

---

## 2. Acceso a cuenta Stripe

Inspección MCP (`user-stripe/list_available_accounts_or_orgs`) — **2026-09-24**:

| Cuenta disponible | ¿SuHuella? |
| --- | --- |
| `acct_1UIAErPCxG2kbkFO` (Linkeram) | **No** — no usar |

**No confundir** “sin acceso MCP” con “Stripe mal configurado”. El Worker usa secretos propios; la verificación de Prices y webhook debe hacerse en **Dashboard Live** de `acct_1TSg2hAAPiPo60kj`.

**Conectar cuenta correcta (operador):**

1. Stripe Dashboard → modo **Live** → confirmar nombre/cuenta `acct_1TSg2hAAPiPo60kj`.
2. Para MCP/CLI local: `stripe login` con usuario autorizado en esa cuenta (no Linkeram).
3. **No** pegar `sk_live_` ni `whsec_` en chat.

---

## 3. Catálogo Live (documentado — API no verificada aquí)

IDs documentados en operaciones previas; **validar en Dashboard** (active, livemode, product, currency, amount, interval):

| Producto | Price ID documentado | Regla código | Gate venta |
| --- | --- | --- | --- |
| **Monthly** | `price_1UIAU8AAPiPo60kjL0s2civu` | EUR 500¢/mes | **Abierto** |
| **Lifetime** | `price_1UIAUyAAPiPo60kj4KFgwyxZ` | Importe = Price Stripe (no inventar) | **Abierto** |
| **Business** | secret `STRIPE_BUSINESS_PRICE_ID` → prod `prod_VIm3Wl67GcHe2v` | EUR 200¢/asiento/mes, mín. 20 | **Abierto** |
| **Partner** | secret `STRIPE_PARTNER_PRICE_ID` → prod `prod_VIm3GgwggtElq9` | EUR 100 000¢/año | **Cerrado** |
| **Lifetime Upgrade** | secret `STRIPE_LIFETIME_UPGRADE_PRICE_ID` | EUR 500¢ único | **Cerrado** |

Lifetime toma el importe del Price configurado (`unitAmountCents: null` en catálogo).

---

## 4. Webhook Live

| Campo | Valor |
| --- | --- |
| URL esperada | `https://suhuella.com/api/stripe/webhook` |
| Scope | Your account (no Connect) |
| Firma | Cuerpo crudo + `STRIPE_WEBHOOK_SECRET` |
| Eventos requeridos | `checkout.session.completed`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.resumed` |

### Verificado Live (2026-09-24)

| Probe | Resultado |
| --- | --- |
| `POST /api/stripe/webhook` sin firma | **400** — rechazo local ✓ |
| Destino activo en Dashboard | **No verificado** |
| Eventos suscritos | **No verificado** |
| Entrega real 2xx con firma aceptada | **No verificado** |

**Procedimiento seguro alinear signing secret (sin mostrar valores):**

```bash
cd site
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# Pegar signing secret del destino Live cuando Wrangler lo solicite en terminal local
```

Confirmar en Dashboard que no hay destinos duplicados apuntando a la misma URL. **No** enviar eventos sintéticos a producción.

El webhook **no** depende de `PAID_CHECKOUT_ENABLED` — compras ya iniciadas siguen reconciliándose si se cierra checkout.

---

## 5. Producción observada (2026-09-24)

| Probe | Resultado |
| --- | --- |
| `GET /checkout/monthly` | **302** → `checkout.stripe.com` / `cs_live_…` |
| `GET /checkout/business` | **200** |
| `GET /api/service-health` | Worker operativo |
| `npm run verify:production` post-deploy | **PASS** |

**Version ID:** `209055aa-082a-4111-b23c-ee6357683f5c`

**Flags efectivos (`wrangler.jsonc` + prod):**

```json
"PAID_CHECKOUT_ENABLED": "true",
"PARTNER_CHECKOUT_ENABLED": "false"
```

Monthly, Lifetime y Business expuestos juntos vía `PAID_CHECKOUT_ENABLED`. Partner y Upgrade siguen cerrados por gates independientes.

---

## 6. Persistencia y recuperación

### Personal Monthly / Lifetime — **IMPLEMENTADO**

| Capa | Mecanismo |
| --- | --- |
| Grant | D1 `license_grant` vía `upsertStoredGrant` |
| Idempotencia webhook | D1 `stripe_event` |
| Recuperación browser | `GET /api/verify-session` → `reconcilePaidCheckoutSession` |
| Productos soportados verify-session | **Solo `monthly` y `lifetime`** — Business/Partner/Upgrade devuelven `invalid_session` |

### Business — **PARCIAL / BLOQUEADO**

| Capa | Mecanismo | Durabilidad Worker |
| --- | --- | --- |
| Org, plazas, refs Stripe | `business-store.ts` | **Memoria isolate** — `storePath()` null en Worker |
| Idempotencia webhook | `claimStripeEventId` → D1 `stripe_event` | **Durable** (fix 2026-09-24) |
| Grant titular | `upsertStoredGrant` en provision | **Durable** en D1 |
| Recuperación verify-session | **No soportada** | — |
| Recuperación operador | Re-envío webhook Stripe o ops manual con refs session/subscription | Idempotente vía D1 event + session id |

**Nota sobre “business-store JSON”:** en local Node escribe `.data/business.json`; en Cloudflare Workers solo memoria (`defaultSave` catch “Worker / read-only runtime”). No es un blob D1.

**Migración 0014 (propuesta, NO aplicada):** tablas D1 para `business_account`, `business_seat`, etc. Requiere autorización explícita antes de `migrations apply --remote`.

### Partner — **IMPLEMENTADO (cerrado comercialmente)**

| Capa | Mecanismo |
| --- | --- |
| Entitlement | Tablas Partner D1 |
| Idempotencia | `stripeEventAlreadyHandled` / `rememberStripeEvent` → D1 |
| Gift Dbasenet | Ops-only, independiente de Stripe checkout |

### Lifetime Upgrade — **CERRADO**

Catálogo `checkoutEnabled: false`; ruta devuelve `checkout_closed`.

---

## 7. Estado por producto

| Producto | Código | Config secretos | Tests | Venta | Live E2E |
| --- | --- | --- | --- | --- | --- |
| **Personal Monthly** | ✓ | Presentes | PASS | **Abierto** | **PENDIENTE** (Gate C) |
| **Personal Lifetime** | ✓ | Presentes | PASS | **Abierto** | **PENDIENTE** |
| **Business** | ✓ | Presentes | PASS | **Abierto** | **BLOQUEADO** (persistencia org) + smoke **PENDIENTE** |
| **Partner anual** | ✓ | Presentes | PASS | **Cerrado** | **PENDIENTE** autorización |
| **Partner gift** | ✓ | Ops | PASS | Ops-only | N/A |
| **Lifetime Upgrade** | ✓ cerrado | Presente | PASS | **Cerrado** | N/A |

---

## 8. Problemas encontrados y resueltos (este cierre)

| Problema | Severidad | Resolución | Estado |
| --- | --- | --- | --- |
| Business webhook idempotencia en memoria | Alta | `claimStripeEventId` + D1 `INSERT OR IGNORE` en `business-webhooks.ts`, `business-checkout-webhook.ts` | **IMPLEMENTADO** · desplegado |
| Claim no atómico file/memory en tests | Media | `claimStripeEventId` read-modify-write único en `withLicensePersistence` | **IMPLEMENTADO** |
| Tests interferían por `license-state.json` compartido | Baja | `LICENSE_STORE_PATH` aislado por check | **IMPLEMENTADO** |
| Informe desactualizado (0013 pendiente, checkout cerrado) | Info | Este documento | **IMPLEMENTADO** |

### Archivos modificados (2026-09-24)

| Archivo | Cambio |
| --- | --- |
| `site/lib/checkout-reconciliation.ts` | `claimStripeEventId` (D1 atómico + fallback) |
| `site/lib/license-persistence/store.ts` | `claimStripeEvent` en store D1 |
| `site/lib/license-persistence/types.ts` | tipo opcional `claimStripeEvent` |
| `site/lib/business-webhooks.ts` | idempotencia D1 |
| `site/lib/business-checkout-webhook.ts` | idempotencia D1 |
| `site/lib/business-seat-billing-check.ts` | store aislado + IDs evento únicos |
| `site/lib/checkout-complete-by-product-check.ts` | store aislado + IDs evento únicos |
| `STRIPE-LIVE-FINAL-READINESS.md` | este informe |

---

## 9. Tests ejecutados (2026-09-24)

| Comando | Resultado |
| --- | --- |
| `npm run test:stripe-live-readiness` | **PASS** |
| Deploy + `npm run verify:production` | **PASS** |

Incluye: PAN en rutas ejecutables, firma inválida, duplicados webhook, Business &lt;20 plazas, partner vs gift, upgrade cerrado, seat billing lifecycle.

**No sustituyen:** compra Live humana, entrega webhook Dashboard, activación Desktop.

---

## 10. D1 migraciones

```bash
cd site && npx wrangler d1 migrations list suhuella-license --remote
```

**2026-09-24:** `✅ No migrations to apply!` — `0013_license_token_algorithm.sql` aplicada.

Backup pre-0013: `site/.build/recovery/suhuella-license-pre-0013-20260923T214214Z.sql`

**No re-aplicar 0013.** Migración 0014 Business store: **pendiente autorización**.

---

## 11. Protocolo Gate C — Monthly (titular)

**Prerrequisitos operador**

1. Dashboard Live SuHuella: Prices y webhook destino verificados (§3–§4).
2. Signing secret alineado con Worker (§4).
3. Desktop candidato instalado (registrar SHA256).

**Candidatos desktop (sin republicar en este track)**

| Plataforma | SHA256 |
| --- | --- |
| Mac | `247bec3ea5ea84c75daf85bb76228336e244a7ec463d076a519363a92470b136` |
| Windows | `b25ca4135fd600caaf1e82e4ed3ee6d38855982daa447257f781b9da81f8680e` |

**Pasos titular (una compra real — no automatizar)**

1. `https://suhuella.com/checkout/monthly` → completar Stripe Checkout Live.
2. **No** compartir PAN/CVV/OTP en chat.

**Verificación operador (registrar PASS/FAIL)**

| # | Comprobación |
| --- | --- |
| 1 | Dashboard: pago `succeeded`, cuenta `acct_1TSg2hAAPiPo60kj`, price Monthly correcto |
| 2 | Webhook entregado **2xx** en Dashboard para este pago |
| 3 | D1: un único `personal_monthly` grant, refs session/customer/subscription correctas |
| 4 | Desktop: OTP titular → token Ed25519 aceptado |
| 5 | Modo avión: derechos dentro de `offlineUntil` |
| 6 | Plan Mode en carpeta temporal: mover, renombrar, deshacer |

**Registrar:** producto, timestamp UTC, `evt_…` / `cs_live_…`, grant id, device id, Version ID Worker, SHA256 Desktop.

**Matiz success URL:** volver a `/success` **no** demuestra fulfillment si el usuario no completó activación — separar evidencias.

**Después de Monthly PASS:** smoke Lifetime y Business por separado. Partner requiere autorización de apertura (`PARTNER_CHECKOUT_ENABLED`) y compra propia.

**Suscripción Live = real:** no cancelar ni reembolsar sin instrucción explícita.

---

## 12. Si pago OK y derechos fallan

1. Conservar `cs_live_…`, `evt_…`, email titular, timestamp.
2. Contener nuevas compras (cerrar `PAID_CHECKOUT_ENABLED` si procede — webhooks siguen).
3. Corregir causa raíz.
4. Reconciliar idempotentemente (webhook re-send o `verify-session` para Personal).
5. **No** segundo pago, **no** gift encubridor, **no** reembolso automático.

---

## 13. Intervención humana pendiente (mínima)

| # | Acción | Quién |
| --- | --- | --- |
| 1 | Verificar Prices Live en Dashboard `acct_1TSg2hAAPiPo60kj` vs tabla §3 | Operador |
| 2 | Verificar webhook destino único, 8 eventos, entrega 2xx reciente | Operador |
| 3 | Alinear `STRIPE_WEBHOOK_SECRET` si Dashboard rotó secret | Operador (`wrangler secret put`) |
| 4 | Compra Monthly Live + checklist §11 | Titular + operador |
| 5 | Autorizar diseño/aplicación migración 0014 Business D1 antes de smoke Business Live | Operador |
| 6 | Autorizar `PARTNER_CHECKOUT_ENABLED=true` + smoke Partner | Operador (futuro) |

---

## 14. Flags finales

| Flag | Valor | Efecto |
| --- | --- | --- |
| `PAID_CHECKOUT_ENABLED` | `true` | Monthly + Lifetime + Business checkout público |
| `PARTNER_CHECKOUT_ENABLED` | `false` | Partner checkout cerrado |
| Lifetime Upgrade env | ausente/false | Upgrade cerrado |

Cerrar checkout **no** detiene webhooks ni reconciliación de compras en vuelo.
