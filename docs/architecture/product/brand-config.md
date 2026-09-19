# BrandConfig

```text
ONE REPOSITORY
      │
 SHARED CORE
      │
 build-time Brand
   /          \
SuHuella    Dbasenet
   │            │
 Web / Desktop  Web / Desktop
```

```text
Operator "self"
  ├── SuHuella     production
  └── Dbasenet     BUILD-PROVEN, NOT PRODUCTION-COMMERCE-ENABLED
```

Both Brands compile from the same product core. They do not share Desktop application identity, protocol, userData, installer artifacts, or customer-visible presentation assets.

## Proven topology

| Field | SuHuella | Dbasenet |
|---|---|---|
| `operatorId` | `self` | `self` |
| `brand.id` | `suhuella` | `dbasenet` |
| `displayName` | SuHuella | Dbasenet |
| `primaryDomain` | suhuella.com | dbasenet.com |
| `desktopProductName` | SuHuella | Dbasenet |
| `desktopAppId` | `com.suhuella.desktop` | `com.dbasenet.desktop` |
| `desktopProtocol` | `suhuella` | `dbasenet` |
| Commercial authority | current (unchanged) | **not enabled** |
| Deployment | production Worker `suhuella` | projected only (`dbasenet`, do not deploy) |

Canonical Brand files: `brands/<id>/brand.ts`. Desktop Vite/esbuild alias `@suhuella/brand` to `brands/<id>/entry.ts` for the selected `BRAND`, not the last `brands/.build/entry.ts` projection. Site/TypeScript still resolve the projected package entry after `project-site.mjs`. The catalog lives in `brands/resolve.ts` for Node/build tools only — product artifacts do not ship both Brands.

Import the selected Brand. Do not switch on hostname.

```ts
import { brand } from "@suhuella/brand";
```

## Build-time selection

`BRAND` selects the Brand at build/load time.

- Missing `BRAND` defaults to `suhuella` (developer compatibility).
- Unknown `BRAND` fails closed. It never silently becomes SuHuella.

```bash
BRAND=suhuella npm run build:site
BRAND=dbasenet npm run build:site
BRAND=unknown   # throws
```

Desktop packaging does not edit `desktop/package.json`. BrandConfig is projected to `desktop/.build/<brand>/electron-builder.json`.

Site public assets are projected from `brands/<id>/assets/public` before the site build. Sequential site projection is not parallel-safe for `site/public`; Desktop outputs are isolated under `desktop/.build/<brand>/`.

## What BrandConfig is

Public, non-secret product identity: name, domain, optional emails, logo/icon paths, desktop display name, app ID, protocol, PWA, download names, and future deployment/release pointers.

## What BrandConfig is not

Secrets and infrastructure stay in the deployment environment:

- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `LICENSE_SIGNING_SECRET`
- D1 / R2 / Cloudflare credentials

`RESEND_FROM` remains a deployment env var (`SuHuella <licenses@suhuella.com>`). BrandConfig holds the operational address map (`emails.*`) when the Brand owns mailboxes. Dbasenet `emails` is `null` until real mailboxes exist. See [suhuella-email-foundation.md](suhuella-email-foundation.md).

```text
INBOUND   Cloudflare Email Routing
OUTBOUND  Resend (Worker secret only)
ADDRESSES BrandConfig.emails
```

SuHuella mail infrastructure is scoped to suhuella.com only.

## Dbasenet is not commercially activatable

Dbasenet product identity is proven. Dbasenet commercial authority is **not** proven.

The current license schema has no `brandId`. Therefore:

```text
buy Dbasenet    must NOT yet be possible
```

Do not attach `dbasenet.com` DNS, deploy a Dbasenet Worker, configure Dbasenet Stripe/Resend, or publish Dbasenet installers.

```text
SECOND BRAND BUILD PROOF
        ≠
SECOND BRAND COMMERCIAL AUTHORITY
```

## Commercial authority · frozen · see commercial-authority-model.md

Presentation Brand (`BrandConfig`) is **not** commercial authority. See [commercial-authority-model.md](commercial-authority-model.md).

```text
RC1     Platform owns license authority (Model C)
        single Stripe · single Resend · email-keyed grants
        Brand = presentation only

Later   issuedByOperator + acceptedBrands / entitlements
        NOT brandId as primary license owner
        FAIL CLOSED when currentBrand ∉ acceptedBrands
        legacy grants without fields → platform / [suhuella]
```

`paidCheckoutEnabled=false` is a presentation/Payment-Link gate only. It is not entitlement authority.

## Frozen separations

```text
PLATFORM  ≠  OPERATOR  ≠  BRAND  ≠  BUSINESS CUSTOMER
HOSTNAME  ≠  BRAND AUTHORITY
BUILD / DEPLOY SELECTS BRAND
SUPERADMIN AUTHORITY  ≠  USER DOCUMENT ACCESS
LicenseOrigin "partner"  ≠  Operator
Business branding  ≠  Brand
CUSTOMER LICENSE  ≠  BUSINESS LICENSE  ≠  PARTNER LICENSE
PARTNER SUBSCRIPTION STATUS  ≠  END-CUSTOMER LICENSE HISTORY
PLATFORM STRIPE  ≠  PARTNER STRIPE
REGISTRAR ≠ DNS PROVIDER ≠ APPLICATION HOSTING
SUHUELLA LOCAL STATE ≠ DBASENET LOCAL STATE
```

Partner License (€1,000/year founding) is the future commercial entitlement that keeps an Operator active. It is not an end-customer plan. See [operator-partner-license.md](operator-partner-license.md).

Business customer logos overlay the selected Brand mark. They do not change `BrandConfig`. Fallback is the selected Brand logo, never a hardcoded SuHuella mark in a Dbasenet build.

Persistent technical names stay where they are internal compatibility, not customer identity: `window.suhuella`, `@suhuella/desktop`, IndexedDB `suhuella-web`, locale keys, service-worker cache names, Windows helper assembly `SuhuellaSaveWatcher`. Desktop **product** identity is Brand-scoped: appId, protocol, productName, userData.

## Reserved, not implemented

These names are future seams only. They have no runtime, tables, or APIs:

- `OperatorConfig`
- `CommercialConfig`
- `OperatorCommercialTerms`
- Partner entitlement (`partner_annual`)
- Brand-scoped license / Stripe / OTP authority

Deployment projection files (`brands/<id>/deployment.json`) describe public domain and Worker name only. They contain no secrets and do not create Cloudflare resources.

```text
BRAND CONFIG              identity / presentation
OPERATOR                  commercial operator (seam only)
PARTNER LICENSE           right to operate
OPERATOR COMMERCIAL TERMS how Platform earns from that Operator
STRIPE CONNECT            possible future settlement
```

```text
STRIPE CREDENTIAL         → Operator / deployment
END-CUSTOMER PRODUCTS     → Brand commercial offering
PARTNER PLATFORM FEE      → Platform ↔ Operator relationship
RESEND CREDENTIAL         → Operator / deployment
EMAIL PRESENTATION        → Brand
```

No Operator database. No Partner Portal. No Stripe Connect. No revenue-share runtime. No DNS automation. No Partner checkout on `/license`. No Dbasenet production commerce.

Illustrative later structure for other Operators, **not implemented**:

```text
Operator "partner-x"
  └── PartnerBrand
```

Adding a later Brand should be `brands/<id>/` plus catalog registration. It must not require copying Organise, Search, Sources, or license core UI. Do not add a third Brand until Platform license entitlements are implemented per [commercial-authority-model.md](commercial-authority-model.md).
