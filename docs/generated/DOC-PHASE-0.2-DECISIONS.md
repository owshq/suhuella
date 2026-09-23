# DOC-PHASE-0.2-DECISIONS

```text
STATUS = ACCEPTED
TYPE = Phase 0.2 manual decisions
EFFECTIVE = 2026-09-21
SCOPE = The 15 ambiguous items in DOC-INVENTORY-001.md
```

Wave 1 moved those 15 to the destinations below. Wave 2 points the README release block at `docs/architecture/constitution/release-architecture.md` and removes the redirect stubs `RELEASE-ARCHITECTURE-FROZEN.md`, `HEALTH-FROZEN.md`, and `docs/architecture/frozen/README.md`.

Phase 0.1 separated facts from estimates. This document freezes **where each ambiguous file belongs** and **which document is the single current authority**.

Decision rule used for every row:

> Does this document define how SuHuella must keep working, or does it record how we got here?

| Answer | Destination class |
| --- | --- |
| Defines future behaviour | Institutional (one layer only) |
| Records a finished implementation or migration | `tracks/archive/` |
| Describes a procedure we will run again | `docs/operations/` |
| Work still unfinished or explicitly reserved | `tracks/open/` |

`FROZEN` means “do not change without a process”. It does **not** mean Constitution.

---

## Frozen corrections (apply to DOC-REORG-001)

1. **Constitution** = explicitly a constitutional contract, or listed by `docs/architecture/constitution/README.md` / decision precedence. Not every `FROZEN` file.
2. **Operations** = living runbooks only. An open verification or activation track stays a track until it becomes a procedure we will repeat.
3. **No blanket redirect stubs.** In one wave: move, update Markdown, `.cursor/rules`, TS checks, and scripts, then run them. A stub only if an external consumer still needs the old path.
4. **Generated / audit artifact** is its own class. Not a package README. Not institutional. Home: `docs/generated/`. Regenerating the inventory must not change institutional counts.
5. **One canonical authority per rule.** History may be archived. It must not look like a second current contract.

Target shape (in progress):

```text
README.md
docs/architecture/{constitution,decisions,product}/
docs/governance/
docs/operations/
docs/generated/
tracks/{open,archive}/
first-impression/
pre-beta/
```

Phase 1 gate, per wave:

```text
Markdown links           = 0 broken
Code path references     = 0 stale
.cursor/rules references = 0 stale
CI/scripts references    = 0 stale
```

Do not chase a document count. 34 institutional files is acceptable.

---

## Decisions

