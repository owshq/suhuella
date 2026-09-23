# ADR-006 — Plan source candidates (never granted)

```text
STATUS = PROPOSED
DATE = 2026-09-23
PROPOSED = 2026-09-23
CLASS = Architecture
REOPENS = nothing
SUPERSEDES = nothing
AMENDS = ADR-004 §2 (composer scope — adds candidate resolution when search is empty or partial)
PEERS = ADR-004 · ADR-005 · Navigation Policy · SOURCE-LIFECYCLE-MODEL-001
APPROVAL = Explicit human acceptance required. An agent must not set STATUS to ACCEPTED.
```

## Context

[ADR-004](./ADR-004-plan-mode-screen.md) accepts Plan Mode with prompt-first scope via search over indexed metadata. Phase 1b added `source_unavailable` for sources that **were** indexed and later lost access (`sourceId` present, inline Reconnect / Grant access).

A third case exists: the user names a folder SuHuella can see on the host (via `getSuggestedLocations`) but has **never** indexed. There is no `sourceId` in the search corpus. The composer previously returned `PLAN_SCOPE_UNRESOLVED` with zero plan items.

Track C spike (2026-09-23) validated:

1. Desktop `getSuggestedLocations()` is the correct OS-side input (no prompt argument; returns `{ id, label, path, exists, kind }`).
2. Browser has no OS paths; grant uses well-known tokens (`suhuella:downloads`, etc.).
3. A distinct plan item shape works without touching the executor or `source_unavailable`.

## Decision

### 1. Two blocked-source states

| Status | Meaning | Has `sourceId` | Inline action |
| --- | --- | --- | --- |
| `source_unavailable` | Was indexed; access lost | Usually yes | Reconnect / Grant access (1b) |
| `source_needs_access` | Never indexed; host can suggest folder | No | Grant access to [label] |

Do not conflate these. Reconnect flows must not run without a prior source record.

### 2. Candidate item fields

When the composer identifies a never-granted source from the prompt:

- `status: 'source_needs_access'`
- `sourceName` — display label
- `candidateSourcePath` — OS path (desktop) or catalog token (browser)
- `candidateSourceGrantHint` — passed to `addIndexedLocation(hint)`
- `currentPath: 'candidate:{id}'` — synthetic; not executed
- `action: 'none'` — not confirmable

### 3. Resolution pipeline

`resolvePlanComposerScope` (in `plan-scope.ts`):

1. Search indexed corpus (`searchDocuments`) with existing token relaxation.
2. Match prompt aliases against `mergeSuggestedCatalog(host, suggested, wellKnown)`.
3. Drop candidates already indexed or already represented in search hits.
4. Outcomes:
   - **Search only** — normal preview.
   - **Candidates only** — preview with grant rows; no executor scope.
   - **Both** — merge candidate rows into preview (blocked) alongside file items.
   - **Neither** — `PLAN_SCOPE_UNRESOLVED`.
5. **Source × document AND:** when the prompt names both (e.g. “OneDrive invoices”) and the source is not indexed, scope stays empty — no invoices pulled from other folders. Document-type terms use shared `document-hints.ts` vocabulary (same stems as recommendations).

Prompt alias matching is explicit (longest phrase wins). No LLM inference in this layer.

### 4. Grant flow

Inline **Grant access** calls `addIndexedLocation(grantHint)`:

- **Browser:** `suhuella:*` token → File System Access picker (existing host).
- **Desktop:** hint resolves to OS path via `getSuggestedLocations` or direct absolute path; adds without picker when path exists. Falls back to folder picker when hint does not resolve.

After grant, the composer re-runs `resolvePlanComposerScope` for the same prompt.

### 5. Out of scope (this ADR) — tracked debt

- **Cloud OAuth** for OneDrive / Dropbox / Google Drive as remote accounts (`coming_later` in browser catalog). Local sync folder grant only today. Product copy: `PLAN_CLOUD_OAUTH_DEBT`.
- Arbitrary free-text folder names not in suggested / well-known catalog.
- Executor changes, `undo.ts`, or `delete_file`.
- Using candidate items in Activity runs (they are pre-scope only).

## Consequences

- Plan preview may show non-executable rows; Confirm Plan must ignore `source_needs_access` items (already non-confirmable).
- Desktop `addIndexedLocation` accepts an optional hint (aligned with browser API).
- Browser `getSuggestedLocations` returns the well-known catalog for composer matching.
- Full natural-language disambiguation (“Drive” → Google vs OneDrive) remains future work; alias list must grow deliberately.

## Verification

```bash
npm run test:plan-semantics --prefix site
npm run check:knowledge-set --prefix desktop
```

Contract checks: `runPlanSourceCandidateChecks`, `resolvePlanComposerScope` wired in `OrganisePanel`.

Manual (desktop): index Documents only; prompt `Move invoices from OneDrive`; expect grant row; grant; re-prepare returns searchable scope.
