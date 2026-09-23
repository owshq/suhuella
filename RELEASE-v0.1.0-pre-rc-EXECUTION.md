# Release v0.1.0-pre-rc — flight recorder

```text
Flight recorder — not Constitution, not Governance, not ADR.
Historical evidence when this release closes. One file per version.
Next: RELEASE-v0.1.0-rc1-EXECUTION.md · RELEASE-v0.1.0-EXECUTION.md
```

```text
Observation → Evidence → Classification → Fix → Result
```

**Facts only.** This file records what happened — not decisions, debates, or roadmap. Every incident entry uses the same shape:

```text
Observation     what happened (user or gate)
Evidence        URL · log · screenshot · commit · repro steps
Classification  Product · Release · Infrastructure · Environment · External · Operator
Fix             commit or action taken (empty until done)
Result          PASS / FAIL / Open / blocked · next gate or next user
```

Do **not** write here:

- “maybe we should…”
- suggested fixes (observation ≠ solution)
- architectural proposals
- future ideas

Solutions → GitHub issue. This file → evidence only.

**Execution phase.** No Constitution / Governance / PRE-RC edits unless observed evidence forces it.

Allowed commit types until Private Beta:

```text
fix      observed problem
feat     active track (Desktop Release · Download · First Launch · …)
evidence this flight recorder after a gate or user session
```

Before each commit:

```text
Does this make the next user session more successful?

If this commit disappeared tomorrow, would any user notice?
```

If both are **no** → probably not this phase.

**Private Beta observation:** one obstacle → one fix → next user — not eight fixes before the next observation.

**Exception:** if multiple failures share one root cause, fix the root cause **once**.

```text
/download/preparing 404
/api/release         404
smoke                FAIL
        ↓
one Deploy bug — one fix
```

| Field | Value |
| --- | --- |
| Version | 0.1.0-pre-rc |
| Started | 2026-09-19 |
| Operator | local run |
| Closed | |

### Canonical release artifact

All gates after Package reference **this** artifact only. Prior SHA256 values in this file are historical attempts.

```text
Version   0.1.0-pre-rc
SHA256    2db738fe4f11f9c3983274080c0b3dc9c9cdf7340560cb46a3a9ea0849003c4d
Size      131,533,425 bytes
Built     2026-09-19
File      desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg
```

---

## Decision (2026-09-20)

```text
Commercial code-signing is intentionally deferred.

Reason:
Business decision — trusted commercial distribution deferred.

Primary metric:
Can a first-time user obtain a useful result without assistance?

Private Beta remains blocked until commercial signing
infrastructure is enabled.

Decision: DECISION-PRIVATE-BETA-001
Authority: brands/suhuella/commercial-signing.json (status: deferred)
```

Not a product blocker. Not a release engineering blocker. External prerequisite.

`validate-release` returns **SKIPPED** (not FAIL) while deferred. Publish remains blocked.

---

## Layer summary (2026-09-20)

```text
Release pipeline     FROZEN · IMPLEMENTED · commercial distribution deferred
    validate-release → SKIPPED until signing enabled
    publish blocked
Distribution         PASS   (Gates 3 · 4 · 5)
Operations           PASS   (worker · /api/release · smoke)
DX                   two modes documented (UI / Full Cloudflare)
Gate 6 Trusted Install   DEFERRED (not attempted — docs preserved)
Gate 7               DEFERRED
Private Beta         BLOCKED — external prerequisite
Primary metric       first useful session without assistance
```

Do not reopen Developer ID / Authenticode until DECISION-PRIVATE-BETA-001 is superseded.

---

## Order from here

```text
✓ Gate 1   Package (mac)
✓ Gate 1b  Visual inspection
✓ Gate 2   Publish (mac + windows) — historical PASS; re-publish blocked by validate-release
✓ Gate 4   Deploy (worker 11db1523…)
✓ Gate 3   Verify (mac + windows)
✓ Gate 5   Smoke
— Gate 6 Trusted Install   deferred (commercial signing)
— Gate 7                   deferred
— Private Beta             BLOCKED (DECISION-PRIVATE-BETA-001)
→ Primary metric           first useful session without assistance
```

