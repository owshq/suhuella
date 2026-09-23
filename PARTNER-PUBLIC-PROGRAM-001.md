# PARTNER-PUBLIC-PROGRAM-001

```text
STATUS = LOCAL ADVANCE · production NOT accepted
B1 = remote list reported no pending migrations on 2026-09-23 · not a batch re-apply order
B2 = OPEN (deploy) · B3–B6 pending
TYPE = Public partner program discovery and application
SCOPE = /partners · D1 applications · Ops approval · no auto-sales
CHECKOUT = CLOSED
PUBLICATION = none
```

## Surfaces (separated)

| URL | Audience | Purpose |
| --- | --- | --- |
| `/partners` | Public (platform host only) | Discover program, price from Stripe Price when configured, apply |
| `/hostname-status` | Public visitors on non-active partner hostnames | Visitor notice only — no DNS, no onboarding |
| `/partners/onboarding/[token]` | Invited partner admin | Private OTP → session → setup |
| `/partners/onboarding/complete` | Authenticated partner session only | Brand + hostname + DNS |
| `/partners/portal` | Partner member after email verification | Permanent panel. Invite link is not required to return. See [PARTNER-GIFT-PORTAL-001.md](./PARTNER-GIFT-PORTAL-001.md) |
| `ops.suhuella.com` | SuHuella operators | Review applications, approve/reject, manual invite URL |

Registering interest **does not** grant entitlements. Email invite delivery is **manual** via Operations notice (copy link).

## Journey

1. **Discover** — `/partners`
2. **Identify** — `PARTNER_APPLICATION` OTP (`/api/partners/apply`, platform host only)
3. **Entitlement** — paid (when enabled) or Ops-approved gift/manual/internal/test
4. **Private setup** — onboarding after invite accept
5. **Activation** — entitlement + verified hostname

## Persistence

Table `partner_application` (migration `0009_partner_application.sql` on `LICENSE_DB`):

| Column | Notes |
| --- | --- |
| `status` | `pending` · `in_review` · `approving` · `approved` · `rejected` |
| `normalized_email` | UNIQUE — rejected rows are **not** auto-reopened |

Legacy `partnerApplications` in local license JSON files: run `migrateLegacyPartnerApplicationsIfPresent()` if present. Data never written to D1 cannot be recovered automatically.

## OTP + submit_interest

1. `peekVerifiedEmailProof` validates the caller
2. D1 `submitPartnerApplication` persists
3. `consumeVerifiedEmailProof` runs **only after** successful persist

If D1 fails, the proof remains valid for retry.

## Ops approval

`approve_partner_application`:

- Conditional claim (`pending`/`in_review` → `approving`) prevents concurrent double approval
- Creates partner via `createPartner` (reuses its onboarding invite — **no** duplicate `createOnboardingInvite`)
- Links existing partner by owner email when present
- Idempotent when already `approved`
- On failure after claim: releases to `in_review`
- Notice includes manual onboarding URL

## Checkout flags (stay off)

| Flag | Default |
| --- | --- |
| `PAID_CHECKOUT_ENABLED` | `false` — general gate |
| `PARTNER_CHECKOUT_ENABLED` | `false` — partner-specific |
| `STRIPE_CATALOG.partner.checkoutEnabled` | `true` in code (still gated by flags above) |
| `STRIPE_CATALOG.business.checkoutEnabled` | `true` in code (Business self-serve; gated by `PAID_CHECKOUT_ENABLED`) |

Monthly/Lifetime must not open Partner when only `PAID_CHECKOUT_ENABLED=true`.

## Price display

`resolvePartnerPublicPrice()` loads `STRIPE_PARTNER_PRICE_ID` via Stripe when secrets exist. UI shows Stripe/catalog amount with a tax disclaimer — **does not** assert net/gross treatment or confirm commercial decisions.

## Enablement order (production — manual only)

1. Implement partner Checkout Session + webhook → `recordStripePartnerEntitlement`
2. Sandbox end-to-end test
3. Validate Live Price ID + webhook
4. Commercial approval
5. **Last:** `PARTNER_CHECKOUT_ENABLED=true`, then `PAID_CHECKOUT_ENABLED=true` if selling personal plans too

## Tests