| # | File | Verdict | Class | Canonical destination | Single current authority |
| --- | --- | --- | --- | --- | --- |
| 1 | `APPLICATION-LIFECYCLE-001.md` | Future behaviour. The file itself says `NOT = Constitution`. | Product model | `docs/architecture/product/application-lifecycle.md` | That file. Do not copy it into constitution. |
| 2 | `RELEASE-LIFECYCLE-001.md` | Phase A rules already belong to the release constitution. Phases B–F are unfinished work. | Track open | `tracks/open/RELEASE-LIFECYCLE-001.md` | `docs/architecture/constitution/release-architecture.md`. This track must not become a second release contract. On close, fold any missing durable rule into release-architecture, then archive the track. |
| 3 | `SOURCE-DOMAIN-EVOLUTION-001.md` | History. Header: superseded by the domain model. | Track archive | `tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md` | `SOURCE-DOMAIN-MODEL-001.md` (later under constitution). Checks and `.cursor/rules/source-domain-guard.mdc` must stop treating the evolution file as a live contract in the same wave that archives it. |
| 4 | `BROWSER-ADAPTER-WIRING-001.md` | Finished integration slice. `FROZEN · PASS` is a change freeze, not a constitution. | Track archive | `tracks/archive/BROWSER-ADAPTER-WIRING-001.md` | `MULTI-PLATFORM-SOURCE-ADAPTERS-001.md`. Reference adapter stays `BROWSER-SOURCE-ADAPTER-001.md` until that track is closed on its own merits. |
| 5 | `DESKTOP-RELEASE-ARTIFACTS-001.md` | Finished re-entry note (`FROZEN · BLOCKED`, off the Web path). Not a release contract. | Track archive | `tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md` | `docs/architecture/constitution/release-architecture.md` |
| 6 | `ANDROID-SOURCE-ADAPTER-001.md` | `STATUS = RESERVED`. Not started. | Track open | `tracks/open/ANDROID-SOURCE-ADAPTER-001.md` | `MULTI-PLATFORM-SOURCE-ADAPTERS-001.md` plus `SOURCE-PLATFORM-READINESS-001.md`. This file is a reservation, not a contract. |
| 7 | `IOS-SOURCE-ADAPTER-001.md` | Same as Android. | Track open | `tracks/open/IOS-SOURCE-ADAPTER-001.md` | Same pair as Android. |
| 8 | `GOOGLE-DRIVE-SOURCE-ADAPTER-001.md` | `STATUS = RESERVED`. Not before Private Beta unless evidence says otherwise. | Track open | `tracks/open/GOOGLE-DRIVE-SOURCE-ADAPTER-001.md` | Same adapter contract. Not constitution. |
| 9 | `RC-CHECKLIST.md` | Stale pre-rc checklist. It is not the procedure we would run again as written (Web-first beta, old blockers). | Track archive | `tracks/archive/RC-CHECKLIST.md` | Living gates stay `PRIVATE-BETA-001.md` and `docs/governance/`. A new operations checklist may be written later. Do not promote this file. |
| 10 | `README.md` | Entry point. The `FROZEN` block inside it duplicates release architecture. | Entry | Stay `README.md`. Later wave: shorten. Do not move. | Product entry only. Constitution: `docs/architecture/constitution/README.md`. Governance: `docs/governance/README.md`. Release rules: `release-architecture.md`. |
| 11 | `DEV-SOURCES.md` | Repeatable localhost developer note. Not a production runbook. | Package/local | `site/DEV-SOURCES.md` | That file. `site/README.md` already points at it. |
| 12 | `FIRST-IMPRESSION-OBSERVATION-MODE-001.md` | Superseded observation prompt. | Track archive | `tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md` | `.cursor/rules/first-impression-observation-mode.mdc` and `first-impression/README.md` |
| 13 | `FIRST-IMPRESSION-TEST-001.md` | Closed test design. | Track archive | `tracks/archive/FIRST-IMPRESSION-TEST-001.md` | `first-impression/` for human records. Engineering gate: `PRE-BETA-BENCHMARK-001.md`. |
| 14 | `FIRST-IMPRESSION-SUMMARY-001.md` | Closed close-out. | Track archive | `tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md` | Same as the test track. Not a living policy. |
| 15 | `FIRST-IMPRESSION-SESSION-NOTE.md` | Stub. Points at the real session files. | Migration stub | Delete in the archive wave. No replacement file. | `first-impression/session-01.md` · `session-02.md` · `session-03.md` |

---

## What this does not decide

- The other files keep the Phase 0.1 classification until a later wave.
- Closed tracks still at the repo root stay there until the archive wave updates every backlink.

## Generated artifacts

| File | Class | Home |
| --- | --- | --- |
| `docs/generated/DOC-INVENTORY-001.md` | Generated / audit artifact | `docs/generated/` |
| `docs/generated/DOC-PHASE-0.2-DECISIONS.md` | Generated / audit artifact | `docs/generated/` |

They are excluded from the institutional count. Regenerate the inventory with `node scripts/doc-inventory.mjs`.

---

## Waves

1. Done. The 15 destinations above.
2. Done. README points at `docs/architecture/constitution/release-architecture.md` and no longer copies that contract. Redirect stubs removed.

Next wave: move root files already classified **Track archive** into `tracks/archive/`, and update every Markdown, check, rule, and script reference in that same wave. Do not move constitution-indexed files in that wave.

Stop after each wave if the Phase 1 gate fails.
