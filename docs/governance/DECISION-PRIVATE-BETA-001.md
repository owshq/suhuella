# DECISION-PRIVATE-BETA-001 — Commercial distribution deferred

```text
STATUS = Accepted
EFFECTIVE = 2026-09-20
SUPERSEDE = Explicit decision only — set commercial-signing.json status to enabled
```

## Decision

Commercial distribution has been **intentionally deferred**.

SuHuella will continue developing without Apple Developer membership or Windows Authenticode.

The release pipeline remains **implemented and ready**. Only **trusted commercial distribution** is deferred.

Pre-RC artifacts may be built, uploaded, downloaded, and tested. Signing blocks promotion to `0.1.0-rc1` and external Private Beta. It does not block that pre-RC publication. See [Pre-RC release semantics](./PRE-RC-RELEASE-SEMANTICS.md).

No future task should reopen Developer ID, notarization, or Authenticode work unless this decision is **explicitly superseded**.

## Reason

The current objective is the **first useful session** — not commercial code-signing infrastructure.

Missing items are **external prerequisites**, not product blockers and not release-engineering bugs:

```text
Apple Developer Program     ~USD 99/year
Developer ID Application
Notarization credentials

Windows Authenticode        when external beta includes Windows
```

Agents must not treat absent certificates as a technical defect to fix in code.

## Primary metric

```text
Can a first-time user obtain a useful result
without assistance?
```

Every task must answer that question. See [Decision precedence](./DECISION-PRECEDENCE.md).

## Current objective — First useful session

```text
• understand product
• connect folder
• indexing
• search
• organise
• daily use
```

## Future objective (when superseded)

```text
Apple Developer
        ↓
Developer ID + notarization
        ↓
Windows Authenticode (if Mac + Windows beta)
        ↓
validate-release PASS
        ↓
Gate 6 Trusted Install
        ↓
Private Beta
```

## Private Beta

```text
STATUS = BLOCKED

Reason:
Missing commercial code-signing infrastructure.

Not a product blocker.
Not a release engineering blocker.
External prerequisite.
```

## Release validation behaviour

When commercial signing is deferred:

```text
npm run validate-release -- --platform mac|windows
        ↓
SKIPPED — commercial signing intentionally disabled
```

This is **not FAIL**. The team is not attempting a commercial Private Beta release.

Pre-RC publication is allowed. Promotion to `0.1.0-rc1` and external Private Beta stays blocked until status is `enabled` and validation PASSes.

Authority file: `brands/suhuella/commercial-signing.json`

```json
{
  "status": "deferred",
  "reason": "business decision",
  "reopenOnlyBy": "explicit human decision"
}
```

Agents must not change `status` without an explicit human decision to supersede this document.

## Related

- [PRIVATE-BETA-001.md](../../PRIVATE-BETA-001.md)
- [DESKTOP-RELEASE-PRODUCTION-001.md](../../DESKTOP-RELEASE-PRODUCTION-001.md)
- [DECISION-PRECEDENCE.md](./DECISION-PRECEDENCE.md)
