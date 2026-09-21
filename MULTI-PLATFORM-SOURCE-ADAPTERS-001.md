# MULTI-PLATFORM-SOURCE-ADAPTERS-001

```text
STATUS = FROZEN · PASS
TYPE = Handle infrastructure (last infrastructure contract)
SCOPE = Source Handle adapters only
DATE = 2026-09-19
```

This implements Phase 4 of [SOURCE-DOMAIN-EVOLUTION-001.md](tracks/archive/SOURCE-DOMAIN-EVOLUTION-001.md).

It does **not** reopen the Source Domain Model.

```text
Source is identity.
Handle is access.
Adapters are infrastructure.
Source is business domain.
```

```text
The Domain never stores provider-specific information.

Provider-specific metadata belongs exclusively to the Handle.
```

Never put `Source.driveId`, `Source.dropboxPath`, or `Source.fileSystemPermission` on the domain.

```text
Domain
──────────────
Source
Lifecycle
Presentation

        ▲
        │
     Bridge          ← only handle-lifecycle-bridge.ts
        │
        ▼
Infrastructure
──────────────
Registry
Handle
Watcher
Provider
```

```text
Source
  │
  │  never knows the adapter
  ▼
Registry            ← owns Handle lifetime
  │
  ▼
Handle
  │
  ▼ HandleStatus
handle-lifecycle-bridge.ts   ← only authorized infra → domain translation
  │
  ▼
Lifecycle
  │
  ▼
Presentation
```

Never `Handle → Presentation`.

---

## Frozen rules

Do not modify Source, Lifecycle, or Presentation.

Every adapter exposes the same interface:

```ts
interface SourceHandle {
  readonly provider: SourceProvider
  readonly capabilities: HandleCapabilities
  readonly contractVersion: number

  open()
  refresh()
  status()
  requestPermission()
  dispose()          // Registry-internal only

  // only when capabilities.watch
  watch?()
}
```

```ts
type HandleCapabilities = {
  watch: boolean
  open: boolean
  organise: boolean
  rename: boolean
  move: boolean
  sync: boolean
}
```

Handles speak **HandleStatus** only:

```ts
type HandleStatus =
  | "unknown"
  | "available"
  | "permissionDenied"
  | "notFound"
  | "offline"
  | "busy"
  | "unsupported"
```

`unknown` is the startup state before the first probe:

```text
unknown → status() → available | permissionDenied | …
```

**Only `handle-lifecycle-bridge.ts` may translate HandleStatus into SourceLifecycle.**
No other component may do so. React must never map `permissionDenied` to badge copy.

The Source never knows which adapter it owns.

Replacing one adapter with another must not:

- change Source ID
- change Activity
- change Plans
- change Search history
- change document identity

---

## Registry owns Handle lifetime

```text
Registry owns Handle lifetime.
```

Never:

```text
UI → handle.dispose()
```

Always:

```text
Registry → dispose(handle)
```

```ts
registry.bind(sourceId, handle)
await registry.replace(sourceId, nextHandle)  // disposes previous
await registry.unbind(sourceId)               // disposes
registry.get(sourceId)
registry.list()
await registry.dispose()                      // disposes all
```

---

## Providers

| Adapter | Factory | Startup status | watch | sync |
| --- | --- | --- | --- | --- |
| Browser File System Access | `createBrowserFileSystemHandle` | unknown | opt-in | no |
| Electron | `createElectronHandle` | unknown | yes | no |
| iOS | `createIOSHandle` | unknown | no | no |
| Android | `createAndroidHandle` | unknown | no | no |
| Google Drive | `createGoogleDriveHandle` | unknown | yes | yes |
| Dropbox | `createDropboxHandle` | unknown | no | yes |
| OneDrive | `createOneDriveHandle` | unknown | yes | yes |
| NAS | `createNasHandle` | unknown | no | no |
| SMB | `createSmbHandle` | unknown | no | no |
| Future | `createFutureHandle` / `registerSourceHandleProvider` | unknown | no | no |

Cloud and network adapters stay honest: no fake Connect, no minted identity.

---

## Implementation

- `packages/product/src/host/source-handles.ts` — adapters + registry
- `packages/product/src/host/handle-lifecycle-bridge.ts` — **only** HandleStatus → Lifecycle bridge

Host binds a handle to a stable Source ID:

```ts
registry.bind(source.id, createBrowserFileSystemHandle(backend))
await registry.replace(source.id, createGoogleDriveHandle(backend))
```

The Source object is not updated. Activity, Plans, Search, and documents keep the same IDs.

---

## Evolution path

```text
Source
  │
  ▼
Registry
  │
  ▼
Handle
  │
  ▼
Watcher              (capabilities.watch)
  │
  ▼
Sync Engine          (capabilities.sync)
  │
  ▼
Indexer
  │
  ▼
Domain
  │
  ▼
Filesystem / Drive / Dropbox / OneDrive / NAS / Mobile
```

Adding Google Drive, Electron, iOS, or Android = write a new adapter and register it.
Do not touch Source, Lifecycle, Presentation, Search, Activity, or Plans.

**Sync rule (frozen):**

```text
Sync Engine → Handle → Provider
```

Never `Sync Engine → Google Drive API`. Never bypass the Handle.

**Adapter Contract Test (same suite, every provider):**

```bash
npm run test:adapter-contract --prefix site
```

---

## Tests

```bash
npm run test:source-handle-adapters --prefix site
```

---

## Out of scope

No Source, Lifecycle, or Presentation edits.
No UI redesign. No cloud OAuth. No mobile UI. No NAS/SMB mount implementation.
