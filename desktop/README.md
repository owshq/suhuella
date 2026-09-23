# SuHuella desktop

Electron + React + TypeScript. Tray assistant for Save / Save As and Organise.

Product vision, roadmap, commercial model, and validation: **[../README.md](../README.md)**.

## Architecture

```text
electron/
  main.ts                 Tray, windows, IPC
  preload.ts              Typed renderer bridge
  settings-store.ts       settings.json
  index-store.ts          index.json (Knowledge Index)
  indexer.ts              Folder scanner
  index-service.ts        Scan orchestration
  recommendations.ts      Recommendation Engine
  descriptors.ts          KnowledgeDescriptor builders
  local-intelligence.ts   Descriptor enrichment seam
  plan-assistant.ts       On-device Plan Assistant (never executes)
  plan-assistant-router.ts On-device or BYOK; no silent complex fallback
  byok.ts                 Assistant contract (never ranks)
  byok-store.ts           Encrypted provider key
  byok-client.ts          User-provider calls
  byok-conversation.ts    Ephemeral AI conversation (never persisted)
  byok-preferences-store.ts Notes for future AI conversations (not teaching)
  intents.ts              Intent Resolver (store_file today)
  capabilities.ts         Capability / Action registry
  confirmed-executor.ts   Confirmed file moves
  activity-store.ts       activity.json (90 days or 500 runs)
  workflow-store.ts       workflows.json (legacy · compatibility read only · not written from Organise)
  autopilot.ts            Autopilot execution mode (approved plan only)
  storage-manager.ts      Cache, logs, usage
  license-store.ts        Signed LicenseContext
  license-client.ts       activate / check / deactivate
  save-dialog-watcher.ts  Windows helper launcher
  compatibility-diagnostics.ts  Dev-only Save As log

native/win-save-watcher/  C# UI Automation (Windows only)

src/
  windows/                Onboarding · Settings · Suggestion
  components/             Home · Organise · Sources · Activity
```

| Window | When |
| --- | --- |
| Tray | Always after launch |
| Onboarding | Until `firstRunCompleted` — License → first source → Home |
| Settings / Home | After first run (first Home shows a one-time hint) |
| Suggestion overlay | Windows Save As detected |
| Preview Save As | Tray, Home, or `⌘⌥S` / `Ctrl+Alt+S` |

Settings and Preview Save As are never visible together. Launch always opens onboarding or Home. Closing the window keeps SuHuella in the tray / menu bar. Quit / ⌘Q exits. See [APPLICATION-LIFECYCLE-001.md](../docs/architecture/product/application-lifecycle.md).

## Local storage

| Path | Purpose |
| --- | --- |
| `{userData}/settings.json` | Indexed locations, counts, first-run flags |
| `{userData}/index.json` | Knowledge Index (`indexVersion`: 2) |
| `{userData}/activity.json` | Organisation history · 90 days or 500 runs |
| `{userData}/byok.json` | Connected AI assistant (key on this computer) |
| `{userData}/byok-preferences.json` | Optional AI conversation notes (not engine rules, not teaching) |
| `{userData}/workflows.json` | Legacy saved Plans · compatibility read only · not an Automation |
| `{userData}/license.json` | Signed LicenseContext |
| `{userData}/cache/` | LRU cache · 30 days · 500 MB cap |
| `{userData}/logs/` | Support logs · 30 days · 50 MB cap |
| `{userData}/diagnostics/` | User-exported support JSON |

No automatic rescans or filesystem watchers. Scan on add folder, rescan, or onboarding.

### Release build — offline license verify

Production `npm run build` embeds Ed25519 **public keys only** at compile time (never HMAC or private keys):

```bash
export SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS="<SPKI public key(s), comma-separated>"
npm run build
npm run test:license-build-inlining
npm run test:license-offline-verify
npm run test:license-dual-verify
```

Must match the Worker’s `LICENSE_SIGNING_PUBLIC_KEYS` after Ed25519 is enabled in production. See [SIGNED-LICENSE-RIGHTS-DELIVERY-006.md](../SIGNED-LICENSE-RIGHTS-DELIVERY-006.md).

### settings.json

