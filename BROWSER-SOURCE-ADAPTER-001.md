# BROWSER-SOURCE-ADAPTER-001

```text
STATUS = OPEN · REFERENCE IMPLEMENTATION
TYPE = Provider adapter
SCOPE = Browser File System Access → SourceHandle
DATE = 2026-09-19
```

This is the **reference implementation** for every future provider adapter.

Adapter id: `browser_fs`

Infrastructure contract (frozen): [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](MULTI-PLATFORM-SOURCE-ADAPTERS-001.md)

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
Provider Adapters   ← this document
```

---

## Frozen rules

This adapter must **not** modify:

- Source
- Lifecycle
- Presentation
- Search
- Activity
- Plans

If it needs to, the infrastructure contract was incomplete — fix the contract, not the domain.

```text
Sync Engine → Handle → Provider
```

Never `Sync Engine → browser API`.

Provider-specific metadata stays on the Handle. Never on Source.

---

## Implementation

| Layer | Module |
| --- | --- |
| Handle adapter (reference) | `packages/product/src/host/adapters/browser-fs-handle-adapter.ts` |
| Store wiring | [BROWSER-ADAPTER-WIRING-001.md](tracks/archive/BROWSER-ADAPTER-WIRING-001.md) · `host/browser/handle-registry.ts` |
| Domain projection | `packages/product/src/host/browser/source-adapter.ts` |
| Browser grant store | `packages/product/src/host/browser/fs.ts` |

```ts
await createBrowserFsHandleAdapterFromDirectory(directoryHandle)
```

Wires `FileSystemDirectoryHandle` into the frozen `SourceHandle` contract.
Use `createBrowserFsHandleAdapter({ directoryAccess })` when injecting test doubles.

---

## Contract test

The **same** suite runs against Browser, Electron, Drive, and every provider:

```bash
npm run test:adapter-contract --prefix site
```

No bespoke test per provider.

---

## Next adapters (same pattern)

Wiring: [BROWSER-ADAPTER-WIRING-001.md](tracks/archive/BROWSER-ADAPTER-WIRING-001.md) — OPEN · AUTOMATED PASS · MANUAL PENDING · FREEZE BLOCKED

| Track | Status |
| --- | --- |
| ELECTRON-SOURCE-ADAPTER-001 | CLOSED · PASS |
| GOOGLE-DRIVE-SOURCE-ADAPTER-001 | RESERVED |
| IOS-SOURCE-ADAPTER-001 | RESERVED |
| ANDROID-SOURCE-ADAPTER-001 | RESERVED |
| DROPBOX-SOURCE-ADAPTER-001 | NOT OPENED |
| ONEDRIVE-SOURCE-ADAPTER-001 | NOT OPENED |
| NAS-SOURCE-ADAPTER-001 | NOT OPENED |
| SMB-SOURCE-ADAPTER-001 | NOT OPENED |

Each adds a real adapter + passes `test:adapter-contract`. Domain stays frozen.
