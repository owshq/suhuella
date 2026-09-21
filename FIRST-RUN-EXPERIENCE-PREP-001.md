# FIRST-RUN-EXPERIENCE-PREP-001

```text
STATUS = CLOSED · READY
TYPE = Pre-RC first-run session preparation
CURSOR = NO (prep only — do not run the session)
EXECUTION = FIRST-IMPRESSION-TEST-001 (preconditions met — operator runs session)
```

**Preparation only.** This track does not observe a real user, does not tag rc1, and does not open **PRODUCTION-READINESS-001**.

Parent spec: [FIRST-IMPRESSION-TEST-001.md](tracks/archive/FIRST-IMPRESSION-TEST-001.md) (supersedes [FIRST-RUN-EXPERIENCE-001.md](FIRST-RUN-EXPERIENCE-001.md))

Expected final status after operator completes participant + folder selection:

```text
FIRST-RUN-EXPERIENCE-PREP-001 — CLOSED · READY
```

---

## Execution precondition

Do **not** run **FIRST-IMPRESSION-TEST-001** until:

```text
COMBINED-PRE-RC-SMOKE-001 = CLOSED · PASS
```

**COMBINED-PRE-RC-SMOKE-001** closed **PASS** (post-deploy rerun 2026-09-19). Execution may proceed once operator selects participant and test folder.

**Start URL (after smoke passes):** `https://suhuella.com` (participant discovers the app — task 3)

Product under test: **SuHuella Web** only. Desktop is not in this RC.

---

## Operational flow

```text
DONE
    APP-MODAL-SHELL-PRODUCTION-DEPLOY-001  CLOSED · PASS
    COMBINED-PRE-RC-SMOKE-001              CLOSED · PASS
    FIRST-RUN-EXPERIENCE-PREP-001          CLOSED · READY

NOW
    FIRST-IMPRESSION-TEST-001  ← operator selects participant + folder, then runs session
```

---

## 1. Participant selection

Run **three** sessions — one participant per profile in [FIRST-IMPRESSION-TEST-001.md](tracks/archive/FIRST-IMPRESSION-TEST-001.md):

| Session | Profile |
| --- | --- |
| 1 | Low technical (40–70); PDFs, invoices, Downloads |
| 2 | Organised professional; hundreds–thousands of files |
| 3 | Chaotic habit; messy Desktop/Downloads, absurd names |

### Criteria (each participant)

Select **one** first-time participant who:

- has **not** built, designed, or tested SuHuella
- has **not** seen internal prompts, architecture docs, or RC track specs
- is **not** a software developer on this project
- can use a modern browser and pick a local folder without step-by-step IT help
- is comfortable speaking aloud while using a product (observer present)
- can commit ~30 minutes (5-minute product window + setup + post-session questions)

**Preferred profiles** (pick one):

- office worker who manages email attachments and PDFs
- freelancer with client invoices and contracts
- student with coursework PDFs and screenshots
- accountant or bookkeeper with routine document folders
- consultant who organises project files locally
- family member who naturally sorts household documents

**Avoid:**

- project developer or contributor to SuHuella
- product designer involved in SuHuella
- anyone who already knows what “Plan”, “Sources”, or “Activity” mean in this product
- anyone who needs the product explained before starting

### Template profile (operator fills before session)

```text
Participant ID:        TBD — operator selects (use initials or code, not full legal name in notes)
Relationship to team:  TBD — operator selects (e.g. colleague, friend, family — no real name required)
Device:                TBD — operator selects (e.g. MacBook Air M2, Windows laptop)
Browser:               TBD — operator selects (e.g. Chrome 129, Safari 18, Firefox 130)
OS language:           TBD — operator selects (e.g. es-ES, en-GB)
Technical level:       TBD — operator selects (non-technical | comfortable-with-computers | power-user-non-dev)
Document habits:       TBD — operator selects (e.g. Downloads pile, organised Documents subfolder)
Session date:          TBD
Observer:              TBD — operator selects
```

**Do not invent real personal data.** Leave fields as `TBD` until the operator confirms a participant.

### Participant briefing (before browser opens)

Tell the participant:

- SuHuella is a product being tested; honest reactions help
- There is no right or wrong way to use it
- Files stay on their computer; nothing is uploaded
- They may stop at any time
- The observer will stay quiet unless they are completely stuck

Do **not** explain screens, terminology, or expected journey.

---

## 2. Test folder prep plan

### Goal

Provide a **realistic** local folder the participant would naturally choose — not a curated demo set.

### Recommended approach

1. Ask the participant to pick **one** folder they already use, **or**
2. Offer to create a **temporary test folder** together before the session if they prefer not to use personal material

### Allowed folder types

- `Downloads` (if it contains mixed PDFs, images, screenshots)
- `Documents` subfolder (e.g. “Facturas 2025”, “Clientes”, “Curso”)
- A dedicated prep folder with **normal-looking** files the participant or operator already has permission to use

### Realistic mix (target 15–40 files)

