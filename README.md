# SuHuella

Paid utility that suggests the right folder when you save. SuHuella runs on Desktop and Web. The experience is the same. Capabilities depend on the platform.

> **Documentation describes the product. It never becomes the product.**

---

## Current build

**SuHuella 0.1.0-pre-rc** — Web RC path does not wait on Desktop installers.

**Web RC (critical path):**

```text
SOURCES-CAPABILITY-MATRIX-001
  →  FIRST-RUN-EXPERIENCE-001
  →  PRODUCTION-READINESS-001
  →  PRIVATE-BETA-001 (Web)
```

**Desktop (parallel, frozen):** GitHub Releases → Desktop Beta → Desktop RC. See [DESKTOP-RELEASE-ARTIFACTS-001](DESKTOP-RELEASE-ARTIFACTS-001.md) — **FROZEN · BLOCKED**.

```text
DESKTOP_IN_RC = NO
FIRST_RUN = WEB ONLY
```

**Open now (product):** [PRE-RC-TRACKS-001](PRE-RC-TRACKS-001.md). Next: [SOURCES-CAPABILITY-MATRIX-001](SOURCES-CAPABILITY-MATRIX-001.md) — **OPEN · VERIFYING**. [FIRST-RUN-EXPERIENCE-001](FIRST-RUN-EXPERIENCE-001.md) is **PAUSED**. Desktop tracks are **FROZEN · PRIORITY LOW**. Checkout is ready and off. [RESEND-PRODUCTION-001](RESEND-PRODUCTION-001.md) is **CLOSED · OTP PRODUCTION PROVEN**. [APP-MODAL-SHELL-001](APP-MODAL-SHELL-001.md) is **CLOSED · PASS** (supersedes DOWNLOAD-PAGE-SEMANTICS-001). [COMBINED-PRE-RC-SMOKE-001](COMBINED-PRE-RC-SMOKE-001.md) is **CLOSED · PASS**. [BRAND-THEME-TOKENS-001](BRAND-THEME-TOKENS-001.md) is **CLOSED · PASS**. [BROWSER-CONNECT-SOURCE-001](BROWSER-CONNECT-SOURCE-001.md), [BROWSER-SOURCES-BRAND-FLOW-001](BROWSER-SOURCES-BRAND-FLOW-001.md), and [BROWSER-ORGANISE-SELECTION-001](BROWSER-ORGANISE-SELECTION-001.md) are **CLOSED · PASS**. Next: [FIRST-RUN-EXPERIENCE-001](FIRST-RUN-EXPERIENCE-001.md). Do not open BYOK, Connections, Automation, or multibrand.

