# RELEASE-PUBLISH-PIPELINE-001

```text
STATUS = FROZEN · PASS
TYPE = Release infrastructure
OBJECTIVE = One operator workflow that publishes a release without requiring product code changes
PUBLIC_VERSION = 0.1.0-pre-rc
NEXT_EXAMPLE = 0.1.1
```

This track closes **how** an operator publishes any version — web and desktop — before opening hosting implementation (`DESKTOP-RELEASE-HOSTING-001`) or auto-update (`AUTO-UPDATER-001`).

Hosting (GitHub Releases, R2, domain redirects) is an implementation detail. The product requirement is a **repeatable publication sequence** that keeps every public surface on the same version and never exposes `github.com` to clients.

Related (closed / frozen):

- [VERSION-CONSISTENCY-001.md](VERSION-CONSISTENCY-001.md) — version mirror rules
- [RELEASE-LIFECYCLE-001.md](RELEASE-LIFECYCLE-001.md) — client lifecycle contract (Phase A PASS; Phase B deferred)
- [DESKTOP-RELEASE-ARTIFACTS-001.md](DESKTOP-RELEASE-ARTIFACTS-001.md) — FROZEN · BLOCKED until hosting exists

**Out of scope (do not touch in this track):** licensing, checkout, desktop auto-updater beyond Phase A check, Operations UI, R2, branding.

---

## 1. Canonical release source

One operator-editable file. Everything else derives automatically.

| Layer | Role | Location | Who reads it |
| --- | --- | --- | --- |
| **A — Release manifest (authority)** | Version, channel, minimum, mandatory, installer URLs | **`brands/suhuella/release.json`** — the only file operators edit | Sync script, `/api/release` bundle |
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

See [RELEASE-ARCHITECTURE-FROZEN.md](RELEASE-ARCHITECTURE-FROZEN.md) — **do not reopen architecture tracks**.

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

- [ ] `npm run package:mac --prefix desktop` (Mac DMG).
- [ ] Confirm artifact name: `SuHuella-<version>.dmg` (from BrandConfig `desktopProductName` + version).
- [ ] Windows: deferred until `WINDOWS-VALIDATION-001` reopens.

### C. GitHub Release (metadata + artifacts — operator-only)

Requires `gh` auth and repo access. Does **not** change client URLs.

- [ ] Create annotated tag: `git tag -a v<version> -m "Release <version>"` and push tag.
- [ ] `gh release create v<version> --title "<version>" --notes "<notes>"`.
- [ ] Upload `SuHuella-<version>.dmg` (and Windows installer when applicable) to the GitHub Release.
- [ ] Do **not** paste GitHub asset URLs into `release.json`.

### D. Point manifest at public download URLs

When `DESKTOP-RELEASE-HOSTING-001` is closed, domain aliases exist:

- [ ] Set `mac` in all release mirrors to stable alias, e.g. `https://download.suhuella.com/latest/mac`.
- [ ] Set `windows` similarly when available.
- [ ] Optional: `notes`, `mandatory`, `channel` (`stable` | `beta`).
- [ ] Re-run `npm run test:brand-config`.

Until hosting is live, leave `mac` / `windows` empty — `/download` correctly shows Mac unavailable.

### E. Deploy

- [ ] From repo root: `npm run cf:deploy`  
  (runs `build:worker`, Cloudflare deploy, `verify:production`).
- [ ] Or from `site/`: `npm run deploy`.

### F. Smoke test

- [ ] `curl -s https://suhuella.com/api/release | jq` — version matches release.
- [ ] Open `https://suhuella.com/download` — badge shows `v<version>`; Mac button state matches manifest (available only if `mac` is HTTPS).
- [ ] If installers published: download via `/download` button (not raw GitHub URL).
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

Operator-facing flow for a **full release** (web + desktop) once hosting exists:

```text
Build desktop
    npm run package:mac --prefix desktop
        ↓
Tag
    git tag -a v<version> -m "Release <version>" && git push origin v<version>
        ↓
Create GitHub Release
    gh release create v<version> --title "<version>" --notes "..."
        ↓
Upload installers
    gh release upload v<version> desktop/.build/suhuella/release/SuHuella-<version>.dmg
    (domain redirect /latest/mac → this asset — DESKTOP-RELEASE-HOSTING-001)
        ↓
Update release manifest
    brands/suhuella/release.json (mac URL + version)
    npm run release:sync
    npm run test:release-version
        ↓
Deploy Worker
    npm run cf:deploy
        ↓
Smoke test
    curl /api/release · /download · optional installer download · Desktop check
        ↓
Release live
```

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

This document is the single operator reference. No additional code required for OPEN — existing checks cover invariants:

| Task | Existing enforcement |
| --- | --- |
| Version consistency | `npm run test:brand-config` |
| Download semantics | `npm run test:download-page` |
| Desktop artifact contract | `npm run test:desktop-artifacts` |
| Release lifecycle kernel | `npm run test:release-lifecycle --prefix desktop` |
| Production smoke | `npm run verify:production` (post-deploy) |
| github.com in clients | manual `rg` (sections 6–7) |

Optional later: one script `test:release-publish-pipeline` wrapping the above — only if operators want a single command.

---

## Definition of done

- [ ] Operator can publish **web version bump** by editing config/manifest mirrors + deploy only.
- [ ] Operator can publish **desktop release** by following sections 2 and 8 once `DESKTOP-RELEASE-HOSTING-001` closes (GitHub upload + domain alias + manifest `mac`).
- [ ] No step requires editing React, Electron feature code, or API routes.
- [ ] Rollback procedure tested once on staging or documented dry-run.

**Close criteria:** one dry-run publish (web-only) executed on checklist; hosting track unblocked for full sequence.

---

## What opens next (not this track)

| Track | When |
| --- | --- |
| **DESKTOP-RELEASE-HOSTING-001** | After this checklist is accepted — connect GitHub Releases → `download.suhuella.com` |
| **AUTO-UPDATER-001** | After a real public installer URL exists |
| **RELEASE-LIFECYCLE-001 Phase B** | After hosting — in-app install/update UX beyond check-only |

---

## Track status log

| Date | Note |
| --- | --- |
| 2026-09-19 | Track opened. Invariants verified locally. Desktop hosting still blocked — web-only publish path is operable today. |
