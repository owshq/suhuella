# RELEASE-LIFECYCLE-001

```text
STATUS = OPEN · NOT RELEASE AUTHORITY
TYPE = Desktop version lifecycle track
AUTHORITY = docs/architecture/constitution/release-architecture.md
SEMANTICS = docs/governance/PRE-RC-RELEASE-SEMANTICS.md
SCOPE = What is still open after pre-RC publication. Not hosting design. Not installer UI.
PHASE_A = PASS
PHASE_B = PASS — pre-RC aliases and manifest URLs (not trusted signing)
PHASE_C = PASS — /api/release exposes Mac and Windows downloads
PHASE_D = OPEN — in-app install of a published update
PHASE_E = OPEN — retire / rollback / mandatory operations
SIGNING = DEFERRED — blocks 0.1.0-rc1, not this track's pre-RC facts
```

This track records lifecycle work. It does not define the current release. If it disagrees with `release.json` or [release-architecture.md](../../docs/architecture/constitution/release-architecture.md), those win.

`0.1.0-pre-rc` may be downloaded and tested now. `0.1.0-rc1` is a later promotion.

```text
Download
Install
Launch
Update check
Update install
License
```

Each does one thing. Distribution can change without touching license logic.

```text
Download ≠ Install ≠ Launch ≠ Check ≠ Offer ≠ Install update
App bundle ≠ user data
License activation ≠ download
```

**Frozen distribution topology (2026–2027 beta):**

```text
GitHub Releases          artifact storage only — not client authority
        │
        ▼
download.suhuella.com    stable download aliases (e.g. /latest/mac)
        │
        ▼
/api/release             version authority — Desktop + Website
        │
        ▼
Desktop + Website        never see github.com
```

Rules:

- **GitHub Releases** stores versioned binaries (preferred for beta: free, simple rollback).
- **Your domain** decides what “latest” means and what URL the client receives.
- **`/api/release`** is the only authority the apps consult. `mac` / `windows` in the payload are **your** HTTPS URLs, not GitHub asset URLs.
- **Clients never hardcode or discover GitHub.** Swap GitHub → R2 → B2 later by changing manifest + redirects only.

R2 remains a later option when download volume or control warrants it. Do not use R2 as the first unblock.

---

## Phase A (this slice) — PASS

| Piece | Result |
| --- | --- |
| Version compare + decision kernel | PASS |
| `/api/release` `latest` / `minimum` / `notes` aliases | PASS — keeps `version` / `minimumVersion` |
| Installer URL still omitted when empty | PASS |
| Settings → About → Check for updates | PASS — Desktop only |
| Update now | Only if a real HTTPS installer URL exists |
| User data outside the app bundle | PASS — already `userData` |
| Hosting | pre-RC aliases published — see phases B and C |
| Custom DMG installer dialogs | not opened |
| Operations publish / retire / rollback | not opened |

`/api/release` now:

```json
{
  "ok": true,
  "release": {
    "latest": "0.1.0-pre-rc",
    "version": "0.1.0-pre-rc",
    "minimum": "0.1.0-pre-rc",
    "minimumVersion": "0.1.0-pre-rc",
    "mandatory": false,
    "channel": "stable",
    "notes": ""
  }
}
```

Mac and Windows installer URLs are the `download.suhuella.com` aliases in `release.json`. Clients still never see `github.com`.

Desktop decision:

```text
latest == installed     → current
latest > installed      → update_available
minimum > installed
  or mandatory = true   → update_mandatory
latest < installed      → downgrade_blocked
unreadable versions     → unknown
```

Without an installer URL the state is still honest: update is published, install is not offered.

---

## Architecture kept

**First install** stays: download → open DMG → drag to Applications → launch → activate license.

**Same app, replace in place.** One `SuHuella.app`. Data stays in `~/Library/Application Support/SuHuella` (or the Windows/Linux `userData` equivalent). Reinstalling the app does not wipe license, settings, sources, or index.

**A DMG cannot show “already installed” / “Update / Cancel”.** That dialog needs a `.pkg` or a Windows installer. Chrome / Slack / VS Code do replacement from the in-app updater, not from the first DMG. Phase A follows that: the installer is a file; the updater lives in the running app.

**Stable download alias:** `https://download.suhuella.com/latest/mac` and `https://download.suhuella.com/latest/win` serve or redirect to the current artifact. The web never hardcodes versioned filenames. **`/api/release`** names the version and points `mac` / `windows` at those aliases.

```json
{
  "latest": "0.1.1",
  "minimum": "0.1.0-pre-rc",
  "mandatory": false,
  "notes": "Beta fixes.",
  "mac": "https://download.suhuella.com/latest/mac"
}
```

GitHub might host `SuHuella-0.1.1.dmg` at `github.com/.../releases/download/...` — that URL stays in infra (redirect target or upload source), not in the app.

---

## Later phases

```text
A  Version contract + Settings check              PASS
B  Domain aliases + manifest mac/windows URLs     PASS for 0.1.0-pre-rc
C  /download and /api/release expose Mac+Windows  PASS for 0.1.0-pre-rc
D  Install update from published URL              OPEN (in-app; not a DMG dialog)
E  Operations publish / retire / rollback         OPEN
F  Trusted install (Developer ID · Authenticode)  DEFERRED — promotion to 0.1.0-rc1
```

A, B, and C are done for the pre-RC. `brands/suhuella/release.json` publishes `https://download.suhuella.com/latest/mac` and `https://download.suhuella.com/latest/win`. Statements in this file that hosting was not opened, or that `gh` and the alias were still unwired, are stale.

Still open: in-app update install (D), retire/rollback operations (E), and trusted signing before anyone calls this `0.1.0-rc1` (F). Signing does not reopen A–C.

Do not block pre-RC downloads or internal QA on D, E, or F.

---

## Tests

```text
npm run test:release-lifecycle --prefix desktop
npm run test:download-page --prefix site
npm run test:desktop-artifacts --prefix site
npm run test:app-modal-shell --prefix site
npm run check:app-host --prefix site
```
