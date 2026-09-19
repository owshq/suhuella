# BRAND-THEME-TOKENS-001

```text
STATUS = CLOSED · PASS
TYPE = Brand theme tokens (Phase A)
SCOPE = BrandConfig + public shell (site + shared browser app)
DATE = 2026-09-19
```

## Objective

Partners must be able to change the interactive corporate color without editing components.

Phase A (this track): `theme` on `BrandConfig`, CSS variables at the shell root, public-shell hex migrated to tokens. Ops/Partner editors stay post-RC.

## Authority

| Token | Source | Use |
| --- | --- | --- |
| `theme.accent` | `BrandConfig` / `identity.json` | CTA, nav active, links |
| `theme.onAccent` | `BrandConfig` / `identity.json` | Text on accent |
| `pwa.themeColor` | existing | Manifest / browser chrome |
| `pwa.backgroundColor` | existing | Splash + landing surface |

Build-time only. `BRAND=suhuella` vs `BRAND=dbasenet` selects the package. No D1/Ops editor in this track.

## Brands

| Brand | accent | onAccent | surface |
| --- | --- | --- | --- |
| SuHuella | `#0084FF` | `#FFFFFF` | `#A7D8F9` |
| Dbasenet | `#0B5F63` | `#FFFFFF` | `#D7EEEA` |

Injected as `--brand-accent`, `--brand-accent-hover`, `--brand-accent-muted`, `--brand-on-accent`, `--brand-surface`, `--nav-active-bg`, `--nav-active-fg`, `--overlay-strong`.

## Public shell

Language toggle uses `--nav-active-bg` / `--nav-active-fg`. Overlay close stays viewport-fixed; language lives inside the scrollable island.

Landing CTAs, overlays, and browser-app chrome read tokens. Hardcoded `#0084FF` is gone from `site/components`.

## Frozen

Checkout remains off. Desktop remains out of RC. License, Resend, version authority unchanged.

Not in this track:

- `BRAND-THEME-DESKTOP-001` — remaining desktop-only chrome if any
- `BRAND-THEME-OPS-001` — Superadmin color editor
- `BRAND-THEME-PARTNER-001` — partner self-service

## Tests

- `npm run test:brand-theme`
- `npm run test:brand-config`
- `npm run test:app-modal-shell --prefix site`
- `npm run check:app-host --prefix site`

## Meaning

```text
Corporate color is BrandConfig.theme.accent.
SuHuella stays blue. Dbasenet paints teal without component edits.
```
