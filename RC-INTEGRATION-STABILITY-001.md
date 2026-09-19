# RC-INTEGRATION-STABILITY-001

**STATUS:** CLOSED · PASS WITH FIXES (2026-09-19)

**Objective:** Repository boots cleanly for any new developer — no hidden steps, no module resolution failures, no manual generate scripts.

---

## Product invariant

```text
git clone → npm install → npm run dev → 0 module errors → Home loads
```

---

## Summary

| # | Category | Verdict |
|---|----------|---------|
| 1 | Fresh clone audit | **PASS WITH FIXES** |
| 2 | Module resolution | **PASS WITH FIXES** |
| 3 | Generated files | **PASS WITH FIXES** |
| 4 | Build pipeline | **PASS** |
| 5 | Console quality | **PASS WITH FIXES** |
| 6 | Runtime stability | **PASS** |
| 7 | Environment audit | **PASS WITH FIXES** |
| 8 | Brand integration | **PASS** |
| 9 | Dependency audit | **PASS WITH FIXES** |
| 10 | Developer experience | **PASS WITH FIXES** |
| 11 | CI readiness | **PASS WITH FIXES** |
| 12 | Out of scope | **N/A** |

---

## Fixes applied in this track

### Root cause: `@suhuella/brand` resolution

Three incompatible strategies existed simultaneously:

| Consumer | Before | After |
|----------|--------|-------|
| `site/tsconfig.json` | `./.build/brand-entry.ts` (missing on clone) | `../brands/.build/entry.ts` |
| `site/next.config.ts` turbopack | `./brands/suhuella/entry.ts` (resolved inside `site/`) | npm package `@suhuella/brand` |
| `desktop/tsconfig` | `../brands/index.ts` (catalog, not selected brand) | `../brands/.build/entry.ts` |
| Bundlers | Per-package aliases | `file:../brands` dependency |

### Solution

1. **`@suhuella/brand` is now a local npm package** (`brands/package.json` with `exports`).
2. **`brands/.build/entry.ts`** is generated automatically (gitignored) and re-exports the selected brand entry.
3. **`scripts/bootstrap.mjs`** runs on root `postinstall` after installing `site` and `desktop` deps.
4. **`dev-safe.mjs`** and **`desktop/scripts/dev.mjs`** regenerate brand assets before starting dev.
5. Turbopack alias hacks for `@suhuella/brand` removed — resolution is standard npm.

---

## Category details

### 1. Fresh clone audit — PASS WITH FIXES

| Item | Result |
|------|--------|
| `npm install` at repo root | Installs site + desktop + bootstraps brand entry |
| `npm run dev` | Starts without module errors |
| Manual `generate-brand` step | **Removed** |
| Home loads | **200** |

**Remaining:** Root has no `package-lock.json`. Reproducibility relies on `site/` and `desktop/` lockfiles. Consider a root lockfile or documented `npm ci` flow for CI.

---

### 2. Module resolution — PASS WITH FIXES

| Import | Desktop | Web (Turbopack) | Web (Webpack build) | Tests |
|--------|---------|-----------------|---------------------|-------|
| `@suhuella/brand` | ✅ npm package | ✅ npm package | ✅ npm package | ✅ |
| `@suhuella/desktop/*` | N/A | ✅ turbopack alias | ✅ webpack alias | ✅ |

**Issue fixed:** Turbopack cannot resolve monorepo path aliases for files imported from both `site/` and `desktop/src/`. npm `file:` dependency is the canonical fix.

**Severity (was):** BLOCKER  
**Effort:** M (half day)  
**Regression risk:** Low — same entry file, different resolution path

---

### 3. Generated files — PASS WITH FIXES

| File | Source of truth | Generated | Committed | Auto-generated |
|------|-----------------|-----------|-----------|----------------|
| `brands/.build/entry.ts` | `brands/<id>/entry.ts` | Yes | No (gitignored) | `postinstall`, `dev`, `build` |
| `site/public/*` brand assets | `brands/<id>/assets/public/` | Yes | Partially | `project-site.mjs` |
| `site/public/app.webmanifest` | Brand identity | Yes | No | `project-site.mjs` |
| `desktop/.build/<id>/` | Brand + build | Yes | No | `brand-build.mjs` |
| `site/.build/brand-entry.ts` | **Removed** | — | — | Deprecated |