Each change should increase the chance the **next user completes a first useful session** — without reopening frozen contracts unless evidence proves a real limit.

Progress is measured by user steps, not ADRs:

```text
First download → First install → First launch → First source → First search → First useful result
```

Retention and adoption come after that works consistently.

---

## Classification (pick one per incident)

```text
□ Product          □ Release          □ Infrastructure
□ Environment      □ External service □ Operator
```

**Priority while commercial signing is deferred** — product maturity, not release gates:

```text
First useful session (local implementation)
        ↓
Search · Indexing · Organise · Onboarding
        ↓
Copy / Motion (P2 — not release blockers)
```

---

## Gate 1 — Package

```bash
npm run package:mac --prefix desktop
```

| Check | Status |
| --- | --- |
| Exit code 0 | ✓ |
| DMG generated | ✓ |
| Icon rebuilt (`build:icons` → `icon.icns`) | ✓ |
| Filename `SuHuella-0.1.0-pre-rc.dmg` | ✓ |
| Size reasonable | ✓ 131,533,425 bytes (~125 MB) |
| `hdiutil verify` | ✓ VALID |
| `electronDist` local (`node_modules/electron/dist`) | ✓ |

**Gate 1:** PASS (package · exit 0)

---

## Gate 1b — Visual inspection

Manual inspection is **evidence**, not approval. Same shape as automated checks: Observation → Evidence → PASS/FAIL → next gate.

```bash
open desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg
hdiutil attach desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg -nobrowse -readonly
```

| Observation | Evidence | Result |
| --- | --- | --- |
| DMG opens / mounts | `hdiutil verify` VALID; mount OK 2026-09-19 | PASS |
| App icon correct (canonical `.icns`) | `icon.icns` MD5 `782f7a25…` = `desktop/assets/icon.icns` | PASS |
| Applications shortcut | `Applications -> /Applications` | PASS |
| App name **SuHuella** | `CFBundleDisplayName` / `CFBundleName` | PASS |
| No old icon / no lupa | canonical H brand `.icns` (not legacy assets) | PASS |
| Artifact SHA256 | `2db738fe…` matches canonical | PASS |
| Volume name contains **SuHuella** | `/Volumes/SuHuella 0.1.0-pre-rc-arm64 1` | PASS |
| DMG volume icon | `.VolumeIcon.icns` present | PASS |

**Gate 1b:** PASS

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | `tsc -b` failed — product types / electron adapter paths | Infrastructure | build log | tsconfig paths + adapter promises | retry |
| 2 | `dmgbuild` race — parallel zip+dmg corrupted Electron Framework | Release | corrupt DMG | Mac target `dmg` only | retry |
| 3 | Exit 1 — `corrupted Electron dist` after electron-builder download/extract | Implementation bug | `Electron.app/Contents/Info.plist` missing | stop release | FAIL |
| 4 | DMG on disk but not from latest compile — prior PASS invalid | Operator | exit code 1 ignored | gate = exit 0 only | invalidate |
| 5 | `electronDist: node_modules/electron/dist` in `brand-build.mjs` | Implementation bug | clean rebuild log | `desktop/scripts/brand-build.mjs` | retry |
| 6 | DMG step TLS disconnect (transient) | Environment | network log | retry | retry |
| 7 | Clean full `package:mac` exit 0 | — | SHA256 above | — | **PASS** |

---

## Gate 2 — Publish

```bash
npm run publish:desktop-mac -- --skip-deploy
```

Deploy stays in Gate 4. Gate 2 passes only when GitHub + manifest match Gate 1 SHA.

| Check | Status |
| --- | --- |
| GitHub Release `v0.1.0-pre-rc` | ✓ |
| DMG uploaded (SHA256 = Gate 1 local) | ✓ `2db738fe…` · 131,533,425 bytes |
| `.sha256` sidecar | ✓ |
| `release.json` updated (sha256, filename, size) | ✓ |
| GitHub asset digest = canonical | ✓ smoke mac sha256 match |

