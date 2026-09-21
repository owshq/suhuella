# BROWSER-SOURCE-ADAPTER-INTEGRATION-001

```text
STATUS = CLOSED · PASS
TYPE = Integration
SCOPE = Browser host ↔ Browser adapter ↔ Registry
DATE = 2026-09-19
```

Connect the current browser host to the frozen Browser Source Adapter. Do not redesign the browser.

This completes [BROWSER-ADAPTER-WIRING-001.md](tracks/archive/BROWSER-ADAPTER-WIRING-001.md).

```text
Web behaves exactly the same.
No visual changes.
Only infrastructure changes.
```

---

## What this track did

- Access probe / restore already go through Registry + adapter.
- Scan now opens the SourceHandle first (`browserHandles.open()`), then reads the persisted directory grant.
- Store never calls `handle.dispose()`.
- Store no longer probes `queryPermission` / `directoryAvailable` directly.

The File System Access grant stays in IndexedDB. That is the provider token, not a second access path.

---

## Definition of done

Connect folder, Search, Remove, and Activity stay the same.

```bash
npm run test:browser-adapter-wiring --prefix site
npm run test:adapter-contract --prefix site
npm run test:browser-sources-brand-flow --prefix site
```
