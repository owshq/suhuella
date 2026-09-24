# BUSINESS-DURABILITY-AND-WEBHOOK-RECOVERY-001

Track de contención Business, persistencia D1, recuperación de webhooks y reconciliación autenticada.

**Cuenta Stripe autorizada:** `acct_1TSg2hAAPiPo60kj` (SuHuella). No usar Linkeram.

---

## 1. Causa y alcance del defecto

| Área | Defecto | Impacto |
|------|---------|---------|
| **Business store** | Organizaciones, plazas, branding y refs Stripe vivían en memoria del isolate (`business-store.ts` / disco local en dev). | Reinicio del Worker, segundo isolate o despliegue perdía estado; dos instancias no compartían org/plazas. |
| **Claim Stripe** | `claimStripeEventId` en `stripe_event` marcaba el evento como recibido antes de completar provisión durable. | Fallo tras claim → reintento Stripe descartado como duplicado; org/plazas a medias sin recuperación. |
| **Exposición comercial** | Business compartía gate con `PAID_CHECKOUT_ENABLED` sin flag propio. | No se podía cerrar Business manteniendo Monthly/Lifetime abiertos de forma independiente. |
| **Producción sin D1 Business** | Sin tablas `business_*`, el código podía caer en memoria vacía sin error explícito. | Webhooks Business podían devolver éxito sin persistencia real. |

**Alcance:** solo Business self-serve checkout y persistencia de org/plazas. Personal Monthly/Lifetime, Partner y Lifetime Upgrade no cambian su política comercial en este despliegue.

---

## 2. Contención desplegada

| Campo | Valor |
|-------|-------|
| Worker | `suhuella` |
| **Version ID (contención)** | `a4ef48a4-e6e6-45d3-ae12-b7861652ffd3` |
| Versión anterior comunicada | `209055aa-082a-4111-b23c-ee6357683f5c` |
| D1 remoto | `suhuella-license` (`database_id`: `a4c8e624-977f-4498-b6c0-7024f3ed5672`) |
| Migración 0014 remota | **No aplicada** (pendiente autorización) |

### Flags efectivos por producto (wrangler vars)

| Producto | Flag | Producción |
|----------|------|------------|
| Monthly / Lifetime | `PAID_CHECKOUT_ENABLED` | `true` |
| Business checkout | `BUSINESS_CHECKOUT_ENABLED` | `false` |
| Partner checkout | `PARTNER_CHECKOUT_ENABLED` | `false` |
| Lifetime Upgrade | catálogo + `LIFETIME_UPGRADE_CHECKOUT_ENABLED` | cerrado (sin cambio) |

Business checkout público exige **ambos** `PAID_CHECKOUT_ENABLED=true` y `BUSINESS_CHECKOUT_ENABLED=true` (`site/lib/business/checkout-gate.ts`).

### Comportamiento en producción hasta migración 0014

- UI `/checkout/business` y CTAs Business ocultos.
- `POST /api/business/checkout` → `checkout_closed` (403) sin llamadas Stripe.
- Webhooks Business (`checkout.session.completed`, `customer.subscription.*`) → **503** `persistence_unavailable` si D1 no tiene tablas `business_*` (fail-closed).
- Webhooks Personal / renovaciones existentes siguen activos.
- `POST /api/business/reconcile` (owner autenticado) disponible tras 0014; requiere proof `BUSINESS_CHECKOUT` + titular verificado.
- Gestión de plazas por email (`POST /api/business/seats` action `invite`) usa D1 cuando está listo; una org Business puede tener **múltiples plazas/licencias** asignadas por email.

---

## 3. Semántica claim, finalización y recuperación

### Modelo `stripe_event_handler` (0014)

Estados: `processing` | `completed` | `retryable`.

Flujo (`site/lib/stripe-event-processing.ts`):

1. **`beginStripeEventProcessing(eventId, handler)`** — lease (5 min). Retorna `process` | `duplicate` | `busy`.
2. Trabajo idempotente (Stripe fetch, validación catálogo, provisión).
3. **`completeStripeEventProcessing`** — marca `completed` + fila legacy en `stripe_event`.
4. **`failStripeEventProcessing`** — `retryable`, libera lease; Stripe puede reintentar.