**Gate 2:** PASS (`--skip-deploy`)

Windows (same release):

```bash
npm run publish:desktop-win -- --skip-deploy
```

| Check | Status |
| --- | --- |
| GitHub `SuHuella-Setup-0.1.0-pre-rc.exe` | ✓ |
| `.sha256` sidecar | ✓ `5b0d1ba2…` · 226,177,159 bytes |
| `release.json` windows metadata | ✓ |

Prior attempts (historical only): SHA256 `3a898668…`, `bae4dce0…`

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Publish started before Gate 1b evidence recorded | Operator | interrupted | Gate 1b evidence | retry |
| 2 | Mac sidecar stale after DMG replace — smoke FAIL | Release | manifest `2db738fe…` ≠ sidecar `3a898668…` | `ensureMacSidecar()` in publish script | PASS |
| 3 | Mac + win publish exit 0; asset unchanged (SHA match) | — | publish logs 2026-09-19 | — | PASS |

Windows CI refresh on `main` (run 35459834636): **FAIL** — `tsc -b` cannot resolve `@suhuella/product/*` on remote `main`. Live Windows artifact remains prior build (`5b0d1ba2…`).

---

## Gate 4 — Deploy

```bash
npm run cf:deploy
```

| Check | Status |
| --- | --- |
| `/api/release` sha256, filename, size | ✓ |
| `/download` | ✓ 200 |
| `/download/preparing?platform=mac` | ✓ 200 |
| `download.suhuella.com/latest/mac` | ✓ 302 → GitHub DMG |

**Gate 4:** PASS

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Deploy exit 0; worker `11db1523-1edd-4b21-8153-3a384431254b` | — | cf:deploy log | — | PASS |
| 2 | `/api/release` canonical mac + windows metadata | — | live API 2026-09-19 | — | PASS |

Live manifest: mac `2db738fe…` · windows `5b0d1ba2…`

---

## Gate 3 — Verify

```bash
npm run verify:desktop-artifact -- --platform mac
npm run verify:desktop-artifact -- --platform windows
```

**Gate 3:** PASS (mac + windows)

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | mac: version · filename · sha256 · size · download · `/api/release` | — | verify output | — | PASS |
| 2 | windows: version · filename · sha256 · size · download · `/api/release` | — | verify output | — | PASS |

---

## Gate 5 — Smoke

```bash
npm run smoke:desktop-download
```

**Gate 5:** PASS

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | mac + windows sidecars, `/download/preparing`, redirects | — | smoke output · mac size 131533425 | — | PASS |

---

## Gate 6 — Trusted Install (platform-specific)

Gate 6 is a **special gate**: one result per platform. Only applies to **trusted commercial install** — not Gates 1–5 (technical pipeline).

When `commercial-signing.json` status is `deferred`, Gate 6 is **not attempted**. Status is **DEFERRED**, not FAIL.

### Current status (2026-09-20)

```text
Gate 6 macOS     DEFERRED   requires: Developer ID + notarization
Gate 6 Windows   DEFERRED   requires: Authenticode
Gate 6 Linux     NOT OPENED

Gate 6 global    DEFERRED
Reason:           commercial signing deferred — DECISION-PRIVATE-BETA-001
```

When status becomes `enabled`, each platform becomes **PASS / FAIL** (not DEFERRED). Global PASS only when every **advertised** platform PASSes.

### Historical observation (2026-09-20 — before deferral decision)

Attempted macOS Trusted Install test while unsigned:

As a user via Chrome: https://suhuella.com/download → `/download/preparing?platform=mac`

| Question | OK? |
| --- | --- |
| Do I understand what is happening? | △ (modal OK; background Home confuses) |
| No blank page | ✓ |
| Preparing page clear | ✓ |
| File downloads | ✓ |
| App opens after install (no `xattr`) | ✗ (historical) |

