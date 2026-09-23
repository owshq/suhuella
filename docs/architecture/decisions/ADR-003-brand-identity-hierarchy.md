# ADR-003 — Brand Identity Hierarchy

```text
STATUS = ACCEPTED · FROZEN · IMPLEMENTATION PHASE A CLOSED
DATE = 2026-09-19
REOPENS = New ADR only — never silent precedence changes · no refinements until real partner/business need
SUPERSEDES = BRANDING-HIERARCHY-001 (track alias retained for index)
PEERS = Commercial Authority Model · Release Architecture · BrandConfig
```

## Context

White-label products break when presentation identity is resolved ad hoc in components (`brand.logo`, `organisationLogo`, `if (businessLogo)`). SuHuella serves three runtime scenarios from one executable:

- SuHuella standard
- Partner-distributed build (partner `BrandConfig`)
- Business customer workspace (organisation overlay via licence)

Presentation must be configurable without recompiling. Commercial relationships (issuer, billing, seat holder) must not be conflated with what the user sees in the shell.

## Decision

### 1. Two concepts — never merge

```text
Commercial Identity     who owns the relationship (issuer, org, seat, plan)
        ↓  (orthogonal)
Effective Brand Identity   what the user sees (logo, wordmark, accent, URLs)
```

Example:

```text
Software layer     Partner: Acme
Business layer     Workspace: Coca-Cola Spain
Seat layer         User: John Smith
```

The user may see **Coca-Cola** in the workspace while the **licence** commercially belongs to another entity. UI components consume **Effective Brand Identity** only. Billing, entitlements, and issuer logic consume **Commercial Identity** only.

### 2. Per-field merge — business may override any subset

Business is not all-or-nothing. Each field resolves independently:

```text
field value =
  first non-null among [ Business override, Partner build, Product default ]
```

Example payload:

```json
{
  "identityVersion": 1,
  "logo": "data:image/png;base64,...",
  "accentColor": null,
  "supportEmail": null
}
```

Full example — business overrides logo and accent only:

```text
Business input
  logo            ✓
  accentColor     ✓
  wordmark        null
  supportEmail    null

Resolved
  logo            → Business
  accentColor     → Business
  wordmark        → Partner
  supportEmail    → Partner
  privacyUrl      → Product
```

**Never reverse global priority:** Partner build cannot override a business field that is set. Product default fills only unset fields.

```text
Business licence
        ↓
Partner build
        ↓
SuHuella / product default
```

### 3. Versioned contract

Every resolved identity includes:

```ts
identityVersion: 1
```

Future fields (`favicon`, `fonts`, `darkTheme`, `banner`, …) require **`identityVersion: 2`** and a new ADR. Clients ignore unknown fields; resolvers must emit the version they implement.

### 4. Field ownership (frozen)

Who may **supply** a layer for each field — avoids future ownership debates.

| Field | Owner layers (merge order) |
| --- | --- |
| `logo` | Business → Partner → Product |
| `wordmark` | Business → Partner → Product |
| `accentColor` | Business → Partner → Product |
| `onAccentColor` | Business → Partner → Product |
| `supportEmail` | Partner → Product |
| `helpUrl` | Partner → Product |
| `privacyUrl` | Product |
| `termsUrl` | Product |

Business cannot supply `privacyUrl` / `termsUrl` (product issuer remains legally accountable). Partner cannot override product legal minimums.

**Ownership rule (frozen):**

```text
Each field has exactly one owner.

If ownership changes, a new ADR is required.
```

Example: `supportEmail` cannot later come from Business “depending on plan” without ADR-00N. No conditional ownership in components or resolvers.

### 5. Single resolver — derived views (not parallel systems)

```text
CommercialIdentity          (orthogonal · licence / issuer / seat)
          │
          ▼
resolveEffectiveBrandIdentity()     ← one base resolver · per-field merge
          │
          ├─────────────────────────────┐
          ▼                             ▼
WorkspaceBrandView              ProductBrandView
useEffectiveBrandIdentity()     useProductBrandIdentity()
```

- **WorkspaceBrandView** — full merge including business overrides (sidebar, org chrome, identity card).
- **ProductBrandView** — same resolver with **empty business input** (About, version, attribution, legal). Not a second precedence engine.

```ts
// Same module — never duplicate merge logic
const workspace = resolveEffectiveBrandIdentity(businessOverrides)
const product = resolveEffectiveBrandIdentity({})
```

Hooks expose views only. Components never call `resolve*` directly except inside the provider module.

### 6. Two surfaces — workspace vs product

| Surface | Identity consumed |
| --- | --- |
| **Workspace** | `EffectiveBrandIdentity` (full per-field merge) |
| **Product** | Product / partner build only — never business-alone |

Workspace: sidebar, header, organisation card, primary panels in org context.

Product: About, version, build, update authority, installer metadata, **“Powered by …”** attribution.

Business logo in workspace does **not** remove product attribution from About.

Example:

```text
Powered by SuHuella · v0.1.0-pre-rc
```

### 7. Consumer rule (literal)

> **Components never resolve branding directly.**

All UI consumes derived views:

```text
useEffectiveBrandIdentity()   // WorkspaceBrandView
useProductBrandIdentity()     // ProductBrandView — same resolver, no business input
```

Forbidden in components:

```ts
brand.logo
organisation.logo
if (businessLogo) { … }
```

Resolution lives in one module. New branded surfaces import the hook — they do not reimplement precedence.

### 7b. Presenter rules (frozen)

Presenters paint. Only the hook resolves.

