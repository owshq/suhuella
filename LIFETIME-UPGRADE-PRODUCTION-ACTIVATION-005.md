# LIFETIME-UPGRADE-PRODUCTION-ACTIVATION-005

```text
STATUS = READY (operator-run · secrets · remote D1 · controlled window)
TYPE = Production activation for Lifetime Upgrade + generation enforcement
DEPENDS = LIFETIME-UPGRADE-CHECKOUT-004 · COMMERCIAL-GENERATIONS-FOUNDATION-002
BLOCKS = GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003 (real-device matrix still open)
```

## License version ids (production)

Aligned with [LICENSE-VERSION-MODEL-001.md](./LICENSE-VERSION-MODEL-001.md):

| Id | Product meaning | Upgrade |
| --- | --- | --- |
| `gen_license_v1_0` | Lifetime 1.x rights | Source |
| `gen_license_v2_0` | Lifetime 2.x rights (EUR 5 Upgrade) | Target |

Template (copy into Worker secrets — **not** Git):

`site/config/commercial-generation-production.example.json`

---

## Worker secrets (production)

```bash
cd site

# Registry + maps (paste JSON from example; replace price_… with live/test ids)
npx wrangler secret put COMMERCIAL_GENERATION_REGISTRY
npx wrangler secret put COMMERCIAL_GENERATION_PRICE_MAP
npx wrangler secret put COMMERCIAL_GENERATION_UPGRADE_MAP

# Stripe (already in readiness doc)
npx wrangler secret put STRIPE_LIFETIME_UPGRADE_PRICE_ID
npx wrangler secret put STRIPE_LIFETIME_PRICE_ID

# Signing (Ed25519 private preferred for Desktop enforcement bit)
npx wrangler secret put LICENSE_SIGNING_PRIVATE_KEY
```

---

## D1 migrations (`suhuella-license` / `LICENSE_DB`)

Apply **after** 0001–0010 already on remote:

| Migration | Track |
| --- | --- |
| `0011_commercial_generations.sql` | Foundation |
| `0012_lifetime_upgrade_intent.sql` | Upgrade intents |
| `0012_license_version_contract.sql` | Version model state |

Both `0012_*` files are independent — apply both. Do not renumber if one is already applied.

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --remote --config wrangler.jsonc
npx wrangler d1 migrations list suhuella-license --remote --config wrangler.jsonc
```

Then sync registry rows from secrets into D1:

```bash
# With secrets exported locally or via wrangler dev env
node scripts/sync-commercial-generation-registry.mjs
```

Or use the window script: `node scripts/lifetime-upgrade-production-window.mjs --sync-registry`

---

## Controlled window flags (secrets — never commit `true` in wrangler.jsonc)

| Secret | Value | Effect |
| --- | --- | --- |
| `LICENSE_VERSION_MODEL_ACTIVE` | `true` | Post-model binding rules |
| `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED` | `true` | Web sign + evaluator |
| `LIFETIME_UPGRADE_CHECKOUT_ENABLED` | `true` | Upgrade Stripe Checkout |
| `PAID_CHECKOUT_ENABLED` | `true` | Optional — only if personal checkout opens too |

`wrangler.jsonc` **stays** `"PAID_CHECKOUT_ENABLED": "false"` as default; window uses **secrets**.

Helper:

```bash
node scripts/lifetime-upgrade-production-window.mjs --apply-window   # interactive
node scripts/lifetime-upgrade-production-window.mjs --close-window   # rollback
```

Redeploy Worker after flipping secrets.

---

## Manual Stripe test checkout (before GA)

```bash
cd site
npm run test:lifetime-upgrade-production-activation
npm run test:lifetime-upgrade-stripe-test          # simulated session
LIFETIME_UPGRADE_MANUAL_STRIPE=1 \
  STRIPE_SECRET_KEY=sk_test_… \
  STRIPE_LIFETIME_UPGRADE_PRICE_ID=price_… \
  npm run test:lifetime-upgrade-stripe-test
```

Verify after payment:

1. `lifetime_upgrade_intent.status = fulfilled`
2. `license_acquisition` row `kind=upgrade` with `gen_license_v2_0`
3. `checkLicense` → `acquiredCommercialGenerationIds` includes v1 + v2
4. `rename_file` allowed when enforcement on

---

## Validation commands

```bash
cd site
node scripts/lifetime-upgrade-production-window.mjs --check
```

Runs: `test:lifetime-upgrade-production-activation`, `test:lifetime-upgrade-checkout`, `test:generation-enforcement`.

---

## Honest blockers (still open for GA)

| Blocker | Doc |
| --- | --- |
| Legacy version policy for pre-model grants | LICENSE-VERSION-MODEL-001 |
| Real Desktop executor / IPC tamper matrix | GENERATION-ENFORCEMENT-003 |
| Published Desktop build with signed verify | SIGNED-LICENSE-RIGHTS-006 |
| Stripe **Live** smoke (human pays once) | SUHUELLA-STRIPE-CLOUDFLARE-PRODUCTION-READINESS-001 |

**Test-mode window PASS ≠ Live GA.**

---

## Rollback

1. `--close-window` (all window secrets → `false`)
2. Redeploy Worker
3. Upgrade intents remain in D1 for audit; no auto-refund on duplicate_payment incidents
