# FIRST-RUN-EXPERIENCE-001

```text
STATUS = SUPERSEDED
TYPE = Pre-RC first-run product validation
SCOPE = SuHuella Web only
SUPERSEDED_BY = FIRST-IMPRESSION-TEST-001
```

**Do not run this session.** Use [FIRST-IMPRESSION-TEST-001.md](FIRST-IMPRESSION-TEST-001.md) instead.

**Not a code task. Not a technical audit. Not production readiness. Not a feature review.**

[SOURCES-CAPABILITY-MATRIX-001.md](SOURCES-CAPABILITY-MATRIX-001.md) is **CLOSED · PASS** (2026-09-19). Production `/sources` shows Local, Limited in browser, and Coming later. Connect folder, Search, and Remove hold. The participant session can run. Use incognito or hard refresh so `suhuella-web-shell-v6` loads.

[BROWSER-ORGANISE-SELECTION-001.md](BROWSER-ORGANISE-SELECTION-001.md) is **CLOSED · PASS** (2026-09-19). Organise in the browser can create a Plan from connected sources or a local picker. Do not treat a missing Plan as a first-run blocker.

[BROWSER-SOURCES-BRAND-FLOW-001.md](BROWSER-SOURCES-BRAND-FLOW-001.md) and [BROWSER-SOURCE-INDEX-SEARCH-001.md](BROWSER-SOURCE-INDEX-SEARCH-001.md) are **CLOSED · PASS** (2026-09-19). Use incognito or hard refresh so the current service worker loads.

[BROWSER-CONNECT-SOURCE-001.md](BROWSER-CONNECT-SOURCE-001.md) is **CLOSED · PASS** (2026-09-19) for “source appears after picker.”

Prep ready: [FIRST-RUN-EXPERIENCE-PREP-001.md](FIRST-RUN-EXPERIENCE-PREP-001.md) — **CLOSED · READY**.

The question is:

> Can a person understand what SuHuella does, connect a source, see what SuHuella knows, search, organise documents, understand the Plan, and understand Activity within approximately five minutes?

Expected final status:

```text
FIRST-RUN-EXPERIENCE-001 — CLOSED · PASS
```

or

```text
FIRST-RUN-EXPERIENCE-001 — CLOSED · PASS WITH FIXES
```

or

```text
FIRST-RUN-EXPERIENCE-001 — CLOSED · FAIL
```

---

## Precondition

Confirm **before starting**:

| Track / flag | Required state |
| --- | --- |
| `CHECKOUT-PRODUCTION-ENABLEMENT-001` | CLOSED · READY FOR STRIPE |
| `PUBLIC_CHECKOUT_ENABLED` | NO |
| `RESEND-PRODUCTION-001` | CLOSED · OTP PRODUCTION PROVEN |
| `VERSION-CONSISTENCY-001` | CLOSED · PASS WITH FIXES |
| `DESKTOP-RELEASE-DISTRIBUTION-001` | CLOSED · PASS · `DESKTOP_IN_RC = NO` |
| `APP-MODAL-SHELL-PRODUCTION-DEPLOY-001` | CLOSED · PASS |
| `COMBINED-PRE-RC-SMOKE-001` | CLOSED · PASS |

If any is not true: **STOP.** Do not run the session.

All preconditions met as of 2026-09-19. Operator may proceed once participant and folder are selected.

---

## Start URL

Use production only:

**https://suhuella.com/home**

- Do **not** use localhost.
- Do **not** use staging.
- Do **not** explain the app before starting.

Product under test: **SuHuella Web**. Desktop is not in this RC.

---

## Participant

Use **one** first-time non-developer participant.

**Allowed profiles:**

- office worker
- consultant
- freelancer
- student
- accountant
- family member who organises documents

**Avoid:**

- developer
- designer involved in SuHuella
- anyone who has seen internal prompts
- anyone who knows the architecture
- anyone who has already tested SuHuella

**Fill in before the session:**

```text
Participant profile:
Relationship to project:
Browser:
Device:
Language:
Approx technical level:
```

Do not record unnecessary personal data.

---

## Test folder

Use a realistic local folder.

**Allowed:**

- Downloads
- Documents
- copied test folder
- mix of PDFs, invoices, screenshots, images, contracts, Office files

**Avoid:**

- perfect demo data
- artificial file names designed to make SuHuella look good
- sensitive documents unless the participant explicitly chooses them

**Fill in:**

```text
Folder type:
Approx file count:
File type mix:
Sensitive content yes/no:
Participant permission yes/no:
```

---

## Observer rule

The observer must **not** explain the product.

The observer may say only:

> “Please use the product as you normally would.”

If the participant asks “what should I do?”, answer:

> “Do what feels natural.”

**Only intervene if:**

- privacy risk
- accidental sensitive exposure
- participant is fully blocked and asks to stop

Do not correct. Do not guide. Do not explain terminology. Do not defend the product.

Confusion is product feedback.

---

## Expected natural journey

Do **not** force every step.

