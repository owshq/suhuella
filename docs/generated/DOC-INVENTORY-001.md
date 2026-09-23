# DOC-INVENTORY-001

```text
STATUS = GENERATED
TYPE = Phase 0.1 documentation inventory (read-only)
GENERATED = 2026-09-21
SOURCE = scripts/doc-inventory.mjs
```

Inventory of all `.md` files (and execution logs) in the canonical repository.
**No files were moved, renamed, deleted, or rewritten** to produce this document.

Classification follows Phase 0 rules. FROZEN and constitution-indexed documents are treated conservatively.
Unknown track-like files are **not** auto-classified as archive.

Institutional doc count (35) is informational only — **precedence and functional separation matter more than hitting a target number**.

---

## Summary counts

| Metric | Count |
| --- | ---: |
| Total `.md` files | 106 |
| Root `.md` files | 57 |
| Execution `.log` files | 1 |
| **Constitution** | 13 |
| **ADR** | 2 |
| **Governance** | 10 |
| **Product model** | 5 |
| **Operations** | 5 |
| **Institutional subtotal** | 35 |
| **Track open** | 11 |
| **Track archive** | 40 |
| **Human evidence** | 6 |
| **Benchmark** | 4 |
| **Execution log** | 2 |
| **Migration stub** | 0 |
| **Generated / audit** | 2 |
| **Package/local README** | 7 |
| **Ambiguous / manual review** | 15 |
| Broken link refs flagged | 0 |

### Phase 0 plan estimates vs actual

| Estimate (Phase 0 plan) | Actual (this inventory) | Notes |
| --- | ---: | --- |
| ~103 total `.md` | 106 | Includes `docs/release/*` not visible in sandbox-only scans |
| ~65 root `*-001.md` | 54 | Exact match |
| ~25 institutional (orientation) | 35 | Orientation only — do not merge to hit a number |
| ~8–12 open tracks | 11 | Classifier-based; 5 additionally ambiguous |
| ~45–50 closed tracks to archive | 40 | Lower than estimate; 15 items need manual review first |

---

## Duplicate / stub candidates (not removed)

| File A | File B | Notes |
| --- | --- | --- |
| `RESEND-LIVE-INBOX-VERIFY-001.md` | `RESEND-LIVE-OTP-PROOF-001.md` | Alias pair — PRE-RC lists as alias |

---

## Highest backlink counts

Backlinks counted across `.md`, `.mdc`, scripts, CI, packages, and config — matching filename/path patterns only (no bare-word false positives).

| File | Backlinks | Classification |
| --- | ---: | --- |
| `PRIVATE-BETA-001.md` | 19 | Track open |
| `brands/suhuella/assets/README.md` | 15 | Package/local README |
| `dev-data/README.md` | 15 | Package/local README |
| `docs/architecture/constitution/README.md` | 15 | Constitution |
| `docs/release/README.md` | 15 | Operations |
| `first-impression/README.md` | 15 | Human evidence |
| `pre-beta/README.md` | 15 | Benchmark |
| `desktop/README.md` | 14 | Package/local README |
| `docs/architecture/decisions/README.md` | 14 | ADR |
| `docs/governance/README.md` | 14 | Governance |
| `README.md` | 14 | Governance |
| `site/README.md` | 14 | Package/local README |
| `MULTI-PLATFORM-SOURCE-ADAPTERS-001.md` | 13 | Constitution |
| `docs/architecture/constitution/release-architecture.md` | 12 | Constitution |
| `SOURCE-DOMAIN-MODEL-001.md` | 12 | Constitution |

---

## Broken or unresolved markdown references

_None detected._

---

## Ambiguous / manual-review items

| Path | Status | Classification | Action | Notes |
| --- | --- | --- | --- | --- |
| `README.md` | CLOSED | Governance | consolidate | Repo entry point; overlaps governance index and closed track history — trim, do not merge with constitution |
| `site/DEV-SOURCES.md` | unknown | Package/local README | review manually | Developer local sources guide; not indexed in governance |
| `tracks/archive/BROWSER-ADAPTER-WIRING-001.md` | FROZEN | Track archive | archive | FROZEN adapter slice — verify not constitution before archiving |
| `tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md` | FROZEN | Track open | review manually | STATUS=FROZEN·BLOCKED but not constitution-indexed — frozen track, not domain contract |
| `tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md` | PASS | Track archive | archive | Root-level first-impression track; overlap with first-impression/ folder |
| `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md` | unknown | Human evidence | move | Loose session note at root; likely belongs in first-impression/ |
| `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md` | CLOSED | Track archive | archive | Root-level first-impression track; overlap with first-impression/ folder |
| `tracks/archive/FIRST-IMPRESSION-TEST-001.md` | CLOSED | Track archive | archive | Root-level first-impression track; overlap with first-impression/ folder |
| `tracks/archive/RC-CHECKLIST.md` | CLOSED | Track open | review manually | Checklist without -001 suffix; may stay root or move to tracks/open/ |
| `tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md` | CLOSED | Constitution | keep | Closed evolution log; referenced by .cursor/rules and domain checks — supporting constitution slice, not a closed track |
| `tracks/open/ANDROID-SOURCE-ADAPTER-001.md` | unknown | Track open | review manually | Adapter implementation track; status unknown — do not auto-archive |
| `tracks/open/DESKTOP-INDEXING-RESPONSIVENESS.md` | OPEN | Package/local README | review manually | Unclassified markdown |
| `tracks/open/GOOGLE-DRIVE-SOURCE-ADAPTER-001.md` | unknown | Track open | review manually | Adapter implementation track; status unknown — do not auto-archive |
| `tracks/open/IOS-SOURCE-ADAPTER-001.md` | unknown | Track open | review manually | Adapter implementation track; status unknown — do not auto-archive |
| `tracks/open/RELEASE-LIFECYCLE-001.md` | OPEN | Constitution | review manually | Release lifecycle model; overlaps release-architecture and RELEASE-PUBLISH-PIPELINE |

