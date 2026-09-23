# Decision precedence

```text
STATUS = PERMANENT RULE
EFFECTIVE = 2026-09-19
```

When guidance conflicts, resolve in this order:

```text
User safety
        ↓
Constitution
        ↓
Architecture Decisions (ADR)
        ↓
Governance
        ↓
Implementation
        ↓
Tests
```

Tests validate implementation. They do not define architecture.

**When in doubt: prefer the higher layer.**

**The architecture is no longer the work. The product is the work.**

**Commercial code-signing is intentionally deferred** ([DECISION-PRIVATE-BETA-001.md](./DECISION-PRIVATE-BETA-001.md)). Do not treat missing Apple Developer ID or Authenticode as a technical bug. The release pipeline is **implemented**; only trusted commercial distribution is deferred. Private Beta remains BLOCKED until the decision is superseded.

**Primary metric:** Can a first-time user obtain a useful result without assistance?

---

## Before starting work

Ask this before any task, track, or PR:

```text
Does this make the next user session more successful?
```

**Yes** → do it.

**No** → it probably does not belong in the current sprint.

Do not reopen architecture weeks because a solution looks more elegant.

---

## Rules

**Implementation never overrides the Constitution.**

**Behavioural or contractual changes** to the Constitution require an **ADR first** — then a deliberate constitution amendment. Not a code comment, not a track, not a quick fix in a PR.

**Editorial clarifications** that do not change behaviour or contracts may update the Constitution directly (better definitions, corrected examples, fixed links, clearer wording). No ADR.

**During Private Beta:** do not open new constitutional documents unless a **real observed problem** proves an existing contract is insufficient.

**Do not open `*-002` tracks** for stable domains. Extend through adapters, UI, and narrow implementation slices.

---

## Where things live

| Layer | Location |
| --- | --- |
| Constitution | [docs/architecture/constitution/README.md](../architecture/constitution/README.md) |
| ADRs | [docs/architecture/decisions/](../architecture/decisions/) |
| Governance policies | [docs/governance/](README.md) |
| Roadmap & open work | [PRE-RC-TRACKS-001.md](../../PRE-RC-TRACKS-001.md) |

---

## Beta gate for new work

Every new track should answer **yes** to at least one:

- Does it make the product work better?
- Does it make the product easier to use?
- Does it fix an observed problem?

If the answer is no, do not open the track.

---

## Architecture Validation Rule

A frozen architecture is considered **successful** only when multiple independent implementations reuse it without modification.

For the Source domain, see [SOURCE-DOMAIN-MODEL-001.md](../../SOURCE-DOMAIN-MODEL-001.md#architecture-validation-rule). Minimum bar: Browser ✓ · Electron ✓ · Google Drive (cloud proof).

If an adapter appears to require changing the domain:

1. **Demonstrate the limitation** — show the integration that fails on the frozen contract.
2. **Show why it cannot be solved in the adapter** — prove the problem belongs to the domain, not the provider layer.
3. **Open an ADR.**
4. **Amend the Constitution** — deliberate contract update after ADR acceptance.
5. **Implement.**

Not the reverse. Not “it does not fit, so I will touch the domain.”

**Default question before any domain edit:**

```text
Does this belong to the domain?

or

Does this belong to the adapter?
```

That question should resolve most decisions during adapter work.

---

## Architecture is validated through shipped product and user evidence

Architecture is no longer the entry point. It is a **testable hypothesis** — validated only when a shipped product and user evidence prove it.

```text
Constitution
        ↓
Implementation
        ↓
User
        ↓
Evidence
        ↓
Architecture (only if required)
```

The project moved from **designing a system** to **building a product**. The daily question changed:

| Before | Now |
| --- | --- |
| Can we make this architecture more elegant? | What prevents a user from using SuHuella successfully tomorrow? |

While the second question guides decisions, the product moves faster with less rework. When a real limit appears (Google Drive, iOS, a beta observation), return to the Constitution via an ADR. Until then, the best validation is architecture that **passes unnoticed for the user**.

---

## User evidence drives priority

Do not build because something “fits the design.” Build because user evidence says it matters.

**No new architecture work until after Private Beta PASS.** After beta:

```text
No new architecture because it feels cleaner.

Only because observed evidence proves
the current architecture is insufficient.
```

“I do not like this adapter” is not a reason. “Three users cannot do X because the domain prevents it” is.

If a problem appears during delivery, apply [Architecture Validation Rule](#architecture-validation-rule).

---

## Priority backlog and bug classification (until Private Beta PASS)

Classify bugs and backlog items the same way — not as Architecture / Infrastructure / Implementation:

```text
Critical   User cannot continue.
High       User is confused.
Medium     User notices friction.
Low        Developer inconvenience.
```

The fourth category practically disappears until beta ends.

---

## Private Beta entry

Do **not** open Private Beta when all tests pass.

Open it when the team can answer **yes** to one question:

> **Would we be comfortable watching someone who has never seen SuHuella complete their first session without our help?**

If the answer is still **no**, product work remains. If **yes** — even with cosmetic defects — it is time for real user evidence.

**Desktop Private Beta requires macOS + Windows user-launchable.** Gate 6 (Trusted Install) is platform-specific. While `commercial-signing.json` status is `deferred`, Gate 6 is **DEFERRED** — not FAIL. Private Beta PASS only when every **advertised** platform passes Gate 6 after signing is enabled. Product implementation (first useful session locally) continues independently of Gate 6/7 deferral.

---

## Operational scoreboard

Progress is no longer:

```text
□ Contract closed
□ ADR approved
□ Domain frozen
□ Test PASS
```

Progress is:

Measure **user behaviours**. Private Beta judges whether someone can use SuHuella — not whether the architecture reads well.

```text
□ User downloads SuHuella          ← release / download
□ User installs it                   ← release / download
□ User launches it                   ← first launch
□ User understands what to do        ← product
□ User connects a folder             ← product
□ User finds a document                        ← product
□ User completes a first successful session    ← product · Private Beta exit
```

The first three depend on release infrastructure. The last four depend on product clarity. When those boxes are checked, architecture is validated through shipped product and user evidence — not by staying on paper.

**After Private Beta:** retention (e.g. user comes back the next day) is a product metric — not required to exit the first beta.

Supporting tracks (not the scoreboard): [DESKTOP-RELEASE-PRODUCTION-001.md](../../DESKTOP-RELEASE-PRODUCTION-001.md) · [DOWNLOAD-EXPERIENCE-001.md](../../DOWNLOAD-EXPERIENCE-001.md) · [FIRST-LAUNCH-EXPERIENCE-001.md](../../FIRST-LAUNCH-EXPERIENCE-001.md) · [PRIVATE-BETA-001.md](../../PRIVATE-BETA-001.md).

Active delivery flow (all energy here until Private Beta PASS):

```text
Desktop Release → Download → Install → First Launch → Connect Folder → Search → External User Feedback
```

---

## Release and publication incidents

Release pipeline architecture is **closed** ([RELEASE-PUBLISH-PIPELINE-001.md](../../RELEASE-PUBLISH-PIPELINE-001.md)).

When publication or download fails:

```text
User expectation
        ↓
Evidence (log, verify output, manual repro)
        ↓
Bug classification
        ↓
Implementation fix
```

Do not reopen the pipeline, change the contract, or start an ADR unless the failure requires a genuine architecture change (signing, auto-update, storage, channels).

Operational runs and execution logs: [DESKTOP-RELEASE-PRODUCTION-001.md](../../DESKTOP-RELEASE-PRODUCTION-001.md).
