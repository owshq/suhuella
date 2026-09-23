# BRAND-PRESENTATION-AND-UNKNOWN-HOST-002

```text
STATUS = COMPLETE (code + tests · no deploy · no external changes)
TYPE = Brand presentation · unknown hostname UX · shell gating
SCOPE = presentation-brand · UnconfiguredHostnameScreen · shell · metadata
DEPENDS = HOSTNAME-RESOLUTION-001
```

## Problem

After hostname resolution was fixed, two presentation bugs remained:

1. **`toPublicRequestBrand`** exposed `"Unknown hostname"` as the app wordmark via `SuhuellaApp` business overrides.
2. **Non-active hosts** still mounted the full product shell (sidebar, download, dialogs) with neutral gray tokens — implying a usable product.

## Architecture (resolution vs presentation)

```text
resolveRequestBrandFromHeaders()     ← unchanged (HOSTNAME-RESOLUTION-001)
        ↓
toPresentationBrand()                ← UI-safe layer (this track)
        ↓
servesApp ? SuhuellaApp : UnconfiguredHostnameScreen
```

| Layer | Unknown host `displayName` | Purpose |
| --- | --- | --- |
| `toPublicRequestBrand` | `"Unknown hostname"` | Internal/API contract unchanged |
| `toPresentationBrand` | `""` + `servesApp: false` | Never a product wordmark |

## State → UI

| Resolution kind | `servesApp` | Shell | Wordmark / logo | Accent tokens |
| --- | --- | --- | --- | --- |
| `platform` | yes | `SuhuellaApp` | SuHuella from `BrandConfig` | `#0084FF` via `requestBrandCssVars` |
| `partner` (active) | yes | `SuhuellaApp` | Partner resolved values | Partner accent |
| `status` (pending/failed/…) | no | `UnconfiguredHostnameScreen` | none | Neutral slate CSS vars |
| `unknown` | no | `UnconfiguredHostnameScreen` | none | Neutral slate CSS vars |

Public visitor copy (`unconfiguredHostnameCopy`) has **no DNS, CNAME, or onboarding steps**. Configuration lives in private partner setup and Operations only.

## Routes

| URL | Host | Behaviour |
| --- | --- | --- |
| `/home`, `/sources`, … | platform / active partner | Product shell |
| `/home`, … | unknown | `UnconfiguredHostnameScreen` (shell gate) |
| `/hostname-status` | non-platform, non-active | Middleware rewrite target; visitor notice |
| `/partners` | platform only | Partner program discovery + apply |
| `/partners` | partner / unknown host | `UnconfiguredHostnameScreen` (no program on brand sites) |

Middleware rewrites non-active partner hostnames to `/hostname-status` (not `/partners/domain-status`).

## SuHuella accent (#0084FF)

Source of truth: `brands/suhuella/brand.ts` → `theme.accent` → `brandCssVars()` / `requestBrandCssVars(platform)`.

Shared product components use `var(--brand-accent)` only — no hardcoded `#0084FF` in `SuhuellaApp`.

## Files

| File | Role |
| --- | --- |
| `site/lib/partners/presentation-brand.ts` | `toPresentationBrand`, `presentationBrandSupportsAppShell` |
| `site/lib/partners/unconfigured-hostname-copy.ts` | Public visitor copy (EN/ES) |
| `site/components/web/UnconfiguredHostnameScreen.tsx` | Neutral screen |
| `site/lib/suhuella-shell.tsx` | Gates shell on `servesApp` |
| `site/components/web/SuhuellaApp.tsx` | Business overrides only when shell supported |
| `site/app/(suhuella)/hostname-status/page.tsx` | Visitor notice (middleware target) |
| `site/app/(suhuella)/partners/page.tsx` | Program page; platform host only |
| `site/app/layout.tsx` | Neutral metadata when `!servesApp` |
| `site/lib/brand-presentation-check.ts` | Automated checks |

## Captures

`docs/brand-presentation-captures/002/`:

| File | Scenario |
| --- | --- |
| `localhost-platform-home.png` | Platform host `/home` — SuHuella shell, sidebar, download |
| `localhost-platform-partners.png` | Platform host `/partners` — program discovery (not product shell) |
| `domain-status-unknown-localhost.png` | Prior fixture for neutral visitor screen |

**Limitation:** `localhost` always resolves as platform SuHuella. Simulating a true unknown host requires a custom FQDN in `/etc/hosts` (e.g. `unknown.local.test` → `127.0.0.1`). Automated checks cover unknown/pending presentation without browser FQDN.

## Tests

```bash
npm run test:brand-presentation --prefix site
npm run test:hostname-resolution --prefix site
npm run test:partners --prefix site
npm run test:brand-theme --prefix site
```

Local run (2026-09-23): all four PASS.

## Metadata (neutral hosts)

When `!requestBrandServesApp(requestBrand)` in `site/app/layout.tsx`:

- Title/description from `presentationPageTitle` / neutral copy (not SuHuella marketing)
- No `metadataBase` or `openGraph.url` (avoids suhuella.com on unknown hosts)
- `openGraph.siteName` and `twitter.title` use neutral title
- Icons: favicon only — no SuHuella apple-touch icon
- `robots: { index: false, follow: false }`

Assertions in `site/lib/brand-presentation-check.ts` read `layout.tsx` for these patterns.

## Out of scope (confirmed not done)

- No hostname resolution, header trust, or partner registration changes
- No deploy, DNS, D1 remote, Stripe, licenses, releases
- No SuHuella visual fallback on unknown domains
