# DESKTOP-INDEXING-RESPONSIVENESS

```text
STATUS = OPEN
TYPE = Desktop indexing debt
SCOPE = Desktop main-process scan yield
```

`statSync` / yield every 40 folders can stall the main process during a large flat-folder scan.

This is a separate debt note. It is **not** proven as the old idle 628% CPU bug. Do not treat a Desktop CPU fix as in scope here; do not change `indexer.ts` from this note alone.
