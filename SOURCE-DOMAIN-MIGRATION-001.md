# SOURCE-DOMAIN-MIGRATION-001

```text
STATUS = CLOSED · REPORT
PARENT = SOURCE-DOMAIN-MODEL-001 · FROZEN · CORE
DATE = 2026-09-19
CLOSED = 2026-09-19
```

The Source model is now split by layer. Screens, navigation, lifecycle rules, Release, and Branding were not redesigned. Drive, Mobile, and Desktop were not implemented.

Future platforms add an adapter. They do not edit these types.

---

## 1. Public type audit

| Type | Before | After | Owner |
| --- | --- | --- | --- |
| `Source` | Declared twice in `source-lifecycle.ts`. One copy embedded Handle and Health. | Identity only: `readonly id`, `displayName`. | `source-identity.ts` |
| `SourceId` | Plain `string`. | Opaque branded id. Not derived from a path or grant. | `source-identity.ts` |
| `SourceHandle` | Declared twice. One copy listed `browser \| desktop \| drive \| …`. | `{ sourceId, permission, adapterId, contractVersion: 1 }`. `adapterId` is an open string. | `source-handle.ts` |
| `SourceHealth` | Declared twice, next to transitions. | Observations only. | `source-health.ts` |
| `SourceStatus` | Mixed with identity and host words. | Transition vocabulary only. | `source-lifecycle.ts` |
| `SourceTransitionKind` | Same file as Handle. | Unchanged tokens. | `source-lifecycle.ts` |
| `SourceAvailabilityReason` | Copied in `types.ts` and the lifecycle file. | One definition. `types.ts` re-exports it. | `source-health.ts` |
| `SourceRecommendedAction` | Copied in `types.ts`. Took a `browser` flag. | One definition. Asks `connectGrant` or a health reason. | `source-actions.ts` |
| `SourcePermissionState` | Copied in `types.ts`. | One definition. | `source-handle.ts` |
| `SourceCapabilities` | Copied in `types.ts`. Accepted host status strings. | Derived from `SourceStatus`. `watchable` follows `folderWatching` when a host passes it. | `source-capabilities.ts` |
| `SourcePresentation` | Already the React DTO. | Unchanged shape. Still the only object React should read. | `source-presentation.ts` |
| `IndexedLocationStatus` | Imported by the domain. | Stays a host word. Mapped in `source-host-vocabulary.ts`. | `types.ts` |
| `WebKnowledgeSource` | Flat browser record. | Still the browser store. Projected by `projectBrowserSource`. | browser adapter |

---

## 2. Duplicated concepts removed

- The second `Source`, `SourceHandle`, and `SourceHealth` declarations in `source-lifecycle.ts` are gone. They did not compile as two exports of the same name.
- `SourceAvailabilityReason`, `SourceRecommendedAction`, `SourcePermissionState`, and `SourceCapabilities` are no longer rewritten in `types.ts`. The host summary re-exports the domain unions.
- `documentCount` left the identity type. It is knowledge, passed into presentation. It is not an id.
- `status` left the identity type. It is a lifecycle token.

---

## 3. Identity is immutable

`Source.id` is `readonly`. `renameSource` returns the same id. Restore in the browser store still mutates the row keyed by `sourceId` and does not call `createId`. `bindSourceHandle` throws if a Handle names a different Source.

---

## 4. Handle is replaceable

`replaceSourceHandle` keeps `sourceId` and swaps `permission` and `adapterId`. The concrete grant (Chrome handle, path, future token) stays in the adapter. The domain never reads it.

The platform union (`drive`, `dropbox`, `ios`, …) was removed from the type. Adding a provider does not change `SourceHandle`.

---

## 5. Lifecycle contains transitions only

`source-lifecycle.ts` now holds `SourceStatus`, transition kinds, `shouldRecordSourceTransition`, and `sourceTransitionKind`.

It does not hold identity, Handle, Health, action labels, or `IndexedLocationStatus`.

Rules kept:

- Same state is not an Activity event.
- `indexing` → `indexed` is not an Activity event.
- Tokens are unchanged: `source_connected`, `permission_lost`, `permission_restored`, `source_unavailable`, `source_reconnected`, `source_removed`.

Host words (`ready`, `needs_permission`, `permission_denied`) are translated by `sourceAccessState` before they reach lifecycle.

---

## 6. Health contains observations only