---

## Full inventory

| Path | Lines | Status | Classification | Action | Backlinks | Notes |
| --- | ---: | --- | --- | --- | ---: | --- |
| `APP-MODAL-SHELL-001.md` | 85 | CLOSED | Track archive | archive | 3 | Closed track |
| `APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md` | 137 | CLOSED | Track archive | archive | 2 | Closed track |
| `BRAND-THEME-TOKENS-001.md` | 65 | CLOSED | Track archive | archive | 2 | Closed track |
| `BRANDING-HIERARCHY-001.md` | 24 | unknown | Constitution | move | 6 | Constitution-indexed; proposed target: docs/architecture/constitution/branding-hierarchy.md |
| `brands/suhuella/assets/README.md` | 11 | INDEX | Package/local README | keep | 15 |  |
| `BROWSER-CONNECT-SOURCE-001.md` | 108 | CLOSED | Track archive | archive | 3 | Closed track |
| `BROWSER-LOCAL-DEVICE-STATE-001.md` | 137 | CLOSED | Track archive | archive | 1 | Closed track |
| `BROWSER-ORGANISE-SELECTION-001.md` | 70 | CLOSED | Track archive | archive | 3 | Closed track |
| `BROWSER-SOURCE-ADAPTER-001.md` | 106 | OPEN | Track open | move | 7 | Adapter implementation track; constitution contract is MULTI-PLATFORM-SOURCE-ADAPTERS-001 |
| `BROWSER-SOURCE-ADAPTER-INTEGRATION-001.md` | 42 | CLOSED | Track archive | archive | 2 | Closed adapter implementation track |
| `BROWSER-SOURCE-INDEX-SEARCH-001.md` | 14 | CLOSED | Track archive | archive | 2 | Closed track |
| `BROWSER-SOURCES-BRAND-FLOW-001.md` | 121 | CLOSED | Track archive | archive | 5 | Closed track |
| `CHECKOUT-PRODUCTION-ENABLEMENT-001.md` | 182 | CLOSED | Track archive | archive | 4 | Closed track |
| `COMBINED-PRE-RC-SMOKE-001.md` | 196 | CLOSED | Track archive | archive | 3 | Closed track |
| `DESKTOP-DMG-HOSTING-UNBLOCK-001.md` | 107 | CLOSED | Track archive | archive | 4 | Closed track |
| `DESKTOP-RELEASE-DISTRIBUTION-001.md` | 151 | CLOSED | Track archive | archive | 3 | Closed track |
| `DESKTOP-RELEASE-HOSTING-001.md` | 88 | CLOSED | Track archive | archive | 3 | Closed track |
| `DESKTOP-RELEASE-PRODUCTION-001-EXEC.log` | 35 | NOT OPENED | Execution log | delete candidate | 0 | Non-markdown execution log |
| `DESKTOP-RELEASE-PRODUCTION-001.md` | 138 | IMPLEMENTED | Track open | move | 8 | Active track at repo root |
| `desktop/README.md` | 286 | INDEX | Package/local README | keep | 14 | Package README preserved in place |
| `dev-data/README.md` | 17 | INDEX | Package/local README | keep | 15 |  |
| `docs/architecture/constitution/COMMAND-TAXONOMY.md` | 97 | CONSTITUTION | Constitution | keep | 4 |  |
| `docs/architecture/constitution/health.md` | 101 | CONSTITUTION | Constitution | keep | 3 |  |
| `docs/architecture/constitution/README.md` | 122 | CONSTITUTION | Constitution | keep | 15 |  |
| `docs/architecture/constitution/release-architecture.md` | 102 | CONSTITUTION | Constitution | keep | 12 |  |
| `docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md` | 349 | ACCEPTED | ADR | keep | 7 |  |
| `docs/architecture/decisions/README.md` | 15 | INDEX | ADR | keep | 14 | ADR index |
| `docs/architecture/product/application-lifecycle.md` | 130 | ACTIVE | Product model | keep | 3 |  |
| `docs/architecture/product/brand-config.md` | 180 | unknown | Product model | keep | 3 |  |
| `docs/architecture/product/commercial-authority-model.md` | 401 | FROZEN | Product model | keep | 6 |  |
| `docs/architecture/product/operator-partner-license.md` | 215 | unknown | Product model | keep | 3 |  |
| `docs/architecture/product/suhuella-email-foundation.md` | 113 | unknown | Product model | keep | 3 |  |
| `docs/generated/DOC-INVENTORY-001.md` | 1097 | unknown | Generated / audit artifact | keep | 2 | Audit output. Not institutional. |
| `docs/generated/DOC-PHASE-0.2-DECISIONS.md` | 109 | ACCEPTED | Generated / audit artifact | keep | 0 | Audit output. Not institutional. |
| `docs/governance/CHANGE-CLASSIFICATION-POLICY.md` | 37 | ACTIVE | Governance | keep | 4 |  |
| `docs/governance/CONTRACT-STABILITY.md` | 60 | ACTIVE | Governance | keep | 1 |  |
| `docs/governance/DECISION-PRECEDENCE.md` | 251 | unknown | Governance | keep | 7 |  |
| `docs/governance/DECISION-PRIVATE-BETA-001.md` | 117 | ACCEPTED | Governance | keep | 6 |  |
| `docs/governance/NAVIGATION-POLICY.md` | 42 | FROZEN | Governance | keep | 1 |  |
| `docs/governance/PRE-RC-RELEASE-SEMANTICS.md` | 110 | ACTIVE | Governance | keep | 6 |  |
| `docs/governance/README.md` | 82 | INDEX | Governance | keep | 14 |  |
| `docs/governance/RELEASE-PROCESS-FROZEN.md` | 73 | FROZEN | Governance | keep | 5 |  |
| `docs/release/mac-signing.md` | 78 | unknown | Operations | keep | 1 | Release operator guides (platform signing / validation) |
| `docs/release/README.md` | 24 | NOT OPENED | Operations | keep | 15 | Release operator guides (platform signing / validation) |
| `DOWNLOAD-EXPERIENCE-001.md` | 60 | CLOSED | Track archive | archive | 5 | Closed track |
| `DOWNLOAD-PAGE-SEMANTICS-001.md` | 14 | NOT OPENED | Track archive | archive | 2 | Never opened / superseded |
| `ELECTRON-SOURCE-ADAPTER-001.md` | 102 | CLOSED | Track archive | archive | 3 | Closed adapter implementation track |
| `first-impression/operator-task-sheet.md` | 41 | unknown | Human evidence | keep | 1 | Preserved in place per Phase 0 rules |
| `first-impression/README.md` | 142 | PASS | Human evidence | keep | 15 | Preserved in place per Phase 0 rules |
| `first-impression/session-01.md` | 113 | PASS | Human evidence | keep | 5 | Preserved in place per Phase 0 rules |
| `first-impression/session-02.md` | 113 | PASS | Human evidence | keep | 6 | Preserved in place per Phase 0 rules |
| `first-impression/session-03.md` | 113 | PASS | Human evidence | keep | 6 | Preserved in place per Phase 0 rules |
| `FIRST-LAUNCH-EXPERIENCE-001.md` | 61 | CLOSED | Track archive | archive | 6 | Closed track |
| `FIRST-RUN-EXPERIENCE-001.md` | 627 | CLOSED | Track archive | archive | 6 | Closed track |
| `FIRST-RUN-EXPERIENCE-PREP-001.md` | 467 | CLOSED | Track archive | archive | 5 | Closed track |
| `LICENSE-PAID-GRANT-DURABILITY-001.md` | 163 | CLOSED | Track archive | archive | 2 | Closed track |
| `MULTI-PLATFORM-SOURCE-ADAPTERS-001.md` | 263 | FROZEN | Constitution | move | 13 | Constitution-indexed; proposed target: docs/architecture/constitution/multi-platform-source-adapters.md |
| `OPERATIONS-ACCESS-CLOSEOUT-001.md` | 279 | CLOSED | Operations | move | 7 | Operations runbook or release operator guide |
| `OPERATIONS-ACCESS-VERIFY-001.md` | 212 | OPEN | Operations | move | 2 | Operations-related track |
| `OPERATIONS-BUILD-DIAGNOSIS-001.md` | 152 | CLOSED | Track archive | archive | 2 | Closed operations track |
| `OPERATIONS-BUILD-UNBLOCK-001.md` | 71 | CLOSED | Track archive | archive | 1 | Closed operations track |
| `OPERATIONS-PRODUCTION-ACTIVATION-001.md` | 304 | unknown | Operations | move | 6 | Operations runbook or release operator guide |
| `ORGANISE-SOURCES-BRIDGE-001.md` | 58 | CLOSED | Track archive | archive | 1 | Closed track |
| `PRE-BETA-BENCHMARK-001.md` | 68 | CLOSED | Benchmark | archive | 8 | Pre-beta gate track; related to pre-beta/ folder |
| `PRE-BETA-SANITY-001.md` | 128 | CLOSED | Benchmark | archive | 6 | Pre-beta gate track; related to pre-beta/ folder |
| `pre-beta/benchmark-results.md` | 43 | CLOSED | Benchmark | keep | 3 | Preserved in place per Phase 0 rules |
| `pre-beta/README.md` | 10 | INDEX | Benchmark | keep | 15 | Preserved in place per Phase 0 rules |
| `PRE-RC-TRACKS-001.md` | 544 | OPEN | Track open | keep | 10 | Active roadmap index (STATUS=OPEN · MAINTENANCE ONLY) |
| `PRIVATE-BETA-001.md` | 198 | BLOCKED | Track open | keep | 19 | Active product gate |
| `PRODUCT-EVOLUTION-POLICY.md` | 157 | ACTIVE | Governance | move | 9 | Listed in governance/README.md; still at repo root |
| `PRODUCT-FREEZE-001.md` | 88 | OPEN | Track open | keep | 7 | Active or deferred gate track |
| `PRODUCTION-READINESS-001.md` | 286 | BLOCKED | Track open | keep | 3 | Active or deferred gate track |
| `RC-CONSISTENCY-001.md` | 125 | CLOSED | Track archive | archive | 1 | Closed track |
| `RC-DOWNLOAD-JOURNEY-001.md` | 23 | CLOSED | Track archive | archive | 2 | Closed track |
| `RC-HOST-INTEGRATION-001.md` | 136 | CLOSED | Track archive | archive | 1 | Closed track |
| `RC-INTEGRATION-STABILITY-001.md` | 225 | CLOSED | Track archive | archive | 1 | Closed track |
| `RC-POLISH-001.md` | 54 | CLOSED | Track archive | archive | 1 | Closed track |
| `README.md` | 781 | CLOSED | Governance | consolidate | 14 | Repo entry point; overlaps governance index and closed track history — trim, do not merge with constitution |
| `RELEASE-PUBLISH-PIPELINE-001.md` | 427 | CLOSED | Constitution | move | 11 | Constitution-indexed; proposed target: docs/architecture/constitution/release-publish-pipeline.md |
| `RELEASE-v0.1.0-pre-rc-EXECUTION.md` | 564 | unknown | Execution log | archive | 3 | Release execution record; not institutional |
| `RESEND-LIVE-INBOX-VERIFY-001.md` | 312 | CLOSED | Track archive | archive | 4 | Closed track |
| `RESEND-LIVE-OTP-PROOF-001.md` | 191 | CLOSED | Track archive | archive | 5 | Closed track |
| `RESEND-PRODUCTION-001.md` | 150 | CLOSED | Track archive | archive | 4 | Closed track |
| `site/AGENTS.md` | 10 | unknown | Package/local README | keep | 0 |  |
| `site/DEV-SOURCES.md` | 28 | unknown | Package/local README | review manually | 2 | Developer local sources guide; not indexed in governance |
| `site/README.md` | 438 | INDEX | Package/local README | keep | 14 | Package README preserved in place |
| `SOURCE-APPEARANCE-PERSISTENCE-001.md` | 47 | CLOSED | Track archive | archive | 1 | Closed track |
| `SOURCE-DOMAIN-MIGRATION-001.md` | 157 | CLOSED | Track archive | archive | 3 | CLOSED migration report; parent SOURCE-DOMAIN-MODEL-001 |
| `SOURCE-DOMAIN-MODEL-001.md` | 530 | FROZEN | Constitution | move | 12 | Constitution-indexed; proposed target: docs/architecture/constitution/source-domain.md |
| `SOURCE-LIFECYCLE-MODEL-001.md` | 136 | FROZEN | Constitution | move | 6 | Constitution-indexed; proposed target: docs/architecture/constitution/source-lifecycle.md |
| `SOURCE-PLATFORM-READINESS-001.md` | 124 | CLOSED | Constitution | move | 10 | Constitution-indexed; proposed target: docs/architecture/constitution/source-platform-readiness.md |
| `SOURCES-CAPABILITY-MATRIX-001.md` | 91 | CLOSED | Track archive | archive | 3 | Closed track |
| `tracks/archive/BROWSER-ADAPTER-WIRING-001.md` | 218 | FROZEN | Track archive | archive | 4 | FROZEN adapter slice — verify not constitution before archiving |
| `tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md` | 201 | FROZEN | Track open | review manually | 4 | STATUS=FROZEN·BLOCKED but not constitution-indexed — frozen track, not domain contract |
| `tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md` | 151 | PASS | Track archive | archive | 3 | Root-level first-impression track; overlap with first-impression/ folder |
| `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md` | 16 | unknown | Human evidence | move | 1 | Loose session note at root; likely belongs in first-impression/ |
| `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md` | 210 | CLOSED | Track archive | archive | 10 | Root-level first-impression track; overlap with first-impression/ folder |
| `tracks/archive/FIRST-IMPRESSION-TEST-001.md` | 370 | CLOSED | Track archive | archive | 8 | Root-level first-impression track; overlap with first-impression/ folder |
| `tracks/archive/RC-CHECKLIST.md` | 96 | CLOSED | Track open | review manually | 2 | Checklist without -001 suffix; may stay root or move to tracks/open/ |
| `tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md` | 232 | CLOSED | Constitution | keep | 3 | Closed evolution log; referenced by .cursor/rules and domain checks — supporting constitution slice, not a closed track |
| `tracks/open/ANDROID-SOURCE-ADAPTER-001.md` | 18 | unknown | Track open | review manually | 1 | Adapter implementation track; status unknown — do not auto-archive |
| `tracks/open/DESKTOP-INDEXING-RESPONSIVENESS.md` | 12 | OPEN | Package/local README | review manually | 0 | Unclassified markdown |
| `tracks/open/GOOGLE-DRIVE-SOURCE-ADAPTER-001.md` | 23 | unknown | Track open | review manually | 1 | Adapter implementation track; status unknown — do not auto-archive |
| `tracks/open/IOS-SOURCE-ADAPTER-001.md` | 18 | unknown | Track open | review manually | 1 | Adapter implementation track; status unknown — do not auto-archive |
| `tracks/open/RELEASE-LIFECYCLE-001.md` | 164 | OPEN | Constitution | review manually | 6 | Release lifecycle model; overlaps release-architecture and RELEASE-PUBLISH-PIPELINE |
| `VERSION-CONSISTENCY-001.md` | 123 | CLOSED | Constitution | move | 6 | Constitution-indexed; proposed target: docs/architecture/constitution/version-consistency.md |
| `WINDOWS-DESKTOP-RELEASE-001.md` | 58 | CLOSED | Track archive | archive | 1 | Closed track |

