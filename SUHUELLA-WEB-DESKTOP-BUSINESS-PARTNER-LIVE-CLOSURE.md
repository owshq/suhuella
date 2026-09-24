# SUHUELLA — WEB + DESKTOP + BUSINESS/PARTNER LIVE CLOSURE

Track de apertura comercial autorizada: Personal Monthly/Lifetime, Business, Partner Platform License; Partner gift separado de Stripe; Lifetime Upgrade permanece cerrado.

**Cuenta Stripe autorizada:** `acct_1TSg2hAAPiPo60kj`  
**Worker:** `suhuella` · **Dominio:** https://suhuella.com  
**D1:** `suhuella-license` · `database_id`: `a4c8e624-977f-4498-b6c0-7024f3ed5672`

---

## Version ID y flags finales (desplegado)

| Campo | Valor |
|-------|-------|
| **Version ID** | `b1818bb4-a4d6-4427-ad20-422ddd61e885` |
| Versión anterior (contención) | `a4ef48a4-e6e6-45d3-ae12-b7861652ffd3` |
| `PAID_CHECKOUT_ENABLED` | `true` |
| `BUSINESS_CHECKOUT_ENABLED` | `true` |
| `PARTNER_CHECKOUT_ENABLED` | `true` |
| Lifetime Upgrade | **cerrado** (catálogo + env) |

Verificación deploy (bindings wrangler): los tres flags aparecen como `"true"` en el despliegue del 2026-09-24.

---

## 1. Persistencia y migración 0014

### Dependencia de processing leases

`stripe_event_handler` (estados `processing` / `completed` / `retryable`) **requiere migración 0014**. Sin ella, Business webhooks devuelven 503 `persistence_unavailable`.

### Migración remota — APLICADA

| Paso | Evidencia |
|------|-----------|
| Backup pre-0014 | `.data/d1-backup-pre-0014.sql` (24 245 bytes) |
| Aplicación | `0014_business_store_and_stripe_event_processing.sql` ✅ remoto |
| Pendientes | `wrangler d1 migrations list --remote` → **No migrations to apply** |
| Tablas Business | `business_account`, `business_seat`, `business_seat_change`, `business_branding` |
| Tablas lease | `stripe_event_handler` |

### Consultas post-migración (ejecutadas)

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'business_%';
-- business_account, business_seat, business_seat_change, business_branding

SELECT name FROM sqlite_master WHERE type='table' AND name='stripe_event_handler';
-- stripe_event_handler
```

### Rollback

0014 no tiene DOWN. Rollback operativo = redeploy Worker anterior + mantener flags; no borrar tablas en caliente sin backup.

---

## 2. Webhook y catálogo Live — VERIFICACIÓN MANUAL REQUERIDA (SuHuella)

**MCP Stripe en este entorno:** solo **Linkeram** (`acct_1UIAErPCxG2kbkFO`). **No** es `acct_1TSg2hAAPiPo60kj`. No se inventó verificación Live.

### Checklist Dashboard Live (`acct_1TSg2hAAPiPo60kj`)

| Comprobación | Valor esperado |
|--------------|----------------|
| Webhook URL | `https://suhuella.com/api/stripe/webhook` |
| Scope | Your account |
| Eventos (exactos, 8) | `checkout.session.completed` · `invoice.paid` · `invoice.payment_succeeded` · `invoice.payment_failed` · `customer.subscription.created` · `customer.subscription.updated` · `customer.subscription.deleted` · `customer.subscription.resumed` |
| Signing secret | Correspondencia real secret ↔ endpoint activo |

### Prices (referencia repo — confirmar en Dashboard)

| Producto | Price ID documentado |
|----------|---------------------|
| Monthly | `price_1UIAU8AAPiPo60kjL0s2civu` (EUR 5/mes) |
| Lifetime | `price_1UIAUyAAPiPo60kj4KFgwyxZ` (EUR 100 one-off) |
| Business | secret → prod `prod_VIm3Wl67GcHe2v` (EUR 2/usuario/mes) |
| Partner | secret → prod `prod_VIm3GgwggtElq9` (EUR 1.000/año) |

**Nota:** Business/Partner se habilitaron en prod antes de cerrar esta verificación. Resolver checklist **antes** de invitar clientes a pagar.

---

## 2b. Pre-rc spctl — CORREGIDO

