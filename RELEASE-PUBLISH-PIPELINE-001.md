# RELEASE-PUBLISH-PIPELINE-001

```text
STATUS = CLOSED · PASS · DO NOT REOPEN
TYPE = Release infrastructure
OBJECTIVE = One operator workflow that publishes a release without requiring product code changes
PUBLIC_VERSION = 0.1.0-pre-rc
NEXT_EXAMPLE = 0.1.1
REOPEN_ONLY = ADR — code signing, auto-update, beta/stable channels, storage change (R2), abandon GitHub Releases
```

This track is **closed**. Architecture decisions are done; remaining work is repeatable operator runs.

This track closes **how** an operator publishes any version — web and desktop — without product code changes.

Hosting (GitHub Releases, domain redirects) is an implementation detail. The product requirement is a **repeatable, artifact-based publication sequence** that keeps every public surface on the same version and never exposes `github.com` to clients.

Related (closed / frozen):

- [VERSION-CONSISTENCY-001.md](VERSION-CONSISTENCY-001.md) — version mirror rules
- [RELEASE-LIFECYCLE-001.md](tracks/open/RELEASE-LIFECYCLE-001.md) — client lifecycle contract (Phase A PASS; Phase B deferred)
- [DESKTOP-RELEASE-HOSTING-001.md](DESKTOP-RELEASE-HOSTING-001.md) — CLOSED · PASS — `download.suhuella.com` aliases + publish scripts
- [DESKTOP-RELEASE-ARTIFACTS-001.md](tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md) — FROZEN · PASS — artifact naming contract

**Out of scope (do not touch in this track):** licensing, checkout, desktop auto-updater beyond Phase A check, Operations UI, R2, branding.

---

## 1. Canonical release source

One operator-editable file. Everything else derives automatically.

| Layer | Role | Location | Who reads it |
| --- | --- | --- | --- |
| **A — Release manifest (authority)** | Version, channel, minimum, mandatory, installer URLs, **artifact metadata** (`filename`, `sha256`, `size`) | **`brands/suhuella/release.json`** — the only file operators edit | Sync script, `/api/release` bundle |
| **B — Derived mirrors** | Same version + URLs, no manual edits | `brands/dbasenet/release.json`, `site/release.json`, package.json, wrangler | Build, deploy, Desktop About |
| **C — BrandConfig.release** | Imported from release.json in code | `brands/suhuella/brand.ts` | Landing badge, browser About, manifest fallback |
| **D — Runtime API** | Single client-facing payload | **`GET /api/release`** | Website `/download`, Desktop Settings check |

**Write order (always):**

```text
brands/suhuella/release.json   ← operator edits this only
        ↓
npm run build                  (gate: sync + version check — automatic)
        ↓
site/release.json · brands/dbasenet/release.json
site/package.json · desktop/package.json · wrangler NEXT_PUBLIC_APP_VERSION
BrandConfig.release            (imports release.json — never duplicate version strings)
        ↓
deploy Worker  →  /api/release live
```

See [release-architecture.md](docs/architecture/constitution/release-architecture.md) — **do not reopen architecture tracks**.

**Rules:**

- **`/api/release` is the only authority clients consult.** Website and Desktop must not invent parallel version sources.
- **`site/release.json` is what production serves** when installer URLs are unset or when no remote override wins. Operator updates this file (via mirrors above), then deploys — no React changes.
- **`RELEASE_MANIFEST_URL`** is optional. SuHuella has `releaseRemoteEnabled: true`, but production Wrangler does not set a remote URL today. Do **not** rely on a remote manifest for the first releases; use bundled `site/release.json` + deploy. Remote remains a later ops escape hatch, not the primary checklist step.
- **GitHub Releases** stores binaries and metadata for operators only. Clients never receive `github.com` URLs. When hosting opens, manifest `mac` / `windows` point at **`https://download.suhuella.com/...`** (domain alias), not GitHub asset links.

---

## 2. Operator checklist (publish a new version)

Use this for every release (e.g. `0.1.0-pre-rc` → `0.1.1`). Check off in order.

### A. Prepare version (config only — no product code)

- [ ] Choose version string (semver; pre-release suffix allowed, e.g. `0.1.1`, `0.1.0-rc1`).
- [ ] Edit **`brands/suhuella/release.json`** only (`version`, `downloads`, `minimumVersion`, `releaseDate`, `notes`).
- [ ] Run `npm run build` — sync and version check run automatically.
- [ ] Optional: `npm run test:brand-config` before deploy.