---

## Backlink detail (files with ≥1 incoming reference)

### `PRIVATE-BETA-001.md` (19)

- `.cursor/rules/first-impression-observation-mode.mdc`
- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/DECISION-PRIVATE-BETA-001.md`
- `docs/governance/README.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `first-impression/README.md`
- `PRE-BETA-SANITY-001.md`
- `pre-beta/benchmark-results.md`
- `pre-beta/README.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-FREEZE-001.md`
- `README.md`
- `scripts/doc-inventory.mjs`
- `site/scripts/pre-beta-benchmark.mjs`
- `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `brands/suhuella/assets/README.md` (15)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `dev-data/README.md` (15)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `docs/architecture/constitution/README.md` (15)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `docs/release/README.md` (15)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `first-impression/README.md` (15)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `pre-beta/README.md` (15)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `desktop/README.md` (14)

- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `docs/architecture/decisions/README.md` (14)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `docs/governance/README.md` (14)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `README.md` (14)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `site/README.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `site/README.md` (14)

- `desktop/README.md`
- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/release/mac-signing.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `MULTI-PLATFORM-SOURCE-ADAPTERS-001.md` (13)

- `BROWSER-SOURCE-ADAPTER-001.md`
- `docs/architecture/constitution/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/CONTRACT-STABILITY.md`
- `ELECTRON-SOURCE-ADAPTER-001.md`
- `PRE-RC-TRACKS-001.md`
- `scripts/doc-inventory.mjs`
- `site/lib/adapter-contract-check.ts`
- `site/lib/source-handle-adapters-check.ts`
- `SOURCE-PLATFORM-READINESS-001.md`
- `tracks/archive/BROWSER-ADAPTER-WIRING-001.md`
- `tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md`