**Organise product model:** [CLOSED · PROVEN](#organise-product-model).

**Closed (product UX):** PRODUCT-AUDIT-FIXES-001 · ORGANISE-PLAN-PRODUCT-MODEL-AUDIT-001 · ORGANISE-PLAN-UX-CLEANUP-001. **Paused:** Identity acceptance · Desktop polish UX.

**Checklist:** [RC-CHECKLIST.md](RC-CHECKLIST.md). Do not start REAL-USER-VALIDATION-001 until **PRODUCTION-READINESS-001** closes and the build is promoted to **0.1.0-rc1**.

**Production routes (2026-09-19):** `npm run verify:production` passes — `/` · `/download` · `/license` → 307 app-shell modals; `/home` · `/search` · `/sources` · `/organise` · `/activity` · `/settings` → 200; `/app` → 308 `/home`.

Frozen: WEB-001 (product) · architecture v1.1 · six-screen model · core pipeline. **DEPLOYMENT-PIPELINE-001** · **WEB-ROUTING-FIX-001** — **CLOSED · PASS**.

---

## Current Product

**Today**

- Save As Assistant (Windows — five supported apps NOT TESTED; Preview works everywhere)
- Organise documents (reviewable Plan · Accept is a Plan decision · Apply is the execution gate · nothing mutates before confirm)
- Workflows (legacy `workflows.json` · compatibility read only · not created from Organise)
- Autopilot (not available as a trigger · later execution policy)
- Undo (30-day window · inverse execution)
- Activity (local history · 90 days or 500 runs)
- Home (what SuHuella knows · one-line state) · Sources · Settings (General · AI · License · Privacy · Notifications · Diagnostics · About)
- Licensing (public `/license` · Settings License · download ≠ purchase ≠ activation)
- Local Knowledge Index (folder names · file names · no content upload)
- Plan Assistant (On-device intelligence today · your account when connected · never executes)
- BYOK (optional · your provider · never ranks · conversation is ephemeral)
- SuHuella Web (`/home` · `/organise` · `/sources` · `/activity` · `/settings` · same Plan Editor · Search · Activity · Workflows · License)

**Not yet**

- Archive as a first-class plan action
- Folder-watch and connector workflow triggers
- Connectors (Drive · Dropbox · Gmail · …)
- LEARNING (explicit teaching · not AI conversation)
- macOS Save As watcher
- Local AI (ONNX) for the same Plan Assistant

Package detail: [desktop/README.md](desktop/README.md) · [site/README.md](site/README.md).

### PRODUCT-AUDIT-001

**Status:** CLOSED · PASS

**Overall:** READY FOR RC CHECKLIST

**Condition:** Do not start REAL-USER-VALIDATION-001 until PRODUCTION-READINESS-001 closes and the build is promoted to 0.1.0-rc1.

**Goal:** Every screen answers one question. Every control has one meaning. Desktop and Web differ only by capabilities. No fake data. No ambiguous copy. No dead buttons.

| Screen | Question | Verdict |
| --- | --- | --- |
| Home | What does SuHuella know? | PASS |
| Sources | What can SuHuella see? | PASS |
| Search | What can I find? | PASS |
| Organise | What should SuHuella do with these documents? | PASS |
| Activity | What happened? | PASS |
| Settings | How is SuHuella configured? | PASS |
| Desktop / Web | Same product · capabilities only | PASS |

Home stays **What does SuHuella know?** (frozen). “How is SuHuella doing?” is health — that belongs in a compact status line, not a second product question.

Must-fixes from the audit are closed in PRODUCT-AUDIT-FIXES-001. Organise passed the screen-question audit; the Plan *model* on that screen was audited in [ORGANISE-PLAN-PRODUCT-MODEL-AUDIT-001](#organise-plan-product-model-audit-001) and cleaned in [ORGANISE-PLAN-UX-CLEANUP-001](#organise-plan-ux-cleanup-001).

### ORGANISE-PLAN-PRODUCT-MODEL-AUDIT-001

**Status:** CLOSED · AUDIT PASS

**Type:** Product-model audit

```text
PLAN_MODEL = KEEP
PREVIEW_EXECUTION_SEPARATION = PASS
CONFIRM_REQUIRED = PASS
ACTIVITY_RECORDING = PASS

READY_SEMANTICS = FAIL · ENGINE_CONFIDENCE_EXPOSED_AS_USER_STATE
SKIPPED_SEMANTICS = FAIL · MULTIPLE_MEANINGS_COLLAPSED
ASSISTANT_PROMPTS = FAIL · STATIC / NOT GROUNDED
SAVE_AS_WORKFLOW = FAIL · PLAN_INSTANCE_PERSISTED_AS_REUSABLE_WORKFLOW

BYOK = OUT OF SCOPE
CONNECTIONS = OUT OF SCOPE
AUTOMATIONS = OUT OF SCOPE
PLAN_CONTRACT_CHANGE = NOT REQUIRED

NEXT = ORGANISE-PLAN-UX-CLEANUP-001
```

### ORGANISE-PLAN-UX-CLEANUP-001

**Status:** CLOSED · PASS

**Type:** Narrow product cleanup. No architecture expansion.

**Purpose:** Make Organise tell the truth about the Plan that already exists. Preview stays simulated. Confirm stays required. Execute stays after confirm. Activity still records what ran.

| Area | Change |
| --- | --- |
| Counts | Suggested / need no change / blocked. Engine `ready` is not a user state. |
| Skip | `Skipped` only after the user chooses Keep original. |
| Assistant chips | Grounded in the current Plan. No static “Group invoices by year”. |
| Save as workflow | Removed from Organise. Legacy `workflows.json` is unread-compatible only. |
| Reanalyse | Replaces the current proposal after a warning. Does not mutate files. |

Classification (`invoice`, `budget`, `screenshot`, …) stays internal evidence. `HINT_GROUPS` / `RECOGNISED_HINTS` are matcher buckets, not user folders.

Future Automation, if ever opened, must be a reusable rule — not a saved list of concrete paths. Not implemented here.

Accepted as **CLOSED · PASS**. The leftover risk (unknown `skipReason` → Needs review) is a safe degradation, not a gap: it is never treated as accepted, executable, or skipped.

`site check:app-host` still fails on pre-existing `desktop/src/host/browser/license.ts`. That failure is **out of this track**. It does not degrade this close and must not be used as a reason to edit license code from Organise.

### ORGANISE PRODUCT MODEL

**Status:** CLOSED · PROVEN

```text
ORGANISE = REVIEWABLE PLAN SURFACE

SELECTION
    ↓
ANALYSIS
    ↓
PLAN PROPOSAL
    ↓
USER REVIEW / ACCEPT
    ↓
CONFIRM
    ↓
EXECUTION
    ↓
ACTIVITY

PLAN != EXECUTION
PLAN != AUTOMATION

CLASSIFICATION != ORGANISATION
DOCUMENT TYPE != FOLDER

AI SUGGESTS
CAPABILITIES EXECUTE

READY != CONFIDENCE
SKIPPED = EXPLICIT USER DECISION ONLY

PREVIEW = SIMULATION
ACCEPT = PLAN DECISION
APPLY = EXECUTION GATE

ON-DEVICE = CURRENT PLANNER
BYOK = FUTURE PLANNER
CONNECTIONS = FUTURE SOURCES
AUTOMATION = FUTURE CONSUMER
```

Future intelligence or sources must still produce the same Plan and the same review semantics. Host and source capabilities bound execution only.

```text
ORGANISE-PLAN-PRODUCT-MODEL-AUDIT-001
    CLOSED · AUDIT PASS

ORGANISE-PLAN-UX-CLEANUP-001
    CLOSED · PASS

PLAN CONTRACT
    KEEP

EXECUTION PIPELINE
    KEEP

SAVE AS WORKFLOW
    REMOVED FROM ORGANISE

LEGACY workflows.json
    COMPATIBILITY READ ONLY

STATIC ASSISTANT PROMPTS
    REMOVED FROM PRODUCT AUTHORITY

GROUNDED ASSISTANT CHIPS
    PROVEN

BYOK
    NOT OPENED

CONNECTIONS
    NOT OPENED

AUTOMATIONS
    NOT OPENED

NEXT ORGANISE SLICE
    NONE
```

Do not open a successor. Resume the global product track.

### PRODUCT-AUDIT-FIXES-001

**Status:** CLOSED · PASS

**Type:** Product UX cleanup

**Purpose:** Close the blocking findings from PRODUCT-AUDIT-001 before starting real users. No new features. No architecture change.

| Area | Fix |
| --- | --- |
| Settings | One job per tab. General hides desktop-only controls in the browser. AI answers who is helping. License stays edition-only. Privacy reassures. Notifications list only real types. Diagnostics stays in Diagnostics. About stays thin. Legacy `folders` / `connections` / `storage` prefs map to current tabs. |
| Home | Knowledge only. One-line state. Empty state links to Sources. No Activity, Undo, or workflow management. |
| Activity | History only. BYOK teaching / preference / workflow-idea card removed. |
| Sources | Included locations keep a real `exists` flag. Missing path or lost permission shows **Unavailable** with Refresh / Refresh permission and Remove. |
| Desktop / Web | Differences are capability-only. No fake Save As, tray, launch-at-login, or notifications in the browser. |

**Closed:** Settings PASS · Home knowledge only · Activity history only · Sources shows real Unavailable · capability-only host differences · desktop and site checks pass.

PRODUCT-AUDIT-001 overall is **READY FOR RC CHECKLIST**. Users still wait for PRODUCTION-READINESS-001.

Browser click-through was not available in this session. Shared shell and typecheck pass; a real browser pass belongs with the RC checklist.

---

## 1. Vision

SuHuella learns how you organise files and recommends where documents belong. Everything stays local. Nothing moves without confirmation.

**KPI nº1:** after five minutes, the user feels SuHuella will save them time every day.

```text
Install → Add folders → First recommendation → Organise → Undo → “I would keep using this.”
```

---

## 2. Product Principles

| Principle | Rule |
| --- | --- |
| **NO MAGIC** | User can answer “why that folder?”. **Why this folder** stays. |
| **NO FEATURE WITHOUT EVIDENCE** | No feature without evidence it moves a metric. |
| **EVERY NEW FEATURE MUST FIT AN EXISTING DOMAIN** | Six domains only. |
| **EVERY EXECUTION SHOULD HAVE A SAFE RECOVERY PATH** | Reversible · Recoverable · or Irreversible with warning. |
| **EVERY FEATURE MUST SAVE TIME OR BUILD TRUST** | Engine saves time. Preview, Undo, Activity build trust. |
| **Identity, not licensing** | User sees Identity and capabilities — never Stripe vocabulary. |
| **One gesture, then done** | Save As: tap → user presses Save. Organise: Confirm → executes. |
| **SuHuella is not a file manager** | Organisation starts from explicit user selection only. |
| **The user approves plans** | Recommendation proposes · Organise builds a plan · User confirms · Executor runs · Activity records · Undo reverses. Never separate low-level commands. |
| **The Plan is the only thing the user edits** | The user reviews and edits a Plan. The Executor only executes approved Plans. |
| **Plan actions extend the Plan** | Move · Rename · Create Destination Structure · Archive · Ignore · future actions are **PlanActions**. They never change the Plan model. |
| **Capabilities, not complexity** | The product grows by adding capabilities — not by adding new product objects or parallel mechanisms. |
| **Rename never adds knowledge** | **RENAME NEVER ADDS KNOWLEDGE. IT ONLY NORMALISES EXISTING KNOWLEDGE.** Deterministic rename may reorder tokens already in the filename — never invent labels such as *Paid* or *Final*. Richer names come from Plan Assistant or BYOK as suggestions; the user still reviews and confirms. |
| **AI conversations are ephemeral** | **AI CONVERSATIONS ARE EPHEMERAL. KNOWLEDGE IS EXPLICIT.** Talking to the assistant is not teaching SuHuella. Teaching is a later explicit action (LEARNING), never an implicit consequence of chat. |
| **Workflows store intent** | WORKFLOWS NEVER STORE FILES. WORKFLOWS STORE INTENT. Plans execute. Activity remembers. |
| **One product** | **THE HOST NEVER DEFINES THE PRODUCT. THE HOST ONLY DEFINES CAPABILITIES.** **THE USER SHOULD NEVER NEED TO THINK ABOUT THE HOST.** Navigation, language, Plan, Search, Activity, Workflows, and AI stay the same. Capabilities depend on the platform. **WEB NEVER UPLOADS DOCUMENTS.** License API is the only network call. |
| **ONE OPEN MILESTONE** | Exactly one milestone OPEN at a time. Finish before opening the next. |
| **The product is ready when users keep using it** | Not when developers stop finding ideas. |

Milestone lifecycle: `OPEN → IN PROGRESS → CLOSED · PASS → ARCHIVED`. **BLOCKED** is not OPEN: the environment is missing; the work is not forgotten.

---

## 3. Architecture Freeze

**Frozen 2026-09-18 · v1.1 · FINAL.** If it is frozen, it is no longer discussed. **Only bugs may reopen it.**

| Domain | Status |
| --- | --- |
| COMMERCIAL · BUSINESS · KNOWLEDGE · PRODUCT | CLOSED · PASS |
| OPERATIONS | DESIGN · PASS |
| PLATFORM | PASS WITH GAPS |

**Six domains:** COMMERCIAL · BUSINESS · KNOWLEDGE · PRODUCT · OPERATIONS · PLATFORM.

**Frozen pipeline**

```text
Knowledge Source → KnowledgeDescriptor → Local Intelligence → Context Builder
  → Recommendation Engine → Recommendation → Organisation Plan
  → Intent → Capability → Action → Executor
```

**Frozen contracts:** Locator (structured destination) · Recommendation (immutable) · Organisation Plan (only mutable in chain) · Recommendation Engine (stateless · benchmark is truth).

**Platform contract (frozen)**

```text
SuHuella runs on Desktop and Web.
The experience is the same.
Capabilities depend on the platform.
```

Adapters only: FileSystem · Activity · Storage · License · Capabilities.
Shared: Recommendation · Plan · License · Search · AI language. Never two products.

**Plan pipeline (frozen):**

```text
Knowledge → Recommendation → Plan → Review → Confirm → Execution → Activity → Undo
```

Plan Assistant may propose or answer questions. It never ranks and never executes. Every future capability is a modification or execution of a **Plan**, never a parallel mechanism.

**Plan Assistant roles (frozen):**

```text
THE RECOMMENDATION ENGINE DECIDES.
THE PLAN ASSISTANT ADVISES.
THE USER APPROVES.
THE EXECUTOR ACTS.
```

**Plan Assistant principles (frozen):**

1. **THE PLAN ASSISTANT NEVER DEFINES THE TRUTH.** It only helps the user build a Plan. Truth stays with the Recommendation Engine, the Knowledge Index, and user confirmation — never AI.
2. **THE PLAN ASSISTANT NEVER PRETENDS TO UNDERSTAND.** Simple tasks may use on-device intelligence. Complex BYOK failures fail honestly. If it cannot help confidently, it says so.
3. **Every suggestion is traceable.** Move, Rename, Ignore, Archive, and folder ideas carry a because — e.g. because SuHuella recommends this destination · because you asked to ignore screenshots · because the filename contains unsupported Windows characters.
4. **THE PLAN ASSISTANT MAY COMBINE CAPABILITIES. IT MAY NEVER INVENT NEW ONES.** It may propose Move · Rename · Create Destination Structure · Ignore · Workflow ideas. It cannot propose Encrypt · Upload · Compress · Email · OCR until those capabilities exist in the product.

**Intelligence layers (frozen):** (1) **Deterministic core** — Knowledge · Recommendation · Plan · Execution · Activity · Undo. (2) **On-device intelligence** — Local Intelligence · rules · later Local AI (ONNX). Private. Never changes matching. (3) **Optional intelligence** — BYOK. User-paid. Never changes matching. Only helps the user.

**PlanAction contract (frozen):** every executable or reviewable row is a **PlanAction** with the same lifecycle — preview · review · confirm · execution · history · inverse (when one exists). No separate engines. Archive is a PlanAction with a different destination, not an “Archive Engine”. Ignore is a PlanAction on the **Plan** only: remove from the current Plan · no disk change · no Undo · Activity records *Ignored because…*.

**Create Destination Structure** (one PlanAction): prepare missing folders under an indexed root, then move. UI may say Create folder (one level) or Create structure (nested); the contract is the same. Forward: mkdir missing segments · move. Inverse: move back · delete empty created folders only. Failed move after mkdir: roll back empty created folders immediately.

**Capability safety:** SAFE_NOW (recommend · explain · navigate · copy · open · refresh) · CONFIRM_REQUIRED (move · rename · create · attachments · bulk) · FORBIDDEN (delete · overwrite · auto_save · background sync).

**Intelligence:** one engine for every edition. Local Intelligence enriches descriptors only. Plan Assistant proposes or answers after recommendation. Today that backend is **On-device intelligence** (rules). **Local AI** is the later ONNX model on the same interface. BYOK is used automatically when the user connects their own account — never ranks. Complex BYOK failures do not silently fall back.

**AI cost (frozen):** SuHuella never pays for AI. On-device intelligence costs SuHuella nothing. BYOK is the user’s provider. SuHuella never forwards requests to its own AI backend.

**Capability matrix (frozen)**

| Capability | On-device Intelligence | Local AI (later) | BYOK |
| --- | --- | --- | --- |
| Recommendation | Engine only | ❌ | ❌ |
| Explain recommendation | ✅ | ✅ | ✅ |
| Why not another folder | ⚠️ Basic | ✅ | ✅ |
| Build a plan | ⚠️ Rules | ✅ | ✅ |
| Workflow suggestions | ❌ | ⚠️ | ✅ |
| Summaries | ❌ | ⚠️ | ✅ |
| Long conversation | ❌ | ⚠️ | ✅ |

**AI principle (frozen):** AI MAY EXPLAIN · AI MAY SUGGEST · AI MAY NEVER DECIDE · The user always approves the Plan.

**Free and paid (frozen):**

```text
FREE IS LOCAL.
PAID UNLOCKS CAPABILITIES.
THE USER'S KNOWLEDGE STAYS ON THE DEVICE.
```

Home stays clean. Identity opens Account / License / Settings. Free works fully local, without an account. Paid only unlocks capabilities. Documents, the Knowledge Index, and Activity never move to SuHuella servers.

**Cloud role (frozen):**

```text
CLOUD DOES NOT CHANGE THE PRODUCT MODEL.

CLOUD ONLY CHANGES WHERE SOURCES LIVE
AND WHERE PLANS EXECUTE.

THE CLOUD STORES STATE.
THE DEVICE STORES KNOWLEDGE.
THE DOCUMENTS STAY WITH THE USER.

THE CLOUD NEVER STORES DOCUMENT CONTENT
OR THE DEVICE'S LOCAL KNOWLEDGE INDEX.

SYNC MAY STORE THE MINIMUM USER-APPROVED METADATA
REQUIRED FOR MULTI-DEVICE FEATURES.

Documents        → stay with user
Knowledge Index  → stays on device
Cloud State      → small, optional, user-approved
Plans            → may sync
Workflows        → may sync
Device status    → may sync
Connectors       → execute where files live
```

State may include license, devices, optional workflow/preference sync, pending remote Plans, and optional Activity summaries. Connectors execute cloud files via the user's Drive / Dropbox / OneDrive. Local files execute on Desktop. Sync is **OFF** by default.

**Workflow AI rule (frozen):** WORKFLOWS DO NOT REQUIRE AI. AI ONLY HELPS CREATE OR IMPROVE WORKFLOWS. RUNNING A WORKFLOW NEVER REQUIRES AI.

**Workflow determinism (frozen):** WORKFLOWS ARE DETERMINISTIC. The same Workflow may produce different Plans only because the user’s files have changed, the indexed knowledge has changed, or the user has changed the Workflow.

**Workflow transparency (frozen):** Every Workflow must remain understandable without AI — which folders it analyses, which actions it may propose, when it runs, and what it will do.

**Workflow ownership (frozen):** AI may create a Workflow. AI never owns a Workflow. The user always owns and edits the Workflow.

**BYOK context contract:** KnowledgeDescriptor summary · Recommendation · Current Plan · Activity summary · User question. Conversation is ephemeral assistant memory — not Knowledge, Activity, or a Workflow. Never: Knowledge Index · weights · scoring · embeddings · engine internals. Saved AI preferences are notes for future conversations only. They do not teach SuHuella.

**Identity contract:** `You → Identity → Capabilities`.

**Workflow contract (frozen)**

```text
Workflow = Intent Template + Trigger
Running a Workflow always produces a Plan.
Only a confirmed Plan produces an Execution.
WORKFLOWS NEVER STORE FILES. WORKFLOWS STORE INTENT.
```

A Workflow stores reusable intent (`workflowVersion: 1`), not files or the last result. Run analyses the current source and builds a new Plan. Folder watch, connectors, and Autopilot are later capabilities on the same contract.

```text
Workflow Template → Workflow Run → Plan → Review → Execution → Activity → Undo
```

```text
WORKFLOWS
✓ Manual trigger
□ Folder watch
□ Gmail trigger
□ Drive trigger
□ Schedule
□ Policy
□ Autopilot
```

---

## 4. Domain Model

**Domain:** Knowledge Source · Knowledge Descriptor · Knowledge Index · Knowledge Set · Recommendation · Organisation Plan.

**Knowledge Sources** (not “Local vs Cloud storage”): a source is anything SuHuella may learn from — local folders today; Drive, Gmail, Outlook, SharePoint, and NAS later. Home shows how much **knowledge** is administered (documents + size), not disk free space.

**PlanActions** (one contract): Move ✓ · Rename ✓ · Create Destination Structure ✓ · Archive (declared) · Ignore (declared). A single file may appear as **Create structure → Move → Rename** as distinct plan items — same Knowledge → Recommendation → Plan path, reviewed and confirmed separately. Rename strategies (`normalize` · `shorten` · `disambiguate` · `keep_original`) are part of the plan item contract; only **normalize** runs today.

**UX backlog (design only — does not change the contract):** destination tree preview (`Clients → 2026 → Invoices`) · per-segment **✓ Exists** / **+ Create** · visual action order when multiple PlanActions apply to one file.

> **RENAME NEVER ADDS KNOWLEDGE. IT ONLY NORMALISES EXISTING KNOWLEDGE.**
>
> **Rename** normalises existing filenames safely. It never invents information, never overwrites files, and always remains a user-reviewed Plan action. Future AI capabilities may propose richer names, but execution will continue to follow the same Plan → Review → Confirm → Execution contract.

**Product:** Intent · Capability · Action · Executor.

**Infrastructure (not user-facing):** Source Adapter · Local Intelligence · Context Builder · RecommendationContext · Recommendation Engine.

Knowledge Set groups Organise UI items. The engine never receives a set.

**Stable core (frozen):** Knowledge · Recommendation · Plan · Execution · Activity · Workflow · Undo. Connectors, Local AI, BYOK, and Autopilot enrich these — they do not add new product objects.

```text
Recommendation → Plan → Workflow → Activity → Undo
```

**Enrichment gate:** Does this enrich an existing concept or introduce a new one? New concepts need strong justification.

---

## 5. Product Roadmap

**Validation phase (now):** release candidates, not feature milestones.

```text
0.1.0-rc1
        ↓
PRODUCT-AUDIT-001          one question per screen
        ↓
PRODUCT-AUDIT-FIXES-001    close Settings / Home / Activity / Sources must-fixes
        ↓
DEPLOYMENT-PIPELINE-001    Operations · production /home 200
        ↓
RC checklist + first-impression test
        ↓
REAL-USER-VALIDATION-001
        ↓
0.1.0                      five to ten users without help
        ↓
Private Beta → Public Beta
```

**Built (frozen):** WEB-001 · Organise tab · canonical web routes · one SuHuella / two hosts.

**Operations (parallel):** DEPLOYMENT-PIPELINE-001 · WINDOWS-COMPATIBILITY-001 (BLOCKED).

```text
CONNECTORS → LEARNING → LOCAL AI → BYOK → AUTOPILOT → BUSINESS → ENTERPRISE
```

LEARNING follows Connectors because teaching only becomes meaningful once there are multiple sources. Talking to BYOK is never LEARNING.

No further Workflow milestones. Workflows are frozen; later work adds **capabilities** on the same contract (triggers, sources, execution policy).

**WINDOWS-COMPATIBILITY-001** validates the **input channel** (host Save As). **KNOWLEDGE-COMPATIBILITY-001** validates the **object** (file types). Keep them separate.

**PRIVATE-BETA-001** is not a technical milestone. It answers: *after several days, would people choose to keep using SuHuella?* Detail lives in **Current Milestone** when active (§9.2). Do not start connectors or OAuth before Save As is proven on Windows. BYOK stays an optional assistant after recommendation — never matching.

Parallel (do not block validation): performance measurement · auto-updater · release packaging (operational).

**PLAN-ACTIONS-001** (when opened): finish remaining Plan actions on the same contract (Move ✓ · Rename ✓ · Create Destination Structure ✓ · Archive · Ignore). Not separate features — new actions on one Plan.

---

## 6. Commercial Model

One engine for everyone. Editions differ by **Knowledge Sources** and **Capabilities** — never recommendation quality. Free includes On-device intelligence. BYOK is “use your own AI for more advanced planning,” not better matching. SuHuella never pays for AI.

| Edition | Sources | Capabilities |
| --- | --- | --- |
| Free | 1 local filesystem | Engine · Preview · Save As |
| Personal Lifetime | Local + cloud storage | Free + future desktop |
| Personal Monthly | + live collaboration | Lifetime + premium |
| Business | Later | Same engine · org on LicenseContext · min 20 seats |
| Enterprise | Later | Later |

**Partner License is not an edition of SuHuella.** It is a later Operator entitlement: €1,000/year founding fee for the right to operate one Brand. The Partner keeps 100% of end-customer revenue on **their** Stripe. Platform Stripe sells only the Partner fee. Public `/license` and Settings → License stay Free / Lifetime / Monthly / Business. Design: [docs/architecture/product/operator-partner-license.md](docs/architecture/product/operator-partner-license.md).

Stripe = checkout + Customer Portal. Billing never in desktop. Desktop sees signed `LicenseContext` only (`{userData}/license.json`).

Download ≠ purchase ≠ activation. Landing downloads the same SuHuella. `/license` is the public plan page. Settings → License buys or activates. Stripe Checkout `success_url` is only a return; entitlement is verified with Stripe before the current device is activated. Already purchased? is recovery, not the happy path.

Public API: `POST /api/license/activate` · `activate-from-checkout` · `check` · `deactivate`.

---

## 7. Operations

**`suhuella.com/_ops`** — customers · licenses · Business seats · activations · gifts · release display · support · audit. Legacy **`/admin`** redirects here.

Production: Cloudflare Access (Google / Microsoft) + `SUPERADMIN_EMAILS`. No password login. Local dev: `http://localhost:3000/_ops` opens without login on localhost only.

Closeout: [OPERATIONS-ACCESS-CLOSEOUT-001.md](OPERATIONS-ACCESS-CLOSEOUT-001.md). Site detail: [site/README.md](site/README.md).

Operations console manages access and support actions. Billing provider controls paid entitlement. Stripe controls paid license state. Console never touches matcher weights · ONNX · benchmark · user Knowledge Index.

**DEPLOYMENT-PIPELINE-001** — **CLOSED · PASS** (2026-09-18)

Definition of Done met: production routes return 200; `npm run verify:production` passes.

Deploy from repo root:

```bash
cd site && npm run deploy
# or: npm run cf:deploy   (from repo root)
```

Build fixes applied: strip `sharp` before OpenNext bundle · `NEXT_PRIVATE_MINIMAL_MODE=1` in `wrangler.jsonc` · Operations auth at `/_ops` (rewrite to `/ops`) + API route guards (no Node `proxy.ts` middleware).

**WEB-ROUTING-FIX-001** — **CLOSED · PASS** (merged into deployment).

### PRODUCTION-READINESS-001

**Status:** DEFERRED

Last run: BLOCKED. Those two P0s were closed by [RC-DOWNLOAD-JOURNEY-001](#rc-download-journey-001). Do not rerun this gate until [PRE-RC-TRACKS-001](PRE-RC-TRACKS-001.md) closes. It must be a no-surprise audit, not a list of work we already know is unfinished.

### CHECKOUT-PRODUCTION-ENABLEMENT-001

**Status:** CLOSED · READY FOR STRIPE · `PUBLIC_CHECKOUT_ENABLED = NO`

Report: [CHECKOUT-PRODUCTION-ENABLEMENT-001.md](CHECKOUT-PRODUCTION-ENABLEMENT-001.md).

Live Worker `c9b35ead-a879-4620-8be7-ca798de7ec5b` (2026-09-19). `PAID_CHECKOUT_ENABLED=false`. Lifetime/Monthly unavailable. Business Contact Sales. Forged `verify-session` is 400.

### DESKTOP-RELEASE-DISTRIBUTION-001

**Status:** CLOSED · PASS · STRATEGY B · `DESKTOP_IN_RC = NO`

Report: [DESKTOP-RELEASE-DISTRIBUTION-001.md](DESKTOP-RELEASE-DISTRIBUTION-001.md).

Live Worker `df34ed42-9ec7-4f9e-9cdd-2b9485c32fd4` (2026-09-19). Landing primary CTA is Open SuHuella → `/home`. No Download CTA. `/api/release` is `0.1.0-pre-rc` with no installer URLs. Desktop stays internal until a real publish path exists.

### Desktop distribution (frozen)

**DESKTOP-RELEASE-ARTIFACTS-001** — **FROZEN · BLOCKED · PRIORITY LOW** · [report](DESKTOP-RELEASE-ARTIFACTS-001.md)

**DESKTOP-DMG-HOSTING-UNBLOCK-001** — **FROZEN · BLOCKED · PRIORITY LOW** · [report](DESKTOP-DMG-HOSTING-UNBLOCK-001.md)

Local Mac DMG exists. No public host. Reopen only with GitHub Releases (preferred), R2, or operator HTTPS. Download is public when published; license controls use. `/download` stays Web-available, Desktop-unavailable.

### RC-DOWNLOAD-JOURNEY-001

**Status:** CLOSED · PASS · STRATEGY B

Report: [RC-DOWNLOAD-JOURNEY-001.md](RC-DOWNLOAD-JOURNEY-001.md).

Superseded for remaining hybrid landing copy by DESKTOP-RELEASE-DISTRIBUTION-001. Paid-grant durability remains in the live Worker.

### LICENSE-PAID-GRANT-DURABILITY-001

**Status:** CLOSED · PASS

**Type:** Narrow persistence fix. No architecture expansion.

**Purpose:** Make paid entitlement survive Worker isolate loss, restart, deploy, and N>1 request routing.

```text
PROCESS MEMORY != PAID ENTITLEMENT AUTHORITY
STRIPE CUSTOMER RECORD != LIFETIME GRANT
LICENSE_DB = paid grant authority
```

Report: [LICENSE-PAID-GRANT-DURABILITY-001.md](LICENSE-PAID-GRANT-DURABILITY-001.md).

Out of scope (unchanged): accounts, multibrand, Lifetime generations, BYOK, Connections, Automation, Business automated checkout.

---

## 8. Performance Targets

Frozen Beta policy. Fill **Measured** on real hardware before beta.

| Metric | Target | Measured |
| --- | --- | --- |
| Startup to tray | < 2 s | UNKNOWN |
| Overlay latency | < 50 ms | UNKNOWN |
| Save As recommendation | < 100 ms | UNKNOWN |
| Idle RAM (tray) | < 50 MB | UNKNOWN |
| Save As RAM | < 100 MB | UNKNOWN |
| Organise 1,000 files RAM | < 250 MB | UNKNOWN |
| Indexing RAM | < 350 MB | UNKNOWN |
| Idle CPU | 0–0.2 % | UNKNOWN |
| Total disk (extreme) | < 500 MB | UNKNOWN |

---

## 9. Validation

No telemetry. Observations local or manual only. Never explain the product during a session — confusion is a product problem.

### 9.1 REAL-USER-VALIDATION-001 — first session

**Question:** can a first-time user complete the workflow unassisted in one sitting?

**Workflow:** Install → understand → add folders → recommendations → organise → undo → would continue.

**After session — ask only:** What does SuHuella do? · What confused you? · What gave confidence? · What would stop you? · Would you use it daily?

**Metrics:** install time · first recommendation · first organisation · first undo · clicks · questions · errors.

**Session template** (store locally):

```text
Session # · Date · Platform · Observer · Profile
Timing: install→open · folders→recommendation · first organise · first undo
Counts: clicks · questions · errors
Completion: unassisted YES/NO · would continue YES/NO
Problems · Suggestions · Notes
```

### 9.2 PRIVATE-BETA-001 — commercial validation

**Not** bug hunting. **Question:** after using SuHuella for several days, would people choose to keep using it?

```text
Phase 1 — 5 users  →  fix repeated friction
        ↓
Phase 2 — 20 users →  Ready for Public Beta
```

**Group:** no project developers · mixed profiles (office · freelancer · student · accountant · engineer · family). Do not skip from five to public: new friction usually appears between 5 and 20.

**Period:** each phase minimum **7 consecutive days** · real documents · not artificial test cases.

**Metrics (observable):** install · onboarding · folders configured · first recommendation accepted · first organisation · first undo · sessions · documents organised · review count · undo usage · acceptance rate · time to first successful organisation.

**After several days — ask only:** Did it save time? · Did you trust recommendations? · When did trust break? · Which action felt unnecessary? · What would make daily use? · Would you recommend it?

**Bug policy:** critical → fix immediately · UX friction → fix only when repeated · feature requests → record only, never implement during Private Beta.

**Roadmap rule:** only **repeated** observations create milestones. Architecture never changes.

**Exit criteria:** install unassisted · understand product · organise successfully · trust recommendations · understand Undo · continue after several days · would recommend · no critical usability issues remain.

**Not success:** green builds · benchmark scores · developer approval.

**Output:** one Beta Summary — participants · observed behaviour · repeated friction · critical issues · roadmap changes · decision: **READY FOR PUBLIC BETA** or **EXTEND PRIVATE BETA**.

**Next after close:** PUBLIC-BETA-001.

### 9.3 KNOWLEDGE-COMPATIBILITY-001 — file types (later)

Not Windows. Not opened. **Question:** can SuHuella recommend a folder for the file types users actually save? Name, folder, and extension are enough. Content, OCR, and speech-to-text are later (ONNX). Table: [desktop/README.md](desktop/README.md#knowledge-compatibility-001-later--not-windows).

---

## 10. Development Rules

**Line budget:** `README.md` maximum **600 lines**. When over limit, **clean before adding**.

**Workflow:** README → code → users → README. Prompts are development tools — implement, update README, discard the prompt. Never store prompts as product documentation.

**Repository:** `site/` · `desktop/` · root shortcuts only. No new markdown docs except user guides or operations manuals.

| Topic | Source |
| --- | --- |
| Product · architecture · roadmap · validation | **This file** |
| Desktop build · engine · compatibility | [desktop/README.md](desktop/README.md) |
| Site · Stripe · Cloudflare | [site/README.md](site/README.md) |

**Agent rules**

1. Read this file first, then the package README for your task.
2. Architecture Freeze v1.1 — FINAL. No `*-ARCHITECTURE-002`.
3. **One OPEN milestone.** DESKTOP-POLISH-001. WINDOWS-COMPATIBILITY-001 stays **BLOCKED** (not OPEN).
4. Frozen means frozen — bugs only.
5. Tests green: `npm run check:knowledge-set` · `npm run benchmark:match` · `npm run build` (in `desktop/`).
6. A change must improve an accepted product metric or it is rejected.
7. Do not grow RAM, disk, or idle CPU against frozen budgets.

**Dev:** `npm run desktop` (root) · `cd desktop && npm run dev` · `npm run desktop:stop` if port 5173 busy.

**Release:** version `0.1.0-rc1` (see [RC-CHECKLIST.md](RC-CHECKLIST.md)) · `npm run package:mac` / `package:win` on matching OS.

---

## Archive

**Read-only history. Never edit. Never a living spec.**

| Milestone | Closed | Summary |
| --- | --- | --- |
| WEB-001 | 2026-09 · PASS | One product · same React app · capabilities only · no demo sources · WEB NEVER UPLOADS DOCUMENTS · production deploy → DEPLOYMENT-PIPELINE-001 |
| AUTOPILOT-001 | 2026-09 · PASS | Approved Workflows execute through the existing executor |
| PLAN-ASSISTANT-001 | 2026-09 · PASS | On-device intelligence · traceable proposals · honest degradation · never defines truth · never invents capabilities |
| BYOK-001 | 2026-09 · PASS | AI assistants · explain/suggest never decide · never matching · ephemeral conversation · preferences are not teaching |
| CREATE-STRUCTURE-001 | 2026-09 · PASS | Create Destination Structure · confirm · rollback on failed move · empty-folder undo |
| WORKFLOWS-001 | 2026-09 · PASS | Saved Plan + Trigger · manual run · confirmation required |
| RENAME-001 | 2026-09 · PASS | Safe filename normalisation as a Plan action · Why this name · user can edit · confirm · no overwrite · undo |
| PLAN-001 | 2026-09 · PASS | Plan Editor · Confirm N actions · inverse plan stored |
| DOCUMENTATION-CLEANUP-001 | 2026-09 · PASS | Single canonical README · 600-line budget · Current Product section |
| TIME-SAVED-001 | 2026-09 · PASS | Perceived time saved in Home · Organise · Activity |
| UNDO-001 / TRUST-001 | 2026-09 · PASS | Inverse execution · 30d undo · 90d history |
| ACTIVITY-001 | 2026-09 · PASS | Local history · 500 runs or 90 days |
| SUHUELLA-MVP-CORE-001 | 2026-09 · PASS | KnowledgeSet · preview · confirmed move |
| LICENSE-FLOW-001 | 2026-09 · PASS | LicenseContext · activate/check/deactivate |
| LICENSE-AUDIT-001 | 2026-09 · PASS | Paid rights protected · gifts revocable with audit · admin ≠ billing |
| LICENSE-CHECKOUT-UX-001 | 2026-09 · PASS | Download ≠ purchase ≠ activation · verify then auto-activate · /license |
| RESOURCE-MANAGER-001 | 2026-09 · PASS | Beta resource policy (design only) |
| RELEASE-MANIFEST-001 | 2026-09 · PASS | verify-session → release.json |