```json
{
  "indexedLocations": [],
  "indexedFolderCount": 0,
  "indexedFileCount": 0,
  "lastIndexed": null,
  "firstRunCompleted": false,
  "launchAtLogin": false,
  "knowledgeSourcesEnabled": { "local_folder": true }
}
```

Only `local_folder` is implemented. Other source flags are declared only.

### Knowledge Index

Each folder record: source id, path, tokens, extensions, file count, sample filenames. Built incrementally on user action. Skips `node_modules`, `.git`, etc.

### Activity

Human history of confirmed organisation runs. Undo available 30 days when reversible. Undo runs use `reversesRunId`. Never uploaded.

## Recommendation engine

`electron/recommendations.ts` — hybrid retrieval + explainable ranking.

```text
KnowledgeDescriptor → Local Intelligence → Context Builder → RecommendationContext
  → Candidate Generator (max 100) → Scorers → Top 5 Recommendation[]
```

Scorers: entity, path tokens, existing filenames, document hints, topic, parent context, extension (low weight), generic-folder penalty.

**Output:** `{ folder, score, confidenceLabel, label, reasons[], contributions[] }` — Strong / Good / Possible / Weak match.

Every origin must pass through `descriptors.ts` before ranking. Engine is stateless and edition-agnostic. Capability safety tables: [../README.md §3](../README.md#3-architecture-freeze).

## Benchmarks

```bash
cd desktop
npm run benchmark:match          # synthetic fixture — 19/19 must pass
npm run benchmark:match:sample # template for local cases
npm run benchmark:match:real     # your index + match-benchmark.local.json
npm run check:knowledge-set      # knowledge-set + activity + storage + undo checks
```

`*.local.json` is gitignored. Do not commit personal paths.

## Windows Save / Save As

```text
Save As → detect → extract → recommend → user clicks → dialog navigates → user presses Save
```

Electron launches `SuhuellaSaveWatcher.exe` (UI Automation, stdin/stdout JSON). SuHuella **never** presses Save.

Build helper (Windows + .NET SDK):

```bash
npm run publish:win-helper
```

### WINDOWS-COMPATIBILITY-001 (measurement only)

```text
Status
BLOCKED

Reason
Requires a real Windows environment.
No Windows environment is currently available.
```

**Windows Compatibility validates the operating system, not the Recommendation Engine.** A host-app dialog failure is not an engine failure. File-type coverage is a different milestone: **KNOWLEDGE-COMPATIBILITY-001**.

Supported ≠ tested. Do not invent PASS. Status values: `PASS` · `FAIL` · `PARTIAL` · `NOT TESTED` · `NOT SUPPORTED`.

**Application Compatibility (MVP)** — Save As channel only.

| Application | Purpose | Supported | Tested | Version | Status |
| --- | --- | --- | --- | --- | --- |
| Notepad | Win32 standard | Yes | No | — | NOT TESTED |
| Word | Office | Yes | No | — | NOT TESTED |
| Excel | Office | Yes | No | — | NOT TESTED |
| Chrome | Download / Save As | Yes | No | — | NOT TESTED |
| Acrobat Reader | PDF host | Yes | No | — | NOT TESTED |
| Photoshop | Custom UI | No | No | — | NOT SUPPORTED |
| Custom WinUI/WPF | Custom UI | No | No | — | NOT SUPPORTED |

Photoshop is not waiting for a PC. It is out of the MVP.

Last run: **darwin · 0 attempts · build PASS**. Measure in order: Notepad → Word → Excel → Chrome → Acrobat. Record the host version when a row is tested (e.g. Office 365).

Per-app observations to fill when a row is tested: Detect · Recommend · Navigate · Save · Activity · Undo · Focus · Timing.

**Definition of Done**

```text
✓ Five supported applications tested
✓ Compatibility table completed
✓ Activity verified
✓ Undo verified
✓ Diagnostics exported
✓ No critical compatibility issues remain
```

**Test on Windows:**

```bash
cd desktop
npm run publish:win-helper
npm run dev
```

1. Finish onboarding and index folders.
2. For each supported app: open → Save As → overlay → click recommendation → dialog navigates → **you** press Save → Activity → Undo.
3. Preferences → Diagnostics → Export diagnostics (local JSON, last 50 attempts).

macOS Save As watcher: not built. Preview Save As works on all platforms and is not a substitute for this matrix.

### KNOWLEDGE-COMPATIBILITY-001 (later · not Windows)

Separate milestone. Validates the **object** SuHuella ranks (file types users actually save), not the Save As host. Names, folders, and extensions are enough — content, OCR, and transcription are later (ONNX). Do not add file-type rows to the Windows table.

| Type | Supported today (intent) |
| --- | --- |
| PDF · DOCX · XLSX · PPTX · TXT · MD · ZIP · JPG · PNG · WAV · MP3 · MP4 · CSV | Yes — name / folder / extension |

Not opened. Not measured. Not a Windows blocker.

### Suggestion overlay

- `showInactive` — never steals focus
- Esc or click-outside closes
- Failed navigation: **Copy path** · **Open folder**
- Navigation order: ValuePattern → address bar → Ctrl+L → Alt+D → type path → Enter (only if address focused)

## Sources

Answers **What does SuHuella know?** — not a storage page and not a folder browser.

Card-based **Knowledge sources** view: hero summary + knowledge map (document share, not GB) · **Included sources** (personality · stars · Included/Updating · Refresh · Open · Remove source) · **Suggested sources** (Detected · Not included · Add source · Browse…) · compact **More sources** chips · **What SuHuella knows** (documents · languages · types · knowledge map · top folders · new knowledge · privacy). Search when many sources. No storage bars.

## Organise

Explicit selection → Knowledge Set → per-item Descriptor → Recommendation → **Plan Assistant (optional)** → **Plan Editor** → Confirm N actions.

The Plan Assistant proposes a Plan or answers a question. One interface — no selector: **Using On-device intelligence**, or automatically **Using OpenAI (your account)** when BYOK is connected. Later: **Using Local AI** when an on-device model ships. On-device intelligence is rules today — not a local language model. Simple BYOK failures may fall back on-device; complex requests fail honestly. Questions never change the plan. BYOK follow-ups use an **AI Conversation** (this session only · Clear conversation). That chat is not teaching.

**Frozen:** THE RECOMMENDATION ENGINE DECIDES · THE PLAN ASSISTANT ADVISES · THE USER APPROVES · THE EXECUTOR ACTS. The assistant never defines truth, never pretends to understand, every suggestion is traceable (because…), and it may combine existing capabilities but never invent new ones (Encrypt · Upload · OCR · …). It can suggest Rename · Move · Archive · Create folders · Ignore · Workflow ideas. It never executes, never changes the index, and never changes recommendations. The user reviews the Plan; the existing executor runs confirmed actions.

A **Workflow** is an Intent Template plus a Trigger (`workflowVersion: 1`). It stores reusable intent, not files or the last execution. Running always builds a fresh Plan and never requires AI. Workflows are deterministic, understandable without AI, and always owned by the user — AI may create one but never owns it. Only a confirmed Plan produces an Execution. Users can save, edit, duplicate, and run templates (Downloads, Invoices, Receipts, Contracts). Only **Manual** is implemented. Folder watch, connectors, and Autopilot are later capabilities on the same contract.

**Autopilot** is another execution mode, not a trigger. After a plan is confirmed, Autopilot can replay that stored plan through `executeOrganisationPlan`. It does not rank, preview, or invent destinations. The run appears in Activity as an Autopilot Run. Undo is the same inverse path.

The user approves a **plan**, not separate commands. Activity stores the executed plan and its inverse. Undo executes that inverse plan through the Confirmed Executor. Today **Move**, **Rename**, and **Create Destination Structure** execute. The UI may label that action Create folder (one level) or Create structure (nested); the contract is the same. Missing destinations under an indexed root are created after confirmation. If the move fails after folders were created, empty created folders are removed immediately. Undo restores the file, then deletes created folders only if they are still empty.

**Frozen:** **RENAME NEVER ADDS KNOWLEDGE. IT ONLY NORMALISES EXISTING KNOWLEDGE.** Deterministic rename reorders tokens already in the filename; it never invents labels such as *Paid* or *Final*. Richer names are Plan Assistant or BYOK suggestions — still reviewed and confirmed by the user.

**Rename** uses the same Recommendation → Plan path — there is no separate Rename Engine. When a file is already in the recommended folder, the plan may propose **safe filename normalisation** (spaces, illegal characters, trailing dots/spaces, duplicate separators, length). The Plan shows **Why this name**; the user can **Edit** the suggestion before confirming. Normalisation only reorders tokens already in the name — it never invents information and never overwrites. Rename strategies (`normalize` · `shorten` · `disambiguate` · `keep_original`) are declared on plan items; only **normalize** runs today. **Move + Rename** may appear as two separate plan actions on the same file. **Archive** is declared. **Ignore** = no execution.

Renderer never touches filesystem. Main process validates and executes via Confirmed Executor. Never overwrite · never delete.

## Build and dev

```bash
cd desktop
npm install          # first time
npm run dev          # Vite + Electron
npm run build        # typecheck + bundle
npm run lint
```

From repo root: `npm run desktop` · stop stuck session: `npm run desktop:stop`.

Version **0.1.0-pre-rc** (`package.json`). Public version until tagged **0.1.0-rc1**.

### Packaging (pre-rc unsigned channel)

Commercial code signing (Developer ID + notarization / Authenticode) is **deferred** — see `brands/suhuella/commercial-signing.json`. Pre-rc ships **adhoc-signed Mac** / **unsigned Windows** installers for technical testing (not Developer ID / not notarized / no Authenticode). Windows and macOS may warn or block depending on machine policy; document the install path (Right-click → Open / More info → Run anyway). **Do not** ask users to disable security globally.

**License verification is separate:** publishable builds still require Ed25519 **public keys** at compile time. `LICENSE_SIGNING_PUBLIC_KEYS` (Worker) and `SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS` (desktop) share the same format: comma-separated **Ed25519 SPKI DER, base64url** (no PEM). Validate with `node desktop/scripts/license-verify-public-keys-cli.mjs --require-desktop`.

```bash
export SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS="<SPKI base64url — same value as LICENSE_SIGNING_PUBLIC_KEYS>"
npm run package:check --prefix desktop
npm run package:mac --prefix desktop    # macOS → SuHuella-0.1.0-pre-rc.dmg
npm run package:win --prefix desktop      # Windows only → SuHuella-0.1.0-pre-rc.exe
npm run validate-release -- --platform mac   # integrity + license embed (pre-rc)
npm run publish:desktop-mac                  # from repo root
```

Compile-only CI smoke (no keys, not publishable):

```bash
SUHUELLA_DESKTOP_COMPILE_ONLY=1 npm run build --prefix desktop
```

`SUHUELLA_DESKTOP_CI=1` skips only the site version matrix in the release gate — **not** license keys or publish checks.

Clean-machine install is **not** verified until tested on a fresh Mac/PC. `release.json` `distribution` records unsigned status honestly.

Upload flow: [../RELEASE-PUBLISH-PIPELINE-001.md](../RELEASE-PUBLISH-PIPELINE-001.md). `dist/`, `dist-electron/`, `release/` are gitignored.

## Performance (implementation notes)

- Load Knowledge Index once per recommendation request
- Idle CPU ~0 — no background rescans; Windows helper is event-driven
- Targets: recommendation < 100 ms · navigation < 300 ms (900 ms timeout)
- Dev logs: detection, extraction, recommendation, navigation — not in production UI

Frozen budgets and Measured column: [../README.md §8](../README.md#8-performance-targets).

## Current limitations

- Local folders only — no Drive, Dropbox, Gmail, OAuth
- Windows Save As: code exists; five supported apps are NOT TESTED (milestone BLOCKED — no Windows PC)
- No macOS Accessibility watcher
- No cloud, accounts, or analytics in app
- On-device Plan Assistant is always available (rules today; Local AI / ONNX later)
- BYOK is optional and automatic when connected — never matching · user pays their provider
- BYOK conversation is in memory only — Clear conversation discards it; it is not Activity or Knowledge
- Saved AI preferences are notes for future conversations — they do not teach SuHuella
- No automatic background learning
- No folder-watch or connector workflow triggers
