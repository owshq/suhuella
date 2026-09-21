# SOURCE-DOMAIN-MODEL-001

```text
STATUS = FROZEN · CORE
TYPE = Domain contract
SCOPE = Source identity, handle, health, lifecycle, presentation
DATE = 2026-09-19
CLOSED = 2026-09-19
```

**Further modifications require an ADR.**

Future work must happen through **adapters**, **bridges**, and **projections** — not by changing the Source Domain.

This is the canonical Source contract. It sits at the same level as Release, Commercial Authority, Branding, and Navigation.

```text
ADR / Domain Contract
        │
        ▼
SOURCE-DOMAIN-MODEL-001
        │
        ├── Identity
        ├── Handle
        ├── Health
        ├── Lifecycle
        ├── Capabilities
        ├── Actions
        └── Presentation
                │
                ▼
        SourcePresentation
                │
                ▼
        React
```

Growth direction (do not open another Sources ADR): [SOURCE-DOMAIN-EVOLUTION-001.md](tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md)

Implementation:

- Identity: `packages/product/src/lib/source-identity.ts`
- Handle: `packages/product/src/lib/source-handle.ts`
- Health: `packages/product/src/lib/source-health.ts`
- Lifecycle: `packages/product/src/lib/source-lifecycle.ts`
- Actions: `packages/product/src/lib/source-actions.ts`
- Capabilities: `packages/product/src/lib/source-capabilities.ts`
- Host access: `packages/product/src/lib/platform-capabilities.ts`
- Presentation: `packages/product/src/lib/source-presentation.ts`
- Host-status adapter: `packages/product/src/lib/source-host-vocabulary.ts`
- Handle → lifecycle bridge: `packages/product/src/host/handle-lifecycle-bridge.ts`
- Browser projection: `packages/product/src/host/browser/source-adapter.ts`
- UI guard: `.cursor/rules/source-domain-guard.mdc`
- Migration: [SOURCE-DOMAIN-MIGRATION-001.md](SOURCE-DOMAIN-MIGRATION-001.md)

---

## Frozen layers

| Layer | Module | Status |
| --- | --- | --- |
| Source Identity | `source-identity.ts` | FROZEN |
| Source Handle | `source-handle.ts` | FROZEN |
| Source Health | `source-health.ts` | FROZEN |
| Source Lifecycle | `source-lifecycle.ts` | FROZEN |
| Source Capabilities | `source-capabilities.ts` | FROZEN |
| Source Actions | `source-actions.ts` | FROZEN |
| Source Presentation | `source-presentation.ts` | FROZEN |
| Host Bridge | `handle-lifecycle-bridge.ts` | FROZEN |
| Browser Factory | `browser/source-adapter.ts` | FROZEN |

Next work: Electron, Google Drive, OneDrive, Dropbox, iOS, and Android **adapters**. If an adapter forces a domain change, that adapter found a real gap — fix it with an ADR, not by editing types in passing.

---

## Frozen rules

```text
Source is identity.
Handle is access.
Presentation is derived.
The UI never decides.
```

```text
Source IDs are immutable.
Handle is mutable.
Presentation is derived.
UI is dumb.
```

```text
A Source is never removed automatically.
SuHuella only changes its state.
Only the user removes a Source.
```

```text
Source does not know the UI.
Domain speaks action IDs.
Presentation never receives Source, Handle, or Health.
React receives SourcePresentation only.
```

---

## Identity

```text
Source IDs are immutable.

Renaming, reconnecting or relocating a Source
does not create a new Source.

Only Remove destroys the identity.
```

Example:

```text
Facturas 2026
        │
        ▼
folder moved
        │
        ▼
Locate again
        │
        ▼
Facturas 2026   (same Source ID)
```

Activity, Search, Plans and analytics keep continuity.

---

## Handle

Two concepts. Do not merge them.

```text
Source                          Handle
────────                        ──────
identity                        current permission
history                         current filesystem access
documents                       OS grant / picker result
health
activity
```

The Handle can change. The Source cannot (except Remove).

`adapterId` is an open string. The domain does not enumerate Browser, Desktop, Mobile, or cloud providers. An adapter binds a Handle. It does not extend this type.

Every Handle carries `contractVersion: 1`. Bump it only with an ADR so adapters from three years ago can still be recognised.

This supports folder moves, external drives, and future cloud connectors without breaking identity.

---

## Source projection (adapter factory)

Each host implements one `project*Source()` function. That is the authorised factory from persisted storage into the domain:

