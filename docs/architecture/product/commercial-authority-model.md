# Commercial Authority Model

```text
STATUS = FROZEN · DESIGN AUDIT CLOSED · ACCEPTED
SLICE   = COMMERCIAL-AUTHORITY-MODEL-001
TYPE    = Architecture · no implementation
RC1     = Do not implement entitlements, Connect, or Partner Portal
```

This document freezes the long-term commercial authority model. Future licensing, Stripe, Resend, Partner, and Admin work must follow it. It does **not** authorize schema changes, Connect, or Partner runtime in RC1.

```text
Presentation Brand     what the customer sees at purchase and in product shell
        ↓
Commercial Operator    who owns the commercial relationship (issuer)
        ↓
License Authority      who signs and stores entitlement (Platform)
        ↓
Entitlements           where the license is valid (brands, surfaces, plans)
        ↓
Capabilities           what the product may do (existing LicenseContext)
```

```text
COMMERCIAL AUTHORITY  ≠  PRESENTATION BRAND
PAYMENT SETTLEMENT    ≠  LICENSE AUTHORITY
WEBHOOK               ≠  MONEY MOVEMENT
ISSUED BY             ≠  ACCEPTED BY
```

---

## Current state (RC1)

| Layer | Today |
|---|---|
| Commercial authority | SuHuella Platform (implicit) |
| License authority | SuHuella Platform (single `LICENSE_SIGNING_SECRET`, single grant store) |
| Stripe | One platform account |
| Resend | One platform account |
| Customer key | Email |
| Brand | Build-time presentation only (`BrandConfig`) |
| Operator | Reserved seam (`operatorId = "self"`) |

This is acceptable for RC1 and Private Beta.

---

## Answers to the audit questions

### 1. Can one license be valid for multiple presentation brands?

**Yes.** That is a product policy expressed through **entitlements**, not through duplicating Stripe or grant stores.

Example:

```text
acceptedBrands: [suhuella, dbasenet]
```

or a higher-level product:

```text
productId: platform_professional
surfaces: [desktop, web]
brands: [suhuella, dbasenet, partner_a]
```

### 2. Can a partner sell a license that also activates SuHuella?

**Yes, if the Platform authorizes it.** The partner may **sell** (commercial relationship) while the Platform **issues** (license authority). Validity is not “partner brand only” unless entitlements say so.

```text
issuedByOperator: partner_x
acceptedBrands:   [suhuella, dbasenet, partner_x_brand]
```

### 3. Can SuHuella sell a license that unlocks partner products?

**Yes, if entitlements include those brands.** Platform checkout can present any Presentation Brand while issuing a Platform license with a broad entitlement set.

### 4. Who owns customers, subscriptions, invoices, refunds, support, chargebacks?

Depends on **who collected payment**, not on who signed the license token.

| Phase | Who collects | Who owns end-customer commercial relationship |
|---|---|---|
| **RC1 / v1** | Platform Stripe | Platform |
| **Founding partner (reserved)** | Partner Stripe for their end-customers | Partner for those sales; Platform for Platform-sold |
| **Connect (future)** | Partner Stripe with application fee / split | Partner primary; Platform fee is settlement |

License **authorization** stays with the Platform in all phases above. Settlement can move without rewriting tokens.

### 5. Is Commercial Authority the same as Presentation Brand?

**No.** They must remain separate.

| Concept | Meaning | Example |
|---|---|---|
| **Presentation Brand** | UI, domain, appId, emails shown | User buys on `dbasenet.com`, sees Dbasenet |
| **Commercial Operator** | Who sold / owns the commercial relationship | `partner_x` or `platform` |
| **License Authority** | Who signs grants and tokens | Always Platform until explicitly delegated (not planned for RC) |
| **Entitlements** | Where the license works | `acceptedBrands`, surfaces, edition |

```text
User buys "Dbasenet"
Presentation     = Dbasenet
issuedByOperator = platform          (RC1)
                 = partner_x          (later, if partner sells)
License signed by = Platform
acceptedBrands   = [dbasenet]        (narrow)
                 = [suhuella, dbasenet]   (bundle)
```

### 6. Should licenses belong to Brand, Operator, Platform, Partner, or Customer?

| Owner | Role |
|---|---|
| **Customer** | Beneficiary (email / org seat) |
| **Platform** | License authority — signs, stores, revokes grants |
| **Commercial Operator** | Issuer metadata — who sold or owns the commercial relationship |
| **Presentation Brand** | Never owns the license |
| **Partner** | May own settlement and support for their sales; does not replace Platform as license authority in v1–v2 |

