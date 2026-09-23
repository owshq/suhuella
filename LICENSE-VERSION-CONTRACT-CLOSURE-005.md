# LICENSE-VERSION-CONTRACT-CLOSURE-005

```text
STATUS = READY LOCAL (contracts · migration 0012 · tests · enforcement OFF · no deploy)
TYPE = License version contract closure
DEPENDS = LICENSE-VERSION-MODEL-001 · COMMERCIAL-GENERATIONS-FOUNDATION-002 · GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003
```

## Objective

Close pending license-version contracts before enforcement or Lifetime Upgrade activation. No production activation in this track.

## Rules observed

- No remote deploy or D1 remote migrations.
- No commercial flag changes in `wrangler.jsonc`.
- No real purchases, secrets, DNS, releases, installers, or aliases.
- No invented commercial versions or legacy rights.
- Dbasenet gift and Windows candidate untouched.

---

## 1. Legacy explicit and stable

| Before | After |
| --- | --- |
| Registry “earliest row” implied legacy rights | **Removed** — legacy = full edition caps until operator policy |
| Ambiguous incomplete grants | `classifyGrantVersionFromBinding()` with persisted `versionModelActiveAtBind` |

**Evidence on binding:** `checkout_generation_binding.version_model_active_at_bind` (migration 0012).

| Classification | Meaning |
| --- | --- |
| `recognized_pre_model_legacy` | Binding created before model active — not version-restricted |
| `post_model_valid` | Bound license version present |
| `post_model_incomplete` | Model active but version missing — no grant |

**Commercial decision still required:** explicit legacy version policy before narrowing pre-model users.

---

## 2. Pre-model vs post-model checkout

| Path | Behavior |
| --- | --- |
| `LICENSE_VERSION_MODEL_ACTIVE=false` | Missing binding → `legacy_unassigned` (existing behavior) |
| `LICENSE_VERSION_MODEL_ACTIVE=true` + no resolvable version | **No Stripe session** (`createStripeCheckoutSession` returns empty) |
| Paid webhook without valid version | **No grant** — `checkout_reconciliation_pending` incident |
| Pre-model binding (`versionModelActiveAtBind=false`) | Recognized legacy at fulfillment |

**Files:** `checkout-version-binding.ts`, `grant-classification.ts`, `grant-application.ts`, `license-fulfillment.ts`, `checkout-session.ts`.

---

## 3. Cumulative acquired versions

| Field | Role |
| --- | --- |
| `commercialGenerationId` on grant | **Original purchased version** — not overwritten on upgrade |
| `license_acquisition` rows | Append-only history (initial + upgrade) |
| `acquiredCommercialGenerationIds[]` | Server-signed cumulative set from acquisitions |
| Evaluator | Unions capabilities from all acquired ids in registry |

Upgrade checkout binding pins target at session creation (existing intent model). No `"latest"` mutable right.

**File:** `lifetime-upgrade/fulfillment.ts` — no longer overwrites grant `commercialGenerationId`.

---

## 4. Undo authorized (host-only)

| Control | Implementation |
| --- | --- |
| No client recovery flag | `recoveryOperation` removed from evaluator |
| Host inverse path | `executeOrganisationPlanForVerifiedUndo` — not on IPC |
| Tamper rejection | Rebuild inverse from **moved items**; reject stored `inversePlan` mismatch |
| Duplicate undo | Reject when `reversesRunId` already exists |
| Occupied destination | Existing `inspectActivityItemUndo` |

**Files:** `undo.ts`, `organisation-plan.ts`, `knowledge-set.ts`.

---

## 5. Local migration

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc
```

**0012:** `version_model_active_at_bind`, `checkout_reconciliation_pending`, `license_version_model_state`.

---

## Tests

```bash
npm run test:license-version-contract-closure --prefix site
npm run test:commercial-generations --prefix site
npm run test:generation-enforcement --prefix site
npm run test:lifetime-upgrade-checkout --prefix site
cd desktop && npm run test:license
# undo tamper/duplicate: desktop/electron/undo.ts runUndoChecks (via check:knowledge-set when dist rebuilt)
```

### Covered

- Registry reorder does not alter legacy rights
- Incomplete grant rejected
- Pre-model binding recognized
- Post-model checkout blocked without version (zero Stripe creates)
- Paid-without-version → open reconciliation incident
- Upgrade preserves original version + cumulative acquisitions
- Duplicate acquisition idempotency
- Undo duplicate + tampered inverse rejected (desktop)

---

## Still BLOCKED (not READY for activation)

| Item | Owner |
| --- | --- |
| Legacy version policy (commercial) | Operator |
| Desktop signed registry + enforcement bit delivery | Engineering |
| Real-device executor + manipulated IPC proof | Engineering |
| Lifetime Upgrade checkout activation | Operator + prior blockers |
| `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED` | Operator |

---

## Pending commercial decisions

1. Which license version for pre-release Lifetime grants?
2. No-cost path to first commercial version?
3. Which version boundaries require paid Upgrade?
4. Explicit legacy policy document (stable, not registry-derived).

---

## Files changed

| Area | Path |
| --- | --- |
| Migration | `site/migrations/0012_license_version_contract.sql` |
| Classification | `site/lib/commercial-generations/grant-classification.ts` |
| Pre-checkout gate | `site/lib/commercial-generations/checkout-version-binding.ts` |
| Binding evidence | `site/lib/commercial-generations/bind-at-checkout.ts`, `persistence.ts` |
| Fulfillment | `site/lib/commercial-generations/grant-application.ts`, `license-fulfillment.ts` |
| Checkout | `site/lib/checkout-session.ts` |
| Upgrade cumulative | `site/lib/lifetime-upgrade/fulfillment.ts` |
| Undo | `desktop/electron/undo.ts`, `organisation-plan.ts`, `knowledge-set.ts` |
| Tests | `site/lib/license-version-contract-closure-check.ts` |
| Persistence D1 | `site/lib/license-persistence/store.ts`, `types.ts` |

---

## External changes

**None.** No deploy, remote D1, flags, Stripe live, DNS, releases, or secrets modified.
