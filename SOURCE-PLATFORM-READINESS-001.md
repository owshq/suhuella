# SOURCE-PLATFORM-READINESS-001

```text
STATUS = CLOSED · PASS
TYPE = Domain readiness (no mobile UI)
SCOPE = Source / host access capabilities for Desktop · Web · iOS · Android
DATE = 2026-09-19
PARENT = SOURCE-DOMAIN-EVOLUTION-001 · PHASE 6
```

Prepare the Source domain so a future iOS or Android host can plug in without changing business logic. This track does **not** implement mobile. It does **not** change the current Web or Desktop experience.

Handle adapters ([MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](MULTI-PLATFORM-SOURCE-ADAPTERS-001.md)) are how a host talks to a provider. This track is what features may assume before that adapter exists.

```text
Source is identity.
Handle is access.
Presentation is derived.
The UI never decides.
Features ask capabilities.
Hosts declare capabilities.
```

```text
BAD     if (browserHandle)
        if (host === 'browser')

GOOD    if (capabilities.searchable)
        if (access.connectGrant)
```

---

## What changed

Host access profiles live in `packages/product/src/lib/platform-capabilities.ts`.

Current hosts (`electron`, `browser`) keep the same copy and the same screens. Reserved profiles (`ios`, `android`) exist so a future adapter only declares capabilities.

| Feature | Asks |
| --- | --- |
| Search | `capabilities.searchable` / `capabilities.openable` |
| Organise | `capabilities.organisable` + `access.organiseFromIndexedSources` |
| Sources catalog | `access.directoryCatalog` / `access.limitedSystemFolders` / `access.connectGrant` |
| Home empty CTA | `access.connectGrant` |
| Unavailable action | `access.connectGrant` → restore permission; else retry |
| Folder watch | `capabilities.watchable` ← `access.folderWatching` |

No mobile UI. No new screens. No Connect on Desktop folders the OS already sees.

---

## Audit

| Current assumption | Platform affected | Capability | Migration cost | Recommendation |
| --- | --- | --- | --- | --- |
| Persistent `FileSystemDirectoryHandle` in IndexedDB | Web (Chrome); Desktop uses a path; iOS cannot persist a directory handle; Android SAF can | `persistentHandles` | Low | Keep persist in the host adapter. Domain never inspects the handle type. |
| Index continues while the window is closed | Desktop yes; Web tab-bound; iOS/Android OS-restricted | `backgroundIndexing` | Low | Host starts scans only when this is true. Web stays foreground. |
| The OS already sees Documents / Downloads / Desktop | Desktop yes; Web / iOS / Android no | `filesystemAvailability` + `directoryCatalog` | Low | Desktop **Available** + **Add**. Others **Connect**. Do not fake Available on mobile. |
| Folder watching / `folder_watch` workflows | Assumed Desktop-only; not implemented anywhere | `folderWatching` → `capabilities.watchable` | Low | Stay false on every current profile. Do not enable watch from UI. |
| Permission survives restart | Desktop OS grant; Web Chrome persist is revocable; iOS/Android scoped | `permanentPermissions` + health `availabilityReason` | Medium | Health observation wins (moved → locate, disk offline → retry). Unknown reason uses `connectGrant`. |
| Synchronous filesystem walk | Desktop Node `fs`; all others async | `synchronousAccess` | Low | Adapters stay async at the domain boundary. Desktop may walk internally. |
| Large local index (no quota) | Desktop disk; Web IndexedDB quota; mobile tight | `largeLocalStorage` | Medium | Browser host already scopes the index. Mobile hosts must bound storage. Do not change Web UX now. |
| `if (host === 'browser')` / `isWeb` for Connect vs Add | Home, Sources, Organise, `homeKnowledgeLine` | `connectGrant` | Low | **Migrated.** Web/iOS/Android Connect. Desktop Add. |
| `sourceRecommendedAction(status, browser)` | Domain | `access.connectGrant` | Low | **Migrated.** Legacy boolean still accepted. |
| Chrome blocks Documents / Downloads | Web only | `limitedSystemFolders` | Low | **Migrated.** iOS/Android profiles do not inherit **Limited in browser**. |
| `webkitdirectory` one-shot picker | Safari / limited Web | `ephemeralPicker` | Low | Host picker only. Domain does not mention webkit. |
| Organise `isWeb` (files + sources vs folders) | Web Organise | `organiseFromIndexedSources` | Low | **Migrated.** Desktop Save As uses `saveAsOverlay`. |
| Desktop Save As overlay | Desktop Organise | `saveAsOverlay` | Low | **Migrated.** Not the win32 `saveAs` chrome flag. |
| Local filesystem is the Source | All | Handle (Phase 4) | High | Do not open Handle adapters here. Source ID stays stable when the Handle changes. |
| `showDirectoryPicker` probed in Settings | Web Settings chrome | host `filesystem` / `organise` | Low | Stay in the browser host. Domain does not probe APIs. |

---

## Profiles (reserved mobile)

| Capability | Desktop | Web | iOS | Android |
| --- | --- | --- | --- | --- |
| `persistentHandles` | yes (path) | yes (Chrome IDB) | no | yes (SAF) |
| `backgroundIndexing` | yes | no | no | no |
| `filesystemAvailability` | yes | no | no | no |
| `folderWatching` | no | no | no | no |
| `permanentPermissions` | yes | no | no | no |
| `synchronousAccess` | yes | no | no | no |
| `largeLocalStorage` | yes | no | no | no |
| `connectGrant` | no | yes | yes | yes |
| `directoryCatalog` | yes | no | no | no |
| `limitedSystemFolders` | no | yes | no | no |
| `scopedDocuments` | no | no | yes | yes |
| `organiseFromIndexedSources` | no | yes | yes | yes |

A future mobile host implements an adapter and calls `hostAccessFor('ios')` or `hostAccessFor('android')`. Search, Organise, Sources, and Home do not change.

---

## Definition of done

```text
The product should support future mobile implementations
without changing business logic.
```

- Domain and product screens that decide Source behaviour ask capabilities, not `host === 'browser'` or `browserHandle`.
- iOS and Android profiles exist and do not alter Desktop or Web copy.
- No mobile UI shipped.
- Existing Web Connect / Desktop Add behaviour is unchanged.

---

## Tests

```bash
npm run test:source-platform-readiness --prefix site
npm run test:source-domain --prefix site
npm run test:sources-capability-matrix --prefix site
npm run test:browser-sources-brand-flow --prefix site
```

---

## Out of scope

No mobile UI. No iOS app. No Android app. No cloud Handle. No folder watch. No UX redesign.
