# Release v0.1.0-pre-rc — flight recorder

```text
Flight recorder — not Constitution, not Governance, not ADR.
Historical evidence when this release closes. One file per version.
Next: RELEASE-v0.1.0-rc1-EXECUTION.md · RELEASE-v0.1.0-EXECUTION.md
```

```text
Runbook → Execute → Observe → Classify → Fix → Re-run → Prevent recurrence
```

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

**Private Beta observation:** fix the **single biggest obstacle**, then watch the next user again — not eight fixes before the next observation.

| Field | Value |
| --- | --- |
| Version | 0.1.0-pre-rc |
| Started | 2026-09-19 |
| Operator | local run |
| Closed | |

---

## Classification (pick one per incident)

```text
□ Product          □ Release          □ Infrastructure
□ Environment      □ External service □ Operator
```

---

## Gate 1 — Package

```bash
npm run package:mac --prefix desktop
```

| Check | Status |
| --- | --- |
| DMG generated | ✓ |
| Icon rebuilt (`build:icons` → `icon.icns`) | ✓ |
| Filename `SuHuella-0.1.0-pre-rc.dmg` | ✓ |
| Size reasonable | ✓ 131,423,445 bytes (~125 MB) |
| DMG volume icon (`.VolumeIcon.icns`) | ✓ matches canonical |
| `SuHuella.app` icon | ✓ MD5 matches `desktop/assets/icon.icns` |
| Volume layout (`.app` + Applications symlink) | ✓ |
| Display name **SuHuella** | ✓ |
| No legacy icon (magnifying glass / folder) | ✓ |

**Gate 1:** PASS (operator review 2026-09-19)

SHA256 (local): `bae4dce06a0cda28c261abf2df1561ece54fcf086c3f42658a27133283be4d95`

Git tag (local artifact): `artifact/desktop-mac/v0.1.0-pre-rc`

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| 1 | `tsc -b` — product types / electron adapter paths | Implementation | tsconfig paths + adapter promises | product devDependencies for `@types/*` |
| 2 | `dmgbuild` race — parallel zip+dmg corrupted Electron Framework | Release | Mac target `dmg` only | `brand-build.mjs` + `desktop/package.json` |
| 3 | — | — | — | **PASS** |

---

## Gate 2 — Publish

```bash
npm run publish:desktop-mac
```

| Check | Status |
| --- | --- |
| GitHub Release `v0.1.0-pre-rc` | |
| DMG uploaded (SHA256 = Gate 1 local) | |
| `.sha256` sidecar | |
| `release.json` updated | |
| `download.suhuella.com/latest/mac` | |
| `/api/release` (after deploy) | |

**Gate 2:** (in progress — Gate 1 artifact tagged, publishing new icons build)

Prior GitHub asset (stale — pre icon rebuild): SHA256 `3a8986683e0b5e14c28c115d8340632ed026f3afa7843d9ed8f03ea853230d12`

Target artifact (Gate 1): SHA256 `bae4dce06a0cda28c261abf2df1561ece54fcf086c3f42658a27133283be4d95`

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Gate 3 — Verify

```bash
npm run verify:desktop-artifact -- --platform mac
```

**Gate 3:** PASS / FAIL

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Gate 4 — Deploy

```bash
npm run cf:deploy
```

| Check | Status |
| --- | --- |
| `/api/release` | |
| `/download` | |
| `/download/preparing` | |

**Gate 4:** PASS / FAIL

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Gate 5 — Smoke

```bash
npm run smoke:desktop-download
```

**Gate 5:** PASS / FAIL

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Gate 6 — Manual download

As a user: https://suhuella.com/download

| Question | OK? |
| --- | --- |
| Do I understand what is happening? | |
| No blank page | |
| Preparing page clear | |
| File downloads | |

**Gate 6:** PASS / FAIL

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Gate 7 — First launch

Experience only — no logs.

| Question | OK? |
| --- | --- |
| Know what to do next | |
| Not lost | |
| No empty screens | |
| No overly technical copy | |
| Installation feels professional | |
| About shows correct version | |
| Can connect first folder | |
| **I reached my first useful result** (connect folder → search → open a document) | |

**Gate 7:** PASS / FAIL

| Attempt | Issue | Classification | Fix | Prevent recurrence |
| --- | --- | --- | --- | --- |
| | | | | |

---

## Release readiness

```text
Gate 1  PASS
Gate 2
Gate 3
Gate 4
Gate 5
Gate 6
Gate 7

First useful session

□ Completed
□ Not completed
```

When **First useful session** is completed, the release works end-to-end and the product delivered value — regardless of how perfect the docs are.

When it is not completed, there is still product work — not architecture work.

---

## User session scoreboard (evidence — fill with real runs)

Do not update governance docs. Log here.

| Step | Gate / user | Result | Notes |
| --- | --- | --- | --- |
| Download | | | |
| Install | | | |
| Launch | | | |
| Understand what to do | | | |
| Connect folder | | | |
| Find document | | | |
| First useful session | User 1 | | |
| First useful session | User 2 | | |
| First useful session | User 3 | | |

Example:

```text
User 3   FAIL — confused at license
User 5   FAIL — couldn't find Connect
```

**Architecture validated** when many users complete the flow without help and **no fix requires** Source Domain · Lifecycle · Presentation · Constitution changes. Product and adapter fixes count as success.

**Reopen architecture only when** evidence shows the frozen contract is insufficient (e.g. two adapters need the same contract change) — ADR first, not “the user is confused.”