```bash
npm run test:partner-public-program --prefix site
npm run test:partners --prefix site
npm run test:operations-control-center --prefix site
npm run test:partner-production-blockers --prefix site
npm run build --prefix site
```

Local D1 durability: `test:partner-public-program` applies `wrangler d1 migrations apply --local`, writes, reopens sqlite, verifies read + UNIQUE constraint.

## Local review (2026-09-23)

### Test results — PASS

| Command | Result |
| --- | --- |
| `npm run test:partner-public-program --prefix site` | PASS |
| `npm run test:partners --prefix site` | PASS |
| `npm run test:operations-control-center --prefix site` | PASS |
| `npm run build --prefix site` | PASS (after TS fixes in `business-checkout-webhook.ts`, `business-sync.ts`) |

Brand track (same session):

| Command | Result |
| --- | --- |
| `npm run test:brand-presentation --prefix site` | PASS |
| `npm run test:hostname-resolution --prefix site` | PASS |
| `npm run test:brand-theme --prefix site` | PASS |

### Browser verification (platform host `localhost:3000`)

| URL | Observed |
| --- | --- |
| `/home` | SuHuella wordmark, sidebar nav, **Download for Mac** with brand accent |
| `/partners` | `PartnerProgramPageContent` — program copy, **1000 € / año** from `resolvePartnerPublicPrice()`, OTP apply form, link to `/partners/portal` |
| `/partners` locale toggle | Page title switches EN/ES; body copy follows dictionary after navigation |

Captures: `docs/brand-presentation-captures/002/` (`localhost-platform-home.png`, `localhost-platform-partners.png`, prior `domain-status-unknown-localhost.png` fixture).

Surface separation on non-platform hosts is covered by `test:brand-presentation` and middleware checks in `test:partners` (not re-run in browser — requires `/etc/hosts` FQDN).

### Production blockers

Code preflight (automated, no remote changes):

```bash
npm run test:partner-production-blockers --prefix site
```

Remote D1 status (2026-09-23):

| Migration | Remote |
| --- | --- |
| `0007_partners.sql` | ✅ Applied |
| `0008_partner_domain.sql` | ✅ Applied |
| `0009_partner_application.sql` | ✅ Applied |
| `0010_partner_stripe_ledger.sql` | ✅ Applied |

Verified tables on remote `suhuella-license`: `partner`, `partner_domain`, `partner_application`, `partner_checkout_attempt`, `partner_stripe_fulfillment`.

```bash
npx wrangler d1 migrations list suhuella-license --remote   # → No migrations to apply!
```

| # | Blocker | Owner | Status |
| --- | --- | --- | --- |
| B1 | D1 remote migrations on `suhuella-license` | Operator | **LISTED** 2026-09-23 — no pending files reported. Not a batch apply of `0007`–`0010`, and not production acceptance |
| B2 | Worker deploy with checkout flags **off** | Operator | **OPEN** — live `GET /partners` → 404 (route not in deployed Worker) |
| B3 | Ops approval smoke on production | Operator | **OPEN** — blocked on B2 deploy |
| B4 | Stripe partner sandbox E2E | Operator + commercial | **OPEN** |
| B5 | `PARTNER_CHECKOUT_ENABLED=true` | Operator | **OPEN** — after B1–B4 |
| B6 | `PAID_CHECKOUT_ENABLED=true` | Operator | **OPEN** — only if personal checkout sells too |

Partner checkout isolation (code, already asserted): partner checkout does **not** open when only `PAID_CHECKOUT_ENABLED=true`.

---

## Production activation runbook (operator)

Do **not** run from an unauthorized agent session. Requires `wrangler login` on the SuHuella Cloudflare account.

### A. D1 — identify, then apply (B1)

From `site/`, list first. Do not apply a named range.

```bash
npx wrangler d1 migrations list suhuella-license --remote
```

For each file the list still marks pending, read that file against the live schema: which base it expects, what SQL it runs, and whether it is compatible with rows already there. Apply that file only. Do not apply `0007`–`0010` because this track mentions them.

Files in repo order, for identification:

