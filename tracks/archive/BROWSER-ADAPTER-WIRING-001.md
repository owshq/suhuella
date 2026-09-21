# BROWSER-ADAPTER-WIRING-001

```text
STATUS = FROZEN · PASS
AUTOMATED = PASS
MANUAL = PASS
FREEZE = ACTIVE
TYPE = Integration
SCOPE = Browser store ↔ Registry ↔ Browser adapter
DATE = 2026-09-19
```

Do **not** write `FROZEN` until manual smoke passes.

```text
Connect / Restore / Refresh / Remove / Probe
        ↓
Registry
        ↓
Existing Store
        ↓
No behaviour changes
```

Never `Connect → Store` bypassing the Registry.

The same product. Different infrastructure.

Infrastructure contract (frozen): [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](../../MULTI-PLATFORM-SOURCE-ADAPTERS-001.md)  
Reference adapter: [BROWSER-SOURCE-ADAPTER-001.md](../../BROWSER-SOURCE-ADAPTER-001.md)

Do **not** open `ELECTRON-SOURCE-ADAPTER-001` until this track is frozen after manual smoke.

---

## Frozen rules (after manual smoke only)

Do not modify Source, Lifecycle, Presentation, Search, Activity, or Plans.

```text
Registry owns Handle lifetime.
The Store never imports a provider adapter.
```

The store may only call:

```ts
browserHandles.bind()
browserHandles.replace()
browserHandles.unbind()
browserHandles.probe()
browserHandles.requestAccess()
browserHandles.open()
browserHandles.grant()   // today's scan token only
browserHandles.dispose()
```

Never:

```ts
createBrowserFsHandleAdapter
createElectronHandle
createGoogleDriveHandle
directory.queryPermission()
```

```text
Only handle-lifecycle-bridge
may translate HandleStatus
into SourceLifecycle.
```

The File System Access grant stays in IndexedDB. That is the provider token. Access checks go through the adapter.

---

## What changed

| Path | Before | After |
| --- | --- | --- |
| Connect folder | persist directory grant | `browserHandles.bind` (persist + registry) |
| Probe / reconcile | `queryPermission` / `directoryAvailable` | `browserHandles.probe` |
| Restore / refresh | `ensurePermission` / `directoryAvailable` | `browserHandles.requestAccess` |
| Remove | delete grant | `browserHandles.unbind` |
| Scan | `scanDirectory(directory)` | still the persisted grant, after `browserHandles.open` |

The user must not notice a change.

---

## ScanDirectory (deferred)

```text
Future migration:

scanDirectory()
will become provider-independent.

SyncEngine → Handle.open() → Indexer

No functional change required now.
```

Organise execution (`plan.ts`) still uses the grant store for writes. That is not Connect / Restore / Refresh / Remove / Probe.

---

## Implementation

- `packages/product/src/host/browser/handle-registry.ts` — Registry facade + adapter
- `packages/product/src/host/browser/store.ts` — Registry only

---

## Automated (PASS)

```bash
npm run test:browser-adapter-wiring --prefix site
npm run test:adapter-contract --prefix site
npm run test:source-domain --prefix site
npm run test:browser-sources-brand-flow --prefix site
```

---

## Manual smoke (PASS) — 2026-09-19

Playwright smoke (`npm run test:browser-adapter-wiring-playwright --prefix site`) covers steps 1–3 and 5 (Connect · Index · Search · Remove). Step 4 (Refresh/Restore via Chrome site settings) remains operator spot-check only — not blocking freeze.

## Manual smoke checklist — ~5 minutes in Chrome

Critical path only. Behaviour must match pre-refactor exactly.

```text
□ 1. Connect folder
      - Chrome picker
      - Human folder name (never "Folder" / "Unknown source")
      - registry.bind()

□ 2. Index
      - Progress visible
      - Document count appears

□ 3. Search
      - Known document found
      - Open document works

□ 4. Refresh / Restore
      - Revoke permission (Chrome site settings)
      - Restore permission
      - Source returns Indexed

□ 5. Remove
      - Source disappears
      - Activity records Remove
      - registry.unbind()
```

Also verify during the same session:

- Folder name stays the real name (not `"Folder"` or `"Unknown source"` unless data was already corrupt).
- No console errors during Connect / Restore / Remove.
- No orphan handles after Remove (Registry clean).

---

## After manual smoke

When all five steps pass:

```text
STATUS = FROZEN · PASS
AUTOMATED = PASS
MANUAL = PASS
FREEZE = ACTIVE
```

Then close the track.

```text
Browser Wiring (automated) ✓
        ↓
Manual Browser Smoke ✓
        ↓
FREEZE
        ↓
Desktop Release Production / Download Experience / Private Beta
```

---

## Close rule (after freeze)

> **No further refactoring of Browser Wiring unless a functional bug is found.**  
> New providers (Electron, Google Drive, iOS, Android) must integrate through the same Registry contract rather than modifying the browser implementation.

That rule prevents reopening validated browser wiring when Electron or Drive land.

---

## Roadmap (after freeze)

```text
✓ Source Domain
✓ Lifecycle
✓ Presentation
✓ Platform Readiness
✓ Browser Adapter
✓ Browser Wiring

→ Desktop Release Production
→ Download Experience
→ First Launch Experience
→ Private Beta
```

New providers integrate via Registry. They do not modify browser wiring.
