# RC-HOST-INTEGRATION-001

STATUS: CLOSED · PASS WITH GAPS

TYPE: Release Candidate Integration Fix

OBJECTIVE: Every visible host action works or explains. No silent failure.

Frozen: Recommendation Engine, Knowledge Engine, Plan / Activity / Workflow models, license schema, BrandConfig, Desktop identity, architecture.

---

## Rule

Every visible action must work or explain why it cannot.

---

## Slice 1 — Search

**Root cause:** Browser `openSearchPath` / `revealSearchPath` returned `{ ok: false }` with no message. The tile stayed clickable and the shell swallowed the result.

**Affected files:** `desktop/src/host/install-browser-host.ts`, `desktop/src/windows/SettingsWindow.tsx`, `desktop/src/lib/host-action-copy.ts`, `desktop/electron/main.ts`, `desktop/src/types.ts`

**Regression risk:** Desktop open/reveal now surface a banner if the OS cannot open the path. Reveal stays hidden in Browser (`capabilities.reveal`).

**Before:** Click a Search tile in Browser. Nothing happens.

**After:** Click shows “This file can only be opened from the desktop app.” Desktop still opens or reveals the file, or explains if the path is gone.

---

## Slice 2 — Organise

**Root cause:** Browser `pickKnowledgeSetFiles` invented a selection from the first indexed files instead of opening a picker.

**Affected files:** `desktop/src/host/browser/fs.ts`, `desktop/src/host/install-browser-host.ts`, `desktop/src/components/OrganisePanel.tsx`, `desktop/src/lib/sources-ui.ts`

**Regression risk:** Cancelled pickers still return an empty list (no fake files). Unsupported browsers show “This browser cannot choose files.”

**Before:** Select files → first ~80 indexed files appeared as if chosen.

**After:** Desktop uses the native picker. Browser uses File System Access (`showOpenFilePicker`) or `input[type=file]`. The user only sees files they picked.

---

## Slice 3 — Save As

**Root cause:** Accepting a recommendation could look like a completed run, but Activity only records confirmed Plans. The Activity model is frozen (`organise_documents | move_this_file | workflow | autopilot | undo`). No `save_as` trigger was added.

**Affected files:** `desktop/src/host/install-browser-host.ts`, `desktop/src/windows/SuggestionWindow.tsx`, `desktop/src/components/PreferencesPanel.tsx`, `desktop/src/lib/host-action-copy.ts`

**Regression risk:** Desktop Save As still only prepares / navigates the folder. Activity does not gain a new trigger.

**Before:** Accept → dialog closes → Activity unchanged, with no explanation.

**After:** One behaviour. Save As is preview / prepare only. Settings says “Activity records confirmed Plans. Save As prepares the folder; you press Save in the other app.” Browser Accept explains that nothing was saved and Activity does not record it.

---

## Slice 4 — Settings exports

**Root cause:** Browser `exportActivity` / `exportCompatibilityDiagnostics` returned `null`. The UI treated null as a quiet cancel.

**Affected files:** `desktop/src/host/install-browser-host.ts`, `desktop/src/components/PreferencesPanel.tsx`

**Regression risk:** Desktop cancel still returns `null` and stays silent (user dismissed the save dialog).

**Before:** Export → nothing.

**After:** Browser shows “Export is not available on this platform.” Desktop still writes a file or stays quiet on cancel.

---

## Slice 5 — Home

**Root cause:** Browser `indexStatus` left `recognised` empty. Home only rendered names from that array, so Browser learning never appeared.

**Affected files:** `desktop/src/lib/recognised-names.ts`, `desktop/src/host/install-browser-host.ts`, `desktop/electron/index-service.ts`

**Regression risk:** Same hint labels as Desktop (`Invoices`, `Contracts`, …). Presentation of the Knowledge Index only — no new engine.

**Before:** Browser Home omitted recognised names after learning.

**After:** Home reads the current Knowledge Index on both hosts and shows the same name chips.

---

## Slice 6 — Capability errors

| Action | Browser | Desktop |
|---|---|---|
| Open file | Explains: desktop app only | Opens, or explains if the path is gone |
| Reveal / Open folder | Hidden where unsupported; otherwise explains | Opens Finder / Explorer, or explains |
| Export | Explains: not available | Works, or silent cancel |
| Launch at login | Not shown (`tray` capability) | Works |
| Notifications / Save As | Copy states preview vs Activity | Copy states prepare vs confirmed Plan |
| Select files | Real picker or “This browser cannot choose files.” | Native picker |

---

## Tests

| Host | Result |
|---|---|
| Browser · Chrome · macOS | Clicked: Home names, Search tile, Organise Select files, Export activity, Export diagnostics, Notifications |
| Browser · Edge | Not installed on this machine |
| Desktop · macOS | Native pickers and open/reveal already wired; Save As does not write Activity |
| Desktop · Windows | Not run on this machine (Save As channel still WINDOWS-COMPATIBILITY-001) |

No architecture changes. No new product features. No Activity trigger added.

---

## Gaps (do not reopen development)

- Windows Save As still needs a Windows box.
- Edge must be confirmed on a machine that has Edge.
- First-impression and real-user validation are the next tracks, not more slices.

---

## Next

```text
RC-HOST-INTEGRATION-001
        ↓
RC-CHECKLIST-001
        ↓
FIRST-IMPRESSION-TEST-001
        ↓
REAL-USER-VALIDATION-001 (5 usuarios)
        ↓
PRIVATE-BETA-001
```