### `docs/architecture/constitution/release-architecture.md` (12)

- `docs/architecture/constitution/README.md`
- `docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md`
- `docs/architecture/decisions/README.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/CHANGE-CLASSIFICATION-POLICY.md`
- `docs/governance/PRE-RC-RELEASE-SEMANTICS.md`
- `docs/governance/README.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`
- `RELEASE-PUBLISH-PIPELINE-001.md`
- `tracks/open/RELEASE-LIFECYCLE-001.md`

### `SOURCE-DOMAIN-MODEL-001.md` (12)

- `.cursor/rules/source-domain-guard.mdc`
- `docs/architecture/constitution/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `packages/product/src/lib/source-lifecycle.ts`
- `packages/product/src/lib/source-presentation.ts`
- `PRE-RC-TRACKS-001.md`
- `scripts/doc-inventory.mjs`
- `site/lib/browser-sources-brand-flow-check.ts`
- `site/lib/source-domain-check.ts`
- `SOURCE-LIFECYCLE-MODEL-001.md`

### `RELEASE-PUBLISH-PIPELINE-001.md` (11)

- `DESKTOP-RELEASE-HOSTING-001.md`
- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/architecture/constitution/README.md`
- `docs/architecture/constitution/release-architecture.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/release/mac-signing.md`
- `DOWNLOAD-EXPERIENCE-001.md`
- `PRE-BETA-SANITY-001.md`
- `PRE-RC-TRACKS-001.md`
- `scripts/doc-inventory.mjs`

