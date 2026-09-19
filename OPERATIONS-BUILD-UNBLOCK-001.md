# OPERATIONS-BUILD-UNBLOCK-001

```text
STATUS = CLOSED · PASS
TYPE = Build repair only
SCOPE = Recover forgotten Git files — no functional changes
```

Make branch `operations-access-closeout-001` buildable in a clean clone so Cloudflare can deploy Operations redirect changes.

Parent: [OPERATIONS-BUILD-DIAGNOSIS-001.md](OPERATIONS-BUILD-DIAGNOSIS-001.md).

---

## Missing file classification

| File | Category | Why it exists | Imported by | Action |
| --- | --- | --- | --- | --- |
| `site/release.json` | **A** Forgotten | Bundled release manifest for site (documented in `site/README.md`) | `lib/release-manifest.ts` | **Recover from local** |
| `site/lib/installer-availability.ts` | **A** Forgotten | Installer URL visibility helpers | `lib/release-manifest.ts` (+ other site modules not on branch) | **Recover from local** |
| `site/scripts/link-standalone-next.mjs` | **A** Forgotten | OpenNext standalone path fix | `package.json` `build:worker` | **Recover from local** |
| `site/scripts/strip-sharp-from-standalone.mjs` | **A** Forgotten | Remove sharp from Worker bundle | `package.json` `build:worker` | **Recover from local** |
| `site/lib/rate-limit.ts` | **A** Forgotten | Rate limiting for service health guard | `lib/service-capability-guard.ts` → Operations API | **Recover from local** |
| `site/tsconfig.json` (partial) | **A** Forgotten | `allowImportingTsExtensions`, `@suhuella/brand` path, check excludes | TypeScript phase of `next build` | **Recover local diff** |

**Not recovered (by design):**

| Item | Category | Reason |
| --- | --- | --- |
| `brands/.build/entry.ts` | **B** Generated | Created by `node ../brands/project-site.mjs` at build time — not committed |
| Full site app shell (`site/app/(suhuella)/`, etc.) | N/A | Not required for Operations-only branch build graph |
| Invented `release.json` content | — | Used existing local file verbatim |

**No category D** (dead imports removed): every missing module is a real dependency.

---

## Verification (clean clone)

After recovering the six items above:

```bash
git clone --branch operations-access-closeout-001 …
cd site && npm ci
npm run build        # PASS
npm run build:worker # PASS
```

Tested: **2026-09-19** on isolated clone with only recovered files added.

---

## What this PR does not change

- No Operations auth logic
- No UI copy
- No Cloudflare Access configuration
- No new architecture

---

## After merge / deploy

1. Cloudflare Git build should pass on `operations-access-closeout-001`.
2. Deploy to Worker `suhuella`.
3. Re-run [OPERATIONS-PRODUCTION-ACTIVATION-001.md](OPERATIONS-PRODUCTION-ACTIVATION-001.md) verification matrix.

```text
OPERATIONS-BUILD-UNBLOCK-001 — CLOSED · PASS
```