**Permitted edits per release:** `brands/suhuella/release.json` only.  
**Not permitted per release:** React/Electron feature code, API route logic, checkout, licensing, duplicate version strings in `brand.ts`.

### B. Build desktop (when shipping installers)

Skip this block for **web-only** version bumps (version badge + `/api/release` only).

- [ ] `npm run package:mac --prefix desktop` — runs `build:icons`, build, electron-builder (Mac DMG).
- [ ] Confirm artifact name: `SuHuella-<version>.dmg` (from BrandConfig `desktopProductName` + version).
- [ ] Windows: `npm run package:win --prefix desktop` on Windows, or CI workflow `desktop-windows-build.yml`.

### C. Publish artifact (operator script — preferred)

Requires `GH_TOKEN` or `gh auth`. Script is **artifact-based, never filename-based** — upload skips only when remote SHA256 matches local SHA256.

- [ ] Mac: `npm run publish:desktop-mac` from repo root.
- [ ] Windows (after CI upload): `npm run publish:desktop-win`.
- [ ] Script uploads DMG/exe + `.sha256` sidecar to GitHub Release, updates `release.json` (`url`, `filename`, `sha256`, `size`), deploys download Worker, syncs mirrors, runs smoke.
- [ ] Do **not** paste GitHub asset URLs into `release.json` manually — manifest uses stable aliases only.

Manual `gh release upload` remains valid for recovery; prefer the publish scripts for the full sequence.

### D. Verify artifact (before calling release live)

- [ ] `npm run verify:desktop-artifact -- --platform mac` (or `windows`).
- [ ] Confirms: **version**, **filename**, **SHA256**, **size** — manifest, redirect, and downloaded bytes.
- [ ] `curl -s https://suhuella.com/api/release | jq '.release.downloads.mac'` — exposes `filename`, `sha256`, `size`.
- [ ] `curl -sI https://download.suhuella.com/latest/mac` — 302 to GitHub asset (operator check only; clients use manifest aliases).

### E. Deploy

- [ ] From repo root: `npm run cf:deploy`  
  (runs `build:worker`, Cloudflare deploy, `verify:production`).
- [ ] Or from `site/`: `npm run deploy`.

### F. Smoke test

- [ ] `npm run smoke:desktop-download` — `/api/release`, aliases, `/download/preparing`.
- [ ] `curl -s https://suhuella.com/api/release | jq` — version matches release; `downloads.*` includes `filename`, `sha256`, `size`.
- [ ] Open `https://suhuella.com/download` — Mac/Windows buttons route to `/download/preparing?platform=…` (not a blank tab).
- [ ] Desktop (when built): About shows same version; Settings → Check for updates hits `/api/release`.
- [ ] `npm run test:download-page --prefix site` and `npm run test:desktop-artifacts --prefix site` (local regression).

### G. Release live

- [ ] Record release in operator notes (version, tag, Worker deploy id, smoke timestamp).
- [ ] Communicate to beta users if applicable.

---

## 3. Version consistency

Every public surface must expose **exactly the same version** after a publish.

| Surface | Source | How to verify |
| --- | --- | --- |
| **`brands/suhuella/release.json`** | **operator authority** | edit here only |
| BrandConfig.release | imports release.json | `npm run test:release-version` |
| `brands/dbasenet/release.json` | synced mirror | same check |
| `site/release.json` | synced mirror | same check |
| `site/package.json` | synced mirror | same check |
| `desktop/package.json` | synced mirror | same check |
| `NEXT_PUBLIC_APP_VERSION` | synced wrangler | same check |
| `/api/release` | bundled manifest at deploy | `curl …/api/release` |
| `/download` badge | `getReleaseManifest()` → fallback BrandConfig | visual + `test:download-page` |
| Landing badge | `site/lib/release.ts` → BrandConfig | production HTML |
| Desktop About | `app.getVersion()` from desktop package.json | app UI |
| Browser About | `brand.release.version` | Settings in browser host |

**Automated gates:** `npm run test:release-version` then `npm run test:brand-config` (from repo root).

**Manual gate after deploy:**

```bash
curl -s https://suhuella.com/api/release | jq '.release | {latest, version, minimum, minimumVersion}'
# latest, version, minimum, minimumVersion must all equal the published version
```

---

## 4. `/download` never hardcodes installer URLs

**Invariant:** Download UI reads manifest via shell/data layer — no literal `https://…dmg` or `github.com` in components.

| Check | Command / location |
| --- | --- |
| Download catalog uses manifest | `site/lib/download-catalog.ts`, `site/components/DownloadCatalogContent.tsx` |
| Semantics test | `npm run test:download-page --prefix site` |
| Desktop artifacts test | `npm run test:desktop-artifacts --prefix site` |
| Grep (product source) | `rg 'https://github\|downloads\.' site/components/DownloadCatalogContent.tsx site/lib/download-catalog.ts` → none |

