# Governance

Constitutional documents for SuHuella. **Read before opening new tracks or changing product structure.**

Do not duplicate these as new “master” documents elsewhere.

---

## Policies (permanent)

| Document | Scope |
| --- | --- |
| [Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md) | Evidence-driven development · frozen vs evolving |
| [Change Classification Policy](CHANGE-CLASSIFICATION-POLICY.md) | Bug · UX · Feature · Infrastructure · Architecture |
| [Release Architecture](../../RELEASE-ARCHITECTURE-FROZEN.md) | `release.json` · `/api/release` · hosting invisibility |
| [Release Process (frozen)](RELEASE-PROCESS-FROZEN.md) | Develop → … → Public Release — no skipped phases |
| [Navigation Policy](NAVIGATION-POLICY.md) | Six-screen order · one question per screen |
| [Branding Hierarchy](../../BRANDING-HIERARCHY-001.md) | Brand · operator · effective identity |

---

## Architecture & product model

| Document | Scope |
| --- | --- |
| [BrandConfig](../architecture/product/brand-config.md) | Brand package · projection |
| [Commercial Authority](../architecture/product/commercial-authority-model.md) | License · checkout · authority |
| [Operator / Partner License](../architecture/product/operator-partner-license.md) | Partner model |
| [Email Foundation](../architecture/product/suhuella-email-foundation.md) | Operational mailboxes |

---

## Architectural decisions (ADRs)

| Document | Scope |
| --- | --- |
| [ADR index](../architecture/decisions/README.md) | How to write ADRs |
| [ADR-003 Brand identity hierarchy](../architecture/decisions/ADR-003-brand-identity-hierarchy.md) | `useEffectiveBrandIdentity()` |

New **Architecture**-class changes require a new ADR ([Change Classification Policy](CHANGE-CLASSIFICATION-POLICY.md)).

---

## Operations

| Document | Scope |
| --- | --- |
| [Operations access](../../OPERATIONS-ACCESS-CLOSEOUT-001.md) | `ops.suhuella.com` · Cloudflare Access |
| [Operations production activation](../../OPERATIONS-PRODUCTION-ACTIVATION-001.md) | Deploy · secrets · smoke |

---

## What is not here

- **Tracks** (`*-001.md` at repo root) — time-bound work items; close and archive.
- **Package READMEs** — `desktop/README.md` · `site/README.md` — build and deploy detail.

---

## Current priority (product)

Not more governance documents. Run:

```text
First Impression Session 1 → 2 → 3 → Summary → one slice (if needed) → Private Beta
```

See [FIRST-IMPRESSION-TEST-001.md](../../FIRST-IMPRESSION-TEST-001.md).