Do **not** make `brandId` the primary owner of a license.

### 7. Does Stripe Connect change the license model or only settlement?

**Only settlement** (and tax/KYC/payout plumbing). Connect must not force a new token shape or per-brand grant stores.

```text
LICENSE MODEL        stable
SETTLEMENT LAYER     Connect | separate accounts | platform-only
```

---

## Model comparison

### MODEL A — Brand owns licenses

Each Presentation Brand owns grants, Stripe, Resend, and activation scope (`brandId` required).

| | |
|---|---|
| **Advantages** | Hard isolation; easy to explain “this license is for Dbasenet only” |
| **Disadvantages** | Duplicates Stripe, D1, OTP, admin; blocks cross-brand bundles; partner→SuHuella activation awkward; highest migration cost |
| **Migration risk** | High — contradicts single core, single Worker, shared product |
| **Scalability** | Poor for platform + partner catalog |

**Verdict:** ❌ Not the platform direction.

### MODEL B — Operator owns licenses

Grants keyed by `operatorId`; Brands are children of Operators.

| | |
|---|---|
| **Advantages** | Matches org chart; natural for Partner as Operator |
| **Disadvantages** | Still conflates “who sold” with “where it works”; Platform-wide SKUs need extra rules |
| **Migration risk** | Medium |
| **Scalability** | Good for Partner isolation; weak for multi-brand entitlements |

**Verdict:** 🟡 Useful as **issuer** metadata, not as the sole license scope key.

### MODEL C — Platform owns licenses (recommended RC1 / v1)

Platform is license authority. One signing secret, one grant store (scoped by policy). Commercial metadata and entitlements describe issuer and validity.

| | |
|---|---|
| **Advantages** | Matches current code; lowest RC complexity; flexible bundles; partner can sell SuHuella-capable licenses; no Connect required |
| **Disadvantages** | Admin and support must filter by issuer/entitlements; requires explicit entitlement checks at activation |
| **Migration risk** | Low — historical grants default to `issuedByOperator: platform`, `acceptedBrands: [suhuella]` |
| **Scalability** | Best fit for 1 → N brands and 1 → N partners |

**Verdict:** ✅ **MVP / RC1 / v1 default.**

### MODEL D — Partner owns settlement, Platform owns authorization

Partner Stripe (or Connect) collects end-customer payment; Platform still issues and signs licenses. `issuedByOperator` records the partner; entitlements define product scope.

| | |
|---|---|
| **Advantages** | Partner keeps customer relationship and payouts; license model unchanged; Connect adds fee without new grant stores |
| **Disadvantages** | Connect: Express/Standard onboarding, KYC, webhooks per account, reconciliation |
| **Migration risk** | Low if Model C is already frozen |
| **Scalability** | Best long-term for revenue share **without** rewriting licensing |

**Verdict:** 🟡 **v2+ settlement layer** on top of Model C — not before real customers.

---

## Recommended architecture by phase

### RC / Private Beta (now)

```text
MODEL C — Platform single Stripe

Stripe          → Platform account only
Resend          → Platform account only
License store   → Platform (current D1 / business-store)
issuedBy        → platform (implicit)
acceptedBrands  → [suhuella] (implicit default for legacy grants)
Presentation    → SuHuella BrandConfig only in production
```

**Do not implement** entitlements fields yet. **Do not** open Dbasenet commerce, Partner checkout, or Connect.

### v1 — First paid production

```text
MODEL C + explicit entitlements (implementation slice later)

Add to grant / token (when implemented):
  issuedByOperator
  acceptedBrands | productId
  presentationBrandAtPurchase   (analytics only, not authority)

Activation rule:
  currentPresentationBrand ∈ acceptedBrands
  OR entitlement.product includes current surface
  → else FAIL CLOSED

Historical grants without fields:
  issuedByOperator = platform
  acceptedBrands   = [suhuella]
```

Dbasenet may **present** checkout only when Platform enables commerce for that brand; license remains Platform-issued.

### v2 — First real partner

```text
MODEL C authorization + MODEL D settlement (choose one path)

Path 1 — Founding partner (already reserved):
  Partner Stripe for end-customer products
  Platform Stripe for Partner License (€1,000/year)
  Platform still signs end-customer grants
  issuedByOperator = partner_x on partner-sold grants

Path 2 — Connect (later, optional):
  Same license fields
  Connect moves application fee / revenue share
  WEBHOOK ≠ SETTLEMENT authority
```

Partner Portal, Operator DB, and Connect remain **out of RC1**.

