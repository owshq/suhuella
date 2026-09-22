# WINDOWS-CANDIDATE-BUILD-001

```text
STATUS = OPEN
TYPE = Windows desktop validation (no public publish)
SCOPE = APPLICATION-LIFECYCLE-001 Windows fixes + harness
BLOCKS = Public release.json / latest / GitHub Release overwrite
NOT = Download transport fix (web — separate deliverable)
NOT = Commercial signing (frozen — DECISION-PRIVATE-BETA-001)
```

## Separation of deliverables

| Deliverable | What it fixes | Public today |
|---|---|---|
| **Web / Worker** | Download transport (redirect, no proxy) | Deployed separately |
| **This track** | Desktop lifecycle (close, tray, minimize, Quit + helper) | **Not published** until validated |
| **Signing** | SmartScreen / Gatekeeper trust | **Frozen** — not in scope |

## Public installer must not be used for lifecycle validation

The live `SuHuella-Setup-0.1.0-pre-rc.exe` was built from commit `3d0f05c` (CI `35431551626`, 2026-09-19).

| Field | Published (do not use for lifecycle) |
|---|---|
| SHA256 | `5b0d1ba2aab4b48f817ea87fb8e58193dc21b09e55aabc66bf3e6bcac4ba234b` |
| Lifecycle fix | **Absent** |

Use only the **candidate artifact** from this track (CI artifact, `publish_release=false`).

---

## Operator flow

### 1. Branch and checks

```bash
git checkout windows-lifecycle-candidate-001
npm run test:application-lifecycle --prefix site
npm run check:knowledge-set --prefix desktop
```

### 2. CI candidate build (no publish)

```bash
gh workflow run desktop-windows-build.yml \
  --ref windows-lifecycle-candidate-001 \
  -f git_ref=windows-lifecycle-candidate-001 \
  -f publish_release=false
```

Record from the workflow run summary and artifact:

- commit SHA
- CI run id
- version (`0.1.0-pre-rc`)
- filename
- size (bytes)
- SHA256

Download: Actions → run → **SuHuella-Setup-windows** artifact.

### 3. Clean Windows validation (same bytes as artifact)

**A — Normal tray**

| Step | Pass criteria |
|---|---|
| Install candidate `.exe` | NSIS completes (integrity separate from SmartScreen) |
| Close window (X) | Hides to tray; process alive |
| Tray → Open | Window returns |
| Second shortcut launch | Focuses existing window |
| Tray → Quit | Process ends; no `SuhuellaSaveWatcher.exe` in Task Manager |

**B — Tray unavailable (validation hook only)**

Set before launch (system env or shortcut target):

```text
SUHUELLA_DESKTOP_VALIDATE_TRAY_UNAVAILABLE=1
```

Not a product setting. Default behaviour unchanged when unset.

| Step | Pass criteria |
|---|---|
| Launch with hook | No tray icon |
| Close window (X) | **Minimizes** to taskbar (not invisible) |
| Restore from taskbar | Window visible |
| File → Quit | App + helper exit |

**C — Save As (real Save / Save As dialogs only)**

| App | Action |
|---|---|
| Notepad | File → Save As |
| Word or Excel | Save As |
| (optional) PowerPoint | Save As |

Explorer browsing is **not** a Save As dialog test.

| Step | Pass criteria |
|---|---|
| Save As opens | Overlay appears (inactive / no focus steal) |
| Pick suggestion | Native dialog navigates or clear error |
| Cancel Save As | Overlay closes |
| After Quit | Helper not running |

### 4. After PASS only

Then and only then:

1. Re-run CI with `publish_release=true` **or** manual publish per RELEASE-PUBLISH-PIPELINE-001
2. Update `brands/suhuella/release.json` SHA256 + size
3. Smoke public `/api/desktop-download/windows` against **new** digest
4. Do **not** conflate with transport-only web deploy

---

## Evidence template

```text
Candidate commit:
CI run:
Artifact SHA256:
Artifact size:
Validation machine:
A normal tray: PASS | FAIL | PENDING
B tray hook minimize: PASS | FAIL | PENDING
C Save As (apps): PASS | FAIL | PENDING
Quit kills helper: PASS | FAIL | PENDING
Public publish authorized: YES | NO
```

---

## Verdicts (this track)

| Area | Until candidate validated |
|---|---|
| Lifecycle code | In branch — not public |
| Public `.exe` lifecycle | **NOT VALIDATED** |
| Web download transport | Separate — already deployed |
| Signing / notarization | **NO VERIFICADO** (frozen) |
| Launch approval | **NO**
