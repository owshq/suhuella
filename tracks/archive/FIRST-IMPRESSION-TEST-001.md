# FIRST-IMPRESSION-TEST-001

```text
STATUS = CLOSED · PASS
TYPE = User validation (human sessions)
SCOPE = SuHuella Web only
SUPERSEDED_BY = PRE-BETA-BENCHMARK-001 (engineering gate)
CLOSE = operator waived session notes · 2026-09-19
DATE = 2026-09-19
```

**Closed.** Engineering gate: [PRE-BETA-BENCHMARK-001.md](../../PRE-BETA-BENCHMARK-001.md) **PASS**. Operator sign-off replaces unfilled [first-impression/](../../first-impression/) templates. Summary: [FIRST-IMPRESSION-SUMMARY-001.md](FIRST-IMPRESSION-SUMMARY-001.md) **CLOSED · PASS**.

Observe whether a completely new user understands SuHuella **without any explanation**.

**No implementation. No UI changes. No coaching. Only observation.**

Cursor behaviour: [FIRST-IMPRESSION-OBSERVATION-MODE-001.md](FIRST-IMPRESSION-OBSERVATION-MODE-001.md) — observer, not developer, until the summary closes.

This track validates **first impression**, not a feature checklist. Supersedes [FIRST-RUN-EXPERIENCE-001.md](../../FIRST-RUN-EXPERIENCE-001.md). Participant and folder logistics: [FIRST-RUN-EXPERIENCE-PREP-001.md](../../FIRST-RUN-EXPERIENCE-PREP-001.md).

**Session records:** [first-impression/](../../first-impression/) (`session-01.md` · `session-02.md` · `session-03.md`).

**Decision document:** [FIRST-IMPRESSION-SUMMARY-001.md](FIRST-IMPRESSION-SUMMARY-001.md) — fill after all three sessions; this summary decides beta entry, not any single session.

---

## Preconditions

All must be true before scheduling. If any is false: **STOP.**

| Track | Required state |
| --- | --- |
| CHECKOUT-PRODUCTION-ENABLEMENT-001 | CLOSED · READY FOR STRIPE |
| RESEND-PRODUCTION-001 | CLOSED · OTP PRODUCTION PROVEN |
| VERSION-CONSISTENCY-001 | CLOSED · PASS WITH FIXES |
| APP-MODAL-SHELL-001 | CLOSED · PASS |
| COMBINED-PRE-RC-SMOKE-001 | CLOSED · PASS |
| SOURCES-CAPABILITY-MATRIX-001 | CLOSED · PASS |

**Also:**

- Desktop remains **out of RC**
- Checkout remains **OFF** (`PAID_CHECKOUT_ENABLED=false`)
- Production only
- Incognito or hard refresh so `suhuella-web-shell-v6` loads

### Preconditions verified (2026-09-19)

| Check | Result |
| --- | --- |
| `npm run verify:production` | PASS — `/` · `/home` · `/sources` · `/search` · shell routes 200 |
| `GET /api/release` | `0.1.0-pre-rc` |
| Landing modal (production) | ES copy · **Abrir SuHuella** · v0.1.0-pre-rc badge |
| Governance / release process | FROZEN — no doc work before sessions |

**Ready for Session 01.** Fill [first-impression/session-01.md](../../first-impression/session-01.md) header before the participant arrives.

---

## Start URL

**Always** `https://suhuella.com` — never `/home`.

The participant must discover the app the same way a real visitor would. Do not deep-link into the shell.

---

## Objective

Across **three** distinct profiles, can a person who has never seen SuHuella:

1. understand what it is,
2. open the app from the public site,
3. connect one folder,
4. find a known document in Search,
5. remove the source,

**without operator help?**

If all three reach Search alone and show plausible understanding of what SuHuella would do with documents (including **Plan / Organise** when asked after the session), the Web UX is likely ready for private beta.

---

## Three sessions (required)

Do **not** close this track after one participant. Run **three** sessions with **three different people** before PASS.

| Session | Profile | Folder / context |
| --- | --- | --- |
| **1** | Low technical comfort (typical age 40–70) | Uses computer regularly; PDFs, invoices; **Downloads** or Documents |
| **2** | Very organised professional | Lawyer, gestor, consultant; structured folders; **hundreds to thousands** of files |
| **3** | Chaotic desktop habit | Full Desktop or Downloads; **hundreds** of files; messy or absurd filenames |

Each participant:

- has never seen SuHuella
- is comfortable using a browser
- has a **real** folder (not demo data)
- is **not** a developer of the project

Schedule sessions on separate days when possible so fixes from PASS WITH FIXES can land before the next profile.

### Session record (copy per participant)

```text
Session: 1 | 2 | 3
Profile label:
Relationship to project:
Browser / Device / Language:
Approx technical level:
Folder type:
Approx file count:
Known document for Search:
Sensitive content yes/no:
Participant permission yes/no:
```

---

## Operator rules

**Only these two sentences are allowed during the session:**

> “Please think aloud.”

> “If something is unclear, do what you think is correct.”

**Do not:**

- explain the product
- point at UI
- answer product questions
- help unless the session is fully blocked

Confusion is data. Never interpret aloud during the session.

---

## Tasks

Give the participant this list **once**, without extra context. Do not demonstrate.

| # | Task |
| --- | --- |
| 1 | Open **https://suhuella.com** |
| 2 | Understand what SuHuella is |
| 3 | Open the application |
| 4 | Connect one folder |
| 5 | Wait until indexing finishes |
| 6 | Search for one known document |
| 7 | Open the document |
| 8 | You no longer want SuHuella to use this folder. **Remove it.** |
| 9 | If a friend asked you what SuHuella is, what would you tell them? |

Record **Start** and **Finish** per task (friction evidence — not participant evaluation). Do not coach between tasks.

