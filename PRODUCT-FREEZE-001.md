# PRODUCT-FREEZE-001

```text
STATUS = OPEN
TYPE = Release policy
TRIGGER = FIRST-IMPRESSION-SUMMARY-001 CLOSED · PASS (operator waived · 2026-09-19)
SCOPE = SuHuella Web RC path
DATE = 2026-09-19
```

No code. No deploy. This track is the **policy gate** between impression validation and private beta.

---

## When it opens

```text
first-impression/session-01..03.md
        ↓
FIRST-IMPRESSION-SUMMARY-001  CLOSED · PASS
        ↓
FIRST-IMPRESSION-TEST-001     CLOSED · PASS
        ↓
PRODUCT-FREEZE-001            OPEN
        ↓
PRIVATE-BETA-001              may start
```

Opened on operator sign-off (2026-09-19). Session templates waived.

---

## Rule

After impression **PASS**, **freeze the product** until private beta closes or rc1 ships.

### Allowed

- **Critical bugs** — data loss, connect/remove broken, search wrong, trust-breaking copy
- **Narrow copy/UX** — from PASS WITH FIXES impression sessions only
- **Operations** — deploy hotfixes for the above; no feature expansion

### Not allowed

- new features
- redesign
- new screens or product questions on existing screens
- checkout enablement
- Desktop RC work on the Web critical path
- partner mode · multibrand · BYOK · Connections · Automations
- architecture changes
- “while we’re here” polish unrelated to beta blockers

The main risk is **regression from continued change**, not missing a function.

---

## Verification

Before inviting private-beta users, operator confirms:

```text
[x] FIRST-IMPRESSION-SUMMARY-001 CLOSED · PASS (operator waived · 2026-09-19)
[x] FIRST-IMPRESSION-TEST-001 CLOSED · PASS (operator waived)
[x] PRE-BETA-SANITY-001 CLOSED · PASS (2026-09-19)
[ ] PRIVATE-BETA-001 opened with participant list
[ ] No open functional tracks except critical/beta-fix slices
[ ] Checkout still OFF
[ ] Desktop still out of Web RC
[ ] Production Worker unchanged since impression PASS — or only hotfix deploy documented
```

---

## Close

```text
PRODUCT-FREEZE-001 — CLOSED · PASS
```

When **PRIVATE-BETA-001** closes **READY FOR PUBLIC BETA** or **0.1.0-rc1** is tagged — whichever comes first per [PRIVATE-BETA-001.md](PRIVATE-BETA-001.md).

---

## Out of scope

Implementing freeze in tooling. This is an operator contract, not a feature flag.
