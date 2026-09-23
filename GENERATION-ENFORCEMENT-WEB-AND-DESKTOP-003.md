# GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003

```text
STATUS = BLOCKED
TYPE = License-version rights enforcement (Web + Desktop)
DEPENDS = COMMERCIAL-GENERATIONS-FOUNDATION-002 · LICENSE-VERSION-MODEL-001
```

## Objective

Apply commercial **license version** rights on Web and Desktop without conflating **downloading a version** with **acquiring rights**. Public download stays open; user documents are never held hostage.

## Verdict

**Local corrections acceptable. Commercial model pending. Enforcement and Upgrade closed.**

This document and attached specs do **not** accredit full test suites or production executors. Activation requires signed Desktop delivery + closed contracts below.

---

## Closed locally (evaluator / fulfillment scaffolding)

| Area | Behavior |
| --- | --- |
| Invalid / incomplete grants | `grant_configuration_invalid` — not treated as legacy |
| Empty registry + enforcement ON | Fail-closed for paid editions |
| Edition / access mode mismatch | Rejected before rights calculation |
| Malformed dates | Corrupt configuration — not “no expiry” |
| Cumulative versions | `acquiredCommercialGenerationIds[]` union in evaluator; server signs from acquisition history |
| Post-model purchase without binding | `version_binding_required` when `LICENSE_VERSION_MODEL_ACTIVE=true` |
| Recognized legacy | **Not version-restricted** until explicit legacy policy (no registry-implied rights) |

---

## Open before activation

### 1. Legacy policy (commercial — not engineering guess)

Registry order or “earliest row” **must not** define legacy rights. Operator must publish an explicit, stable legacy version policy. Until then: do not narrow pre-model grants under enforcement.

### 2. Undo recovery (host authority)

`recoveryOperation` as a client/evaluator flag is **removed**. Undo must:

1. Load a real Activity run
2. Build and validate the inverse plan (paths, conflicts, permissions)
3. Execute via **`executeOrganisationPlanForVerifiedUndo`** — host-only, not IPC

**Still required:** proof that manipulated `knowledge-set:executePlan` requests cannot undo or perform new paid operations.

### 3. Cumulative license versions (server → Desktop)

Evaluator accepts `acquiredCommercialGenerationIds[]`. **Desktop must receive and verify** the signed cumulative set + registry — Worker flag alone does not enforce on old builds.

### 4. Signed rights delivery on Desktop

**Local (006):** Contract v1 signs capabilities, cumulative versions, `generationEnforcementActive`, `policyRevision`. Desktop/Browser executors use `assertSignedExecutorRights` — not Worker env or local registry.

| Still required for activation | Notes |
| --- | --- |
| Minimum app version gate in production | Old executables ignore signed enforcement until they ship 006 verify path |
| Real-device executor matrix | Tampered IPC / patched binary proof |
| Verify secret embedded in release builds | Dev mode skips verify when secret absent |

### 5. Real executor matrix

- Desktop E2E organise deny/allow with signed policy
- Browser FSA tampered cache vs executor
- Offline past `offlineUntil`
- Undo on expired license (host path only)
- Corrupt grant / manipulated token

---

## Shared evaluator

**Source:** `packages/product/src/lib/generation-rights.ts`

| Input | Use |
| --- | --- |
| Edition, status, validUntil, offlineUntil | Entitlement baseline |
| `commercialGenerationId` | Initial purchased version (Lifetime) |
| `acquiredCommercialGenerationIds` | Cumulative acquired versions (preferred for upgrades) |
| `generationAccessMode` | Access pattern |
| Registry | Version-gated capabilities |
| `enforcementActive` | Pass-through when false |

**When enforcement ON (non-legacy):**

| Mode | Version access |
| --- | --- |
| `purchased_generation` | Union of capabilities from all ids in cumulative set |
| `active_subscription` | Registry versions with `effectiveFrom <= now` |
| `legacy_unassigned` | Full edition caps — **no version restriction until legacy policy** |
| `version_binding_required` | Denied — incomplete post-model grant |
| Invalid / corrupt | `grant_configuration_invalid` |

---

## Enforcement matrix

| Surface | Mechanism | Status |
| --- | --- | --- |
| Server sign | `license-service.ts` | Partial — signs capabilities + acquired ids |
| Desktop executor | `knowledge-set.ts` | Gate on new work; undo via verified host path |
| Browser executor | `generation-executor-gate.ts` | Wiring only |
| Public download | Unchanged | Open |

`checkRelease()` = install guidance only — not license authority.

---

## Tests (local — not activation accreditation)

```bash
npm run test:generation-enforcement --prefix site
npm run test:commercial-generations --prefix site
cd desktop && npm run test:license && npm run check:knowledge-set
```

---

## Activation (operator — blocked)

1. Approve [LICENSE-VERSION-MODEL-001.md](./LICENSE-VERSION-MODEL-001.md) including legacy policy.
2. Ship Desktop signed registry + cumulative version set + enforcement bit.
3. Pass real executor matrix (including undo manipulation tests).
4. Populate production registry + pinned Upgrade prices.
5. Enable `LICENSE_VERSION_MODEL_ACTIVE` then `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED` only on builds that verify signed policy.
6. Monitor version-gated denials and binding-missing grants.