**No** tratar claim en `stripe_event` como procesamiento terminado. Consumidores migrados:

- `business-checkout-webhook.ts`
- `business-webhooks.ts` (subscription lifecycle)
- `personal-checkout-webhook.ts`
- `partners/stripe-fulfillment.ts`

### Idempotencia de compra (Business)

Unicidad además de `event_id`:

- `business_account.stripe_checkout_session_id` (unique partial index)
- `business_account.stripe_subscription_id` (unique partial index)
- `business_seat (organisation_id, normalized_email)` (unique)

Eventos distintos de la misma compra reconcilian vía session/subscription id, no re-crean org.

---

## 4. Persistencia Business (código listo, D1 remoto pendiente)

**Store:** `site/lib/business-persistence/store.ts`  
**Entidades:** `business_account`, `business_seat`, `business_seat_change`, `business_branding`  
**Producción:** sin D1/tabla → `BusinessPersistenceUnavailableError` (503). Sin fallback silencioso a memoria.

**Multi-licencia / invitaciones:** `business-service.inviteSeat` + `POST /api/business/seats` `{ action: "invite", email, organisationId, role }` — admins añaden plazas por email; cada plaza genera `license_id` y grant business en `license_grant`.

---

## 5. Migración 0014 — preparada, NO aplicada en remoto

| Campo | Valor |
|-------|-------|
| **Nombre definitivo** | `0014_business_store_and_stripe_event_processing.sql` |
| **Archivo** | `site/migrations/0014_business_store_and_stripe_event_processing.sql` |
| **Base destino** | D1 `suhuella-license` / binding `LICENSE_DB` |
| **database_id** | `a4c8e624-977f-4498-b6c0-7024f3ed5672` |
| **Compatibilidad Worker anterior** | Sí — solo `CREATE TABLE IF NOT EXISTS`; no altera `license_grant` ni tablas partner |
| **Compatibilidad Worker nuevo sin 0014** | Business webhooks 503; checkout ya cerrado por flag |
| **Estado local** | Aplicada (`wrangler d1 migrations apply suhuella-license --local`) |

