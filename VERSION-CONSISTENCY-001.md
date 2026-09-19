# VERSION-CONSISTENCY-001

```text
STATUS = CLOSED · PASS WITH FIXES
TYPE = Pre-RC version authority
PUBLIC_VERSION = 0.1.0-pre-rc
NEXT_TAG = 0.1.0-rc1
```

One public version until tagged **rc1**: **`0.1.0-pre-rc`**.

`0.1.0-web` is gone. Leftover `0.1.0` is compatibility or history, not the public story.

```text
BrandConfig.release.version
    ↓
brands/<id>/release.json
    ↓
site/package.json · desktop/package.json · site/release.json
    ↓
About · landing badge · browser host · /api/release
```

Do not deploy from this close. Live Worker already served `0.1.0-pre-rc` after DESKTOP-RELEASE-DISTRIBUTION-001.

---

## Authority

| Role | Value |
| --- | --- |
| Public version | `0.1.0-pre-rc` |
| Badge | `v0.1.0-pre-rc` |
| Next public tag | `0.1.0-rc1` (not this track) |
| Stable release | `0.1.0` (after RC, not now) |

Write the number in BrandConfig (`brands/<id>/brand.ts` → `release.version`) and the matching `brands/<id>/release.json`. Mirrors and UI read from there.

`brand-config-check` now fails if site / desktop packages, `site/release.json`, Worker `NEXT_PUBLIC_APP_VERSION`, or browser About / license `appVersion` drift.

---

## Inventory

### Public authority — `0.1.0-pre-rc`

| Surface | Before this track | After |
| --- | --- | --- |
| `brands/suhuella/brand.ts` | `0.1.0-pre-rc` | unchanged · authority |
| `brands/dbasenet/brand.ts` | `0.1.0-pre-rc` | unchanged · same number |
| `brands/suhuella/release.json` | `0.1.0-pre-rc` | unchanged |
| `brands/dbasenet/release.json` | `0.1.0-pre-rc` | unchanged |
| `site/release.json` | `0.1.0-pre-rc` | unchanged |
| `site/package.json` version | `0.1.0-pre-rc` | unchanged |
| `desktop/package.json` | `0.1.0-pre-rc` | unchanged |
| `site/wrangler.jsonc` `NEXT_PUBLIC_APP_VERSION` | `0.1.0-pre-rc` | unchanged |
| `wrangler.jsonc` `NEXT_PUBLIC_APP_VERSION` | `0.1.0-pre-rc` | unchanged |
| Landing badge (`site/lib/release.ts`) | BrandConfig | unchanged |
| Electron About (`app.getVersion()`) | package.json | unchanged |
| Browser About (`install-browser-host.ts`) | hardcoded `0.1.0-pre-rc` | `brand.release.version` |
| Browser license `appVersion` | hardcoded `0.1.0-pre-rc` | `brand.release.version` |
| `/api/release` (bundled) | `0.1.0-pre-rc` | unchanged |
| Docs / RC label | `0.1.0-pre-rc` | unchanged |

`0.1.0-web` was already absent from source. PRODUCTION-READINESS-001 recorded it as a historical fail.

### Changed here

- Browser About and browser license `appVersion` read BrandConfig.
- Operations record-activation placeholder is `0.1.0-pre-rc`.
- Site R2 upload script names match electron-builder `${version}`.
- Desktop / site README examples use `0.1.0-pre-rc`.
- `brand-config-check` locks the mirrors.

### Leftover `0.1.0` — do not treat as public version

| Leftover | Why it stays |
| --- | --- |
| npm dependency versions (`cross-dirname`, `yocto-queue`, …) | Third-party packages |
| `PRODUCTION-READINESS-001.md` live `/api/release` = `0.1.0` | Closed audit of an older Worker |
| Local `site/.env.local` `NEXT_PUBLIC_APP_VERSION=0.1.0` | Gitignored override. Only used by unused installer-env fallback. Badge still uses BrandConfig |
| `site/.data/operations-audit.json` recorded `appVersion` | Historical ops row, gitignored |
| `site/lib/license-grant-durability-check.ts` fixture `appVersion` | Test input only. Not a public version. Grant logic untouched |
| `NEXT_PUBLIC_APP_VERSION` env key | Leftover installer-env path. Wrangler value already matches BrandConfig |

Do not “fix” those leftovers by inventing a second public number.

---

## What did not change

Checkout, Resend, license grants, Stripe, Organise, Sources, Host actions. No deploy.

---

## Tests

- `npm run test:brand-config`

---

## Impact on PRE-RC-TRACKS-001

Track 4 **VERSION-CONSISTENCY-001** is **CLOSED · PASS WITH FIXES**.

Close order from here:

```text
CHECKOUT-PRODUCTION-ENABLEMENT-001
+ RESEND-PRODUCTION-001
+ VERSION-CONSISTENCY-001
    ↓
small combined smoke
    ↓
FIRST-RUN-EXPERIENCE-001
    ↓
PRODUCTION-READINESS-001
    ↓
FIRST-IMPRESSION-TEST-001
```

Do not tag `0.1.0-rc1` from this close.