```text
Home
    ↓
Sources
    ↓
Connect folder
    ↓
Index / learning state
    ↓
Home
    ↓
Search
    ↓
Organise
    ↓
Plan
    ↓
Confirm or stop before confirmation
    ↓
Activity
    ↓
Settings only if naturally opened
```

If the participant chooses another path, record it.

---

## Observation targets

Record:

- time to understand what SuHuella does
- time to first meaningful click
- time to connect a source
- time until Home shows useful knowledge
- time to first Search
- time to first Organise attempt
- time to understand Plan
- time to understand Activity
- number of hesitations
- number of questions asked
- misunderstood words
- dead ends
- avoided buttons
- expected actions not found
- trust moments
- trust breaks
- privacy concerns
- upload concerns

---

## Screen checks

### Home

**Question:** What does SuHuella know?

Observe:

- Does the participant understand the screen?
- Does the participant know what to do next?
- Do counts and recognised names help?
- Does the screen feel empty or useful?

Failure examples:

- thinks Home is system health
- expects Activity here
- cannot identify next action

### Sources

**Question:** What can SuHuella see?

Observe:

- Does Connect make sense?
- Does folder permission make sense?
- Does participant understand files stay local?
- Does participant think SuHuella sees everything automatically?

Failure examples:

- thinks files are uploaded
- thinks this is account connection
- thinks Not connected is a license problem

### Search

**Question:** What can I find?

Observe:

- Does participant naturally search?
- Are results understandable?
- Does browser limitation explain itself?
- Does clicking a result avoid silent failure?

Failure examples:

- cannot find search box
- expects file to open and nothing clear happens
- does not understand result action

### Organise

**Question:** What should happen?

Observe:

- Does Select files/folder make sense?
- Does participant understand nothing has changed yet?
- Does the Plan feel safe?
- Does Confirm Plan feel risky or clear?
- Does “why this folder” build trust?

Failure examples:

- thinks files moved before confirmation
- fears losing files
- does not understand Plan
- does not trust destination

### Activity

**Question:** What happened?

Observe:

- Does Activity explain completed action or preview state?
- Does Undo feel visible and trustworthy?
- Does participant understand skipped/blocked if shown?

Failure examples:

- thinks Activity is analytics
- cannot find what happened
- expects Activity before any action

### Settings

Only observe if naturally opened.

Check:

- identity opens Settings
- License is understandable
- Privacy reassures
- Notifications do not promise unavailable Desktop features
- Diagnostics does not feel like normal user configuration

---

## Post-session questions

Ask **only after** the session:

1. What do you think SuHuella does?
2. What did it learn from your folder?
3. Did you feel your files were uploaded?
4. Did you feel in control before anything changed?
5. What confused you?
6. What gave confidence?
7. What would stop you using it again?
8. Would you try it with your own documents?

Do not correct answers. Do not explain what they should have understood. Do not argue.

---

## Session template

Create one local note (do not commit private participant data unless explicitly allowed):

```text
Participant:
Date:
Observer:
Browser:
Device:
Language:
Folder type:
Approx document count:

Timing:
- Open product:
- Understand what it does:
- First meaningful click:
- Connect source:
- Index starts:
- Index useful:
- First Home understanding:
- First Search:
- First Organise:
- First Plan understanding:
- Confirm / stop:
- First Activity understanding:
- Session end:

Observed behaviour:
- Hesitations:
- Questions:
- Misunderstood words:
- Dead ends:
- Buttons avoided:
- Expected action not found:
- Trust moments:
- Trust breaks:
- Privacy concerns:
- Upload concerns:
- Errors:

Post-session answers:
1. What does SuHuella do?
2. What did it learn?
3. Were files uploaded?
4. Did you feel in control?
5. What confused you?
6. What gave confidence?
7. What would stop you?
8. Would you use it again?

Verdict:
PASS | PASS WITH FIXES | FAIL

Recommended fixes:
- fix 1
- fix 2
- fix 3
```

---

## Pass criteria

**PASS** if:

- participant understands SuHuella suggests where documents belong
- participant understands files stay local
- participant can connect a folder
- participant can see what SuHuella knows
- participant can search
- participant can reach Organise
- participant understands Plan before execution
- participant understands Activity after execution or preview
- participant would continue or try again

---

## Pass with fixes criteria

**PASS WITH FIXES** if:

- journey mostly completes
- trust mostly intact
- participant needs one clarification
- confusion appears in copy, CTA, route, or screen flow
- one non-critical dead end appears
- minimal wording or layout fixes would likely solve it

**Allowed fixes after this result:**

- wording
- CTA labels
- empty state copy
- helper text
- order of visible actions
- small layout clarification
- removing misleading copy
- better error explanation

Then rerun **FIRST-RUN-EXPERIENCE-001** with one **new** participant.

---

## Fail criteria

**FAIL** if:

- participant cannot understand what SuHuella does
- participant cannot connect a source
- participant believes files were uploaded
- participant cannot find next action
- participant cannot understand Organise / Plan
- participant does not trust the product
- observer has to explain repeatedly