| Type | Examples | Notes |
| --- | --- | --- |
| PDF invoices / receipts | `factura-*.pdf`, scanned receipts | varied names, not perfectly labelled |
| Contracts / letters | `.pdf`, occasional `.docx` if present locally | avoid confidential third-party data |
| Images / screenshots | `.png`, `.jpg`, `.heic` | phone screenshots, export snippets |
| Spreadsheets | `.xlsx`, `.csv` | optional; only if participant already has them |
| Nested subfolders | 1–2 levels deep | e.g. `2025/Enero/` — tests indexing, not navigation coaching |

### Permissions

- Folder must be **readable** by the browser’s folder picker (File System Access API)
- Participant must be able to **grant** access without admin credentials
- On macOS: avoid system-protected locations (`/System`, iCloud-only stubs without local copy)
- On Windows: prefer user profile paths over network drives for first run

### Avoid

- Carefully curated “perfect demo” sets with obvious labels like `INVOICE_ACME_2025.pdf` for every file
- Synthetic lorem-ipsum documents that look like QA fixtures
- Sensitive personal documents **unless the participant explicitly chooses them**
- Password-protected PDFs or encrypted archives (adds noise unrelated to first-run UX)
- Empty folders or single-file folders (too little signal)

### Prep checklist (operator)

```text
[ ] Participant confirmed folder path or agreed to pick at session start
[ ] Folder contains mixed realistic file types (not a demo kit)
[ ] No confidential third-party data unless participant opted in
[ ] Browser can request folder permission on participant device
[ ] Approximate file count recorded (15–40 target)
[ ] Folder path recorded in session note (local operator copy only)
```

**No files are uploaded.** Indexing is local-only.

---

## 3. Observer script

### Role

One observer, one participant. Observer **watches and records** — does not teach the product.

### Allowed phrases (verbatim)

The observer may **only** say these unless the session is blocked (see interventions):

> “Please use the product as you normally would.”

At session start (once):

> “I’ll stay quiet while you explore. Say what you’re thinking out loud if you can. Ask me only if you’re completely stuck.”

If participant asks “Am I doing this right?”:

> “There’s no right or wrong — use it the way you would if you found it on your own.”

If participant asks “What should I click?” (first time):

> “What would you try first if I weren’t here?”

### Intervention rules

| Situation | Action |
| --- | --- |
| Participant hesitates, rereads, backtracks | **Do not intervene.** Record hesitation. |
| Participant asks what a word means | **Do not define product terms.** Record the word. |
| Participant asks what SuHuella does | **Do not explain.** Record the question. |
| Browser blocks folder picker (OS dialog) | **Minimal OS help only** (e.g. “That’s the system folder dialog — choose the folder you prepared”). No product explanation. |
| Session blocked >2 minutes with no progress | **One** neutral prompt: “What are you looking for right now?” — not a hint toward a screen. |
| Participant wants to stop | **Allow stop.** Record as partial session. |
| Observer tempted to explain Plan / Sources / Activity | **Do not.** Confusion is product feedback. |

### Blocked session definition

Blocked = participant cannot proceed without product knowledge (e.g. cannot find any entry point, folder picker fails repeatedly, page error with no recovery).

If blocked after one neutral prompt: note **BLOCKED** with timestamp and last screen. Do not run a guided tour.

### Recording

- Screen recording: **optional** — only with participant consent
- Required: written timing sheet + observation sheet (templates below)
- Capture exact quotes when possible

---

## 4. Timing sheet template

Copy into local session note. Record **elapsed mm:ss from browser open** unless noted.

```text
Participant ID:
Date:
Observer:
Browser:
Device:
Folder type:
Approx document count:

Timing (mm:ss from product open):
- Open product:
- Understand what it does:
- First meaningful click:
- Connect source (picker opened):
- Connect source (folder granted):
- Index complete (or first useful Home signal):
- First Home understanding (participant articulates what SuHuella knows):
- First Search (query submitted):
- First Organise (screen opened):
- First Plan understanding (participant explains Plan in own words):
- First Activity understanding (or preview if no confirm):
- Session end / natural stop:

Primary question targets (~5 min product window):
- Time to understand what SuHuella is:
- Time to first meaningful action:
- Time to connect a source:
- Time until Home shows useful knowledge:
- Time to first Search:
- Time to first Organise attempt:
- Time to understand Plan:
- Time to understand Activity:
```

---

## 5. Observation sheet template

