# Governance

Policies and precedence for SuHuella. **Read before opening new tracks or changing product structure.**

Do not duplicate these as new “master” documents elsewhere.

**Constitution (permanent contracts):** [docs/architecture/constitution/README.md](../architecture/constitution/README.md) — daily work lives outside that folder.

---

## Precedence

| Document | Scope |
| --- | --- |
| [Decision precedence](DECISION-PRECEDENCE.md) | User safety → Constitution → ADR → Governance → Implementation → Tests |
| [DECISION-PRIVATE-BETA-001](DECISION-PRIVATE-BETA-001.md) | Pipeline IMPLEMENTED · commercial distribution deferred · Private Beta BLOCKED · primary metric = first useful session |

---

## Policies (permanent)

| Document | Scope |
| --- | --- |
| [Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md) | Evidence-driven development · frozen vs evolving |
| [Change Classification Policy](CHANGE-CLASSIFICATION-POLICY.md) | Bug · UX · Feature · Infrastructure · Architecture |
| [Contract Stability](CONTRACT-STABILITY.md) | Frozen domain / infra vs evolving adapters · UI · features |
| [Command taxonomy](../architecture/constitution/COMMAND-TAXONOMY.md) | `health` · `build` · `publish` · `smoke` |
| [Release Architecture](../architecture/constitution/release-architecture.md) | `release.json` · `/api/release` · hosting invisibility |
| [Health](../architecture/constitution/health.md) | Observation only · Build Health · never modifies |
| [Release Process (frozen)](RELEASE-PROCESS-FROZEN.md) | Develop → … → Public Release — no skipped phases |
| [Pre-RC release semantics](PRE-RC-RELEASE-SEMANTICS.md) | `pre-rc` may publish · signing blocks `rc1` / external beta only |
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

New **Architecture**-class changes require a new ADR ([Change Classification Policy](CHANGE-CLASSIFICATION-POLICY.md)). Constitution **behavioural or contractual** changes require ADR **first**; editorial clarifications do not ([Decision precedence](DECISION-PRECEDENCE.md)).

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

**Primary metric:** Can a first-time user obtain a useful result without assistance?

Roadmap (changes weekly): [PRE-RC-TRACKS-001.md](../../PRE-RC-TRACKS-001.md).

Stable architecture: [constitution/README.md](../architecture/constitution/README.md).
