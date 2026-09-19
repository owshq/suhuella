# DESKTOP-RELEASE-HOSTING-001

```text
STATUS = CLOSED · PASS
TYPE = Release hosting + operator automation
DEPENDS = RELEASE-ARCHITECTURE-FROZEN.md (architecture closed)
DATE = 2026-09-19
WORKER = suhuella-download · download.suhuella.com
WORKER_VERSION = d34c0b1f-71bf-4778-afdb-8f3b13d85aff
SITE_WORKER = 851c94ad-b90d-4cee-a095-3aba9ac49915
GITHUB_RELEASE = v0.1.0-pre-rc
MAC_ALIAS = https://download.suhuella.com/latest/mac
```

Publish script: [scripts/publish-desktop-mac-release.mjs](scripts/publish-desktop-mac-release.mjs) · Worker: [workers/download-redirect/](workers/download-redirect/)

Smoke **PASS**: `/api/release` mac alias · redirect to GitHub asset · `/download` mac available. Clients never see `github.com` in manifest.

Goal: one operator action eventually replaces six manual steps. Progressive automation — separate actions at first, single **Publish Release** flow when stable.

---

## Target operator flow

```text
Operator presses:

Publish Release

        ↓
GitHub Release created
        ↓
DMG uploaded
        ↓
release.json updated
        ↓
Deploy
        ↓
Smoke
        ↓
Live
```

Today each step is manual (see [RELEASE-PUBLISH-PIPELINE-001.md](RELEASE-PUBLISH-PIPELINE-001.md)). This track wires hosting and collapses them.

---

## Prerequisites (from pipeline track)

| Requirement | Status |
| --- | --- |
| `brands/suhuella/release.json` is the only operator-editable version source | Implemented |
| `npm run test:release-version` blocks mismatches before publish | Implemented |
| `/api/release` is client authority | Frozen |
| Desktop artifacts only in `desktop/.build/suhuella/release/` | Implemented — `desktop/release/` retired |
| Web-only bump path (no DMG) | Documented in pipeline |

---

## Scope (when opened)

1. **download.suhuella.com** stable aliases (`/latest/mac`, `/latest/win`).
2. Manifest `mac` / `windows` point at domain URLs — never `github.com` in client payloads.
3. GitHub Releases as operator artifact store only.
4. Operations **Publish Release** button (or script) orchestrating: tag → upload → `release.json` → sync → deploy → smoke.
5. Rollback path: previous GitHub asset + manifest revert + redeploy.

**Out of scope:** licensing, checkout, auto-install updates, R2 migration (optional later).

---

## Artifact path (canonical)

```text
desktop/.build/suhuella/release/SuHuella-<version>.dmg
```

Do not reintroduce `desktop/release/`.

---

## Close criteria

- Operator publishes a full release (web + DMG) without editing more than `release.json` + pressing publish.
- `/download` serves Mac installer via domain alias when manifest `mac` is set.
- Smoke checklist in pipeline passes on production.
- `curl https://suhuella.com/api/release` matches published version.
