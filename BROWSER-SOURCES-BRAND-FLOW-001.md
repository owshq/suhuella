# BROWSER-SOURCES-BRAND-FLOW-001

```text
STATUS = CLOSED · PASS
TYPE = Browser source UX + functional blocker
SCOPE = SuHuella Web / Browser Sources / Search
DATE = 2026-09-19
WORKER = 4babd6bf-f2f8-4d37-8f51-942f96f816ff
```

Same slice as **BROWSER-SOURCE-INDEX-SEARCH-001** — also **CLOSED · PASS**.

[FIRST-RUN-EXPERIENCE-001.md](FIRST-RUN-EXPERIENCE-001.md) may resume.

---

## Objective

Fix the browser source connection experience so first-run users are not pushed into Chrome-blocked system folders, show the real folder name, and make indexed files searchable.

---

## Product truth

Chrome may refuse Desktop / Downloads / Documents because they contain system files. SuHuella cannot bypass that.

In Web:

- one action: **Connect folder**
- branded pre-picker modal
- branded recovery if Chrome blocks
- display name = `FileSystemDirectoryHandle.name`
- Home count and Search read the same browser index
- files stay on device

Native Chrome picker/permission dialogs cannot be styled.

---

## Root cause

1. Sources presented Documents / Downloads / Pictures as guaranteed browser shortcuts.
2. Recents used the internal `src_…` id (`recentFolders` stored source ids; UI took the last path segment).
3. Scan could report `source.fileCount` before Search read the same file descriptors. Search also required token splits and missed simple filename substrings.

---

## UX change

Browser Sources no longer shows system-folder cards. Primary action is **Connect folder** / **Conectar carpeta**. A branded modal explains the work-folder path and includes the existing desktop Download CTA plus “to use every function, download the desktop app.” If Chrome blocks, a second branded modal explains the restriction and retries the picker.

---

## Files changed

- `desktop/src/components/BrowserFolderConnectDialog.tsx`
- `desktop/src/components/SourcesPanel.tsx`
- `desktop/src/components/SearchPanel.tsx`
- `desktop/src/components/HomePanel.tsx`
- `desktop/src/windows/SettingsWindow.tsx`
- `desktop/src/host/browser/store.ts`
- `desktop/src/host/browser/search.ts`
- `desktop/src/host/browser/connect-source.ts`
- `desktop/src/host/browser/fs.ts`
- `desktop/src/host/install-browser-host.ts`
- `desktop/src/host/capabilities.ts`
- `desktop/src/lib/sources-ui.ts`
- `site/public/sw.js` (`suhuella-web-shell-v4`)
- `site/lib/browser-sources-brand-flow-check.ts`
- `site/scripts/browser-sources-search-playwright.mjs`

---

## Tests run

```text
npm run test:browser-sources-brand-flow --prefix site   PASS
npm run test:browser-connect --prefix site              PASS
npm run check:app-host --prefix site                    PASS
```

Playwright on production (`https://suhuella.com`, Chromium, locale en-US):

```text
BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-connect-playwright --prefix site
  PASS — branded modal → mocked picker → source visible

BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-sources-search-playwright --prefix site
  PASS — folder informes, query factura → factura-enero.pdf
```

Sources UX production check:

- Connect folder present
- No This Mac
- No Documents Not-connected card
- Modal title: Connect a local folder
- Download CTA present in modal

---

## Production verification

| Field | Value |
|---|---|
| Worker | `4babd6bf-f2f8-4d37-8f51-942f96f816ff` |
| Browser | Chromium headless (Playwright) against suhuella.com |
| Folder name | informes |
| File count | 3 (factura-enero.pdf, contrato-cliente.docx, captura-yala.png) |
| Search query | factura |
| Result count | ≥ 1 (factura-enero.pdf) |
| Service worker | `suhuella-web-shell-v4` |

Use incognito or hard refresh so v4 loads.

---

## FIRST-RUN

May resume. Connecting a folder now shows the human name and Search can find a filename substring from that source.
