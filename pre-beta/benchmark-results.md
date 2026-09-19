# Pre-beta — benchmark results

```text
Track:     PRE-BETA-BENCHMARK-001
Type:      Product readiness (engineering)
Target:    https://suhuella.com
Date:      2026-09-19
Operator:  agent (Playwright)
Verdict:   PASS
```

First Impression (human trust/desirability) → [first-impression/](../first-impression/) optional · [PRIVATE-BETA-001](../PRIVATE-BETA-001.md)

## Contract

| # | Check | Pass | ms | Evidence |
| --- | --- | --- | ---: | --- |
| B1 | Landing loads with local-first copy | ✔ | 957 | https://suhuella.com |
| B2 | Open app from landing → /home | ✔ | 2995 | https://suhuella.com/home |
| B3 | Sources reachable · no Developer Sources on production | ✔ | 515 | no demo panel |
| B4 | Connect folder → human name visible | ✔ | 4255 | informes |
| B5 | Indexing completes | ✔ | 2 | document count or indexed state |
| B6 | Search finds known document | ✔ | 811 | factura-enero.pdf + open limit copy |
| B7 | Remove folder — does not reappear | ✔ | 2731 | gone after 1.8s |
| B8 | Cloud sources honest (Coming later, no Connect) | ✔ | 2 | 0 cloud action buttons |

## Timings

```text
Connect folder (B4):  4255 ms
Search (B6):          811 ms
Remove (B7):          2731 ms
```

## Decision

```text
PRE-BETA-BENCHMARK-001 — CLOSED · PASS
```

Re-run: `npm run test:pre-beta-readiness`
Production: `BROWSER_CONNECT_URL=https://suhuella.com npm run test:pre-beta-readiness --prefix site`