### `PRE-RC-TRACKS-001.md` (10)

- `docs/architecture/constitution/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `RC-DOWNLOAD-JOURNEY-001.md`
- `README.md`
- `RESEND-LIVE-INBOX-VERIFY-001.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `scripts/doc-inventory.mjs`
- `SOURCE-DOMAIN-MODEL-001.md`

### `SOURCE-PLATFORM-READINESS-001.md` (10)

- `docs/architecture/constitution/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `PRE-RC-TRACKS-001.md`
- `scripts/doc-inventory.mjs`
- `site/lib/source-platform-readiness-check.ts`
- `SOURCE-DOMAIN-MODEL-001.md`
- `tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md`
- `tracks/open/ANDROID-SOURCE-ADAPTER-001.md`
- `tracks/open/IOS-SOURCE-ADAPTER-001.md`

### `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md` (10)

- `COMBINED-PRE-RC-SMOKE-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `first-impression/README.md`
- `FIRST-RUN-EXPERIENCE-PREP-001.md`
- `PRE-BETA-SANITY-001.md`
- `PRE-RC-TRACKS-001.md`
- `tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `PRODUCT-EVOLUTION-POLICY.md` (9)

- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/CHANGE-CLASSIFICATION-POLICY.md`
- `docs/governance/CONTRACT-STABILITY.md`
- `docs/governance/NAVIGATION-POLICY.md`
- `docs/governance/README.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `PRE-RC-TRACKS-001.md`
- `README.md`
- `scripts/doc-inventory.mjs`

### `DESKTOP-RELEASE-PRODUCTION-001.md` (8)

- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/DECISION-PRIVATE-BETA-001.md`
- `docs/release/mac-signing.md`
- `DOWNLOAD-EXPERIENCE-001.md`
- `FIRST-LAUNCH-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`
- `RELEASE-PUBLISH-PIPELINE-001.md`