If **FAIL**: do **not** open **PRODUCTION-READINESS-001**. Open exactly **one** narrow fix slice based on the biggest observed blocker.

---

## Out of scope

Do **NOT**:

- change code during the session
- guide the participant
- run production readiness
- tag rc1
- start private beta
- start real-user validation
- open Multibrand
- open BYOK
- open Connections
- open Automations
- reintroduce Desktop download
- change checkout
- change Resend
- change license model
- add new features

---

## Output (on close)

Update this file with:

```text
STATUS = CLOSED · PASS | PASS WITH FIXES | FAIL
```

Include:

- participant profile (no unnecessary PII)
- environment
- folder used
- journey completed yes/no
- timing
- observed confusion
- observed trust points
- post-session answers (summary)
- verdict
- recommended next action (exactly one)

---

## Decision rule

| Verdict | Next |
| --- | --- |
| **PASS** | **PRODUCTION-READINESS-001** |
| **PASS WITH FIXES** | one narrow **FIRST-RUN-FIX** slice, then rerun with new participant |
| **FAIL** | one narrow blocker fix slice only |

Do not open multiple fixes.

---

## Definition of done

Close only when:

- at least one first-time non-developer participant completes the session
- observer did not explain the product
- notes are recorded
- user understanding is documented
- trust/confusion points are documented
- verdict is PASS / PASS WITH FIXES / FAIL
- next action is exactly one item

---

## Operator session (copy-paste)

**CURSOR = NO.** Run this as operator. Cursor only enters after `PASS WITH FIXES` or `FAIL` if a narrow fix slice opens.

```text
FIRST-RUN-EXPERIENCE-001 — OPERATOR SESSION

STATUS: OPEN
TYPE: Live first-run observation
CURSOR: NO

TASK:
Run one first-run SuHuella Web observation with a first-time non-developer participant.

URL: https://suhuella.com/home
Do not use localhost or staging.
Do not explain the app before starting.

Observer may only say:
  “Please use the product as you normally would.”
If asked what to do:
  “Do what feels natural.”

Do not guide. Do not correct. Do not explain terminology. Do not defend the product.
Confusion is product feedback.

Before starting, fill:
  Participant profile / Relationship / Browser / Device / Language / Approx technical level
  Folder type / Approx file count / File type mix / Sensitive content / Permission

Observe (do not force every step):
  Home → Sources → Connect → Index → Home → Search → Organise → Plan → Confirm or stop → Activity → Settings if natural

Record timing, hesitations, questions, dead ends, trust moments/breaks, privacy/upload concerns.

Post-session (do not correct answers):
  1. What do you think SuHuella does?
  2. What did it learn from your folder?
  3. Did you feel your files were uploaded?
  4. Did you feel in control before anything changed?
  5. What confused you?
  6. What gave confidence?
  7. What would stop you using it again?
  8. Would you try it with your own documents?

Close with exactly one verdict: PASS | PASS WITH FIXES | FAIL

PASS              → PRODUCTION-READINESS-001
PASS WITH FIXES   → one narrow FIRST-RUN-FIX slice, rerun with new participant
FAIL              → one narrow blocker fix slice only

Do not open multiple fixes. Do not run PRODUCTION-READINESS-001 unless PASS. Do not tag rc1. Do not start private beta.
```

---

## Session results

```text
STATUS = OPEN — awaiting real operator session with non-developer participant
```

### Automated browser reconnaissance (2026-09-19)

**Not a valid close.** Cursor ran Playwright against production as a technical proxy only. No human participant, no folder connect (File System Access API requires user gesture), no post-session interview.

Script: `site/scripts/first-run-browser-walkthrough.mjs`  
Artifacts: `site/.first-run-walkthrough/` (screenshots + `report.json`)

| Screen | HTTP | First-run signal |
| --- | --- | --- |
| `/home` | 200 | Empty state clear: “Connect a source to begin”, 0 docs / 0 sources |
| `/sources` | 200 | “What SuHuella can see”, “Your documents stay on this device”, Connect on This Mac folders |
| `/search` | 200 | “Type a name to find a document” (empty, no source yet) |
| `/organise` | 200 | “Plan before anything changes”, local copy present |
| `/activity` | 200 | “Nothing has happened yet. Confirm a Plan in Organise” |
| `/download` overlay | 200 | Web available, Desktop not in pre-RC — no post-purchase copy |
| `/` landing overlay | 200 | Local-first, browser-now messaging |

**Possible friction for human session (observe):**

1. Sidebar **“Download for Mac”** visible on every screen while `DESKTOP_IN_RC = NO` — may confuse first-time users expecting web-only RC.
2. Home CTA **Connect** vs Sources **Connect** — verify participant finds folder connect without guidance.
3. Search / Organise empty until source connected — verify participant understands why.

**Automated proxy verdict:** `INCOMPLETE` — cannot assign PASS / PASS WITH FIXES / FAIL without real participant.

**Still required:** operator session per checklist above, then close with one official verdict.