### Consultas de verificación (post-aplicación remota)

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'business_%';
SELECT name FROM sqlite_master WHERE type='table' AND name='stripe_event_handler';
SELECT COUNT(*) AS accounts FROM business_account;
SELECT COUNT(*) AS seats FROM business_seat;
SELECT status, COUNT(*) FROM stripe_event_handler GROUP BY status;
```

### Rollback

- **0014 no tiene DOWN script.** Rollback = no borrar tablas en caliente; redeploy Worker anterior + mantener `BUSINESS_CHECKOUT_ENABLED=false`.
- Eliminar tablas `business_*` / `stripe_event_handler` solo con ventana de mantenimiento y backup; perdería orgs persistidas post-migración.

### Orden exacto de promoción

1. **Autorizar y revisar SQL 0014** (contenido completo en `site/migrations/0014_…sql`).
2. Aplicar remoto:  
   `cd site && npx wrangler d1 migrations apply suhuella-license --remote`
3. Verificar consultas anteriores en D1 remoto.
4. Redeploy Worker (mismo commit candidato persistencia; Version ID nuevo).
5. Smoke: webhook Business test mode → org en D1; **no** reabrir `BUSINESS_CHECKOUT_ENABLED` hasta checklist humano.
6. Reconciliar compras Business previas (si existen) vía `/api/business/reconcile` owner + Stripe Dashboard.

---

## 6. Recuperación Business autenticada

**Ruta:** `POST /api/business/reconcile`  
**Auth:** sesión owner + `BUSINESS_CHECKOUT` email proof (no basta `session_id` anónimo).  
**Validación:** cuenta Stripe SuHuella, modo test/live, Price business, pago, suscripción, cantidad ≥ 20.  
**Idempotente:** session/subscription ya provisionadas → `duplicate: true`.

No usa `verify-session` personal. No segundo pago. No grant manual sustitutivo.

---

## 7. Tests y evidencia

```bash
npm run test:stripe-live-readiness   # raíz — incluye test:business-durability
cd site && npm run test:business-durability
```

**Evidencia local D1 (0014 aplicada localmente):**

- Business gate cerrado: cero fetch Stripe en checkout Business.
- Monthly sigue abriendo con `PAID_CHECKOUT_ENABLED=true`.
- Webhook Business provisiona org + plazas en D1; sobrevive reopen DB.
- Invitación por email persiste tras reopen.
- Claims concurrentes → `busy`; lease expirado/fallido → `retryable` → reclaim.
- Evento completado → duplicate en reintento.
- Reconciliación owner idempotente.
- Producción sin D1 → error explícito (no memoria).
- Regresión Personal/Partner/Upgrade en suite completa.

**Harness:** `site/lib/test/local-d1.ts` — adapter SQLite con `meta.changes` D1-compatible y batch serializado (business + license comparten conexión en tests).

---

## 8. Compras Business previas en Live

| Estado | Notas |
|--------|-------|
| **Verificadas en Stripe** | No ejecutado en este track (sin consulta Dashboard en sesión). |
| **Sesiones Checkout pendientes** | Cerrar nuevas sesiones **no** impide pagar una sesión ya creada. **No** se cancelaron sesiones automáticamente. |
| **Riesgo** | Si hubo pago Business con Worker pre-0014, org/plazas no están en D1 remoto; reconstruir desde Stripe (`reconcile` + webhooks tras 0014). |
| **Datos fixtures locales** | No migrados a producción. |

---

## 9. Archivos principales modificados

| Archivo | Cambio |
|---------|--------|
| `site/lib/business/checkout-gate.ts` | Gate independiente Business |
| `site/lib/stripe-event-processing.ts` | Lease processing/completed/retryable |
| `site/lib/business-persistence/*` | Store D1 + fail-closed prod |
| `site/lib/business-checkout-webhook.ts` | begin/complete/fail + D1 |
| `site/lib/business-webhooks.ts` | Claim orden + processing |
| `site/lib/business-reconciliation.ts` | Reconciliación owner |
| `site/app/api/business/reconcile/route.ts` | API autenticada |
| `site/app/api/business/seats/route.ts` | D1 + invite/remove/resend email |
| `site/migrations/0014_…sql` | Tablas business + stripe_event_handler |
| `site/lib/business-durability-check.ts` | Test obligatorio track |
| `site/lib/test/local-d1.ts` | Adapter D1 fiel para tests |
| `site/wrangler.jsonc` | `BUSINESS_CHECKOUT_ENABLED=false` |
| UI checkout/planes | Ocultar Business si gate off |

---

## 10. Intervención humana mínima restante

1. Revisar y autorizar SQL **0014** (no solo el número de migración).
2. Aplicar 0014 en D1 remoto + verificar consultas.
3. Redeploy candidato persistencia (mismo código; confirmar webhooks Business pasan de 503 a provisión).
4. Consultar Stripe Live (`acct_1TSg2hAAPiPo60kj`) por sesiones/suscripciones Business pagadas no provisionadas; reconciliar owners afectados.
5. Smoke humano Monthly (paralelo): checkout + webhook en cuenta SuHuella correcta.
6. **No** reabrir `BUSINESS_CHECKOUT_ENABLED` hasta 0014 + smoke Business en test/staging.

---

## 11. Resultado del track

| Objetivo | Estado |
|----------|--------|
| Business cerrado y contenido | **Desplegado** (`a4ef48a4-e6e6-45d3-ae12-b7861652ffd3`) |
| Persistencia/reconciliación corregidas | **Código + tests locales PASS** |
| Migración remota | **Preparada, no aplicada** |
| Monthly/Lifetime sin cambio comercial | **Confirmado** |
| Partner/Upgrade cerrados | **Sin cambio** |
| Multi-plaza / invite email | **Soportado** (`/api/business/seats`) |