```text
Browser store          projectBrowserSource()       Domain
─────────────          ──────────────────────       ──────
WebKnowledgeSource  →  Source                       identity
                       Handle                       access + contractVersion
                       Health                       observations
                       status                       lifecycle token
                             │
                             ▼
                       buildSourcePresentation()
                             │
                             ▼
                       React (SourcePresentation only)
```

Future: `projectElectronSource()`, `projectGoogleDriveSource()`, `projectIOSSource()`.

They must not mint a new Source id on reconnect. They must not persist `SourcePresentation`.

---

## Lifecycle

Lifecycle is a chapter of this model, not the top-level contract.

Canonical statuses:

```text
indexed
indexing
permission_required
missing
unavailable
error
```

Activity records **transitions** (`old state → new state`), not repeated probes on the same state.

Record tokens:

```text
source_connected
permission_lost
permission_restored
source_unavailable
source_reconnected
source_removed   (user action only)
```

Do **not** record:

```text
Still unavailable
indexing → indexed   (normal scan completion)
```

See [SOURCE-LIFECYCLE-MODEL-001.md](SOURCE-LIFECYCLE-MODEL-001.md) for the lifecycle chapter.

---

## Health

| Field | Meaning |
| --- | --- |
| **lastIndexedAt** | When the last index finished |
| **lastCheckedAt** | When SuHuella last verified the source is still reachable |
| **lastStateChangeAt** | When `status` last changed |

`availabilityReason` is internal. It drives presentation tokens. React never reads it.

```text
disk_offline
permission_revoked
folder_deleted
folder_moved
scan_failed
unknown
```

---

## Capabilities

Domain answers “what can this Source do?” so UI never inspects status.

```text
searchable
openable
organisable
removable
reconnectable
refreshable
watchable
```

Organise reads `capabilities.organisable`. Search reads `capabilities.openable`.
Documents stay searchable when the Handle is missing.

Host access (`connectGrant`, `directoryCatalog`, `folderWatching`, …) is declared by the host. Feature code never asks `host === 'browser'` or inspects a handle type. See [SOURCE-PLATFORM-READINESS-001.md](SOURCE-PLATFORM-READINESS-001.md).

---

## Actions

Domain recommends an action ID. It never speaks a button label.

```text
restore_permission
locate_folder
retry
remove
none
```

```text
Domain                      Presentation                 Client
──────                      ────────────                 ──────
retry                       action id                    label + icon
                            SourcePresentation           Retry / RotateCw
                                                         (desktop, mobile, CLI, API)
```

Do **not** store `"Retry"` on Source, Health, or Lifecycle.

---

## Presentation

`buildSourcePresentation()` is the only allowed path from domain to React.

```ts
SourcePresentation {
  summary   // Facturas 2026 · 147 documents · Last updated yesterday
  status    // kind + sight label + accessibility
  actions   // restore_permission | remove | retry | …
}
```

React never receives:

```ts
Source
Handle
SourceHealth
```

React only receives:

```ts
SourcePresentation
```

**Presentation is ephemeral. It is never persisted** — not in IndexedDB, not on disk, not in Activity. Hosts may attach it to a host summary for the current render only.

The UI translates `actions` into buttons. Presentation may include locale copy for summary and status. Domain does not.

---

## Consumers

| Screen | Uses |
| --- | --- |
| Sources | `SourcePresentation` only |
| Search | presentation helpers (`sourceSearchUnavailableLine`, `sourceOpenBlockedCopy`) |
| Organise | `capabilities.organisable` + blocked copy — no Plan UI in Sources |
| Activity | transition tokens; presentation resolves titles |
| Home | **debt:** still reads host `location.status` for the learning line — future: Presentation only |
| Host/store | Source, Handle, Health, Lifecycle — never render those types |

---

## Tests

```bash
npm run test:source-domain --prefix site
npm run test:source-platform-readiness --prefix site
npm run test:browser-sources-brand-flow --prefix site
```

---

## Technical debt (visible, not frozen)

```text
Future: Home should consume Presentation only.
```

Home still reads host `location.status` for the learning line. Do not reopen the domain for this — fix when Home is touched next.

---

## Post-freeze discipline

Until SOURCE-DOMAIN-MODEL-001 closed, work followed:

```text
Architecture
    ↓
Contracts
    ↓
Infrastructure
```

From here on, work follows:

```text
Adapter
    ↓
Integration
    ↓
Product
    ↓
User
```

No new Sources architecture tracks. Open as many **adapter** tracks as needed. Each adapter is the same pipeline:

