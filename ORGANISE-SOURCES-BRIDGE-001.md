# ORGANISE-SOURCES-BRIDGE-001

```text
STATUS = CLOSED · PASS
TYPE = Narrow UX bridge
SCOPE = Sources browse → Organise preloaded context
DATE = 2026-09-19
```

Core rule:

> Sources answers “what is there”. Organise answers “what to do”.

## Behaviour

In **Source browse**:

- Checkbox per file row; folders stay browsable only.
- Selected count in the bottom bar.
- **Organise this folder** when nothing is selected.
- **Organise these files** when one or more files are selected.

On click:

- Writes `suhuella-pending-organise` to `sessionStorage` (no URL path leakage).
- Navigates to `/organise`.
- Closes source browse.

**Organise** on load:

- Consumes pending context once.
- Resolves descriptors from the local index.
- Starts Plan draft analysis.

Sources never shows Plan, destinations, scores, or Confirm Plan.

## Tests

```bash
npm run test:organise-sources-bridge --prefix site
npm run test:organise-sources-bridge-playwright --prefix site  # requires playwright
```

Unit check: **PASS**

## Manual

Localhost:

1. Load demo data on Sources.
2. Open **dev-data** browse.
3. Select `factura-enero.pdf` → **Organise these files** → Plan draft on Organise.
4. Return to browse with no selection → **Organise this folder** → folder context on Organise.

## Out of scope

Organise split view, Plan UI in Sources, recommendation/Activity/execution changes.
