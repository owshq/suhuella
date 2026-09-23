# SUHUELLA — CHECKOUT COMPLETO POR PRODUCTO 001

**Track:** implementación y verificación local. **No** incluye deploy, D1 remoto, DNS, compras reales ni activación comercial en producción.

**Cuenta Stripe SuHuella:** `acct_1TSg2hAAPiPo60kj`

**Decisión vigente:** Business y Partner tienen checkout propio (sustituye Contact sales / Partner sin checkout). Free sin pago. Dbasenet conserva gift (`origin=gift`). Lifetime Upgrade cerrado hasta elegibilidad y generaciones.

## Estado por producto

| Producto | Implementado | Probado (mocks) | Bloqueado | Habilitado en prod |
|---|---|---|---|---|
| Free | Sí | Sí | — | Sí (sin pago) |
| Personal Monthly | Sí (existente) | Sí (`test:personal-checkout-webhook`, `test:checkout`) | — | No (`PAID_CHECKOUT_ENABLED=false`) |
| Personal Lifetime | Sí (existente) | Sí | — | No |
| Business | Sí (nuevo) | Sí (`test:checkout-complete-by-product`) | — | No |
| Partner anual | Sí (existente) | Sí (`test:partner-public-program`) | — | No (`PARTNER_CHECKOUT_ENABLED=false`) |
| Partner gift (Dbasenet) | Sí (Ops + script local) | Sí (`provision:dbasenet-gift`, `test:dbasenet-gift-provision`) | Prod Ops smoke remoto | Gift Ops-only |
| Lifetime Upgrade | Auditoría (`lifetime-upgrade-audit.ts`) | Sí (cerrado) | Generación / elegibilidad no implementada | No |

## Recorridos

### Personal Monthly / Lifetime
- `/checkout/monthly` · `/checkout/lifetime` → Stripe Checkout alojado
- Webhook → `applyPersonalCheckoutWebhook` → grant personal D1
- Pago pendiente no concede derechos; deduplicación por `event_id`

### Business
- `/license` → `/checkout/business` (cuando flags abiertos)
- Email verificado (`BUSINESS_CHECKOUT`) → selección plazas (mín. 20, enteros) → `POST /api/business/checkout`
- Stripe suscripción por cantidad (EUR 2/usuario/mes desde catálogo)
- Webhook → `applyBusinessCheckoutWebhook` → org + owner + plazas
- Sin mailto Contact sales como único recorrido

### Partner
- `/partners` → email verificado → `POST /api/partners/checkout`
- EUR 1.000/año; webhook → entitlement Partner → portal
- Gift Dbasenet: Ops, `origin=gift`, sin Stripe

### Lifetime Upgrade
- `lifetimeUpgradeSaleEnabled()` → `false`
- `evaluateLifetimeUpgradeCheckout()` → siempre bloqueado (`generation_model_missing`, etc.)
- Catálogo preparado pero checkout deshabilitado
- **Pendiente:** modelo de generación, elegibilidad servidor, anti-recompra, enforcement Web/Desktop

## Flags (solo lectura en este track)

| Flag | `wrangler.jsonc` | Efecto |
|---|---|---|
| `PAID_CHECKOUT_ENABLED` | `false` | Personal + Business checkout cerrados |
| `PARTNER_CHECKOUT_ENABLED` | `false` | Partner checkout cerrado |

Catálogo (`STRIPE_CATALOG`): `business.checkoutEnabled=true`, `partner.checkoutEnabled=true`, `lifetime_upgrade.checkoutEnabled=false`.

## Tests

```bash
cd site
npm run test:checkout-complete-by-product
npm run test:checkout
npm run test:personal-checkout-webhook
npm run test:partner-public-program
npm run test:business-seat-billing
npm run provision:dbasenet-gift
npm run test:dbasenet-gift-provision
```

## Decisiones comerciales pendientes

1. **Lifetime Upgrade:** definir generación de licencia, reglas de elegibilidad y enforcement antes de abrir cobro.
2. **Dbasenet gift prod smoke:** Ops `create_partner` slug `dbasenet`, owner `info.linkeram@gmail.com`; verificar portal + aislamiento de marca (fixture local ya en `test:partner-gift-portal`).
3. **Impuestos Business/Partner:** mostrar según configuración Stripe real (no inventada en UI).

## Plan de activación (separado — no ejecutado aquí)

1. Confirmar secrets Worker: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs Live.
2. Smoke webhook Live (sin compra automatizada en CI).
3. Activar `PAID_CHECKOUT_ENABLED=true` → Personal + Business.
4. Activar `PARTNER_CHECKOUT_ENABLED=true` → Partner anual.
5. Monitor reconciliación 24h; no migrar suscripciones Business existentes.

## Confirmación

- Sin compras reales en tests automatizados
- Sin deploy ni cambios D1 remoto en este track
- Flags comerciales permanecen `false` en `wrangler.jsonc`
