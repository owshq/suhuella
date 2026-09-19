# OPERATIONS-BUILD-DIAGNOSIS-001

```text
STATUS = CLOSED · PASS (investigation)
TYPE = Investigation only
NO CODE CHANGES · NO COMMITS · NO PR
```

Determine why Cloudflare production builds failed for `operations-access-closeout-001` and whether that blocked Operations redirect changes from reaching production.

Related: [OPERATIONS-ACCESS-VERIFY-001.md](OPERATIONS-ACCESS-VERIFY-001.md) · [OPERATIONS-PRODUCTION-ACTIVATION-001.md](OPERATIONS-PRODUCTION-ACTIVATION-001.md).

Investigation date: **2026-09-19**.

---

## Executive summary

**The failed Cloudflare Git builds are real and reproducible.** They failed during **`next build`** with **module-not-found** errors. The branch **`operations-access-closeout-001` is not self-contained**: it adds the Operations module but omits files that Operations imports (`site/release.json`, `site/lib/installer-availability.ts`, `site/scripts/*`).

**Production was not rolled back to an older app by those failed builds.** Failed Git builds never promoted. Production continues to serve a **manually deployed** Worker version (latest wrangler deployment **`ed49bf08-79a4-4c52-ad31-faadb9740078`**, 2026-09-19 04:56 UTC) that includes Operations on `/_ops` but **not** the canonical redirect changes from commits `904577b` / `2d6ce31`.

**Fixing deployment requires repository changes** (complete the branch or merge to `main` with all dependencies). Not Cloudflare Access configuration alone.

---

## 1. Failed build — reproduced locally

Simulated Cloudflare CI: clean clone of branch `operations-access-closeout-001`, `npm ci` in `site/`, `npm run build:worker`.

| Field | Value |
| --- | --- |
| **Failing step** | `next build` (first step of `build:worker`) |
| **Bundler** | Turbopack (default for `next build` without `--webpack`) |
| **Exit code** | 1 |
| **Rollback** | N/A — build never produced a Worker bundle to deploy |

### First root cause

```text
site/lib/release-manifest.ts:2
Module not found: Can't resolve '../release.json'
```

### Additional errors (same build)

| File | Missing import |
| --- | --- |
| `site/lib/release-manifest.ts:59` | `./installer-availability.ts` |
| `site/lib/operations/auth.ts:1` | `@suhuella/brand` (when `project-site.mjs` not run before build) |
| `site/components/operations/OperationsConsole.tsx:3` | `@suhuella/brand` |
| `site/lib/operations/session.ts:1` | `@suhuella/brand` |

With `npm run build` (runs `project-site.mjs` first), `@suhuella/brand` resolves; **`release.json` and `installer-availability.ts` still fail**.

### Files present on branch vs required

| Path | In commit `2d6ce31`? | Required by Operations |
| --- | --- | --- |
| `site/release.json` | **No** | `release-manifest.ts` |
| `site/lib/installer-availability.ts` | **No** | `release-manifest.ts` |
| `site/scripts/link-standalone-next.mjs` | **No** | `build:worker` step 2 |
| `site/scripts/strip-sharp-from-standalone.mjs` | **No** | `build:worker` step 3 |
| `brands/` | Yes | `@suhuella/brand` |
| `site/lib/operations/*` | Yes | Operations routes |

**Conclusion:** Failure is **directly related to Operations landing on an incomplete branch**, not an unrelated lint/test flake.

### Local contrast (misleading PASS)

`npm run build:worker` **passes** on the developer machine when the working tree contains **uncommitted** files (`site/release.json`, `site/scripts/`, full app shell, etc.). Cloudflare builds **only what is in Git** on the branch — hence fail in CI, pass locally.

---

## 2. Active production deployment

From `wrangler deployments list` (Worker **`suhuella`**):

| Field | Value |
| --- | --- |
| **Latest deployment** | 2026-09-19T04:56:39Z |
| **Active version ID** | `ed49bf08-79a4-4c52-ad31-faadb9740078` |
| **Source** | Unknown (manual `wrangler deploy` / local upload — not Git build artifact from failed branch) |
| **Notable prior version** | `688364c5-7834-4b5c-9069-27c7ddc17026` (2026-09-19 02:55 — APP-MODAL-SHELL deploy) |