`SourceHealth` stores `lastIndexedAt`, `lastCheckedAt`, `lastStateChangeAt`, and `availabilityReason`.

`recordHealthObservation` writes those fields. It does not choose a status or an action.

Inferring a reason from status when a probe forgot to record one lives in `handle-lifecycle-bridge.ts` (`availabilityReasonForStatus`). That is a host fallback on the path Host status → Lifecycle → Health. It is not domain Health.

`sourceAccessState` throws `UnknownHostStatusError` in development when a host stores an unrecognised word (for example `"almost_ready"`). Production keeps the previous silent fallback to `indexed` for forward compatibility with stale records.

---

## 7. Capabilities are derived

`sourceCapabilities(status)` is computed. Nothing stores it on `Source`.

`searchable` stays true when the Handle is gone. `openable` and `organisable` follow an accessible status. `watchable` is true only when the caller also passes `folderWatching`. That flag comes from host access, not from a platform name.

Browser search and the browser host map `ready` → `indexed` before they ask for capabilities. They no longer pass a host word into the domain.

---

## 8. Presentation is the only UI DTO

`buildSourcePresentation` is still the path into React. `SourcePresentation` is still `{ id, summary, status, actions, capabilities }`.

React does not receive `Source`, `SourceHandle`, or `SourceHealth`.

`types.ts` still carries `availabilityReason`, `recommendedAction`, and `capabilities` on `IndexedLocationSummary` so existing host projections keep compiling. Sources and Organise read `presentation`, not those fields. Home still reads host `status` for the learning line. That was left in place. Changing it would be a screen change.

---

## 9. Coupling found

Removed:

| Coupling | Where it was | What happened |
| --- | --- | --- |
| Domain imported `IndexedLocationStatus` | `source-lifecycle.ts` | Moved to `source-host-vocabulary.ts` |
| `sourceRecommendedAction(status, browser)` | lifecycle | Replaced by status, optional health reason, and `connectGrant` |
| Handle `kind` union of products | lifecycle | Replaced by `adapterId: string` |
| Duplicate domain unions | `types.ts` | Re-exports |
| Capabilities accepted any host string | `source-capabilities.ts` | Callers map first |
| Lifecycle owned identity, handle, and health | one file | Split |

Still present, on purpose:

| Coupling | Why it stays |
| --- | --- |
| `source-host-vocabulary.ts` knows `ready`, `needs_permission`, `permission_denied`, `external_drive_disconnected` | This is the adapter for words current hosts already store. A new platform should emit `SourceStatus` and not extend this list. |
| `buildSourcePresentation` still accepts those host words | Existing UI call sites pass `location.status`. The function maps them. React still receives `SourcePresentation`. |
| Unavailable action still asks `connectGrant` when no specific health reason was recorded | Closed rule from SOURCE-PLATFORM-READINESS-001. Web keeps Restore permission. Desktop keeps Retry. A recorded reason (`disk_offline`, `folder_moved`, `scan_failed`, `permission_revoked`) wins over that default. |
| `watchable` reads `folderWatching` | Same closed rule. The domain does not name iOS or Android. |
| `WebKnowledgeSource` is still one record | Storage was not migrated. `projectBrowserSource` is the adapter factory seam. |
| `IndexedLocationSummary.status` is still a host word | **Technical debt.** Home reads it for the learning line. Future: Home consumes Presentation only. |

---

## 11. Technical debt (not frozen)

```text
Future: Home should consume Presentation only.
```

Today Home reads `location.status === 'indexing'` for the learning line. That breaks the strict Presentation → React rule slightly. Do not fix in the domain freeze — mark and close when Home is touched next.

---

## 10. What an adapter must do

An adapter:

1. Mints a `SourceId` once. Reconnect and relocate reuse it.
2. Stores its own grant. The domain never sees that object.
3. Replaces the Handle with `replaceSourceHandle`. It does not create a Source.
4. Writes Health with `recordHealthObservation`.
5. Emits `SourceStatus` (or passes a stored word through `sourceAccessState` only if it still uses the current host vocabulary).
6. Asks `sourceCapabilities` and `sourceRecommendedAction`. It does not branch on `host === "browser"`.
7. Resolves `availabilityReason` via `availabilityReasonForStatus` when the probe did not record one.
8. Calls `buildSourcePresentation` before anything reaches React. Never persist the result.

Not done here: Drive, Mobile UI, Desktop UI, a new Handle implementation, a storage split of `WebKnowledgeSource`.
