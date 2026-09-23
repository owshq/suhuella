# ELECTRON-SOURCE-ADAPTER-001

```text
STATUS = CLOSED · PASS
TYPE = Provider adapter
SCOPE = Desktop path → SourceHandle
DATE = 2026-09-19
```

Replace Desktop filesystem access checks with the frozen SourceHandle contract.

```text
No Source Domain changes.
No Lifecycle changes.
No Presentation changes.
No UI redesign.
```

Infrastructure contract (frozen): [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](MULTI-PLATFORM-SOURCE-ADAPTERS-001.md)  
Reference adapter: [BROWSER-SOURCE-ADAPTER-001.md](BROWSER-SOURCE-ADAPTER-001.md)

```text
UI
        │
        ▼
SourcePresentation
        │
        ▼
Source Domain
        │
        ▼
Handle-Lifecycle Bridge
        │
        ▼
Handle Registry
        │
        ▼
Electron Adapter   ← this document
        │
        ▼
Node path (provider token)
```

---

## What changed

| Path | Before | After |
| --- | --- | --- |
| Add folder | persist path | persist path + `registry.bind` |
| Availability | `statSync` / `accessSync` in index-service | `adapter` probe → bridge → same Desktop statuses |
| Restore / refresh | rescan only | `handle.refresh()` then rescan |
| Remove | drop path | `registry.unbind` (dispose) + drop path |
| Index walk | `readdir` on the path | unchanged — path is the provider token |

Desktop still **Adds**. Web still **Connects**. Same badges.

---

## Implementation

| Layer | Module |
| --- | --- |
| Handle adapter | `packages/product/src/host/adapters/electron-handle-adapter.ts` |
| Path probe | `desktop/electron/electron-path-access.ts` |
| Registry | `desktop/electron/handle-registry.ts` |

```ts
createElectronHandleAdapter({ probe, requestAccess, watchPath })
```

`createElectronHandle()` stays the factory. This adapter is the real desktop wiring.

---

## Definition of done

Desktop behaves exactly the same. Only the adapter changed.

- connect / Add folder
- refresh
- availability
- dispose via Registry
- `test:adapter-contract` PASS
- `test:electron-source-adapter` PASS

---

## Tests

```bash
npm run test:electron-source-adapter --prefix site
npm run test:adapter-contract --prefix site
npm run test:source-handle-adapters --prefix site
```

---

## Out of scope

No mobile. No Google Drive. No folder-watch product feature. No Domain / Lifecycle / Presentation edits.
