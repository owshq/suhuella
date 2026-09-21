# SOURCE-DOMAIN-EVOLUTION-001

```text
STATUS = CLOSED · SUPERSEDED BY SOURCE-DOMAIN-MODEL-001 · FROZEN · CORE
TYPE = Domain evolution (historical)
SCOPE = Source domain only
DATE = 2026-09-19
CLOSED = 2026-09-19
```

No further Sources ADRs. Implement adapters only.

```text
OBJECTIVE

Stabilise the Source Domain Model so it becomes the
single contract for:

- Web
- Desktop
- iOS
- Android
- Cloud providers
- Future automation

No UX redesign.
No screen changes.
No release changes.
No branding changes.
No implementation shortcuts.

Everything must evolve on top of SOURCE-DOMAIN-MODEL-001
and SOURCE-LIFECYCLE-MODEL-001.
```

This is the last evolutionary contract on Sources. Later work implements Handles and adapters. It does not reopen the model.

---

## PRINCIPLES

Frozen:

```text
Source is identity.
Handle is access.
Presentation is derived.
UI never decides.
Source IDs are immutable.
Only Remove destroys identity.
```

```text
                Source
                   │
         ┌─────────┴─────────┐
         │                   │
      Handle             Lifecycle
         │                   │
         ├─────────┐         │
         │         │         │
      Health   Capabilities  │
         └─────────┬─────────┘
                   │
            SourcePresentation
                   │
        ┌──────────┼──────────┐
        │          │          │
      Web      Desktop      Mobile
```

---

## PHASE 1 — Domain stabilisation · IMPLEMENTED

No visible UI changes.

Explicit domain objects:

```text
Source
Handle
SourceHealth
SourceCapabilities
SourcePresentation
```

```text
Domain
    │
    ▼
SourcePresentation
    │
    ▼
React
```

React never receives Source, Handle, SourceHealth, or SourceLifecycle.

---

## PHASE 2 — Remove UI text from domain · IMPLEMENTED

Domain returns tokens only.

```text
recommendedAction   restore_permission | locate_folder | retry | remove | none
transition          source_connected | permission_lost | permission_restored | …
```

Presentation resolves copy, icon, button label, accessibility text.

`packages/product/src/lib/source-lifecycle.ts` has no visible English.
`packages/product/src/lib/source-presentation.ts` owns copy.

---

## PHASE 3 — Capability Model · IMPLEMENTED

```ts
capabilities {
  searchable
  openable
  organisable
  removable
  reconnectable
  refreshable
  watchable
}
```

No UI checks `status == unavailable`.

Organise asks `capabilities.organisable`.
Search asks `capabilities.openable`.
Documents remain `searchable` when the Handle is gone.

---

## PHASE 4 — Multi-platform Handles · IMPLEMENTED

Infrastructure only. Domain, Lifecycle, and Presentation are unchanged.

`packages/product/src/host/source-handles.ts`

Every adapter exposes `provider / capabilities / contractVersion / open / refresh / status / requestPermission / dispose` and optional `watch` when `capabilities.watch`. HandleStatus (`unknown` at startup) is translated to Lifecycle **only** through `handle-lifecycle-bridge.ts`. Registry owns Handle lifetime. Provider metadata never lives on Source. Contract frozen: [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](../../MULTI-PLATFORM-SOURCE-ADAPTERS-001.md).

Providers: Browser File System Access, Electron, iOS, Android, Google Drive, Dropbox, OneDrive, NAS, SMB, future.

Source identity stays identical. Only the Handle adapter changes. See [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](../../MULTI-PLATFORM-SOURCE-ADAPTERS-001.md).

---

## PHASE 5 — SourceHealth · PARTIAL

Present today:

```text
lastCheckedAt
lastIndexedAt
lastStateChangeAt
availabilityReason
```

Reserved, not implemented:

```text
syncStatus
integrityStatus
batteryRestricted
networkOffline
providerUnavailable
storageFull
```

---

## PHASE 6 — Mobile readiness · IMPLEMENTED (prepare only)

Prepare only. Do not redesign. No mobile UI.

The model supports Source → Handle → Presentation without assuming a local filesystem.

Hosts declare [platform access capabilities](../../SOURCE-PLATFORM-READINESS-001.md). Feature code asks `capabilities.searchable` / `access.connectGrant`, never `host === 'browser'` or `browserHandle`.

Reserved profiles: `ios`, `android`. Current hosts: `electron`, `browser`. UX unchanged.

---

## PHASE 7 — Automation readiness · NOT OPENED

Agents manipulate Sources, never Handles.

```text
Organise Source
Analyse Source
Index Source
Refresh Source
```

---

## PHASE 8 — Cloud readiness · NOT OPENED

Same Source ID can later bind a Drive Handle. History, Activity, Plans and Search survive.

---

## TESTS

```bash
npm run test:source-domain --prefix site
npm run test:source-platform-readiness --prefix site
npm run test:browser-sources-brand-flow --prefix site
npm run test:source-handle-adapters --prefix site
```

---

## CURSOR RULE

Minimal. Not alwaysApply.

`.cursor/rules/source-domain-guard.mdc`

---

## OUT OF SCOPE

No UI redesign. No Sources redesign. No Organise redesign.
No mobile UI. No desktop UI. No cloud implementation. No API redesign.