| File | Table |
| --- | --- |
| `0007_partners.sql` | `partner` |
| `0008_partner_domain.sql` | `partner_domain` |
| `0009_partner_application.sql` | `partner_application` |
| `0010_partner_stripe_ledger.sql` | `partner_stripe_fulfillment` |

On 2026-09-23 the remote list reported no migrations left to apply, and those table names were present. That observation is not a review of each file, and it is not an instruction to run them again.

```bash
npx wrangler d1 execute suhuella-license --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('partner','partner_domain','partner_application','partner_stripe_fulfillment');"
```

Until `partner_application` exists, `/api/partners/apply` fails closed (503 / table missing). Deploying a previous Worker does not drop these tables or undo rows.

### B. Deploy — flags stay off (B2)

Confirm before and after deploy in `site/wrangler.jsonc`:

```json
"PAID_CHECKOUT_ENABLED": "false",
"PARTNER_CHECKOUT_ENABLED": "false"
```

Deploy the candidate Worker only after the pending-migration list is reviewed. Redeploying a previous Worker version leaves D1 data in place. Do **not** enable checkout in that deploy. Checkout stays closed.

Post-deploy smoke:

| Check | Expected |
| --- | --- |
| `GET https://suhuella.com/partners` | Program page 200, price from catalog/Stripe |
| `GET https://suhuella.com/partners/portal` | Portal entry (platform host) |
| Non-platform host `/partners` | Neutral visitor screen (not program) |
| `GET https://suhuella.com/api/service-health` | NORMAL |

Interest-only path (checkout off): OTP verify → `submit_interest` persists to D1 → Ops manual follow-up.

### C. Operations — approval path (B3)

On `https://ops.suhuella.com` (Cloudflare Access — see [OPERATIONS-PRODUCTION-ACTIVATION-001.md](./OPERATIONS-PRODUCTION-ACTIVATION-001.md)):

1. Submit a test application on `/partners` (or seed in D1 only in non-prod).
2. `approve_partner_application` — idempotent, concurrent-safe claim.
3. Notice includes **manual onboarding URL** (no auto-email in this track).
4. Owner completes `/partners/onboarding/[token]` → brand + hostname setup.

Gift/manual partners: [PARTNER-GIFT-PORTAL-001.md](./PARTNER-GIFT-PORTAL-001.md).

### D. Stripe — enablement order (B4–B6)

Parent: [SUHUELLA-STRIPE-CLOUDFLARE-PRODUCTION-READINESS-001.md](./SUHUELLA-STRIPE-CLOUDFLARE-PRODUCTION-READINESS-001.md).

| Step | Action |
| --- | --- |
| 1 | Partner Checkout Session + webhook → `recordStripePartnerEntitlement` (sandbox) |
| 2 | End-to-end sandbox purchase → entitlement + Ops visibility |
| 3 | Validate Live `STRIPE_PARTNER_PRICE_ID` + webhook signing secret |
| 4 | Commercial approval |
| 5 | **`PARTNER_CHECKOUT_ENABLED=true`** + redeploy |
| 6 | **`PAID_CHECKOUT_ENABLED=true`** only if Monthly/Lifetime/Business sell publicly too |

Monthly/Lifetime must **not** open Partner checkout when only `PAID_CHECKOUT_ENABLED=true` (asserted in `test:partner-public-program`).

### E. Close this track

Mark **PASS** only when B1–B3 are verified on production and B4–B6 match the chosen commercial posture (interest-only vs paid partner sales).

---

## Execution log

### 2026-09-23 — B1 closed

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --remote
# → 0009_partner_application.sql ✅
# → 0010_partner_stripe_ledger.sql ✅
npx wrangler d1 migrations list suhuella-license --remote
# → No migrations to apply!
```

### 2026-09-23 — B2 smoke (pre-deploy)

| Check | Result |
| --- | --- |
| `GET https://suhuella.com/api/service-health` | `NORMAL` |
| `GET https://suhuella.com/home` | 200 |
| `GET https://suhuella.com/partners` | **404** (Next.js not-found — deploy required) |
| `GET https://suhuella.com/partners/portal` | **404** |

**Next operator action (B2):**

```bash
cd site
npm run deploy
npm run verify:production   # now includes /partners and /partners/portal
```

Checkout flags must remain `false` in `wrangler.jsonc` before deploy.
