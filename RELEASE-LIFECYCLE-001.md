# RELEASE-LIFECYCLE-001

```text
STATUS = OPEN · PHASE A PASS
TYPE = Desktop version lifecycle
SCOPE = Version contract + check. Not hosting. Not installer UI. Not Ops publish.
PHASE_B = DEFERRED — see RELEASE-PUBLISH-PIPELINE-001 then DESKTOP-RELEASE-HOSTING-001
DESKTOP_IN_RC = NO
FIRST_RUN = WEB ONLY
```

Separate download from update. Close the contract before the installer host exists.

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
| Hosting | not opened |
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

No `mac` / `windows` until a real HTTPS URL exists.

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

**Stable download alias (future):** `https://download.suhuella.com/latest/mac` → serves or redirects to the current DMG filename (e.g. `SuHuella-0.2.1.dmg`). The web never hardcodes versioned filenames. **`/api/release`** still names the version and may point `mac` at that alias or a versioned URL on your domain.

**Example manifest when Phase B opens** (note: no `github.com` in client-visible fields):

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

## Later phases (not now)

```text
A  Version contract + Settings check     ← PASS
B  GitHub Release upload + domain alias + manifest mac URL
C  /download and /api/release expose Mac (domain URL only)
D  Install update from published URL (in-app; not DMG dialog)
E  Operations publish / retire / rollback / mandatory
F  Windows installer (when Windows exists)
```

B is still blocked: `gh` not authenticated, `download.suhuella.com` alias not wired, manifest `mac` still empty.

Do not block Web first-impression tests on this track.

---

## Tests

```text
npm run test:release-lifecycle --prefix desktop
npm run test:download-page --prefix site
npm run test:desktop-artifacts --prefix site
npm run test:app-modal-shell --prefix site
npm run check:app-host --prefix site
```
