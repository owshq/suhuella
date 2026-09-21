# FIRST-IMPRESSION-OBSERVATION-MODE-001

```text
STATUS = SUPERSEDED
TYPE = Observation mode (Cursor behaviour)
SUPERSEDED_BY = PRE-BETA-BENCHMARK-001 (engineering)
DATE = 2026-09-19
```

Engineering → [PRE-BETA-BENCHMARK-001.md](../../PRE-BETA-BENCHMARK-001.md). Human First Impression → optional in [first-impression/](../../first-impression/) for desirability only.

```text
The product is frozen.

Do not implement.
Do not redesign.
Do not improve copy.
Do not create tracks.

Observe only.
```

This is the **last master prompt** for the Web RC validation cycle. After it closes, use session evidence — not architecture prompts — to decide the next slice.

Cursor rule: [.cursor/rules/first-impression-observation-mode.mdc](../../.cursor/rules/first-impression-observation-mode.mdc)

---

## Objective

Support the operator during the three First Impression sessions **without changing the product**.

The objective is to collect evidence, not improve the application.

---

## Rules

### During session

Do not analyse.

Do not interpret.

Do not suggest.

Record only:

```text
Observation
Evidence
Impact
Severity
```

No proposed solution.

No UI comments.

No architecture comments.

---

### Between sessions

Do not compare with previous internal opinions.

Do not generate UX recommendations.

Do not open implementation slices.

Simply accumulate evidence.

---

### After session 03

Generate only [FIRST-IMPRESSION-SUMMARY-001.md](FIRST-IMPRESSION-SUMMARY-001.md): hallazgos ordered by **impact** (not by screen), frequency, severity, acción. One decision. Nothing else.

---

## Decision matrix

```text
Session 01 → Session 02 → Session 03 → no changes between
        ↓
FIRST-IMPRESSION-SUMMARY-001 → one decision
```

```text
0 repeated issues → PASS → no slice → PRIVATE-BETA-001
```

```text
1 repeated issue → PASS WITH FIXES
        ↓
1 problem → 1 slice → 1 participant → close
```

```text
Critical blocker (🔴) → FAIL → 1 blocker slice only (no scope creep)
```

**Repeated issue** = same observation in **2 or more** of 3 sessions (same task or same behaviour pattern).

---

## Forbidden

Until [FIRST-IMPRESSION-SUMMARY-001.md](FIRST-IMPRESSION-SUMMARY-001.md) closes:

- No product redesign
- No navigation redesign
- No architecture discussion
- No branding discussion
- No release discussion
- No documentation changes (except filling session notes and the summary)
- No speculative improvements

---

## End condition

After session 03:

1. Generate the summary.
2. Recommend exactly one of: **PASS** · **PASS WITH FIXES** · **FAIL**.
3. No implementation proposal unless the verdict is **PASS WITH FIXES** or **FAIL**.

```text
FIRST-IMPRESSION-OBSERVATION-MODE-001
STATUS = CLOSED
(when summary closes)
```

---

## Flow

```text
FIRST-IMPRESSION-OBSERVATION-MODE-001  (Cursor: observe only)
        ↓
first-impression/session-01..03
        ↓
FIRST-IMPRESSION-SUMMARY-001
        ↓
PASS | PASS WITH FIXES | FAIL
        ↓
evidence → decision → one slice → re-validation (if needed)
```
