# STRIPE-LIVE — candidato de deploy (sin aplicar)

```text
STATUS = CODE CANDIDATE PREPARED · PRODUCTION NOT APPROVED · GATE C PENDING
DATE = 2026-09-23
PARTNER = closed · LIFETIME UPGRADE = closed
```

**Estado correcto:** código candidato preparado; producción y recorrido de compra **todavía no aprobados**.

---

## Orden obligatorio antes de Gate C (operador)

| Paso | Acción | Estado repo |
| --- | --- | --- |
| **1** | Cerrar exposición Personal: `PAID_CHECKOUT_ENABLED=false` + deploy | **Listo en repo** · prod sigue en `true` hasta deploy |
| **2** | Confirmar webhook Live en Dashboard **`acct_1TSg2hAAPiPo60kj`** (no MCP Linkeram) | Pendiente operador |
| **3** | Aplicar migración **`0013`** en D1 `suhuella-license` tras revisar SQL y backup | **Pendiente** — solo `0013` en cola remota |
| **4** | Deploy fixes (Business Suspense, PAN en rutas) + smoke Business | Pendiente deploy |
| **5** | Ventana compra humana **Monthly** (titular): pago → webhook → grant → Ed25519 → offline | Pendiente Gate C |

**Paso 1 conserva webhooks y reconciliación:** `POST /api/stripe/webhook` y `GET /api/verify-session` **no** consultan `PAID_CHECKOUT_ENABLED`.

**Paso 3 es bloqueo funcional:** sin `0013`, la escritura de activaciones Ed25519 con algoritmo persistido **falla** en D1 remoto.

---

## Diff funcional (código)

| Archivo | Cambio |
| --- | --- |
| `site/wrangler.jsonc` | `PAID_CHECKOUT_ENABLED: "false"` (cerrar ventas hasta Gate C) |
| `site/app/(suhuella)/checkout/business/page.tsx` | `<Suspense>` alrededor de `BusinessCheckoutPageContent` (fix HTTP 500) |
| `site/app/api/partners/checkout/route.ts` | `rawCardRejection` |
| `site/app/api/lifetime-upgrade/checkout/route.ts` | `rawCardRejection` |
| `site/lib/checkout-route-pan-guard-check.ts` | **Pruebas ejecutables** PAN → 400, Stripe fetch = 0 |
| `site/lib/business-license-check.ts` | node-register + tabs Permissions + assert Suspense |
| `site/lib/settings-tabs-check.ts` | tabs Permissions |
| `site/lib/partner-public-program-check.ts` | gate autenticado + wrangler sales closed |
| Checks varios | assert `PAID_CHECKOUT_ENABLED: "false"` en wrangler |
| `.github/workflows/desktop-windows-build.yml` | secret solo en step Resolve (no job env) |

## Flags efectivos tras deploy paso 1+4

| Var | Repo `wrangler.jsonc` | Efecto post-deploy |
| --- | --- | --- |
| `PAID_CHECKOUT_ENABLED` | `"false"` | Personal + Business checkout **cerrados** (403/unavailable) |
| `PARTNER_CHECKOUT_ENABLED` | `"false"` | Partner checkout **cerrado** |
| `CLOUD_INTEGRATIONS_ENABLED` | `"false"` | sin cambio |

**Gate C — abrir venta Monthly:** operador pone `"true"`, deploy, una compra humana, evidencia, luego volver a `"false"` o mantener según decisión.

## Comando deploy (operador — tras revisar pasos 2–3 según orden acordado)

```bash
cd site
npm run build
npm run deploy
# Verificar Version ID en output; no imprimir secretos
```

## Tests obligatorios antes de deploy

```bash
npm run test:stripe-live-readiness
```

Incluye `test:checkout-route-pan-guard` — ejecuta handlers con PAN rechazado y **contador Stripe = 0** (no basta importar `rawCardRejection`).

## Post-deploy smoke (sin crear sesiones Live de salud)

1. `GET https://suhuella.com/checkout/monthly` → **no** 302 a Stripe (sales closed)
2. `GET https://suhuella.com/checkout/business` → **200** (Suspense fix; **500 desaparece solo tras deploy**)
3. Business POST con plazas &lt;20 → error controlado (no 500)
4. Personal Monthly redirect Live → reservado para ventana humana Gate C (paso 5)
