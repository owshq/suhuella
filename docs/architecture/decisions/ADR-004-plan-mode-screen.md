# ADR-004 — Plan Mode screen

```text
STATUS = ACCEPTED
DATE = 2026-09-23
ACCEPTED = 2026-09-23
CLASS = Architecture
REOPENS = A new ADR only. This record accepted the visible rename and the local plan library.
SUPERSEDES = nothing
AMENDS ON ACCEPTANCE = Navigation Policy canonical name · Product Evolution Policy navigation line
PEERS = ADR-003 · Navigation Policy · Change Classification Policy · Product Evolution Policy
APPROVAL = Explicit human acceptance required. An agent must not set STATUS to ACCEPTED.
```

## Context

The product shell answers one question per screen. The fifth screen is **Organise**: “What should happen?” Navigation order and screen names are frozen.

```text
Landing → Home → Sources → Search → Organise → Activity → Settings
```

Sources: [PRODUCT-EVOLUTION-POLICY.md](../../../PRODUCT-EVOLUTION-POLICY.md), [NAVIGATION-POLICY.md](../../governance/NAVIGATION-POLICY.md).

The same screen already reviews a Plan and runs it only after **Confirm Plan**. Execution, route validation, and undo already exist (`knowledge-set.ts`, `apply_bulk_organisation`, `undo.ts`). The Plan lives in memory for the session. Workflows persist a reusable scope in `workflows.json` (desktop) and IndexedDB (browser). They are not a library of Plans.

Two product requests sit on that screen:

1. The visible name becomes **Plan Mode** (Spanish **Modo Plan**).
2. A person can start from a prompt, without selecting files first, and can save, list, edit, duplicate, delete, and run Plans on this device.

Change classification picks the higher-risk class when a change fits two. A frozen screen name is Architecture. A saved-plan library is a Feature. This ADR is **Architecture**. Feature work waits until this record is accepted. See [CHANGE-CLASSIFICATION-POLICY.md](../../governance/CHANGE-CLASSIFICATION-POLICY.md).

UX evidence for a navigation rename is multiple users or strong telemetry. That evidence is **not** in this record. Acceptance would be an explicit exception by the person who approves ADRs, not a claim that the evidence bar was met.

`delete_file` is `FORBIDDEN` in `desktop/electron/capabilities.ts`. Deleting a saved Plan deletes the record. It does not delete files. Trash for file removal is a later phase and is outside this ADR.

Remote sync, D1, and Durable Objects are outside this ADR.

## Decision

### 1. Visible name, stable identifiers

On acceptance, user-visible copy changes:

| Locale | Today | Accepted label |
| --- | --- | --- |
| en | Organise | Plan Mode |
| es | Organizar | Modo Plan |

The screen question stays **What should happen?**

These identifiers stay, so deep links, section routing, IPC, and checks do not move:

- Section id `organise`
- Route `/plan-mode` (`/organise` → permanent redirect)
- Capability id `apply_bulk_organisation`

Component files `OrganisePanel.tsx` and `PlanEditor.tsx` stay. They are extended. They are not rewritten.

Historical tracks, governance already accepted, and internal symbol names may keep the word Organise. The acceptance test is visible product copy, not a repository-wide string purge.

### 2. Prompt without a prior selection

The composer accepts a task when no documents are selected. Scope resolution uses the index and folders the user has already granted. If the task does not resolve to files, the screen asks the user to choose them. The composer does not call the executor.

### 3. Local plan library

A saved Plan is a local record: id, title, revision, timestamps, knowledge set, and plan items. Actions: save from `PlanEditor`, list, reopen in `PlanEditor`, duplicate, delete the record, run through the existing confirm path.

Persistence matches what the app already uses. No SQLite. No D1.

| Host | Store |
| --- | --- |
| Desktop | `{userData}/plans.json`, same log shape as `workflows.json` (`version`, `updatedAt`, `plans`) |
| Browser | IndexedDB store `plans`, beside `workflows` in `packages/product/src/host/browser/store.ts` |

The document type lives in the product package. Each host adapter writes it.

Empty-state copy in `organise-copy.ts` currently rejects the phrases “Save a plan” and “Saved plans” (`STALE_ORGANISE_EMPTY`). That guard changes only in the implementation that follows acceptance, and only for the library labels this ADR allows.

### 4. Execution contract untouched

Acceptance does not change the behaviour or the contract of:

- `apply_bulk_organisation`
- path and scope validation in the executor
- `desktop/electron/undo.ts` (30-day undo)
- `delete_file` remains `FORBIDDEN`

Run on a saved Plan calls the existing confirm-and-execute path. Delete on a saved Plan removes the JSON or IndexedDB record only.

How items run on disk and what the user sees while they run are **two independent axes**. See [ADR-005](./ADR-005-plan-execution-axes.md): filesystem uses direct API only; `background` vs `watch` is a text progress log, not cursor automation.

### 5. Out of scope

- Families `apps`, `system_settings`, `input`, `network_local`
- Screen recording
- D1, Durable Objects, queues, remote agents
- File delete, including Trash
- Renaming the section id

## Evidence

Not provided. Navigation Policy forbids this rename until the UX evidence bar is met, unless this ADR is explicitly accepted as an exception.

## Approval

Accepted on 2026-09-23 by the product owner as an explicit exception to the UX evidence bar. Navigation Policy and Product Evolution Policy carry the new screen name. The evidence bar was not met; this acceptance does not claim that it was.

## After acceptance — visible strings

Search used: `Organise|Organizar` in `*.{ts,tsx,mjs,json,md,mdc}`.

Change user-visible copy only. Leave the section id, the route, IPC, and the executor.

| Surface | File |
| --- | --- |
| Nav label en/es | `packages/product/src/lib/app-locale.ts` (`chrome.organise`) |
| Screen title and sidebar | `packages/product/src/lib/organise-copy.ts` |
| Browser empty and selection labels | `packages/product/src/lib/browser-organise-selection.ts` |
| Source actions “Organise this folder / these files” | `packages/product/src/lib/organise-sources-bridge.ts` |
| Marketing sentences | `site/lib/i18n/dictionary.ts` |
| Shell that renders `chrome.organise` | `packages/product/src/windows/SettingsWindow.tsx` |

Checks that assert the English word Organise on visible copy move with the labels. They are not a behaviour change of the executor. Principal files: `site/lib/plan-semantics-check.ts`, `site/lib/first-run-ux-check.ts`, `site/lib/first-launch-experience-check.ts`, `brands/brand-config-check.ts`.

Do not edit `undo.ts`, `desktop/electron/capabilities.ts`, or the executor contract as part of the rename.

## Consequences

- One screen keeps one question. The library and the composer are how a Plan is authored on that screen.
- Offline use and the Free plan stay intact. Nothing in this decision writes to Cloudflare.
- **Cost of acceptance:** every visible “Organise” / “Organizar” in the product shell and the marketing dictionary moves together, and the stale-copy guard that bans “Saved plans” is updated on purpose.
- **Cost of rejection:** the screen name and the in-memory Plan stay as they are.

## Related

- [NAVIGATION-POLICY.md](../../governance/NAVIGATION-POLICY.md)
- [PRODUCT-EVOLUTION-POLICY.md](../../../PRODUCT-EVOLUTION-POLICY.md)
- [CHANGE-CLASSIFICATION-POLICY.md](../../governance/CHANGE-CLASSIFICATION-POLICY.md)
- [ADR-003](./ADR-003-brand-identity-hierarchy.md)
- [ADR-005 — Plan execution axes](./ADR-005-plan-execution-axes.md)
