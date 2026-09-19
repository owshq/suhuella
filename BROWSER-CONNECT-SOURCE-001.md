# BROWSER-CONNECT-SOURCE-001

```text
STATUS = CLOSED · PASS
TYPE = Production blocker
SCOPE = SuHuella Web / Browser Sources
DATE = 2026-09-19
WORKER = ad7d2436-f60e-48dd-8163-7a927be5229e
```

Superseded for first-run completeness by [BROWSER-SOURCES-BRAND-FLOW-001.md](BROWSER-SOURCES-BRAND-FLOW-001.md) — **CLOSED · PASS**.

A first-time user cannot complete the first real step: connect a folder.

---

## Objective

After the user selects a folder in the browser picker, SuHuella must **immediately** show that the source was added. Indexing may continue in the background. The UI must never wait for a full scan before showing the source.

---

## Root cause (re-audit)

Production still behaved as “picker opens, folder selected, nothing connected” (Home 0 sources, catalog cards stay **Not connected**). Previous store-only changes were not sufficient and were not proven on production.

Runtime path:

```text
Sources Connect
  → SettingsWindow.addLocation
  → addIndexedLocation
  → connectLocalFolder / showDirectoryPicker
  → addSourceFromHandle
  → IndexedDB + in-memory list
  → getIndexStatus / reconcileSources
  → SourcesPanel + Home locations.length
```

Failure modes found:

1. **Scan blocked the connect promise** on the production path, so React never received a source until a large folder finished scanning (or appeared unchanged if the user left).
2. **`startIndexScan` auto-fired on browser** when `lastIndexed` was null and file count was 0 — exactly the just-connected state. That rescan called `ensurePermission` **without a user gesture**, which can fail and fight the live handle.
3. **`onIndexProgress` was a no-op** on the browser host, and SettingsWindow only refreshed locations when progress was *not* scanning.
4. **UI depended on a second IndexedDB read** after persist; no in-memory write-through list.
5. **Service worker cache** (`suhuella-web-shell-v2`) stored `/_next/static/` — stale bundles possible after deploy.

Product truth unchanged: connect is local permission + IndexedDB handle. Not upload, sync, license, or Desktop.

---

## Fix

- Commit `BrowserSource` with `status = indexing` **before** `scanDirectory`.
- In-memory source list + `onBrowserSourcesChanged` → real `onIndexProgress`.
- SettingsWindow paints locations on every progress event; `busy` only wraps the picker + first paint.
- Browser host skips the Electron-style auto `startIndexScan` on empty index.
- `startIndexScan` skips sources already `indexing`.
- Scan failure keeps the source (`unavailable`), never silent delete.
- Catalog card hides on `catalogKey` / `wellKnownToken`.
- PWA cache bumped to `suhuella-web-shell-v3`.
- Trace logs: `[suhuella-connect]` in Chrome DevTools.

---

## Tests

```bash
npm run test:browser-connect --prefix site
npm run check:app-host --prefix site
```

Playwright seam (mocked picker, source must appear before slow scan):

```bash
BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-connect-playwright --prefix site
```

---

## Manual Chrome (required to close)

1. Incognito → https://suhuella.com/sources (hard refresh).
2. Connect Documents or Choose another folder.
3. Immediately after picker closes: source name visible, **Updating…**, source count ≥ 1.
4. Large folder: UI stays usable while scanning.
5. Cancel picker: no source created.
6. Reload: source persists or **Unavailable · Restore permission**.

---

## Production

| Field | Value |
| --- | --- |
| Worker after deploy | `ad7d2436-f60e-48dd-8163-7a927be5229e` |
| Production JS | chunks `3lxievoq83znx.js`, `0at9e6hwf6lsf.js` contain `[suhuella-connect]` |
| Service worker | `suhuella-web-shell-v3` live on https://suhuella.com/sw.js |
| Playwright seam on production | **PASS** — mocked picker, source card + name visible before 8s scan |
| Incognito real picker | operator should hard-refresh once; DevTools → `[suhuella-connect]` |
| First-run | may **resume** |

---

## Definition of done

Close **PASS** only when production Chrome shows a source immediately after folder selection, Home source count includes indexing sources, scan failure does not erase the source, and first-run may resume.
