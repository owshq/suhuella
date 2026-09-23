# Constitution

```text
STATUS = CONSTITUTION
PURPOSE = Permanent contracts — not daily work
```

**The Constitution defines the permanent rules of the product.**

**Everything else is implementation.**

**Frozen** describes a state. **Constitution** describes a purpose.

These documents define the **stable architecture** of the product. Implementation, tracks, and UI evolve on top — they do not replace the constitution.

> **During Private Beta:** do not open new constitutional documents unless a real observed problem proves an existing contract is insufficient.

Precedence: [Decision precedence](../../governance/DECISION-PRECEDENCE.md).

Current product roadmap: [PRE-RC-TRACKS-001.md](../../../PRE-RC-TRACKS-001.md) (not constitution — changes weekly).

---

## Permanent contracts

| Contract | Document |
| --- | --- |
| Command taxonomy | [COMMAND-TAXONOMY.md](./COMMAND-TAXONOMY.md) |
| Release architecture | [release-architecture.md](./release-architecture.md) |
| Brand identity | [BRANDING-HIERARCHY-001.md](../../../BRANDING-HIERARCHY-001.md) · [ADR-003](../decisions/ADR-003-brand-identity-hierarchy.md) |
| Source domain | [SOURCE-DOMAIN-MODEL-001.md](../../../SOURCE-DOMAIN-MODEL-001.md) |
| Commercial authority | [commercial-authority-model.md](../product/commercial-authority-model.md) |
| Health | [health.md](./health.md) |

Supporting references (same authority, detailed slices):

| Area | Document |
| --- | --- |
| Version authority | [VERSION-CONSISTENCY-001.md](../../../VERSION-CONSISTENCY-001.md) |
| Source lifecycle | [SOURCE-LIFECYCLE-MODEL-001.md](../../../SOURCE-LIFECYCLE-MODEL-001.md) |
| Source presentation | [SOURCE-DOMAIN-MODEL-001.md](../../../SOURCE-DOMAIN-MODEL-001.md) (presentation layer) |
| Handle registry / adapters | [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](../../../MULTI-PLATFORM-SOURCE-ADAPTERS-001.md) |
| Platform readiness | [SOURCE-PLATFORM-READINESS-001.md](../../../SOURCE-PLATFORM-READINESS-001.md) |
| Release pipeline | [RELEASE-PUBLISH-PIPELINE-001.md](../../../RELEASE-PUBLISH-PIPELINE-001.md) |

Build Health implementation: `scripts/build-health.mjs`.

---

## Stable domains

No `*-002` tracks for these domains unless a real problem proves the contract is insufficient:

```text
✓ Release
✓ Branding
✓ Health
✓ Source Domain
✓ Source Lifecycle
✓ Source Presentation
✓ Handle Registry
✓ Platform Readiness
✓ Adapter Contracts
✓ Command Taxonomy
```

**Behavioural or contractual changes** require an ADR first, then a deliberate constitution update.

**Editorial clarifications** (definitions, examples, links, wording that does not change behaviour or contracts) may update the Constitution directly — no ADR.

---

## Phase

```text
Before (risk: over-architecture):

Architecture → Contracts → Infrastructure

Now (inflection point):

Constitution
        ↓
Domain (FROZEN)
        ↓
Infrastructure (FROZEN)
        ↓
Adapters (EVOLVE)
        ↓
Product (EVOLVE)
        ↓
User evidence (DRIVES PRIORITY)
```

**The architecture is no longer the work. The product is the work.**

**Criterion now:** *User evidence drives priority.* **Architecture is validated through shipped product and user evidence.** Before any task: [Does this make the next user session more successful?](../../governance/DECISION-PRECEDENCE.md#before-starting-work)

Every decision has a clear place: Constitution → implementation → user → evidence → architecture (only if required).

Measure [user behaviours](../../governance/DECISION-PRECEDENCE.md#operational-scoreboard), not technical deliverables:

```text
□ User downloads SuHuella
□ User installs it
□ User launches it
□ User understands what to do
□ User connects a folder
□ User finds a document
□ User completes a first successful session
```

Retention (e.g. comes back the next day) is a post-beta product metric.

**No new architecture until after Private Beta PASS** — and after beta, only when **observed evidence** proves the current architecture is insufficient, not because a design feels cleaner. [Priority backlog](../../governance/DECISION-PRECEDENCE.md#priority-backlog-until-private-beta-pass): Critical → High → Medium → Low (developer preference waits).

Google Drive remains the hardest validation **after** beta — not the next sprint.

**Architecture Validation Rule** (Sources): [SOURCE-DOMAIN-MODEL-001.md](../../../SOURCE-DOMAIN-MODEL-001.md#architecture-validation-rule) — a frozen model succeeds only when independent implementations reuse it without modification.

Daily work lives **outside** this folder.