**Passive observation (do not prompt):** Did the participant open **Organise** on their own? Note yes/no and when.

---

## Observe

During the session, record **only**:

- hesitation
- confusion
- wrong clicks
- time spent
- comments spoken aloud
- whether Organise was opened unprompted

**Never interpret during the session.**

### Observation log (one table per session)

Use [first-impression/session-XX.md](../../first-impression/session-01.md) — columns: **Start · Finish · Completed · Without help? · Notes**.

```text
Task timings (evidence only — fill after session):
4 Connect folder:
6 Search:
8 Remove:

Organise opened unprompted: yes / no
Assistance given (must be empty for session PASS):
```

---

## Afterwards ask

Ask **after** the session ends. Do not lead answers.

1. What do you think SuHuella is?
2. What was the hardest part?
3. Was anything unexpected?
4. Would you trust it with your documents?
5. Did anything suggest your files were uploaded?
6. What would you improve first?
7. **Would you install or use this product tomorrow?** — **Yes** / **Maybe** / **No**
8. If you noticed Organise (or if we show it briefly now without explaining): **what do you think SuHuella would do if you wanted to move or sort files?**

Q7 is the summary metric. Q8 captures **Plan** understanding without forcing Organise during the task list.

**Q8 wording is frozen** for sessions 01–03. Do not change the question between participants. If Q8 proves ambiguous after the summary, one PR may improve the **observation template only** — not the product.

**Confidence after session:** ask the participant to rate **1–5** (1 = not at all confident · 5 = completely confident). This is **trust**, not satisfaction. Not NPS or SUS.

### Post-session notes (per session)

```text
Q1:
Q2:
Q3:
Q4:
Q5:
Q6:
Q7 (Yes / Maybe / No):
Q8 (Plan / Organise):
Task 9 (friend explanation):
Confidence (1–5):
```

---

## Success criteria

### Per session

| Outcome | Definition |
| --- | --- |
| **Session PASS** | All 9 tasks completed without assistance; Search reached; Q7 is **Yes** or **Maybe** |
| **Session PASS WITH FIXES** | Flow completes with minor copy/UX friction only |
| **Session FAIL** | Cannot understand or complete the flow; Q7 **No** with trust/upload fear; or observer had to explain |

### Track close (all three sessions)

| Track outcome | Definition |
| --- | --- |
| **PASS** | Sessions **1, 2, and 3** each **Session PASS**; all three reach Search alone; Q8 shows plausible Plan understanding (organise = propose moves, user stays in control); **no** session Q7 = **No** alone blocks if others are Yes/Maybe — but **three Nos = FAIL** |
| **PASS WITH FIXES** | One profile hits friction that copy/UX can fix — one narrow slice, then **re-run that profile only** with a new participant |
| **FAIL** | Any profile cannot complete the flow, or aggregate trust (Q7) collapses, or Plan is incomprehensible across profiles |

---

## Product freeze (after track PASS)

When this track closes **PASS**, **freeze the product** for the beta window. Policy: [PRODUCT-FREEZE-001.md](../../PRODUCT-FREEZE-001.md). Beta spec: [PRIVATE-BETA-001.md](../../PRIVATE-BETA-001.md).

```text
FIRST-IMPRESSION-TEST-001  CLOSED · PASS
        ↓
    PRODUCT FREEZE
        ↓
PRIVATE-BETA-001
        ↓
    20–30 users
        ↓
    0.1.0-rc1
        ↓
    Public launch
```

**Do not open new functional tracks** after PASS except:

- **critical bugs** found in impression tests or private beta
- **narrow copy/UX** slices from PASS WITH FIXES

The main risk is no longer missing a feature — it is **regression from continued change**.

`PRODUCTION-READINESS-001` remains a separate technical gate; it does not replace these three sessions.

---

## Flow

```text
FIRST-IMPRESSION-TEST-001
    ↓
first-impression/session-01.md
first-impression/session-02.md
first-impression/session-03.md
    ↓
FIRST-IMPRESSION-SUMMARY-001.md
    ↓
Decision: PASS | PASS WITH FIXES | FAIL
    ↓
PRODUCT-FREEZE-001 → PRIVATE-BETA-001
```

After **PASS**, freeze internal functional tracks. Open new tracks only for problems **reported by users**, not internal reviews.

---

## Next

```text
PASS (summary)
    ↓
PRODUCT FREEZE
    ↓
PRIVATE-BETA-001

PASS WITH FIXES
    ↓
One implementation slice maximum (pick highest severity)
    ↓
One new participant on affected profile
    ↓
Update FIRST-IMPRESSION-SUMMARY-001 → close

FAIL
    ↓
One blocker slice only
```

---

## Out of scope

- new features
- redesign
- architecture
- checkout
- desktop
- partner mode
- branding work

---

## Operator checklist (each session)

```text
[ ] All preconditions confirmed
[ ] Correct profile bucket (1 / 2 / 3) and new participant
[ ] Real folder ready; one known filename for Search
[ ] Start URL: https://suhuella.com only
[ ] Incognito / clean profile
[ ] Observer script memorised (two sentences only)
[ ] Observation table ready
[ ] Post-session questions ready (including Q7 and Q8)
```

---

## Track close

Complete [FIRST-IMPRESSION-SUMMARY-001.md](FIRST-IMPRESSION-SUMMARY-001.md) when all three session files are filled. Copy the **Decision** block from the summary into this track’s status header.

---

## Expected final status

```text
FIRST-IMPRESSION-TEST-001 — CLOSED · PASS
```

or

```text
FIRST-IMPRESSION-TEST-001 — CLOSED · PASS WITH FIXES
```

or

```text
FIRST-IMPRESSION-TEST-001 — CLOSED · FAIL
```