```text
Participant ID:
Date:
Observer:

Observed behaviour:
- Hesitations (count + where):
- Questions asked (verbatim if possible):
- Misunderstood words:
- Buttons or links avoided:
- Expected actions not found:
- Dead ends (screen + what participant tried):
- Trust moments:
- Trust breaks:
- Errors (UI or browser):
- Screens visited (order):
- Screens never discovered:

Screen-specific notes:

Home — “What does SuHuella know?”
- Understands Home?
- Counts make sense?
- Next action obvious?
- Failure signals:

Sources — “What can SuHuella see?”
- Connect / folder picker clear?
- Understands files stay local?
- Failure signals:

Search — “What can I find?”
- Natural search behaviour?
- Results make sense?
- Failure signals:

Organise — “What should happen?”
- Understands nothing changed yet?
- Plan understandable?
- Confirm feels safe?
- Failure signals:

Activity — “What happened?”
- Explains completed actions?
- Undo visible / trusted?
- Failure signals:

Settings (only if opened naturally):
- License / privacy / notifications notes:

Observer interventions (should be zero product explanations):
- Timestamp — phrase used — reason:
```

---

## 6. Post-session questions (all 8)

Ask **after** the participant stops exploring. Do not argue or correct.

1. What do you think SuHuella does?
2. What did it learn from your folder?
3. Did you feel your files were uploaded?
4. Did you feel in control before anything changed?
5. What confused you?
6. What made you trust it?
7. What would stop you using it again?
8. Would you try it with your own documents?

Record answers verbatim or near-verbatim in the session note.

---

## 7. Expected natural journey

Do **not** force every screen. Let the participant act naturally from **`https://suhuella.com`** (never `/home`).

```text
Landing / Home
    ↓
Sources → Connect folder → Index
    ↓
Home
    ↓
Search
    ↓
Organise → Plan → Confirm or stop before confirmation
    ↓
Activity
    ↓
Settings / License (only if naturally discovered)
```

Valid partial journeys:

- Stops after Search but demonstrates understanding → record; may still PASS or PASS WITH FIXES
- Reaches Organise but does not confirm Plan → record Plan understanding separately
- Never opens Activity if they did not confirm anything → note; not automatic FAIL

Invalid observer behaviour:

- “Now go to Sources”
- “Click Organise”
- Explaining Plan before participant reaches it

---

## 8. Pass / Pass with fixes / Fail criteria

Aligns with [FIRST-IMPRESSION-TEST-001.md](tracks/archive/FIRST-IMPRESSION-TEST-001.md) (three required sessions).

### PASS

- Participant understands SuHuella **suggests where documents belong**
- Participant understands **files stay local**
- Participant can **connect a folder**
- Participant can **see what SuHuella knows** (Home)
- Participant can **search**
- Participant can **reach Organise**
- Participant understands **Plan before execution**
- Participant understands **Activity after execution or preview**
- Participant would **continue** or is **interested enough to try again**
- Observer did **not** explain the product

### PASS WITH FIXES

- Journey completes but **repeated confusion** in copy, CTA, or screen flow
- Participant needs **one** clarification (observer neutral prompt only — not product explanation)
- **One non-critical dead end**
- Trust is **mostly intact**
- Recommended fixes are wording / CTA / empty state / helper text / order of visible actions only

### FAIL

- Participant **cannot understand** what SuHuella does
- Participant **cannot connect** a folder
- Participant **believes files were uploaded**
- Participant **cannot find** the next action
- Participant **cannot understand** Organise / Plan
- Participant **does not trust** the product
- Observer has to **explain the product repeatedly**
- Session **BLOCKED** with no recoverable first-run path

### Verdict block (copy into session note)

```text
Verdict: PASS | PASS WITH FIXES | FAIL

Recommended fixes (if any):
- fix 1
- fix 2
- fix 3

Next action (exactly one):
- PASS (all 3 sessions) → PRODUCT FREEZE → PRIVATE-BETA-001
- PASS WITH FIXES → minimal copy/UX fixes, rerun affected profile with new participant
- FAIL → one narrow fix slice from biggest blocker
```

---

## 9. Session records

Fill [first-impression/session-01.md](first-impression/session-01.md), [session-02.md](first-impression/session-02.md), and [session-03.md](first-impression/session-03.md). Mandatory header (Age, Occupation, Browser, …) before each session. After all three: [FIRST-IMPRESSION-SUMMARY-001.md](tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md).

---

## 10. Prep completion checklist

Operator closes this prep track when:

```text
[ ] Participant selected (profile fields filled — no invented personal data)
[ ] Participant briefed (no product walkthrough)
[ ] Test folder plan confirmed (realistic mix, permissions OK)
[ ] Observer assigned and script reviewed
[ ] Timing + observation templates copied to session note location
[ ] Post-session questions printed or ready
[ ] COMBINED-PRE-RC-SMOKE-001 PASS confirmed before scheduling FIRST-IMPRESSION-TEST-001
[ ] Start URL confirmed: https://suhuella.com (not /home)
[ ] Three session profiles scheduled (low technical · organised · chaotic)
```

---

## 11. Definition of done (this prep track)

```text
FIRST-RUN-EXPERIENCE-PREP-001 — CLOSED · READY
```

Prep is **ready**. Execution remains **FIRST-IMPRESSION-TEST-001** (three sessions) after smoke **PASS**.

Do **not**:

- run the live session under this track
- tag rc1
- open PRODUCTION-READINESS-001
- change product code as part of prep
