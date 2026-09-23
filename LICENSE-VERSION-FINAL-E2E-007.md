# LICENSE-VERSION-FINAL-E2E-007

```text
STATUS = IN PROGRESS (local integration · honest platform labels · no deploy · enforcement CLOSED)
TYPE = License version end-to-end validation (local)
DEPENDS = LICENSE-VERSION-CONTRACT-CLOSURE-005 · SIGNED-LICENSE-RIGHTS-DELIVERY-006
```

## Objective

Validate the license-version and Upgrade path locally through real routes, storage, signatures, and executors — with **honest** evidence labels. **Local PASS ≠ Stripe Live or published installer validation.**

## Rules observed

- No real purchases, Live secrets, production webhooks, deploy, or artifact publish.
- Stripe stand-in enabled only via `LICENSE_VERSION_E2E_SIMULATOR=true` in the E2E check (forbidden in production).
- Test registry fixtures only — not production commercial ids.
- File writes limited to temp directories.
- **Enforcement and Upgrade checkout remain CLOSED in production flags.**

---

## Platform legend (honest)

| Label | Meaning |
| --- | --- |
| **A** | Unit / pure function |
| **B** | Service-layer integration + local D1 (not HTTP wire) |
| **B+** | Next.js **route handler** invoked directly (real HTTP handler code, not browser fetch) |
| **C−** | Host gate **module** in Node (not Chromium) |
| **C** | **Playwright Chromium** running bundled gate |
| **E−** | Node + `test-electron-mock.cjs` (not real Electron) |
| **E** | Real `electron` process (when available) |
| **E+** | Real Electron **main-process** IPC path (`knowledge-set:executePlan` code) |
| **F** | Published installer on clean machine — **SKIP** |
| **G** | Stripe Live — **SKIP** |

What this track does **not** claim: full app Organise UX, FSA picker, renderer→preload IPC wire, or Stripe Live.

---

## Reproducible environment

| Component | Implementation |
| --- | --- |
| D1 local | `openFreshLocalD1Adapter` + migrations 0011 + both **0012** files (see below) |
| Server routes | Service fns + **POST `/api/license/check` route handler** |
| Stripe | `site/lib/test/stripe-simulator.ts` |
| Signing | Ed25519 test keypair — private server / public desktop |
| Browser gate | `assertHostExecutorGenerationRights` (**C−**) |
| Desktop | Mock (**E−**) + optional real Electron (**E**) |

### D1 migrations 0012 (do not renumber)

Two independent files share prefix `0012` — apply **both**, order between them is not schema-dependent:

| File | Purpose |
| --- | --- |
| `0012_lifetime_upgrade_intent.sql` | Upgrade checkout intents |
| `0012_license_version_contract.sql` | Version model state + reconciliation |

Verify with `wrangler d1 migrations list` before remote apply. Do not blindly renumber already-applied migrations.

---

## Evidence matrix (007 harness)

| Scenario | Platform | Result |
| --- | --- | --- |
| Incomplete config before charge | B | PASS |
| Checkout + version binding | B | PASS |
| Webhook without success return | B | PASS |
| Single grant + acquisition | B | PASS |
| Signed rights after activation (Ed25519) | B | PASS |
| Pre-upgrade: organise yes / rename no | C− | PASS |
| Browser upgrade gate (pre/post rename) | C | PASS |
| POST `/api/license/check` | B+ | PASS |
| Offline stored token in grace | B | PASS |
| Desktop organise pre-upgrade | E− | PASS |
| Upgrade intent + webhook | B | PASS |
| Post-upgrade: rename denied→allowed | B | PASS |
| Upgrade via HTTP check | B+ | PASS |
| Desktop post-upgrade rename | E or E− | PASS |
| Desktop IPC gate (tamper / fake recovery) | E+ or E− | PASS |
| Duplicate upgrade webhook | B | PASS |
| Failure cases (signature, pending, recon, tamper, expiry, gift) | A/B | PASS |
| Published installer (F) | SKIP | |
| Stripe Live (G) | SKIP | |
| Regression suites | A/B | PASS |

Run:

```bash
npm run test:license-version-final-e2e --prefix site
```

---

## Upgrade proof (functional)

Same license, enforcement on: organise allowed before upgrade; upgrade checkout adds the next generation’s capabilities; organise still allowed after.

---

## Failure matrix — harness vs prior tracks

| Scenario | 007 harness | Prior track |
| --- | --- | --- |
| Legacy binding vs purchase date | — | 005 (binding evidence `versionModelActiveAtBind`) |
| DB fault injection | — | grant-durability |
| Catalog change mid-checkout | — | commercial-generations |
| IPC / fake recovery | — | organise-integrity, desktop undo |

---

## Verdicts (separate)

| Area | Verdict |
| --- | --- |
| Contracts (005) | READY LOCAL — prior track |
| Asymmetric signing (006) | **IN PROGRESS** — Ed25519 implemented locally; production key ceremony pending |
| Persistence + idempotency | PASS local D1 |
| Signed rights refresh | PASS service + B+ route |
| Browser | **PARTIAL** — Playwright gate PASS; full Organise/FSA UX not closed |
| Desktop | **PARTIAL** — E+/E when electron available; renderer IPC wire not closed |
| Upgrade local | PASS functional deny→allow |
| **Production** | **NOT READY** |

**Enforcement and Upgrade checkout remain CLOSED in production flags.**

---

## Promotion checklist (do not execute)

- [ ] Operator approves legacy version policy (purchase-date evidence, not flag-only)
- [ ] Generate production Ed25519 keypair; private key → Worker secret; public key → Desktop build allowlist
- [ ] Apply D1 migrations remote (0011 + both 0012)
- [ ] Minimum app version gate for Ed25519 tokens
- [ ] Real-device matrix: IPC tamper, patched binary, Playwright organise gate
- [ ] Stripe **test mode** smoke (optional) — separate from **Live** verification
- [ ] Enable `LICENSE_VERSION_MODEL_ACTIVE` then enforcement only on builds that verify Ed25519 contract
- [ ] Open Lifetime Upgrade checkout commercially

---

## Files

| Path | Role |
| --- | --- |
| `packages/product/src/lib/license-token-crypto.ts` | Public-key verify + allowed algorithms |
| `site/lib/license-token-signing.ts` | Server Ed25519 sign |
| `site/lib/test/stripe-simulator.ts` | Test-only Stripe mock |
| `site/lib/license-version-final-e2e-check.ts` | Integration harness |
| `desktop/electron/license-version-e2e-executor-check.ts` | Desktop temp executor |

---

## External changes

**None.**
