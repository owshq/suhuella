# Release Process — FROZEN

```text
STATUS = FROZEN
EFFECTIVE = 2026-09-19
TYPE = Permanent policy (not a track)
```

Release **architecture** is frozen in [RELEASE-ARCHITECTURE-FROZEN.md](../../RELEASE-ARCHITECTURE-FROZEN.md). This document freezes the **process** — the order phases run in.

---

## Phases (mandatory order)

```text
Develop
    ↓
Internal testing
    ↓
First Impression  (3 sessions)
    ↓
Private Beta
    ↓
Feedback
    ↓
RC
    ↓
Public Release
```

| Phase | Track / reference |
| --- | --- |
| Develop | Normal engineering |
| Internal testing | `npm run test:*` · smoke · staging |
| First Impression | [FIRST-IMPRESSION-TEST-001.md](../../FIRST-IMPRESSION-TEST-001.md) → [FIRST-IMPRESSION-SUMMARY-001.md](../../FIRST-IMPRESSION-SUMMARY-001.md) |
| Private Beta | [PRIVATE-BETA-001.md](../../PRIVATE-BETA-001.md) |
| Feedback | Narrow fixes from [Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md) |
| RC | Tag `0.1.0-rc1` · [RC-CHECKLIST.md](../../RC-CHECKLIST.md) |
| Public Release | Launch track (when opened) |

---

## Rule

> **No phase may be skipped** except for a **critical incident** (security, data loss, production outage).

“It feels stable” is not a skip reason. “Ship RC without First Impression” is not allowed.

Critical-incident skips must be recorded (ops notes · incident summary · follow-up validation in the next normal phase).

---

## Web vs Desktop

- **Web RC path** follows this sequence now.
- **Desktop** may lag (installers · hosting) but does not skip **First Impression** or **Private Beta** for the product as a whole.

See [PRODUCT-EVOLUTION-POLICY.md](../../PRODUCT-EVOLUTION-POLICY.md).