### `PRE-BETA-BENCHMARK-001.md` (8)

- `.cursor/rules/first-impression-observation-mode.mdc`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `first-impression/README.md`
- `pre-beta/README.md`
- `PRE-RC-TRACKS-001.md`
- `tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `tracks/archive/FIRST-IMPRESSION-TEST-001.md` (8)

- `COMBINED-PRE-RC-SMOKE-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `FIRST-RUN-EXPERIENCE-001.md`
- `FIRST-RUN-EXPERIENCE-PREP-001.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md`

### `BROWSER-SOURCE-ADAPTER-001.md` (7)

- `docs/generated/DOC-INVENTORY-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/CONTRACT-STABILITY.md`
- `ELECTRON-SOURCE-ADAPTER-001.md`
- `site/lib/adapter-contract-check.ts`
- `site/lib/browser-adapter-wiring-check.ts`
- `tracks/archive/BROWSER-ADAPTER-WIRING-001.md`

### `docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md` (7)

- `BRANDING-HIERARCHY-001.md`
- `docs/architecture/constitution/README.md`
- `docs/architecture/decisions/README.md`
- `docs/governance/README.md`
- `PRE-BETA-SANITY-001.md`
- `PRE-RC-TRACKS-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`

### `docs/governance/DECISION-PRECEDENCE.md` (7)

- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/constitution/README.md`
- `docs/architecture/decisions/README.md`
- `docs/governance/DECISION-PRIVATE-BETA-001.md`
- `docs/governance/README.md`
- `PRE-RC-TRACKS-001.md`
- `SOURCE-DOMAIN-MODEL-001.md`

### `OPERATIONS-ACCESS-CLOSEOUT-001.md` (7)

- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/README.md`
- `OPERATIONS-ACCESS-VERIFY-001.md`
- `OPERATIONS-PRODUCTION-ACTIVATION-001.md`
- `PRE-RC-TRACKS-001.md`
- `README.md`
- `scripts/doc-inventory.mjs`

### `PRODUCT-FREEZE-001.md` (7)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `PRIVATE-BETA-001.md`
- `README.md`
- `scripts/doc-inventory.mjs`
- `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `BRANDING-HIERARCHY-001.md` (6)

- `docs/architecture/constitution/README.md`
- `docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/README.md`
- `PRE-RC-TRACKS-001.md`
- `scripts/doc-inventory.mjs`

### `docs/architecture/product/commercial-authority-model.md` (6)

- `docs/architecture/constitution/README.md`
- `docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md`
- `docs/architecture/decisions/README.md`
- `docs/architecture/product/brand-config.md`
- `docs/architecture/product/operator-partner-license.md`
- `docs/governance/README.md`

### `docs/governance/DECISION-PRIVATE-BETA-001.md` (6)

- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `docs/governance/README.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `PRE-RC-TRACKS-001.md`
- `PRIVATE-BETA-001.md`

### `docs/governance/PRE-RC-RELEASE-SEMANTICS.md` (6)

- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/governance/DECISION-PRIVATE-BETA-001.md`
- `docs/governance/README.md`
- `docs/governance/RELEASE-PROCESS-FROZEN.md`
- `PRIVATE-BETA-001.md`
- `README.md`

### `first-impression/session-02.md` (6)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `first-impression/operator-task-sheet.md`
- `first-impression/README.md`
- `FIRST-RUN-EXPERIENCE-PREP-001.md`
- `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `first-impression/session-03.md` (6)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `first-impression/operator-task-sheet.md`
- `first-impression/README.md`
- `FIRST-RUN-EXPERIENCE-PREP-001.md`
- `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `FIRST-LAUNCH-EXPERIENCE-001.md` (6)

- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/architecture/product/application-lifecycle.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `DOWNLOAD-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `FIRST-RUN-EXPERIENCE-001.md` (6)

- `BROWSER-SOURCE-INDEX-SEARCH-001.md`
- `BROWSER-SOURCES-BRAND-FLOW-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-PREP-001.md`
- `PRE-RC-TRACKS-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `OPERATIONS-PRODUCTION-ACTIVATION-001.md` (6)

- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/README.md`
- `OPERATIONS-ACCESS-VERIFY-001.md`
- `OPERATIONS-BUILD-DIAGNOSIS-001.md`
- `OPERATIONS-BUILD-UNBLOCK-001.md`
- `scripts/doc-inventory.mjs`