```text
Provider
    ↓
Handle
    ↓
Registry
    ↓
Bridge
    ↓
Presentation
    ↓
React
```

The domain does not change. Only the provider implementation does.

---

## Frozen internal API

Treat these as a **public internal API**. Consumers are adapters, bridges, and host projections — not React.

| Piece | Module |
| --- | --- |
| Source | `source-identity.ts` |
| SourceId | `source-identity.ts` |
| Handle | `source-handle.ts` |
| Lifecycle | `source-lifecycle.ts` |
| Health | `source-health.ts` |
| Capabilities | `source-capabilities.ts` |
| Actions | `source-actions.ts` |
| Presentation | `source-presentation.ts` |
| Registry | `host/source-handles.ts` |
| Bridge | `host/handle-lifecycle-bridge.ts` |
| Contract version | `SOURCE_HANDLE_DOMAIN_CONTRACT_VERSION` |

If a future adapter needs to change any of these, follow [Architecture Validation Rule](#architecture-validation-rule) below — not the reverse.

**Before any domain edit, ask:**

```text
Does this belong to the domain?

or

Does this belong to the adapter?
```

Most adapter friction belongs in the adapter.

---

## What may evolve (adapter tracks)

These tracks are expected to multiply. They do **not** reopen the domain:

```text
Electron Adapter          (reference · CLOSED · PASS)
Google Drive Adapter
Dropbox Adapter
OneDrive Adapter
iOS Adapter
Android Adapter
NAS Adapter
```

Each implements `project*Source()` and a Handle factory. None edits Source, Handle shape, Lifecycle, Health, Capabilities, or Presentation.

---

## Architecture Validation Rule

A frozen architecture is considered **successful** only when multiple independent implementations reuse it without modification.

A frozen model is not validated when it is designed. It is validated when **independent providers integrate without changing the domain**.

This model is considered **validated** when at least three independent providers integrate without requiring changes to:

- Source
- Handle
- Lifecycle
- Health
- Capabilities
- Presentation

If an adapter requires changing the domain:

1. **Demonstrate the limitation** — show the integration that fails on the frozen contract.
2. **Show why it cannot be solved in the adapter** — prove the problem belongs to the domain, not the provider layer.
3. **Open an ADR.**
4. **Amend the Constitution** — deliberate contract update after ADR acceptance.
5. **Implement.**

### Validation bar

| Provider | Role | Status |
| --- | --- | --- |
| Browser | Web grant + `projectBrowserSource()` | **PASS** |
| Electron | Desktop path + Handle registry | **PASS** |
| Google Drive | First cloud provider on the same contract | **RESERVED** |

**Google Drive is the strongest proof.** It breaks local-filesystem assumptions: no local paths, different permissions, API-driven sync, files that may never download locally, changes that arrive by API rather than filesystem events. If the domain supports Google Drive without edits to Source, Handle, Lifecycle, Health, Capabilities, or Presentation, the abstraction is validated by a hard case — not only by Browser and Electron.

Until Google Drive passes, SOURCE-DOMAIN-MODEL-001 remains **FROZEN · CORE** but **validation-in-progress**.

### What to watch during adapter work

Resist the default reflex:

```text
"It does not fit → I will touch the domain."
```

Always ask first whether the gap belongs in the adapter. That question should resolve most decisions.

---

## Recommended roadmap (after this contract)

**Architecture is validated through shipped product and user evidence.** No new architecture until after Private Beta PASS — and after beta, only when observed evidence proves insufficiency.

User-behaviour scoreboard ([DECISION-PRECEDENCE.md](docs/governance/DECISION-PRECEDENCE.md#operational-scoreboard)):

```text
□ User downloads SuHuella
□ User installs it
□ User launches it
□ User understands what to do
□ User connects a folder
□ User finds a document
□ User completes a first successful session
```

Product path first, then cloud proof (Google Drive = hardest validation), then mobile:

```text
SOURCE-DOMAIN-MODEL-001     FROZEN · CORE
        ↓
Desktop Release Production  →  Download Experience  →  First Launch  →  Private Beta
        ↓
Google Drive Adapter  →  OneDrive  →  Dropbox
        ↓
iOS  →  Android
```

Success: a user downloads SuHuella, installs it, connects a folder, and finds a document without help. That validates the architecture by delivery — not by another contract on paper.

See [PRE-RC-TRACKS-001.md](PRE-RC-TRACKS-001.md) for track status. Precedence: [docs/governance/DECISION-PRECEDENCE.md](docs/governance/DECISION-PRECEDENCE.md).
