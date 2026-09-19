# LICENSE-PAID-GRANT-DURABILITY-001

```text
STATUS = CLOSED · PASS
TYPE = Production blocker fix
UNBLOCKS = PRODUCTION-READINESS-001
```

## Root cause

Paid grants were not in `LICENSE_DB`. D1 already stored activations, OTP challenges, verified proofs, activation attempts, and rate-limit events. Paid / gifted / manual / business grants were written through process-memory stores (`defaultBusinessStore`, in-process maps, optional local `.data/business.json`).

A Worker isolate loss, deploy, or a request landing on a different isolate could drop the paid entitlement.

A second fail-open existed in Stripe fallback: a customer record with no live subscription was treated as `personal_lifetime`. That can invent a paid right.

`checkLicense` could reconstruct a paid grant from the signed token when the memory grant was missing. Token is proof of a previous check, not grant authority.

```text
BEFORE
  checkout / gift / business write  →  process memory
  checkLicense                      →  memory grant, else token reconstruction
  Stripe customer, no subscription  →  personal_lifetime

AFTER
  checkout / gift / business write  →  LICENSE_DB.license_grant
  checkLicense                      →  D1 grant only; missing / revoked / expired fail closed
  Stripe customer alone             →  no entitlement
```

## Authority model

| Source | Production role |
| --- | --- |
| `LICENSE_DB.license_grant` | Sole paid-grant write and read authority |
| Worker process memory | Never paid-grant authority |
| `LICENSE_GRANTS` env | Ignored in production. Dev/test overlay only; cannot override a durable `licenseId` |
| `defaultBusinessStore` grants | Development / isolated Business-service tests. Not used by activate / check / OTP eligibility |
| File store (`.data/license-state.json`) | Local development and tests only |
| Signed `licenseToken` | Device session. Cannot recreate a missing grant |

Invariant: **no durable grant = no paid entitlement.**

## Schema migration

**Name:** `0004_license_grant.sql`

**Local:**

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc
```

**Production:**

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --remote --config wrangler.jsonc
```

Idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. Does not alter activation, OTP, proof, attempt, or rate-limit tables. Not destructive.

Table `license_grant`: `license_id` PK, normalized email, customer id, Stripe customer / subscription indexes, edition, status, origin, timestamps, revocation metadata, JSON `payload` of the existing grant shape.

No `brandId`, `acceptedBrands`, `issuedByOperator`, or other future commercial-authority fields.

### Migration limitation

Existing production paid grants that lived only in Worker memory or env cannot be reconstructed. Those entitlements are gone unless re-issued from a verified Stripe session, a new gift/manual write, or a Business seat that is persisted after this deploy. Document that limitation before applying `0004` and deploying the Worker.

Until `0004` is applied, production paid reads/writes fail closed (`LICENSE_DB` required; missing binding or missing table is not a memory fallback).

## Affected files

| Area | Files |
| --- | --- |
| Migration | `site/migrations/0004_license_grant.sql` |
| Persistence | `site/lib/license-persistence/types.ts`, `site/lib/license-persistence/store.ts` |
| Grant store | `site/lib/license-store.ts` |
| Checkout | `site/lib/license-fulfillment.ts`, `site/app/api/verify-session/route.ts` |
| Check / activate | `site/lib/license-service.ts` |
| OTP eligibility | `site/lib/email-verification.ts` |
| Operations gifts | `site/lib/operations/service.ts` |
| Business convert | `site/lib/business-service.ts`, `site/app/api/admin/business/route.ts` |
| Fail-closed gate | `site/lib/service-capability-guard.ts` |
| Tests | `site/lib/license-grant-durability-check.ts`, `site/lib/license-audit-check.ts`, `site/lib/license-otp-production-check.ts`, `site/lib/business-license-check.ts` |

## Tests added

`site/lib/license-grant-durability-check.ts` (`npm run test:grant-durability`):

1. Checkout fulfillment writes a durable grant
2. `checkLicense` reads that grant
3. Simulated isolate restart (`resetLicensePersistenceStoreForTests` + file re-read) keeps entitlement
4. Paid grant still present after memory reset
5. Stripe customer without a durable grant is not Lifetime
6. Cancelled / expired monthly does not become Lifetime and fails closed
7. Gift/manual grant survives isolate restart
8. Revoked grant fails closed
9. Device activation still works
10. Device limit still works
11. Forged success session still fails
12. Unbound activation attempt still fails
13. Production without D1 cannot write a paid grant to process memory
14. Production ignores `LICENSE_GRANTS` env

Existing OTP / proof / admin / paid-revoke tests remain in their suites.

## Tests run

Site:

- `npm run test:grant-durability` — PASS
- `npm run test:license` — PASS
- `npm run test:otp-production` — PASS
- `npm run test:email` — PASS
- `npm run test:admin` — PASS
- `npm run test:service-health` — PASS
- `npm run check:business-license` — PASS
- `npm run verify:production` — PASS
- `npm run build` — PASS

Desktop:

- `npx tsc --noEmit` — PASS
- `npm run check:knowledge-set` — PASS
- `npm run test:license` — PASS
- `npm run build` — PASS

Required for checkLicense after activation: signed tokens omit `undefined` fields (`canonicalize`). Tokens that previously embedded `:undefined` were already unreadable.

## Remaining accepted limitations

- Stripe Checkout for lifetime / monthly remains `INTENTIONALLY_PARTIAL` (unavailable redirect). This slice does not open paid checkout.
- Business automated checkout and branding remain out of scope. Business is still Contact Sales. A Business grant that *is* created (Operations invite / create org, convert) is now D1-backed.
- Historical in-memory / env grants are not migrated. Re-issue if a real customer was granted only in memory.
- `defaultBusinessStore` still holds accounts, seats, and a test-only grants array. That array is not activate / check / OTP authority.
- Empty `/api/release` installer URLs, version drift, Resend production delivery, Windows installer, Edge verification, Multibrand, Connect, BYOK, Connections, and Automations are unchanged.

## Production migration notes

1. Apply `0004_license_grant.sql` to `suhuella-license` remotely **before** or with the Worker deploy that reads `license_grant`.
2. Confirm `LICENSE_DB` remains bound in `wrangler.jsonc`.
3. Do not seed paid grants from env in production.
4. After deploy, a verified checkout session or an Operations gift/manual write is required to create a grant.
5. Re-run `PRODUCTION-READINESS-001` before promoting to rc1.

## Regression risk

Low and local to license persistence. Device activation, device limits, paid-revoke rules, OTP, and unbound-attempt fail-closed are unchanged in contract. Risk is apply-order: deploying the Worker before `0004` makes paid activate/check/checkout return unavailable until the migration exists.

## Production gate (this P0)

```text
PAID_ENTITLEMENT_DURABILITY = PASS
PROCESS_MEMORY_PAID_ENTITLEMENT_AUTHORITY = ABSENT
STRIPE_CUSTOMER_FALLBACK_INVENTS_LIFETIME = NO
CHECK_LICENSE_USES_DURABLE_GRANT = PASS
```

`PRODUCTION-READINESS-001` is unblocked on this P0 and should be re-run in full before RC. Do not treat this close as rc1.
