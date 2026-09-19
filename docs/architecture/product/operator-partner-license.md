# Operator Partner License

```text
STATUS = RESERVED · NOT IMPLEMENTED
FOUNDATION = BrandConfig
RUNTIME = future Operator slice
```

This document freezes the commercial model for a later Operator. It does not create Operator runtime, Superadmin onboarding, Stripe products, or a Partner Portal.

```text
CUSTOMER LICENSE
    Platform-authorized entitlement
    may be valid on one or many Presentation Brands (policy)

BUSINESS LICENSE
    business customer seat under one org (unchanged)

PARTNER LICENSE
    buys the right to operate a Brand on the platform

PARTNER LICENSE  !=  END-CUSTOMER LICENSE
LicenseOrigin "partner"  !=  Operator Partner License
COMMERCIAL AUTHORITY     !=  PRESENTATION BRAND
```

See [commercial-authority-model.md](commercial-authority-model.md). A partner-sold end-customer license may include SuHuella in `acceptedBrands` if the Platform authorizes it. Partner Stripe collects; Platform signs.

`LicenseOrigin "partner"` remains an end-customer grant origin (gifted/channel). It is not the Operator entitlement.

## Two Stripe worlds

```text
PLATFORM STRIPE                          PARTNER STRIPE
(our account)                            (their account)

Partner Platform License                 Brand Lifetime
€1,000 / year                            Brand Monthly
                                         Brand Business

optional later:
  Setup €500 one-time
  Additional Brand €300 / year
```

```text
PARTNER FEE
    = right to operate the platform

END-CUSTOMER REVENUE
    = belongs to the Partner

PLATFORM DOES NOT TAKE
    end-customer Stripe revenue

NO STRIPE CONNECT
```

Do not sell Partner License on public `/license` or Settings → License. Those surfaces remain Free / Lifetime / Monthly / Business.

## Launch offer

```text
FOUNDING PARTNER
€1,000 + VAT / year
Setup fee: waived
Includes: 1 Operator · 1 Brand · own domain
          Web + Desktop branded builds
          own Stripe · own Resend
          product updates · standard onboarding
```

Later commercial decision, not a runtime change:

```text
STANDARD PARTNER
€1,000 / year
+ €500 setup

ADDITIONAL BRAND
€300 / year / brand
```

No user-count metering. No price per end-customer.

## Future monetization · reserved · not implemented

```text
FUTURE MONETIZATION · RESERVED · NOT IMPLEMENTED

PARTNER PLATFORM REVENUE
    = FIXED PARTNER FEE
      + OPTIONAL FUTURE REVENUE SHARE

PARTNER LICENSE  !=  REVENUE SHARE
PARTNER STRIPE   !=  PLATFORM STRIPE
WEBHOOK          !=  MONEY MOVEMENT
WEBHOOK          !=  SETTLEMENT
WEBHOOK          !=  REVENUE AUTHORITY

Platform monetization of an Operator may combine:

    FIXED PARTNER FEE
        annual right to operate the Platform

    OPTIONAL VARIABLE PLATFORM FEE
        percentage or other commercial fee
        derived from end-customer transactions

For MVP:

    FIXED PARTNER FEE = €1,000 + VAT / year
    VARIABLE PLATFORM FEE = NONE

Future settlement may use Stripe Connect application fees
or another explicitly defined settlement mechanism:

    CONNECT_APPLICATION_FEE
    PERIODIC_INVOICE
    other explicitly defined settlement

STRIPE CONNECT = RESERVED · NOT OPENED

END-CUSTOMER LICENSE HISTORY
    remains independent from Partner subscription status.
```

Do not put `5%`, `revenueShareBps`, or settlement mode on `BrandConfig`. Those belong to a later `OperatorCommercialTerms` seam, not Brand identity.

Conceptual later shape only — no types, store, or API now:

```text
OperatorCommercialTerms
    annualPlatformFee
    revenueShareBps          // example only, not a committed rate
    revenueShareMode
        NONE
        | CONNECT_APPLICATION_FEE
        | PERIODIC_INVOICE
```

A webhook may later record `checkout.completed` / `invoice.paid`. It does not move the platform percentage. Independent Partner Stripe cannot withdraw an application fee; Connect or a periodic invoice would be an explicit later decision.

Possible later commercial variants (policy, not architecture):

```text
Partner          €1,000/year · 0% · own Stripe
Partner Plus     lower fixed fee + revenue share
Partner Enterprise  €X/year + lower share
```

## Provisioning order

```text
contract accepted
        +
Partner annual fee paid
        ↓
Superadmin creates operatorId + brandId
        ↓
technical onboarding
```

Do not deploy domain, Worker, Desktop identity, Stripe, or Resend for an unpaid Operator. Founding exceptions are commercial, not architecture.

Lifecycle (reserved names only):

```text
PROSPECT → AWAITING_PAYMENT → ONBOARDING → ACTIVE → PAST_DUE → SUSPENDED / TERMINATED
```

## Future Operator entitlement shape

Reserved. `operatorId` is not payment authority until this slice exists.

```text
Partner entitlement
    operatorId
    planId = partner_annual
    periodStart
    periodEnd
    status
    stripeCustomerId
    stripeSubscriptionId
```

Suggested Stripe product (platform account only):

```text
Product: Platform Partner License
Price:   €1,000 / year recurring
metadata.productType = operator_license
metadata.planId      = partner_annual
```

## Non-payment

```text
PARTNER SUBSCRIPTION STATUS
    !=
END-CUSTOMER LICENSE HISTORY
```

A failed Partner renewal must not immediately void Lifetime / Monthly / Business licenses already sold to that Brand's customers. Suspension policy for end-customers is a later explicit product decision. Grace of 14–30 days is the intended commercial default.

## Forbidden in this reservation

- Partner checkout on `/license` or Settings → License
- Mixing Partner prices into `commercialPlanCards`
- Using `STRIPE_LIFETIME_*` / `STRIPE_MONTHLY_*` for Partner License
- Stripe Connect
- Operator database, Partner Portal, DNS automation
- Inferring Operator ownership from `LicenseOrigin "partner"`
- Making BrandConfig or `operatorId` billing authority
