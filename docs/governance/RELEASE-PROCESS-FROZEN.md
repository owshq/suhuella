# Release Process — FROZEN

```text
STATUS = FROZEN
EFFECTIVE = 2026-09-19
TYPE = Permanent policy (not a track)
```

Release **architecture** is [release-architecture.md](../architecture/constitution/release-architecture.md). This document freezes the **process** — the order phases run in.

---

## Phases (mandatory order)

Version names: [Pre-RC release semantics](./PRE-RC-RELEASE-SEMANTICS.md).

```text
Develop
    ↓
Internal testing          (0.1.0-pre-rc · artifacts · downloads · /api/release)
    ↓
First Impression
    ↓
Product / technical gates
    ↓
Commercial signing gates
    ↓
RC                        (0.1.0-rc1 · trusted install)
    ↓
Private Beta              (external)
    ↓
Feedback
    ↓
Public Release
```

| Phase | Track / reference |
| --- | --- |
| Develop | Normal engineering |
| Internal testing | `0.1.0-pre-rc` publication · `npm run test:*` · smoke |
| First Impression | [FIRST-IMPRESSION-TEST-001.md](../../tracks/archive/FIRST-IMPRESSION-TEST-001.md) → [FIRST-IMPRESSION-SUMMARY-001.md](../../tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md) |
| Product / technical gates | Download · first launch · product checks — not signing |
| Commercial signing | [DECISION-PRIVATE-BETA-001.md](./DECISION-PRIVATE-BETA-001.md) — external prerequisite |
| RC | Tag `0.1.0-rc1` only after trusted-install gates pass |
| Private Beta | [PRIVATE-BETA-001.md](../../PRIVATE-BETA-001.md) — external users, after `rc1` |
| Feedback | Narrow fixes from [Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md) |
| Public Release | Launch track (when opened) |

---

## Rule

> **No phase may be skipped** except for a **critical incident** (security, data loss, production outage).

“It feels stable” is not a skip reason. “Ship RC without First Impression” is not allowed.

Critical-incident skips must be recorded (ops notes · incident summary · follow-up validation in the next normal phase).

---

## Pre-RC publication

[Pre-RC release semantics](./PRE-RC-RELEASE-SEMANTICS.md) define the version names. Develop and internal testing include real Mac and Windows artifacts, download aliases, and `/api/release`. Signing does not pause that work.

External Private Beta starts only after promotion to `0.1.0-rc1` (trusted-install gates). Calling a pre-RC build a Private Beta, or blocking pre-RC downloads on signing, skips or stalls a phase. Neither is allowed.

## Web vs Desktop

- Web and Desktop downloads are both in scope for `0.1.0-pre-rc`.
- Desktop does not skip **First Impression** or **Private Beta** for the product as a whole. Trusted install is required before the external beta, not before pre-RC publication.

See [PRODUCT-EVOLUTION-POLICY.md](../../PRODUCT-EVOLUTION-POLICY.md).