Windows (historical): file downloads ✓ (infra) · Authenticode ✗ · install not user-launchable.

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | macOS: “SuHuella is damaged and can't be opened.” | Release | Gate 6 screenshot; `/Applications/SuHuella.app` | — | **FAIL** |
| 2 | `codesign --verify --deep --strict` FAIL | Release | `code has no resources but signature indicates they must be present` | — | root cause |
| 3 | `spctl --assess --type execute -vv` FAIL | Release | `internal error in Code Signing subsystem` | — | root cause |
| 4 | Signature is adhoc; Identifier=`Electron`; TeamIdentifier not set | Release | `codesign -dv`; `identity: null` in `brand-build.mjs` / `package.json` | — | unsigned build |
| 5 | App in Applications has Chrome quarantine | Release | `com.apple.quarantine` = `Chrome;C6519627-…` | — | Gatekeeper path |
| 6 | `~/Downloads/SuHuella-0.1.0-pre-rc.dmg` SHA is stale `3a898668…` (not canonical `2db738fe…`) | Release | `shasum` on Downloads | — | note |
| 7 | Published / first-install `.app`: Identifier=`Electron` | Release | `codesign -dv` | afterPack `sign-mac-app.cjs` | packaging issue resolved |
| 8 | Local `.app` after resign | Release | `codesign --verify --deep --strict` PASS; Identifier=`com.suhuella.desktop`; `spctl --assess` rejected | — | packaging issue resolved |
| 9 | Preparing page clear; filename · size · install steps · Gatekeeper hint | — | `/download/preparing?platform=mac` EN+ES | — | **PASS** (web steps 2–3) |

**Historical Gate 6 verdict (2026-09-20 — evidence only)**

```text
Web download flow     ✓ PASS (Gates 3–5 — distribution layer)
Mac install/launch    ✗ would FAIL if attempted unsigned
Product copy          △
```

Operational status after DECISION-PRIVATE-BETA-001: **DEFERRED** — team not attempting Gate 6 until signing enabled.

**Product (open · deferred · no suggested fix here)**

```text
Observation
The download modal is displayed on top of the application shell,
making it appear as if the user is already inside the product.

Classification
Product

Evidence
“Connect a source…”, “knows nothing yet” visible behind `/download` overlay
2026-09-20 EN+ES

Result
Open
```

```text
Observation
Download modal footer says the Mac build is not available while the row is Available.
Modal copy exposes internal language (pre-RC, checkout off, license edition checks).

Classification
Product copy (minor) · △ 3 issues

Evidence
`/download` overlay EN+ES 2026-09-20

Result
Open
```

**Historical root cause (2026-09-20 evidence — why unsigned install failed)**

Packaging issue resolved (`Identifier`: Electron → `com.suhuella.desktop`; local `codesign --verify --deep --strict` PASS).

Observed when unsigned install was tested:

```text
0 valid identities
No Developer ID Application identity
CSC_NAME not configured
APPLE_* credentials not configured
Windows Authenticode not configured
```

**Current decision:** commercial signing deferred — external prerequisite, not a code defect. See DECISION-PRIVATE-BETA-001.

**When signing is enabled** (`commercial-signing.json` status = `enabled`), run platform validation before re-publish:

**P0 — macOS**

```text
□ Developer ID + APPLE_*
□ npm run package:mac --prefix desktop
□ npm run validate-release -- --platform mac
□ npm run publish:desktop-mac
□ Gate 6 macOS — Chrome download · install · open
```

**P0 — Windows** (same contract — not a lower bar)

```text
□ Authenticode signing (timestamped)
□ npm run validate-release -- --platform windows
□ npm run publish:desktop-win
□ Gate 6 Windows — browser download · install · open
```

Until Windows Authenticode PASS: hide Windows on `/download` or mark internal-only — do not advertise Available for external beta.

Then, and not before:

```text
Gate 2 (re-publish trusted artifacts · both platforms)
        ↓
Gate 6 macOS + Gate 6 Windows PASS
        ↓
Gate 7
        ↓
Private Beta
```

---

## Gate 7 — First useful session (release gate)

Formal release gate — depends on Gate 6 Trusted Install for external releases.

**Gate 7 (release path):** DEFERRED — follows Gate 6 deferral (DECISION-PRIVATE-BETA-001)

