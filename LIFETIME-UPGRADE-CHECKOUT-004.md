# LIFETIME-UPGRADE-CHECKOUT-004

```text
STATUS = COMPLETE (implementation · local migration · tests · checkout CLOSED · no remote deploy · no real charges)
TYPE = Lifetime Upgrade hosted Checkout (EUR 5 generation acquisition)
DEPENDS = COMMERCIAL-GENERATIONS-FOUNDATION-002
```

## Objective

Implement Lifetime Upgrade as a **generation acquisition** for eligible Lifetime holders (EUR 500 céntimos, one-time Stripe Checkout), with checkout **closed** until operator validation and commercial authorization.

## Rules observed

- No automatic real purchases in tests or CI.
- No remote D1 deploy or `--remote` migrations.
- Commercial flags unchanged (`lifetimeUpgradeSaleEnabled()` → `false`, `checkoutEnabled: false`).
- Stripe Checkout hosted only — no Payment Links for Upgrade, no PAN, no custom PaymentIntents.
- Upgrade does **not** create a new Lifetime license.
- No invented eligibility for gifts or `legacy_unassigned` grants.
- Security patches are not sold as upgrades (unchanged foundation policy).

---

## Flow

### Before Checkout (`POST /api/lifetime-upgrade/checkout`)

1. Commercial gate (`evaluateLifetimeUpgradeCheckout`) — **closed by default**.
2. Verified email proof (`LIFETIME_UPGRADE` purpose, consumed once).
3. Lifetime grant loaded from persistence by `licenseId`.
4. Eligibility: holder match, active `personal_lifetime`, purchased source generation, valid upgrade path, target not yet acquired.
5. Rejects Free, Monthly, Business, legacy/gift-unassigned grants.
6. Stripe Price validated server-side (EUR 500, one-time, account/mode).
7. Intent persisted (`lifetime_upgrade_intent`) with idempotency key `licenseId:targetGenerationId`.
8. Concurrent retry while `checkout_created` → `checkout_in_progress` (no duplicate Stripe session).

### After payment (webhook + reconciliation)

1. Signature verified (existing Stripe webhook route).
2. Session verified with Stripe API (`payment_status=paid`).
3. Intent resolved from persisted `checkout_session_id` (metadata not authoritative alone).
4. Checkout generation binding applied at session creation.
5. Grant updated: `commercialGenerationId` → target; `generationAccessMode` → `purchased_generation`.
6. Append-only `license_acquisition` with `kind: upgrade` (deduped by checkout + event).
7. License id, origin, and prior acquisitions preserved.
8. Signed license context refreshed on next `checkLicense`.
9. Works without browser return to success URL.
10. Second confirmed payment for same generation → `duplicate_payment` incident, no extra rights, no auto-refund.

---

## Implementation

| Area | Path |
| --- | --- |
| Types | `site/lib/lifetime-upgrade/types.ts` |
| Eligibility | `site/lib/lifetime-upgrade/eligibility.ts` |
| Upgrade path env | `site/lib/lifetime-upgrade/generation-path.ts` |
| Intent persistence | `site/lib/lifetime-upgrade/intent-persistence.ts` |
| Checkout session | `site/lib/lifetime-upgrade/checkout-session.ts` |
| Fulfillment | `site/lib/lifetime-upgrade/fulfillment.ts` |
| Webhook | `site/lib/lifetime-upgrade-webhook.ts` |
| Commercial gate | `site/lib/lifetime-upgrade-audit.ts` |
| API route | `site/app/api/lifetime-upgrade/checkout/route.ts` |
| D1 migration (local) | `site/migrations/0012_lifetime_upgrade_intent.sql` |
| Tests | `site/lib/lifetime-upgrade-checkout-check.ts` |

### Local migration

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc
```

Do **not** run `--remote` until operator promotion.

### Operator configuration (required before opening sales)

| Variable | Purpose |
| --- | --- |
| `STRIPE_LIFETIME_UPGRADE_PRICE_ID` | Stripe Price (`price_…`, EUR 500, one-time) |
| `COMMERCIAL_GENERATION_UPGRADE_MAP` | JSON `[{ "from": "…", "to": "…" }]` — no invented paths |
| `COMMERCIAL_GENERATION_PRICE_MAP` | Must map upgrade price → target generation (`product: lifetime_upgrade`) |
| Commercial flags | `lifetimeUpgradeSaleEnabled()`, catalog `checkoutEnabled`, `PAID_CHECKOUT_ENABLED` |
| Enforcement | `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED=true` on Web **and** Desktop |

---

## Commercial blockers (current)

| Blocker | State |
| --- | --- |
| `sale_switch_off` | **Active** — `lifetimeUpgradeSaleEnabled()` hard-coded `false` |
| `catalog_disabled` | **Active** — `STRIPE_CATALOG.lifetime_upgrade.checkoutEnabled === false` |
| `PAID_CHECKOUT_ENABLED` | **Off** in wrangler |
| `upgrade_map_missing` | **Active** until `COMMERCIAL_GENERATION_UPGRADE_MAP` set in production |
| `eligibility_enforcement_missing` | **Active** — generation enforcement off |
| `desktop_enforcement_missing` | **Active** — Desktop gate not enabled |

**Result:** no production Stripe Checkout sessions for Upgrade; tests use `bypassCommercialGateForTests` only inside the check script.

---

## Tests

```bash
npm run test:lifetime-upgrade-checkout --prefix site
```

Covers: wrong holder, non-lifetime, legacy/gift unassigned, generation already acquired, concurrent checkout, wrong price, pending payment, webhook dedup, double payment incident, history preserved, signed context generation, flags closed (zero Stripe calls).

---

## Post-validation procedure (operator)

1. Confirm first production generation ids and upgrade path in `COMMERCIAL_GENERATION_UPGRADE_MAP`.
2. Map Stripe Upgrade Price in `COMMERCIAL_GENERATION_PRICE_MAP`.
3. Apply migration `0012` remotely after `0011` promotion plan.
4. Enable Web + Desktop generation enforcement and verify Desktop reads upgraded `commercialGenerationId`.
5. Set `STRIPE_LIFETIME_UPGRADE_PRICE_ID` in production secrets.
6. Enable catalog + sale switch + `PAID_CHECKOUT_ENABLED` in a controlled window.
7. Run one manual test checkout in Stripe test mode; verify acquisition row + grant generation + signed token.
8. Monitor `duplicate_payment` incidents before general availability.

---

## Confirmation

- Upgrade checkout implementation: **complete**
- Commercial checkout: **closed**
- Real charges in CI/tests: **none**
- Remote migration/deploy: **not performed**
