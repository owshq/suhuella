# SOURCE-LIFECYCLE-MODEL-001

```text
STATUS = FROZEN · CHAPTER · see SOURCE-DOMAIN-MODEL-001
TYPE = Lifecycle chapter
SCOPE = Source status transitions and Activity
DATE = 2026-09-19
```

This is **not** the top-level Source contract.

```text
SOURCE-DOMAIN-MODEL-001
        │
        ├── Identity
        ├── Handle
        ├── Health
        ├── Lifecycle   ← this document
        ├── Capabilities
        ├── Actions
        └── Presentation
```

Canonical contract: [SOURCE-DOMAIN-MODEL-001.md](SOURCE-DOMAIN-MODEL-001.md)

Implementation: `packages/product/src/lib/source-lifecycle.ts`

---

## Frozen product rules

```text
A Source is never removed automatically.
SuHuella only changes its state.
Only the user removes a Source.
```

Documents stay visible in Search when their source is unavailable.

Activity records **transitions** (`old state → new state`), not repeated probes on the same state.

### Source IDs are immutable

```text
Source IDs are immutable.

Renaming, reconnecting or relocating a Source
does not create a new Source.

Only Remove destroys the identity.
```

### Source ≠ Handle

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

---

## status

```text
indexed
indexing
permission_required
missing
unavailable
error
```

## availabilityReason (internal — not shown to users, not sent to React)

```text
disk_offline
permission_revoked
folder_deleted
folder_moved
scan_failed
unknown
```

## recommendedAction (IDs only — domain never speaks button copy)

```text
restore_permission
locate_folder
retry
remove
none
```

UI paints badge + button chrome from `SourcePresentation`. Logic stays in the domain module.

---

## Health timestamps

| Field | Meaning |
| --- | --- |
| **lastIndexedAt** | When the last index finished |
| **lastCheckedAt** | When SuHuella last verified the source is still reachable |
| **lastStateChangeAt** | When `status` last changed |

---

## Activity

Record tokens only when access state changes:

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