### Enterprise

```text
MODEL C + org seats (existing Business model)

Business license  ≠  Partner license  ≠  Platform catalog SKU
Organisation      → seats, branding overlay (unchanged)
issuedByOperator  → platform | partner_x
acceptedBrands    → contract-defined
Support / refunds → owning operator of the sale
```

---

## Stripe evaluation

| Option | License model impact | Settlement | RC1 |
|---|---|---|---|
| Single platform account | None — Model C | Platform collects all | ✅ |
| Multiple independent Stripe accounts | None if Platform still authorizes | Per-operator collection | 🟡 Founding partner path |
| Connect Standard | None | Partner primary, Platform fee | ❌ Later |
| Connect Express | None | Same, faster onboarding | ❌ Later |

**Rule:** Never tie license validity to `stripeAccountId`. Tie validity to **entitlements**. Tie refunds/chargebacks to **who collected payment**.

---

## License shape (recommended, not implemented)

Prefer **issuer + entitlements** over **`brandId` as owner**.

```text
LicenseGrant / LicenseContext (future)

  licenseId
  customerId
  email

  issuedByOperator      platform | self | partner_x
  acceptedBrands        [suhuella, dbasenet, ...]
  // OR
  productId             catalog_sku
  entitlements          [desktop, web, business_branding, ...]

  edition
  origin                stripe | gift | partner | ...
  status
  capabilities          (derived, unchanged)
  deviceLimit
  organisationId?       (Business)

  // NOT on Desktop token:
  stripeCustomerId
  invoiceId
  settlementAccountId
```

```text
FAIL CLOSED (activation)

  currentBrand ∉ acceptedBrands
      → never activate
      → never convert
      → never auto-migrate

  legacy grant without acceptedBrands
      → issuedByOperator = platform
      → acceptedBrands = [suhuella]
```

This replaces the earlier goal “buy Dbasenet ≠ activate SuHuella” with the correct goal:

```text
Each operator / product defines which brands a license may use.
Platform may authorize cross-brand licenses by policy.
```

---

## Resend evaluation

| Phase | Transport | Presentation |
|---|---|---|
| RC1 | Platform `RESEND_API_KEY` | `BrandConfig` subject / reply-to when brand owns mailboxes |
| Partner path | Partner `RESEND_API_KEY` for their transactional mail | Partner Brand templates |
| Platform OTP | Platform Resend always for Platform-issued recovery | Current brand display name |

OTP proves **email possession for a grant the Platform recognizes** — not “this mailbox belongs to this brand’s DNS”.

Categories: **license OTP** (platform), **billing** (collector’s account), **marketing** (brand or partner), **support** (owning operator).

---

## Admin evaluation

| Actor | Scope (future) |
|---|---|
| **SUPER_ADMIN** | All grants, all operators, Platform Partner License |
| **OPERATOR_ADMIN** (reserved) | Grants where `issuedByOperator = that operator` |
| **Business owner** | Seats and branding for their org only |

Actions (issue, revoke, gift, refund, suspend) follow **commercial ownership of the sale**:

- Platform-sold → Platform admin + Platform Stripe
- Partner-sold → Partner admin + Partner Stripe (refund on their account)

License **revocation** remains Platform authority (signing secret).

---

## Partners (without changing core licensing)

| Capability | Changes license model? |
|---|---|
| Partner Portal | No — UI over `issuedByOperator` |
| Partner Stripe checkout | No — sets issuer + settlement metadata |
| Partner branding | No — Presentation Brand only |
| Partner support | No — operational routing |
| Revenue share / Connect | No — settlement only |

Core product (Organise, Search, Sources, Plan, Activity, Desktop/Web hosts) unchanged.

---

## What not to do

- Do not implement `brandId` as the primary license owner
- Do not open Stripe Connect before customers
- Do not duplicate grant stores per brand
- Do not let Presentation Brand imply payment authority
- Do not conflate Partner License (right to operate) with end-customer License
- Do not implement this document in RC1 — **RC-END-TO-END-INTEGRATION-001** first

---

## Supersedes

`MULTIBRAND-BRAND-SCOPED-COMMERCIAL-AUTHORITY-AUDIT-001` recommended `brandId` fail-closed. **This document supersedes that recommendation.**

Next implementation slice (when product is RC-ready):

```text
MULTIBRAND-PLATFORM-LICENSE-ENTITLEMENTS-001
  Model C fields only
  no Connect
  no Partner Portal
```

Until then: **Multibrand commercial work STOPs.** Product work continues.