| Item | Detalle |
|------|---------|
| **Causa del bloqueo** | `desktop/scripts/verify-mac-bundle.mjs` usaba `resolveMacCodesignIdentity()` (identidad en llavero) en lugar de la firma real del `.app`. Con Developer ID instalado pero app adhoc/sin notarizar → `spctl` rechazaba → **exit 1**. |
| **Fix** | `scripts/mac-gatekeeper-assess.mjs` — clasifica `PASS` / `EXPECTED_UNSIGNED_REJECTION` / `BLOCK` según canal `pre-rc-unsigned` y firma real (`detectMacCodesignState`). |
| **Test** | `npm run test:mac-gatekeeper-assess` |
| **Validación** | `npm run validate-release -- --platform mac` → `✓ spctl EXPECTED_UNSIGNED_REJECTION` · **PreRcReleaseValidation PASS** |

Bloqueantes conservados: artefacto ausente, `codesign --verify` fallido, claves Ed25519 ausentes, canal comercial sin requisitos.

---

## 3. Estado por producto

| Producto | Implementado | Probado local | Habilitado prod | E2E Live verificado | Pendiente humano |
|----------|--------------|---------------|-----------------|---------------------|------------------|
| **Personal Monthly** | ✅ | ✅ | ✅ | ⚠️ parcial | **Probes auto PASS · pago humano pendiente** |
| **Personal Lifetime** | ✅ | ✅ | ✅ | ⚠️ parcial | **Probes auto PASS · pago humano pendiente** |
| **Business** | ✅ | ✅ D1 + durability | ✅ | ⚠️ parcial | **Probes auto PASS · pago humano pendiente** |
| **Partner Platform** | ✅ | ✅ | ✅ | ⚠️ parcial | **Probes auto PASS · pago humano pendiente** |
| **Partner gift** | ✅ | ✅ `test:partner-gift-portal` | ✅ (no Stripe) | ❌ | Smoke gift + portal |
| **Lifetime Upgrade** | ✅ código | ✅ cerrado | ❌ | — | Permanece cerrado |

### Rutas producción (HTTP)

| Ruta | Código | Notas |
|------|--------|-------|
| `/checkout/monthly` | 302 | Redirige a Stripe Checkout |
| `/checkout/business` | 200 | Página activa (email + plazas) |
| `/partners` | 200 | Programa público |
| `POST /api/lifetime-upgrade/checkout` `{}` | 400 `invalid_request` | Campos obligatorios ausentes |
| `POST /api/lifetime-upgrade/checkout` `{proofId,licenseId}` | 403 `checkout_closed` | Gate cerrado confirmado |

### Checkout Web/Desktop

- Solo **Checkout Sessions** servidor + Stripe alojado.
- Desktop: `shell.openExternal` → `https://suhuella.com/checkout/{plan}` (`desktop/electron/license-client.ts`).
- PAN rechazado antes de Stripe (`raw-card-guard`).
- Activación separada: webhook/reconcile + OTP titular + `activate-from-checkout`.

---

## 4. Business — recuperación de compradores sin org

`POST /api/business/reconcile` + `reconcileBusinessCheckoutForOwner`:

- Requiere **proof email verificado** (`BUSINESS_CHECKOUT`) + `sessionId`.
- Valida titular contra email Stripe (metadata / `customer_email`).
- **No** exige pertenecer a org preexistente — crea org vía `provisionFromStripeCheckout` si falta.
- Conocer `session_id` solo **no** autoriza (401/403 sin proof).

Gestión multi-plaza: `POST /api/business/seats` `{ action: "invite", email, organisationId, role }` — una licencia (`license_id`) por plaza.

---

## 5. Partner — alcance

- Descubrimiento `/partners`, checkout anual gated por `PARTNER_CHECKOUT_ENABLED=true`.
- Fulfillment D1 (`partner`, `partner_entitlement`, `partner_stripe_fulfillment`).
- Portal + onboarding tras pago (sin revisión manual en flujo estándar).
- **Gift:** origen autorizado, no Stripe; `test:partner-gift-portal` PASS; Dbasenet no inventado desde fixtures.
- No Stripe Connect ni cobros de clientes del partner en este track.

---

## 6. Idempotencia y recuperación

Demostrado en suite local (`test:business-durability`, `test:personal-checkout-webhook`, `test:business-seat-billing`, `test:partner-public-program`):

- Claim (`beginStripeEventProcessing`) ≠ completed.
- Lease abandonado → `retryable` → reclaim.
- Duplicados concurrentes → `busy`.
- Eventos distintos misma compra → idempotencia por session/subscription id.
- Reconciliación disponible con checkout cerrado (test env override).
- Fail-closed sin D1 en producción.

---

## 7. Tests ejecutados (PASS)

```bash
npm run test:stripe-live-readiness   # suite completa
npm run smoke:stripe-live-checkout   # probes prod sin pago (10/10 PASS 2026-09-24)
npm run test:license                 # web + desktop Ed25519
npm run test:partner-gift-portal     # gift separado Stripe
```