**Verified 2026-09-19:** no hardcoded installer URLs in download UI source.

---

## 5. `/api/release` is the only authority

| Consumer | Must use `/api/release` or shared manifest loader | Must not |
| --- | --- | --- |
| Website `/download` | `getReleaseManifest()` in shell → catalog | Hardcoded version or URL |
| Desktop update check | `release-check.ts` → production `/api/release` | GitHub API, local version file |
| verify-session (post-checkout) | `getReleaseManifest()` for version in payload | Separate version constant |
| Operations console | reads same manifest (ops only; not client path) | N/A |

**Runtime implementation:** `site/app/api/release/route.ts` → `getReleaseManifest()` → `publicReleasePayload()`.

Clients treat empty `mac` / `windows` as “installer not published” — not an error.

---

## 6. Desktop never contains `github.com`

**Scope:** product source — `desktop/src/**`, `desktop/electron/**`, excluding lockfiles and `node_modules`.

```bash
rg 'github\.com' desktop/src desktop/electron --glob '!*.lock'
# Expected: no matches
```

**Verified 2026-09-19:** PASS.

Installer URLs in Desktop come only from `/api/release` response (`mac`, `windows` fields).

---

## 7. Website never contains `github.com`

**Scope:** product source — `site/app/**`, `site/components/**`, `site/lib/**` (exclude lockfiles).

```bash
rg 'github\.com' site/app site/components site/lib --glob '!*.lock'
# Expected: no matches
```

**Verified 2026-09-19:** PASS.

GitHub is operator tooling (`gh release`, browser upload). It never appears in shipped HTML/JS client bundles for download or update.

---

## 8. Exact publication sequence

Operator-facing flow for a **full release** (web + desktop):

```text
Build
    npm run package:mac --prefix desktop
        ↓
Generate icons
    (included in package:mac — build:icons before electron-builder)
        ↓
Package
    SuHuella-<version>.dmg in desktop/.build/suhuella/release/
        ↓
Calculate SHA256 + size
    publish script computes digest and byte size from local artifact
        ↓
Publish artifact
    npm run publish:desktop-mac
    → GitHub Release + .sha256 sidecar
    → download.suhuella.com/latest/mac redirect var
    → release.json (url, filename, sha256, size)
        ↓
Verify artifact
    npm run verify:desktop-artifact -- --platform mac
        ↓
Update release.json
    (automatic in publish script; operator may edit version/notes before publish)
    npm run release:sync
        ↓
Deploy
    npm run cf:deploy  (included unless --skip-deploy)
        ↓
Smoke
    npm run smoke:desktop-download
        ↓
Live
```

**Upload rule (frozen):** skip upload only when remote SHA256 === local SHA256. Never skip because the filename already exists on the release.

**Web-only release today** (no public DMG):

```text
Update version mirrors (section 2A)
        ↓
Deploy Worker
        ↓
Smoke: /api/release + /download badge
        ↓
Release live
```

No GitHub Release required for web-only bumps. No product code edits.

---

## 9. Rollback procedure

Rollback is **manifest + deploy**, not git revert of application code.

### Fast rollback (stop serving bad version)

1. Restore previous values in `brands/suhuella/brand.ts` `release` block and all mirrors (`release.json`, package.json, wrangler).
2. If installer URL was wrong, set `mac` / `windows` back to previous HTTPS alias or empty string.
3. `npm run test:brand-config`
4. `npm run cf:deploy`
5. Smoke: `/api/release` and `/download` show previous version; Mac unavailable if URLs cleared.
6. Desktop users on bad build: optional `mandatory: true` + higher `minimumVersion` in a **forward-fix** release — only after hosting exists; do not use for web-only rollback.

### GitHub Release assets

- **Do not delete** published DMGs unless legally required — leave release artifacts immutable.
- Rollback means **stop pointing** `/api/release` and domain aliases at the bad artifact, not removing GitHub history.
- If domain alias was repointed, restore redirect to last known good asset (hosting track).

### Tag / release metadata

- Prefer a **new forward release** (e.g. `0.1.2`) over rewriting tags.
- If tag was wrong and never adopted: delete remote tag only before any user downloaded (`git push --delete origin vX`).

### Verification after rollback

```bash
curl -s https://suhuella.com/api/release | jq '.release.version'
# must equal rolled-back version
```

---

## Deliverable

This document is the single operator reference:

