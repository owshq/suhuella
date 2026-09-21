# First impression — session records

**First Impression = human observation only** (optional). Not an engineering gate.

Engineering readiness: [PRE-BETA-BENCHMARK-001](../PRE-BETA-BENCHMARK-001.md) · [pre-beta/benchmark-results.md](../pre-beta/benchmark-results.md)

Session templates (`session-01..03.md`) — trust/desirability signals during or after [PRIVATE-BETA-001](../PRIVATE-BETA-001.md).

```text
Session 01 → Session 02 → Session 03
        ↓
FIRST-IMPRESSION-SUMMARY-001
        ↓
PASS | PASS WITH FIXES | FAIL
        ↓
PRODUCT-FREEZE-001 → PRIVATE-BETA-001
```

## Files

| File | Target profile |
| --- | --- |
| [session-01.md](session-01.md) | Low technical (40–70); PDFs, invoices, Downloads |
| [session-02.md](session-02.md) | Organised professional; hundreds–thousands of files |
| [session-03.md](session-03.md) | Chaotic habit; messy Desktop/Downloads |

After a session, rename if useful (e.g. `session-01-retired-user.md`). Keep the mandatory header inside the file.

## Session rules

- Start URL: **https://suhuella.com** only
- Incognito · no coaching · two allowed sentences only
- Fill header **before** the session
- Do not delete past sessions — dated addenda only

## Verify before the participant arrives

```text
[x] Production URL — https://suhuella.com (verified 2026-09-19)
[x] npm run verify:production — PASS
[ ] Incognito window
[ ] Browser cache clean (hard refresh or incognito; SW suhuella-web-shell-v6)
[ ] Browser zoom 100%
[ ] Recording ready (optional)
[ ] Folder prepared (Session 01: Downloads or Documents · PDFs/invoices)
[ ] One known document available (for Search task)
[ ] Session timer
[ ] session-XX.md header completed
[ ] Observer has [operator-task-sheet.md](operator-task-sheet.md) on second screen or printed
```

## During session

Display **one task at a time.**

Observer may **only** say:

> Please think aloud.

> If something is unclear, do what you think is correct.

No hints · no demonstrations · no explanations.

### Abort criteria

Stop immediately **only** if:

- data loss
- security issue
- application crash
- impossible to continue

Otherwise continue until all tasks finish.

## Do not record solutions during the session

If the participant says *“I don't understand this button”*, do **not** write *“We should rename it.”*

Record only:

```text
Observation  →  what happened (behaviour, quote)
Evidence     →  time, clicks, screens, verbatim
Impact       →  task outcome (completed / delayed / failed)
```

Example (Task 4):

```text
Observation:
Participant searched three times for Connect folder.

Evidence:
36 seconds. Opened Settings first. Returned to Home.

Impact:
Task completed only after trial and error.
```

**Never write “Recommended fix” during the session.** Solutions are discussed only in [FIRST-IMPRESSION-SUMMARY-001.md](../tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md).

## After session

Ask Q1–Q8. Complete verdict: **PASS** | **PASS WITH FIXES** | **FAIL**.

Do not propose solutions. Do not open implementation tracks.

### Operator report (return only)

```text
Session completed.
Evidence collected.
Ready for Session 02.
```

Unless a 🔴 product blocker appeared — then report the blocker and stop the track until resolved.

### Definition of done

- Session executed
- Notes completed in session file
- No product changes made
- No architecture discussion
- Ready for the next participant

## Severity (tag each finding in session notes)

| | Severity | Meaning |
| --- | --- | --- |
| 🟢 | Cosmetic | Comment only; task unaffected |
| 🟡 | Friction | Task completed with hesitation or wrong path |
| 🟠 | Task blocker | Task completed only after trial and error or near-failure |
| 🔴 | Product blocker | Task failed or trust broken (e.g. upload fear) |

The summary rolls these up across sessions (e.g. 🟡 Search wording confused 2/3).

## After three sessions

Complete [FIRST-IMPRESSION-SUMMARY-001.md](../tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md). That summary — not any single session — decides beta entry.

**PASS:** no slice → private beta. **PASS WITH FIXES:** one repeated problem → one slice → one participant → close. **FAIL:** one blocker slice only. No changes between sessions 01–03.