Runbook E2E humano: [STRIPE-LIVE-SMOKE-RUNBOOK.md](./STRIPE-LIVE-SMOKE-RUNBOOK.md)

Incluye: checkout gates, PAN guard, business durability D1, partner program, lifetime upgrade cerrado, business seat billing, settings tabs.

---

## 8. Archivos modificados en este track

| Archivo | Cambio |
|---------|--------|
| `site/wrangler.jsonc` | `BUSINESS_CHECKOUT_ENABLED=true`, `PARTNER_CHECKOUT_ENABLED=true` |
| `site/lib/checkout-enablement-check.ts` | Asserts flags abiertos |
| `site/lib/checkout-complete-by-product-check.ts` | Idem |
| `site/lib/business-durability-check.ts` | Assert wrangler abierto; test contención vía env |
| `site/lib/license-copy-audit-check.ts` | Partner flag |
| `site/lib/partner-*-check.ts` | Partner flag |
| `site/lib/partners-check.ts` | Partner flag |
| `.data/d1-backup-pre-0014.sql` | Backup D1 remoto |

Código Business/Partner/persistencia del track anterior (`BUSINESS-DURABILITY-AND-WEBHOOK-RECOVERY-001`) ya desplegado; este track aplica 0014 remoto + apertura flags.

---

## 9. Desktop candidatos

| Plataforma | Archivo | Tamaño | SHA256 |
|------------|---------|--------|--------|
| **Mac pre-rc** | `desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg` | 146 272 363 bytes | `3e29308155745cd51c3ef5b176a577685308b58f94fdb4644c312f6edecc2504` |
| Windows pre-rc | — | — | CI `desktop-windows-build.yml` — no build local (requiere Windows + .NET SDK) |

Sidecar: `SuHuella-0.1.0-pre-rc.dmg.sha256` · Reporte: `desktop/.build/suhuella/CANDIDATE-mac.json`

Metadatos honestos: **adhoc** Mac (sin Developer ID / sin notarización) · Authenticode Windows congelado. **No** se actualizó `release.json` ni aliases.

Ed25519: claves públicas embebidas en build; SPKI fingerprints `2b81e7594ccec379` (overlap Worker documentado en log PreRcReleaseValidation).

Tests Desktop PASS: `license-status-check`, `license-dual-verify-check` (checkout external browser, planes Monthly/Lifetime/Business paths).

---

## 10. Plan Mode

Rutas `/plan-mode` y `/activity` responden 200 en producción. Tests de executor y undo existen en paquete producto; **E2E humano Plan Mode no ejecutado** en esta sesión (marcar pendiente en smoke).

---

## 11. Pruebas manuales pendientes (humano)

### Stripe Dashboard (`acct_1TSg2hAAPiPo60kj`)

1. Confirmar webhook Live activo en URL y eventos listados arriba.
2. Validar Prices Monthly/Lifetime/Business/Partner (active, livemode, EUR, importe, intervalo).
3. Confirmar signing secret ↔ Worker.

### Smoke por producto (Checkout alojado — **usuario paga**)

| Producto | Pasos |
|----------|-------|
| Monthly | Checkout → webhook → grant D1 → activación Web/Desktop |
| Lifetime | Idem one-off |
| Business | Email verify → checkout ≥20 plazas → org D1 → invite miembro → activación |
| Partner | `/partners` → checkout → portal → onboarding |
| Gift | Flujo ops/gift autorizado (sin Stripe) |

**No** declarar E2E Live PASS hasta completar cada fila.

### Recuperación operativa

Si existe pago sin derecho: `POST /api/business/reconcile` (Business) o reconciliación personal existente; **sin segundo cobro**, **sin gift sustituto**.

---

## 12. Intervención humana mínima restante

1. **Conectar MCP o Dashboard** a cuenta SuHuella (no Linkeram) y cerrar verificación webhook + catálogo.
2. **Smokes Live** independientes por producto (tabla §11).
3. **Desktop:** ejecutar/build candidatos si el build Mac local no completó; Windows vía CI.
4. **DNS/TLS Partner hostname** — verificación separada del pago.

---

## Resultado

| Objetivo | Estado |
|----------|--------|
| 0014 remoto + persistencia Business | **Hecho** |
| Flags tres productos abiertos | **Desplegado** `b1818bb4-…` |
| Lifetime Upgrade cerrado | **Sí** |
| Webhook/catálogo Live verificados | **Bloqueado** — cuenta MCP incorrecta |
| E2E Live | **Pendiente humano** por producto |
| Compras automáticas | **No realizadas** (por instrucción) |