---

### 4. Build pipeline — PASS

| Command | Status | Notes |
|---------|--------|-------|
| `npm run dev` | ✅ | Turbopack, all routes 200 |
| `npm run build:site` | ✅ | Webpack production build |
| `npm run build:desktop` | ✅ | Vite + esbuild |
| `npm run test:brand-config` | ✅ | |
| `npm run package:check` | Not re-run this session | Previously passing |

---

### 5. Console quality — PASS WITH FIXES

| Area | Status |
|------|--------|
| Module resolution errors in dev | **Fixed** |
| React/Next runtime warnings during navigation | None observed |
| `test:brand-config` Node warning | `MODULE_TYPELESS_PACKAGE_JSON` for `site/lib/resend-mail.ts` — cosmetic |

**Open (low):** Add `"type": "module"` to `site/package.json` or adjust test import to silence Node reparsing warning.

---

### 6. Runtime stability — PASS

All six app screens return **200** in dev:

```text
/home · /search · /sources · /organise · /activity · /settings
```

No unhandled module failures. `/api/release` and `/api/service-health` return 200.

---

### 7. Environment audit — PASS WITH FIXES

| Variable | Class | Behaviour |
|----------|-------|-----------|
| `BRAND` | Optional | Defaults to `suhuella`; unknown values fail closed |
| `PORT` | Optional | Dev default 3000 |
| `.env.local` / `.dev.vars` | Dev only | Present in dev environment; app starts without for static routes |
| Cloudflare / Resend / Stripe | Production | Not required for local dev shell |

**Not audited exhaustively** — full env matrix deferred to PRODUCTION-READINESS-001.

---

### 8. Brand integration — PASS

- `@suhuella/brand` imports resolve to selected brand entry everywhere.
- `npm run test:brand-config` passes for `suhuella`.
- Site metadata, manifest, and public assets projected from BrandConfig.

---

### 9. Dependency audit — PASS WITH FIXES

| Finding | Severity | Action |
|---------|----------|--------|
| `@suhuella/brand` not a real package | BLOCKER | **Fixed** — `file:../brands` in site + desktop |
| Duplicate alias configs | HIGH | **Fixed** — single npm resolution path |
| `desktop` npm audit (14 vulns) | MEDIUM | Pre-existing; not introduced by this track |
| Unused `site/.build/` shim | LOW | Removed from generation |

---

### 10. Developer experience — PASS WITH FIXES

```text
git clone <repo>
cd suhuella
npm install      # installs site + desktop + bootstraps brand
npm run dev      # http://localhost:3000/home
npm run desktop  # Electron + Vite (separate terminal)
```

**Added scripts:**

- `npm run bootstrap` — regenerate brand entry + public assets
- `npm run dev:stop` / `npm run dev:force` — safe dev server lifecycle
- `npm run install:all` — explicit subpackage install

---

### 11. CI readiness — PASS WITH FIXES

| Requirement | Status |
|-------------|--------|
| Deterministic brand entry | ✅ Generated from `BRAND` env |
| No machine-specific aliases | ✅ npm `file:` symlinks |
| Build commands exit clean | ✅ Verified locally |
| Root lockfile | ⚠️ Missing — CI should use `npm ci --prefix site` pattern |

---

## Definition of Done

```text
✅ Fresh clone path documented and automated (postinstall)
✅ npm run dev — 0 module resolution errors
✅ Home + all six screens load
✅ site build + desktop build succeed
✅ No manual generate-brand step
⚠️ 0 warnings — one Node MODULE_TYPELESS warning in test script (low)
⚠️ Root package-lock — not yet unified
```

---

## Recommended follow-ups (outside this track)

1. Add root `package-lock.json` or document CI install order explicitly.
2. Silence `MODULE_TYPELESS_PACKAGE_JSON` in brand-config-check.
3. Run `npm audit` on desktop dependencies before RC1 tag.
4. **RC-END-TO-END-001** — user journey validation.
5. **PRIVATE-BETA-001** — after integration + E2E pass.

---

## Out of scope (unchanged)

No UI redesign · no product behaviour changes · no Recommendation/Knowledge/Organise/licensing architecture changes.