### `PRE-BETA-SANITY-001.md` (6)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-BETA-BENCHMARK-001.md`
- `pre-beta/README.md`
- `PRE-RC-TRACKS-001.md`
- `PRIVATE-BETA-001.md`
- `README.md`

### `SOURCE-LIFECYCLE-MODEL-001.md` (6)

- `docs/architecture/constitution/README.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `packages/product/src/lib/source-lifecycle.ts`
- `scripts/doc-inventory.mjs`
- `site/lib/browser-sources-brand-flow-check.ts`
- `SOURCE-DOMAIN-MODEL-001.md`

### `tracks/open/RELEASE-LIFECYCLE-001.md` (6)

- `docs/architecture/constitution/release-architecture.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `docs/governance/PRE-RC-RELEASE-SEMANTICS.md`
- `PRE-RC-TRACKS-001.md`
- `RELEASE-PUBLISH-PIPELINE-001.md`
- `tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md`

### `VERSION-CONSISTENCY-001.md` (6)

- `docs/architecture/constitution/README.md`
- `docs/architecture/constitution/release-architecture.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `RELEASE-PUBLISH-PIPELINE-001.md`
- `scripts/doc-inventory.mjs`

### `BROWSER-SOURCES-BRAND-FLOW-001.md` (5)

- `BROWSER-CONNECT-SOURCE-001.md`
- `BROWSER-SOURCE-INDEX-SEARCH-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `docs/governance/RELEASE-PROCESS-FROZEN.md` (5)

- `docs/architecture/constitution/release-architecture.md`
- `docs/governance/CHANGE-CLASSIFICATION-POLICY.md`
- `docs/governance/README.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `README.md`

### `DOWNLOAD-EXPERIENCE-001.md` (5)

- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `docs/governance/DECISION-PRECEDENCE.md`
- `FIRST-LAUNCH-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `first-impression/session-01.md` (5)

- `first-impression/operator-task-sheet.md`
- `first-impression/README.md`
- `FIRST-RUN-EXPERIENCE-PREP-001.md`
- `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `FIRST-RUN-EXPERIENCE-PREP-001.md` (5)

- `APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `RESEND-LIVE-OTP-PROOF-001.md` (5)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `RESEND-LIVE-INBOX-VERIFY-001.md`
- `RESEND-PRODUCTION-001.md`
- `scripts/doc-inventory.mjs`

### `CHECKOUT-PRODUCTION-ENABLEMENT-001.md` (4)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `README.md`
- `site/README.md`

### `DESKTOP-DMG-HOSTING-UNBLOCK-001.md` (4)

- `DESKTOP-RELEASE-DISTRIBUTION-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md`

### `docs/architecture/constitution/COMMAND-TAXONOMY.md` (4)

- `docs/architecture/constitution/health.md`
- `docs/architecture/constitution/README.md`
- `docs/architecture/constitution/release-architecture.md`
- `docs/governance/README.md`

### `docs/governance/CHANGE-CLASSIFICATION-POLICY.md` (4)

- `docs/governance/CONTRACT-STABILITY.md`
- `docs/governance/NAVIGATION-POLICY.md`
- `docs/governance/README.md`
- `README.md`

### `RESEND-LIVE-INBOX-VERIFY-001.md` (4)

- `docs/generated/DOC-INVENTORY-001.md`
- `RESEND-LIVE-OTP-PROOF-001.md`
- `RESEND-PRODUCTION-001.md`
- `scripts/doc-inventory.mjs`

### `RESEND-PRODUCTION-001.md` (4)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `RESEND-LIVE-INBOX-VERIFY-001.md`
- `RESEND-LIVE-OTP-PROOF-001.md`

### `tracks/archive/BROWSER-ADAPTER-WIRING-001.md` (4)

- `BROWSER-SOURCE-ADAPTER-001.md`
- `BROWSER-SOURCE-ADAPTER-INTEGRATION-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `PRE-RC-TRACKS-001.md`

### `tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md` (4)

- `DESKTOP-RELEASE-DISTRIBUTION-001.md`
- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `PRE-RC-TRACKS-001.md`
- `RELEASE-PUBLISH-PIPELINE-001.md`

### `APP-MODAL-SHELL-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `DOWNLOAD-PAGE-SEMANTICS-001.md`
- `PRE-RC-TRACKS-001.md`

### `BROWSER-CONNECT-SOURCE-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `BROWSER-ORGANISE-SELECTION-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `COMBINED-PRE-RC-SMOKE-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `RESEND-PRODUCTION-001.md`

### `DESKTOP-RELEASE-DISTRIBUTION-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `README.md`

### `DESKTOP-RELEASE-HOSTING-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRODUCT-EVOLUTION-POLICY.md`
- `RELEASE-PUBLISH-PIPELINE-001.md`

### `docs/architecture/constitution/health.md` (3)

- `docs/architecture/constitution/COMMAND-TAXONOMY.md`
- `docs/architecture/constitution/README.md`
- `docs/governance/README.md`