| Question | OK? |
| --- | --- |
| Know what to do next | |
| Not lost | |
| No empty screens | |
| No overly technical copy | |
| Installation feels professional | |
| About shows correct version | |
| Can connect first folder | |
| **I reached my first useful result** (connect folder → search · open a document) | |

**Product maturity** (local implementation — not this formal gate):

```text
First useful session · Search · Indexing · Organise · Onboarding
```

This work continues while Gate 6/7 are deferred.

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | Release Gate 7 not attempted — Gate 6 deferred | — | DECISION-PRIVATE-BETA-001 | — | **DEFERRED** |
| 2 | Historical: cannot reach launch unsigned (macOS “damaged”) | Release | Gate 6 historical #1 | — | evidence only |

---

## Release readiness

```text
Release pipeline     FROZEN · IMPLEMENTED · commercial distribution deferred
Distribution         PASS
Operations           PASS
Gate 6 Trusted Install   DEFERRED (docs preserved — enable signing to reopen)
Gate 7                   DEFERRED
Private Beta             BLOCKED (DECISION-PRIVATE-BETA-001)

Web download flow     ✓ PASS (distribution layer)
Commercial signing    deferred — business decision (external prerequisite)
Primary metric        Can a first-time user obtain a useful result without assistance?
Product copy          △ P2 (after commercial beta reopens)

First useful session

□ Completed
□ Not completed
```

Commercial signing intentionally deferred — not a missing pipeline. Reopen Gate 6 when `commercial-signing.json` status is `enabled` (explicit human decision).

When **First useful session** is completed, the release works end-to-end and the product delivered value — regardless of how perfect the docs are.

When it is not completed, there is still product work — not architecture work.

### Desktop runtime CPU (2026-09-21)

Old 19-Sep packaged artifact = invalid/untrusted for runtime testing. Fresh current Desktop build still needs a packaged validation; the local HEAD runtime below is not that package.

| # | Observation | Classification | Evidence | Fix | Result |
| --- | --- | --- | --- | --- | --- |
| 1 | `/Applications/SuHuella.app` (mtime 19 Sep 19:37) is adhoc, Identifier=`Electron`, Chrome quarantine. macOS “damaged” dialog. Not launched. Volume `SuHuella` ejected. Downloads DMGs left in place. | Release | `codesign -dv`; quarantine `Chrome` | — | invalid for current-runtime CPU |
| 2 | Local HEAD runtime (vite + esbuild, not `package:mac`) on an empty Electron profile: 10 samples over ~5 min, 6 processes, sum CPU 0.0–0.2%. | Environment | `ps` samples 2026-09-21 04:24–04:29Z | — | idle, empty profile |
| 3 | Same runtime with a copy of the real profile (Documents + Desktop, 8,564 documents). Home / Sources / Activity opened. Pending index scan ran. Sum CPU ~41% at scan start, then about 0–20%. Not 200–600%. | Product | CDP + `ps` 2026-09-21 04:32–04:34Z | — | no current runaway on this launch |
| 4 | `npm run build` in `desktop/` fails `tsc -b` (unused locals, license device types). Runtime bundle was produced without that typecheck. Published `0.1.0-pre-rc` artifact was not replaced. | Release | `tsc` log | — | not republished |

---

## Beta learning log (evidence — fill with real users)

Not a bug list. What each user **reached** and the **first blocker** — so the next fix is evidence-based.

| User | Reached | First blocker | Fixed |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |

Example:

| User | Reached | First blocker | Fixed |
| --- | --- | --- | --- |
| 1 | Download | None | — |
| 2 | Install | Gatekeeper warning | ✓ |
| 3 | License | Activation unclear | ✓ |
| 4 | First source | Didn't understand Connect | ✓ |

**Reached** = furthest step completed: Download · Install · Launch · Understand · Connect · Search · First useful session.

After ~10 users: if most complete the flow without help and fixes stay Product / Release / adapter — not Source Domain · Lifecycle · Presentation · Constitution — architecture is validated by use.

**Reopen architecture only when** evidence shows the frozen contract is insufficient (e.g. two adapters need the same contract change). ADR first. “User is confused” is product work.
