# BROWSER-LOCAL-DEVICE-STATE-001

**STATUS:** CLOSED · PASS (2026-09-19)

**TYPE:** Browser local-device state

**Objective:** Make the Browser behave like a real local device, without pretending it is the Desktop app.

No upload. No sync. No fake paths. No silent permission loss.

---

## Product rule

```text
Browser = local device
License = right to use
Account / email = activation
IndexedDB = persistent local memory
Session cache = temporary permission for this tab only
```

IndexedDB is the authority. Session cache must never decide that a saved source does not exist.

---

## Device model

```text
License     → what you may use
Device      → where local state lives
Source      → belongs to one device
Knowledge   → belongs to one device
Activity    → belongs to one device
```

| Host | Device | Source memory |
|------|--------|----------------|
| Free Browser | `browserDeviceId` in IndexedDB | directory handle + knowledge in IndexedDB |
| Activated Browser | same `browserDeviceId` | same IndexedDB — license does not wipe it |
| Desktop | installed app identity | real OS paths |

The same license may sit on several devices. Each device keeps its own local memory.

Activating a license **promotes** the existing browser device. It does not replace it, reindex from scratch, or pull Desktop sources (that would be Sync).

---

## Source states (Browser)

| Stored in IndexedDB | Browser permission | User sees | Action |
|---------------------|--------------------|-----------|--------|
| No | — | Not connected | Connect |
| Yes | granted | Indexed | Refresh / Remove |
| Yes | prompt / denied | Unavailable · Permission required | Restore permission / Remove |
| Yes | handle cannot be kept | Unavailable | This browser cannot keep folder access |

A saved source never becomes **Not connected** again.

---

## Flow

```text
Open /sources
        ↓
Read saved handles from IndexedDB
        ↓
queryPermission()
        ↓
granted → Indexed
prompt / denied → Unavailable · Restore permission
        ↓
Restore permission → requestPermission()
        ↓
granted → Indexed
denied → Unavailable · Permission not granted
```

Connect uses the live picker handle. It does not ask for permission a second time after IndexedDB writes (that loses the user gesture and used to delete the source).

---

## Frozen invariant

```text
A persisted browser source must never be deleted
only because permission is currently missing.

Permission loss changes state.
It does not delete knowledge.
```

Code: `desktop/src/host/browser/source-invariants.ts` · `removeSource` in `store.ts`.

---

## Minimum test

```text
1. Open /sources in Chrome
2. Connect Downloads
3. Confirm permission
4. Source shows Indexed
5. Refresh /sources
6. Source still exists
7. If permission is still granted → Indexed
8. If permission is lost → Unavailable · Restore permission
9. Restore permission
10. Source returns to Indexed
11. Activate license
12. Source and Knowledge Index remain
```

Page-level banners are not a permission state. Permission belongs on the source card.

---

## Out of scope

- Syncing sources between Browser and Desktop
- Uploading names or indexes
- Treating a license as a cloud of folders
- UX redesign unrelated to Sources state

---

## Definition of Done

```text
Free Browser trial can connect a source,
refresh,
reopen the tab,
activate a license,
and keep its local sources and knowledge.
```