Failed Git builds on `operations-access-closeout-001` (`904577b`, `2d6ce31`) **did not replace** this version.

---

## 3. Live route verification (2026-09-19)

| URL | HTTP | Live behaviour |
| --- | --- | --- |
| `https://ops.suhuella.com/` | **302** | Redirect to Cloudflare Access login (`wispy-dew-bfae.cloudflareaccess.com`) |
| `https://suhuella.com/_ops` | **200** | Next.js app — **no Access** — body: *"Operations is not configured"* (old copy) |
| `https://suhuella.com/admin` | **307** | `location: /_ops` (not `ops.suhuella.com`) |

Evidence: anonymous `curl` from MAD edge. Production HTML still references *"put Cloudflare Access in front of /_ops"* — string removed in branch `2d6ce31`.

---

## 4. EXPECTED vs LIVE vs MISMATCH

| Item | EXPECTED (branch `2d6ce31`) | LIVE (production now) | MISMATCH |
| --- | --- | --- | --- |
| Canonical URL | `https://ops.suhuella.com` | Access works on ops subdomain | **No** (for ops host) |
| `ops.suhuella.com` Access | Anonymous → login | **302 → Access login** | **No** |
| `suhuella.com/_ops` | **301 → ops.suhuella.com** | **200** unprotected Operations page | **Yes** |
| `suhuella.com/admin` | **301 → ops.suhuella.com** | **307 → /_ops** | **Yes** |
| Config error (prod) | Generic *"temporarily unavailable"* | *"Operations is not configured"* + env hints | **Yes** |
| Config diagnostic (prod) | Hidden | N/A (old message instead) | **Yes** |
| Worker secrets | Set | Not set (503/not configured) | **Yes** |
| Git branch deployed | `operations-access-closeout-001` | **Not deployed** (build failed) | **Yes** |

---

## 5. Is the failure unrelated to Operations?

**No.** The Operations PR introduced imports (`OperationsPage` → `getReleaseManifest` → `release-manifest.ts`) that pull in **`site/release.json`** and **`installer-availability.ts`**, which were **never committed** on the branch. The build breaks when resolving the Operations dependency graph.

Secondary issue: `build:worker` runs `next build` without `node ../brands/project-site.mjs` (unlike `npm run build`), which can also break `@suhuella/brand` on clean installs.

---

## 6. Fix — stop before code (explanation only)

Deploying the redirect/canonical-URL changes **requires a build that passes on a clean checkout**. Options (operator choice, not implemented here):

1. **Expand the branch** — commit missing files: `site/release.json`, `site/lib/installer-availability.ts`, `site/scripts/*`, and any other imports required by the full site graph; re-run Cloudflare build.
2. **Merge to `main` first** — ensure `main` + Operations changes build together; deploy from `main`.
3. **Manual deploy from local** — `npm run deploy` from a complete working tree (works today locally) bypasses Git CI but does not fix the branch for future builds.

**Cloudflare Access + Worker secrets** remain required regardless (see [OPERATIONS-PRODUCTION-ACTIVATION-001.md](OPERATIONS-PRODUCTION-ACTIVATION-001.md)). They do **not** replace deploying the redirect code.

**No application architecture change is required** — only a **complete, buildable commit set**.

---

## 7. Recommended operator sequence

1. Do **not** open new product tracks until deploy path is clear.
2. Fix branch completeness or merge PR → verify `npm run build:worker` on **clean clone**.
3. Deploy to Worker `suhuella`.
4. Set secrets: `SUPERADMIN_EMAILS`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, optional `OPS_BASE_URL`.
5. Verify matrix in [OPERATIONS-ACCESS-VERIFY-001.md](OPERATIONS-ACCESS-VERIFY-001.md).

---

```text
OPERATIONS-BUILD-DIAGNOSIS-001 — CLOSED · PASS (investigation)
```