```text
BrandMark never decides.

BrandWordmark never decides.

Only useEffectiveBrandIdentity() / useProductBrandIdentity() resolve identity.
```

```tsx
const identity = useEffectiveBrandIdentity()

<BrandMark identity={identity} />
<BrandWordmark identity={identity} />
```

- `BrandMark` / `BrandWordmark` receive `EffectiveBrandIdentity` — they do **not** call the hook, read `BrandConfig`, or read `organisationLogo`.
- Precedence (Business → Partner → Product) lives only in `resolveEffectiveBrandIdentity()`.
- New fields (`favicon`, `fontFamily`, …) extend the resolver and identity type — presenters stay dumb.

```text
PartnerProductMark — INTERNAL ONLY — never import from UI components.
```

Enforced by `brand-config-check`. Path: `desktop/src/lib/branding/PartnerProductMark.tsx`.

### 7c. Layer stack (frozen)

Every change must land in exactly one layer:

```text
UI Components
      │
      ▼
Identity Hooks          useEffectiveBrandIdentity() · useProductBrandIdentity()
      │
      ▼
Identity Resolvers      resolveEffectiveBrandIdentity() · deriveProductBrandView()
      │
      ▼
BrandConfig / CommercialIdentity
```

| Layer | May | Must not |
| --- | --- | --- |
| **UI components** | Call identity hooks; pass `identity` to presenters | Read `BrandConfig`; read `CommercialIdentity`; call resolvers |
| **Identity hooks** | Call resolvers; expose identity to React tree | Render UI |
| **Presenters** (`BrandMark`, `BrandWordmark`) | Paint `EffectiveBrandIdentity` fields | Decide precedence; call hooks |
| **Resolvers** | Per-field merge; version contract | Render UI |
| **Sources** | Supply raw config and licence data | Precedence logic in UI |

A new developer asks: *where does this change go?* — follow the stack downward until the layer matches.

### 8. Stability rules

Forward compatibility for `identityVersion` and future fields:

```text
Consumers must ignore unknown fields.

Resolvers must preserve unknown fields when passing through layers.

Identity versions are additive.

Existing fields must never change semantics.
```

Version 2 may add `favicon`, `fonts`, `shellTheme`, `illustrationStyle`. Version 1 clients ignore them. Version 1 field meanings are immutable.

### 9. Security

- Workspace `logo`: data URLs only (`image/png`, `image/jpeg`, `image/webp`) — no remote `https://` in client overlay.
- URLs (`helpUrl`, …): HTTPS allowlist or platform-hosted when implemented — same ADR gate.

## Types (contract)

```ts
/** Who owns the commercial relationship — not for shell rendering. */
type CommercialIdentity = {
  issuerOperatorId: string
  organisationId: string | null
  organisationName: string | null
  seatHolderLabel: string | null
  edition: string
}

/** Partial runtime overlay — null field means “do not override”. */
type BusinessBrandOverrides = {
  identityVersion?: 1
  logo?: string | null
  wordmark?: string | null
  accentColor?: string | null
  onAccentColor?: string | null
  supportEmail?: string | null
  helpUrl?: string | null
}

type EffectiveBrandIdentity = {
  identityVersion: 1
  logo: string | null
  wordmark: string
  accentColor: string
  onAccentColor: string
  supportEmail: string | null
  helpUrl: string | null
  privacyUrl: string | null
  termsUrl: string | null
}
```

Phase A implementation exposes **`logo`**, **`wordmark`**, **`accentColor`**, **`onAccentColor`** only. Other fields resolve to product defaults and are ready for licence/config without API breaks.

## Implementation (Phase A)

| Module | Role |
| --- | --- |
| `resolveEffectiveBrandIdentity()` | **Single base resolver** — all views derive from here |
| `deriveProductBrandView()` | `resolveEffectiveBrandIdentity({})` — no business layer |
| `AppBrandingProvider` | Injects business overrides; exposes workspace + product views |
| `useEffectiveBrandIdentity()` | WorkspaceBrandView hook |
| `useProductBrandIdentity()` | ProductBrandView hook — not a parallel resolver |
| `BrandMark` | Paints `identity.logo` — **never resolves** |
| `BrandWordmark` | Paints `identity.wordmark` — **never resolves** |
| `PartnerProductMark` | Build glyph when `identity.logo` unset — **internal; BrandMark only** |
| `EffectiveBrandMark` | Deprecated convenience wrapper |

```text
CommercialIdentity
        │
        ▼
useEffectiveBrandIdentity() / useProductBrandIdentity()
        │
        ▼
EffectiveBrandIdentity
        │
        ├── BrandMark
        └── BrandWordmark
```

**Implementation status: DEFINITIVELY FROZEN (Phase A).** Do not refine branding architecture until a real partner or business customer requires new `EffectiveBrandIdentity` fields. Until then: user sessions and private beta — not branding polish.

Configuration changes (licence / org settings) update identity without rebuild.

## Consequences

- One executable, three presentation scenarios, no component-level precedence forks.
- Commercial and presentation evolution decouple cleanly.
- Adding fields is versioned and ADR-gated.
- **Cost:** all new branded UI must use the hook; legacy direct `brand.*` reads are tech debt to remove when touched.

## Related

- [commercial-authority-model.md](../product/commercial-authority-model.md)
- [brand-config.md](../product/brand-config.md)
- [release-architecture.md](../constitution/release-architecture.md)
- [BRANDING-HIERARCHY-001.md](../../../BRANDING-HIERARCHY-001.md) — index alias
