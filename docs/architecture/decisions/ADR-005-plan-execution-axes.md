# ADR-005 — Plan execution axes (how vs visibility)

```text
STATUS = ACCEPTED
DATE = 2026-09-23
PROPOSED = 2026-09-23
ACCEPTED = 2026-09-23
CLASS = Architecture
REOPENS = nothing
SUPERSEDES = nothing
AMENDS = ADR-004 §4 (execution contract — clarifies implementation, does not change scope)
PEERS = ADR-004 · Navigation Policy · Product Evolution Policy
APPROVAL = Explicit human acceptance required. An agent must not set STATUS to ACCEPTED.
```

## Context

[ADR-004](./ADR-004-plan-mode-screen.md) accepts Plan Mode and a local plan library. It states that execution, path validation, and undo stay untouched. It does not define how a confirmed Plan runs on disk or what the user sees while it runs.

After implementation, two independent concerns emerged in practice:

1. **How** the executor applies a confirmed Plan item (direct filesystem API vs any fallback).
2. **How much** the user sees while items run (background notification vs a live text log).

These must not be conflated. A future **input** family (Fase 5, outside ADR-004 scope) may need visible automation where no programmatic API exists. That possibility must not leak into **filesystem** execution today.

Verification (2026-09-23): background and watch use the same executor path. Watch only attaches progress callbacks; it does not add artificial delay or a second execution engine.

| Area | Evidence |
| --- | --- |
| Desktop executor | `desktop/electron/knowledge-set.ts` — `executeOrganisationPlan` / `executeOrganisationPlanInternal`; optional `onItemApplied` hook after each `applyConfirmedPlanItem` |
| Desktop IPC | `desktop/electron/main.ts` — `executionMode === 'watch'` sets `onItemApplied` → `knowledge-set:planProgress`; otherwise hooks omitted |
| Browser executor | `packages/product/src/host/install-browser-host.ts` — `executeGuardedPlan`; watch gates `onJournal` progress emission only |
| UI copy | `packages/product/src/lib/plan-execution-copy.ts` — watch hint: “same Plan, same executor” |
| Live log UI | `packages/product/src/components/PlanLiveLog.tsx` — text lines (origin → destination · result), not cursor animation |
| Pacing guard | `packages/product/src/lib/plan-execution-pacing-check.ts` — static scan of Plan executor sources; `npm run test:plan-execution-pacing --prefix site`; also in `test:plan-semantics` and desktop `check:knowledge-set` |

Cross-source integrity and browser write guards remain in `packages/product/src/host/browser/organise-integrity.ts`. That file governs *what* may run, not watch vs background.

## Decision

### 1. Two independent axes

| Axis | Who decides | `filesystem` today |
| --- | --- | --- |
| **Execution mechanism** | System (capability + host adapter) | Direct API always (`renameSync` / File System Access `move`). No simulated delay. |
| **User visibility** | User (`PlanExecutionMode`: `background` \| `watch`) | Same mechanism either way. Watch emits `PlanExecutionProgressEvent` for `PlanLiveLog`. |

Background and watch are **not** two executors. They differ only in whether progress events are surfaced during the run.

### 2. `filesystem` — direct API only

For the `filesystem` family (moves, renames, folder creation covered by ADR-004):

- Use the host’s programmatic path (desktop: Node `fs`; browser: granted handles + `moveOrRenameFile`).
- Do **not** introduce a third “visible cursor” mode for filesystem actions.
- Do **not** add artificial pacing so the user can “watch” slower execution — watch is a log, not a throttle.

### 3. Watch mode is a text progress log

Watch mode means:

- Per-item progress events after each item settles (`applied` / `skipped` / `failed`).
- `PlanLiveLog` renders plain text (`file → destination · result`).

Watch mode does **not** mean:

- Animated cursor or screen automation for filesystem items.
- A different validation, selection, or undo contract.

### 4. `input` family (Fase 5 — future, out of ADR-004 scope)

When the product adds the `input` capability family:

- Prefer programmatic integration where one exists.
- **Visible cursor / UI automation** may be offered **only** for `input` actions with no API, as a trust mechanism for irreversible or opaque UI steps.
- Cursor visibility must **not** replace direct execution for `filesystem`, cloud sync APIs, or any path that already has a programmatic vía.

This ADR does not authorise Fase 5 work. It reserves the design boundary so ADR-004’s filesystem executor stays closed.

## Approval

An agent briefly set this record to ACCEPTED citing its own code review. That was reverted to **PROPOSED** before human review.

Accepted on 2026-09-23 by the product owner. Source: explicit acceptance in product review — *“acepto el contenido de ADR-005 tal como está redactado”* — with no changes to the technical text. Implementation in code predates this record; acceptance closes the architecture decision only.

## Consequences

- Engineers may not re-open “does watch need cursor visible?” for filesystem Plans — the answer is no unless a new ADR explicitly extends `input`.
- Product copy should keep stating that watch shows the same execution with a live log (`plan-execution-copy.ts`).
- Adding artificial delays for watch would violate this record and should be rejected in review. `runPlanExecutionPacingChecks()` fails CI if executor sources introduce pacing primitives without an explicit `adr-005-pacing-allow` opt-out line.
- Fase 5 can cite this ADR when defining cursor-visible automation without revisiting ADR-004’s screen scope.

## Related

- [ADR-004 — Plan Mode screen](./ADR-004-plan-mode-screen.md)
- [NAVIGATION-POLICY.md](../../governance/NAVIGATION-POLICY.md)
- [PRODUCT-EVOLUTION-POLICY.md](../../../PRODUCT-EVOLUTION-POLICY.md)
