# LICENSE-HMAC-RETIREMENT-2B

```text
STATUS = IN PROGRESS (dual-verify client · D1 algorithm tracking · HMAC secret still live)
TYPE = Phase 2B — transition grace before retiring LICENSE_SIGNING_SECRET
DEPENDS = SIGNED-LICENSE-RIGHTS-DELIVERY-006 · LICENSE-ED25519-PRODUCTION-DEPLOY-001
```

## Design decision — HMAC offline verify

**Do not embed `LICENSE_SIGNING_SECRET` in the desktop client.**

HMAC is symmetric: any extracted secret lets an attacker forge paid tokens offline. That violates 006’s trust model (public keys only on clients).

**Dual-verify implemented as:**

| Format | Offline local verify | Online |
| --- | --- | --- |
| `ed25519.<body>.<sig>` | Ed25519 crypto against embedded public keys | Server re-signs on check |
| `<body>.<sig>` (legacy HMAC) | **No crypto** — online-attested cache only while `offlineUntil` is future + payload validates | Server HMAC verify (unchanged) |

Fail-closed unchanged for: missing `.`, malformed prefix, expired `offlineUntil`, corrupt payload, invalid Ed25519 signature.

Legacy offline grace = same trust class as `0.1.0-pre-rc` permissive cache, bounded by `offlineUntil`. Ed25519 path is the real integrity upgrade.

## Client implementation

- `desktop/electron/license-signature-verify.ts` — `verifyLicenseSignatureDetailed()` with modes `ed25519-crypto` | `legacy-hmac-online-attested`
- `desktop/electron/license-dual-verify-check.ts` — functional tests

```bash
cd desktop && npm run test:license-dual-verify
```

## D1 — can we count HMAC tokens today?

**Before 0013:** **No.** D1 stores grants (`license_grant.payload` = grant metadata, not signed token) and activations without token or algorithm. The signed token lives only in client `license.json` and in-flight API bodies.

**After 0013 (`last_presented_token_algorithm` on `license_activation`):** each successful **check/activate** records the algorithm the **client presented** (not the newly issued token). Query:

```bash
cd site
npx wrangler d1 execute suhuella-license --remote --command \
  "SELECT last_presented_token_algorithm, COUNT(*) AS n FROM license_activation WHERE status = 'active' GROUP BY last_presented_token_algorithm"
```

Recent HMAC-only clients (30-day lookback):

```sql
SELECT COUNT(*) FROM license_activation
WHERE status = 'active'
  AND last_presented_token_algorithm = 'legacy-hmac-sha256'
  AND last_seen >= datetime('now', '-30 days');
```

Helper: `site/lib/license-hmac-retirement-metrics.ts` · check: `npm run test:license-hmac-retirement-2b --prefix site`

## Objective 2B closure criteria (all required)

1. **Worker** signs new tokens with Ed25519 only (`LICENSE_SIGNING_PRIVATE_KEY` deployed; production no longer issues HMAC for new activations/checks).
2. **D1 query** returns **0** active activations with `last_presented_token_algorithm = 'legacy-hmac-sha256'` and `last_seen` within the last **30 days** (configurable lookback in metrics helper).
3. **Desktop release** with dual-verify + public keys published; operator communication sent (LICENSE-ED25519-PRODUCTION-DEPLOY-001 §5).
4. **Explicit operator decision** logged to retire `LICENSE_SIGNING_SECRET` (remove secret + delete server HMAC path in a follow-up task — not automatic).

Until (1) and (2) pass, **do not remove** `LICENSE_SIGNING_SECRET` — legacy clients and cached HMAC tokens still need server verify.

## Server changes (this track)

- Migration `0013_license_token_algorithm.sql`
- `license-service.ts` — record `lastPresentedTokenAlgorithm` on check/activate
- `license-persistence/store.ts` — read/write column when migration applied

Signing priority unchanged: Ed25519 if private key set, else HMAC.

## Deploy order (with LICENSE-ED25519-PRODUCTION-DEPLOY-001)

1. Apply migration 0013 on D1 (enables HMAC→Ed25519 metric).
2. Worker secrets (Ed25519 + OTP + partner — Phase 2A).
3. Publish desktop 006+2A+2B with `SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS`.
4. Smoke + communication §5.
5. Monitor D1 until HMAC presentations = 0 (30-day lookback).
6. Follow-up task: remove server HMAC path + `LICENSE_SIGNING_SECRET`.

## Not in scope

- Removing `LICENSE_SIGNING_SECRET` or server HMAC verify code (this track)
- Browser local crypto verify
- Plan Mode / executor changes