| Task | Enforcement |
| --- | --- |
| Version consistency | `npm run test:brand-config` |
| Download semantics | `npm run test:download-page` |
| Desktop artifact contract | `npm run test:desktop-artifacts` |
| Mac publish | `npm run publish:desktop-mac` |
| Win publish | `npm run publish:desktop-win` |
| Artifact verification | `npm run verify:desktop-artifact` |
| Post-publish smoke | `npm run smoke:desktop-download` |
| Release lifecycle kernel | `npm run test:release-lifecycle --prefix desktop` |
| Production smoke | `npm run verify:production` (post-deploy) |
| github.com in clients | manual `rg` (sections 6–7) |

---

## 10. Frozen rules

These rules follow from the architecture. Changing them requires a new ADR or track — not a silent implementation tweak.

### Immutable artifacts

**Release artifacts are immutable.**

The only mutable object is `release.json`.

Clients never infer releases from filenames, GitHub assets, or download URLs.

Clients trust only **`GET /api/release`**.

Rollback repoints `release.json` and domain aliases — it does not rewrite published binaries.

### Stable distribution API

**`download.suhuella.com` is a stable public API.**

| Consumer | Uses |
| --- | --- |
| Website | `/download/preparing` triggers download via manifest URLs pointing at aliases |
| Desktop updater (future) | Same aliases |
| Automation / CLI | `GET /latest/mac`, `GET /latest/win` |
| Support documentation | May reference stable alias URLs |

Changing alias semantics (paths, redirect behaviour, response codes) requires an **ADR**.

The website consumes the API; it does not replace it.

---

## Definition of done

- [x] Operator can publish **web version bump** by editing config/manifest mirrors + deploy only.
- [x] Operator can publish **desktop release** via `publish:desktop-mac` / `publish:desktop-win` + verify + smoke.
- [x] No step requires editing React, Electron feature code, or API routes per release.
- [x] Artifact-based upload (SHA256 match to skip; never filename-based skip).
- [x] `/download/preparing` replaces blank post-download UX.
- [ ] One production publish with new DMG verified end-to-end (`verify:desktop-artifact` PASS) — **next operator action**.

**Close criteria:** pipeline frozen; remaining work is operational (publish real artifact, validate live).

---

## What opens next (not this track)

| Track | When |
| --- | --- |
| **AUTO-UPDATER-001** | After a verified public installer + manifest artifact metadata in production |
| **RELEASE-LIFECYCLE-001 Phase B** | In-app install/update UX beyond check-only |
| **New ADR** | If abandoning GitHub Releases, moving to R2, code signing, or Stable/Beta/Nightly channels |

Do **not** open a new pipeline document for SHA256, size, preparing page, or aliases — those are implementations of this track.

---

## Implementation status (2026-09-19)

- [x] Artifact-based publishing (SHA256 match to skip upload; replace on mismatch)
- [x] SHA256 verification (`release-artifact-sha256.mjs`, sidecar on GitHub Release)
- [x] `download.suhuella.com` stable aliases (`/latest/mac`, `/latest/win`)
- [x] Preparing page (`/download/preparing` — live download state, not a blank tab)
- [x] `filename` / `size` / `sha256` in manifest and `/api/release`
- [x] `npm run verify:desktop-artifact` (version, filename, SHA256, size)

**Architecture complete.** Failures from here are implementation bugs, not design gaps.

---

## Operator runbook (first desktop release)

No more pipeline design. **Gated execution** — do not advance until the current step passes. Full log template: [DESKTOP-RELEASE-PRODUCTION-001.md](DESKTOP-RELEASE-PRODUCTION-001.md).

```text
1. Package       npm run package:mac --prefix desktop
        ↓
2. Publish       npm run publish:desktop-mac
        ↓
3. Verify        npm run verify:desktop-artifact -- --platform mac
        ↓
4. Deploy        (in publish, or npm run cf:deploy if --skip-deploy)
        ↓
5. Smoke         npm run smoke:desktop-download
        ↓
6. Manual download   suhuella.com/download
        ↓
7. First launch      icon · About · folder · use
```

Failures are **implementation bugs** unless an ADR trigger applies. First desktop release closes when step 7 passes for a user who has never seen SuHuella.

---

## Track status log

| Date | Note |
| --- | --- |
| 2026-09-19 | Track opened. Invariants verified locally. |
| 2026-09-19 | FROZEN · PASS — artifact pipeline, preparing page, distribution API rules, verify script. |
| 2026-09-19 | **CLOSED · PASS** — no pending architecture. Operator runbook above. Reopen only via ADR. |
