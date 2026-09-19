# SOURCES-CAPABILITY-MATRIX-001

```text
STATUS = CLOSED · PASS
TYPE = Sources UX / capability correctness blocker
SCOPE = SuHuella Web Sources
DATE = 2026-09-19
PRODUCTION = https://suhuella.com/sources
WORKER = ed49bf08-79a4-4c52-ad31-faadb9740078
```

Browser Sources shows every relevant source type with an honest state. Connect folder, index, Search, and Remove work on localhost and production. FIRST-IMPRESSION-TEST-001 is unblocked.

---

## Contract

| # | Check | Localhost | Production |
| --- | --- | --- | --- |
| 1 | Connect folder → human name → count → Search finds file | PASS | PASS |
| 2 | Remove → refresh → source does not reappear | PASS | PASS |
| 3 | Documents / Downloads / Desktop / Pictures = Limited in browser; Choose subfolder opens picker; blocked folder shows branded explanation | PASS | PASS |
| 4 | Google Drive / OneDrive / Dropbox = Coming later; no Connect | PASS | PASS |
| 5 | Developer Sources: Load demo → Search `factura` → `factura-enero.pdf` | PASS | absent (correct) |
| 6 | Repeat 1 on https://suhuella.com/sources | — | PASS |

Confirmed:

```text
- Connect folder creates source immediately
- Scan finishes and document count persists
- Documents appear in Search
- Remove is visible
- Remove does not reappear after scan race
- Files remain local / no upload language
```

---

## Production

| Field | Value |
| --- | --- |
| Command | `npm run deploy --prefix site` |
| Worker before | `444619e8-1128-47e7-8511-b68498379c5f` |
| Worker after | `ed49bf08-79a4-4c52-ad31-faadb9740078` |
| Checkout | `PAID_CHECKOUT_ENABLED=false` |
| Service worker | `suhuella-web-shell-v6` |

Chrome Playwright on https://suhuella.com (en-US, 2026-09-19):

- Catalog: Local folders + Connect folder; system folders Limited in browser; Cloud Coming later; iCloud Coming later; cloud cards have no buttons.
- Developer Sources / Load demo: absent.
- Mocked work folder: human name, document count, Search finds `factura-enero.pdf`.
- Remove stays gone after index refresh.
- Blocked system folder: branded “not available in this browser” + Choose another folder.

`verify:production` **PASS**. Hard refresh or incognito if a tab still holds `suhuella-web-shell-v5`.

---

## Product rules kept

| Group | State | Action |
| --- | --- | --- |
| Local folders | Indexed / Connect folder | Connect folder |
| System folders | Limited in browser | Choose subfolder → same picker |
| Cloud | Coming later | none |
| Developer Sources | localhost only | Load demo / Add folder |

Indexed, never Connected. No upload language. Cloud has no fake Connect.

---

## Tests

```text
npm run test:sources-capability-matrix --prefix site                         PASS
npm run test:browser-sources-brand-flow --prefix site                        PASS
BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-connect-playwright --prefix site
                                                                             PASS
BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-sources-search-playwright --prefix site
                                                                             PASS
BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-sources-card-playwright --prefix site
                                                                             PASS
BROWSER_CONNECT_URL=https://suhuella.com npm run test:browser-dev-sources-playwright --prefix site
                                                                             skipped (not localhost)
npm run test:browser-sources-card-playwright --prefix site                   PASS (localhost demo)
npm run verify:production --prefix site                                      PASS
```