### `docs/architecture/product/application-lifecycle.md` (3)

- `desktop/README.md`
- `FIRST-LAUNCH-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `docs/architecture/product/brand-config.md` (3)

- `docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md`
- `docs/architecture/decisions/README.md`
- `docs/governance/README.md`

### `docs/architecture/product/operator-partner-license.md` (3)

- `docs/architecture/product/brand-config.md`
- `docs/governance/README.md`
- `README.md`

### `docs/architecture/product/suhuella-email-foundation.md` (3)

- `docs/architecture/product/brand-config.md`
- `docs/governance/README.md`
- `site/README.md`

### `ELECTRON-SOURCE-ADAPTER-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`
- `site/lib/electron-source-adapter-check.ts`

### `pre-beta/benchmark-results.md` (3)

- `first-impression/README.md`
- `PRE-BETA-BENCHMARK-001.md`
- `pre-beta/README.md`

### `PRODUCTION-READINESS-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `scripts/doc-inventory.mjs`
- `VERSION-CONSISTENCY-001.md`

### `RELEASE-v0.1.0-pre-rc-EXECUTION.md` (3)

- `DESKTOP-RELEASE-PRODUCTION-001.md`
- `docs/generated/DOC-INVENTORY-001.md`
- `scripts/doc-inventory.mjs`

### `SOURCE-DOMAIN-MIGRATION-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `scripts/doc-inventory.mjs`
- `SOURCE-DOMAIN-MODEL-001.md`

### `SOURCES-CAPABILITY-MATRIX-001.md` (3)

- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-001.md`
- `PRE-RC-TRACKS-001.md`

### `tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md` (3)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `PRE-RC-TRACKS-001.md`
- `tracks/archive/FIRST-IMPRESSION-TEST-001.md`

### `tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md` (3)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `MULTI-PLATFORM-SOURCE-ADAPTERS-001.md`
- `SOURCE-DOMAIN-MODEL-001.md`

### `APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`

### `BRAND-THEME-TOKENS-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`

### `BROWSER-SOURCE-ADAPTER-INTEGRATION-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`

### `BROWSER-SOURCE-INDEX-SEARCH-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `FIRST-RUN-EXPERIENCE-001.md`

### `docs/generated/DOC-INVENTORY-001.md` (2)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `scripts/doc-inventory.mjs`

### `DOWNLOAD-PAGE-SEMANTICS-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `PRE-RC-TRACKS-001.md`

### `LICENSE-PAID-GRANT-DURABILITY-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `README.md`

### `OPERATIONS-ACCESS-VERIFY-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `OPERATIONS-BUILD-DIAGNOSIS-001.md`

### `OPERATIONS-BUILD-DIAGNOSIS-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `OPERATIONS-BUILD-UNBLOCK-001.md`

### `RC-DOWNLOAD-JOURNEY-001.md` (2)

- `docs/generated/DOC-INVENTORY-001.md`
- `README.md`

### `site/DEV-SOURCES.md` (2)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `site/README.md`

### `tracks/archive/RC-CHECKLIST.md` (2)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`
- `README.md`

### `BROWSER-LOCAL-DEVICE-STATE-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `docs/governance/CONTRACT-STABILITY.md` (1)

- `docs/governance/README.md`

### `docs/governance/NAVIGATION-POLICY.md` (1)

- `docs/governance/README.md`

### `docs/release/mac-signing.md` (1)

- `docs/release/README.md`

### `first-impression/operator-task-sheet.md` (1)

- `first-impression/README.md`

### `OPERATIONS-BUILD-UNBLOCK-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `ORGANISE-SOURCES-BRIDGE-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `RC-CONSISTENCY-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `RC-HOST-INTEGRATION-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `RC-INTEGRATION-STABILITY-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `RC-POLISH-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `SOURCE-APPEARANCE-PERSISTENCE-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

### `tracks/archive/FIRST-IMPRESSION-SESSION-NOTE.md` (1)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`

### `tracks/open/ANDROID-SOURCE-ADAPTER-001.md` (1)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`

### `tracks/open/GOOGLE-DRIVE-SOURCE-ADAPTER-001.md` (1)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`

### `tracks/open/IOS-SOURCE-ADAPTER-001.md` (1)

- `docs/generated/DOC-PHASE-0.2-DECISIONS.md`

### `WINDOWS-DESKTOP-RELEASE-001.md` (1)

- `docs/generated/DOC-INVENTORY-001.md`

---

## Safeguards applied

1. FROZEN and `constitution/README.md`-indexed paths classified as **Constitution** (conservative).
2. FROZEN but **not** constitution-indexed → **review manually**, not auto-archive.
3. Unknown `*-001` tracks → **review manually**, not auto-archive.
4. `first-impression/`, `pre-beta/`, `desktop/README.md`, `site/README.md` → **keep** in place.
5. Duplicate/stub pairs listed, not removed.
6. Backlinks counted across repo text files (docs, `.cursor/rules/*.mdc`, scripts, CI, packages).
7. Broken links flagged with relative-path resolution from source file.
8. No redirect stubs created.

---

_Generated by `node scripts/doc-inventory.mjs`. Re-run after any doc change before Phase 1._
