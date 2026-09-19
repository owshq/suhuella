# PRE-BETA-BENCHMARK-001

```text
STATUS = CLOSED · PASS
TYPE = Product readiness (engineering)
SCOPE = SuHuella Web
DATE = 2026-09-19
PRODUCTION = https://suhuella.com
```

**Not First Impression.** This track validates **product readiness** — what Playwright can prove objectively.

| Layer | Track | Question |
| --- | --- | --- |
| **A — Readiness (engineering)** | PRE-BETA-BENCHMARK-001 | Does the first-run path work? |
| **B — Desirability (market)** | PRIVATE-BETA-001 | Would people keep using it? |

Human **First Impression** ([first-impression/](first-impression/)) stays reserved for optional trust observation — not an RC gate.

Results: [pre-beta/benchmark-results.md](pre-beta/benchmark-results.md)

---

## Contract (B1–B8)

| # | Check |
| --- | --- |
| B1 | Landing · local-first copy |
| B2 | Open app → `/home` |
| B3 | Sources · no Developer Sources on production |
| B4 | Connect → human display name |
| B5 | Indexing completes |
| B6 | Search finds document |
| B7 | Remove persistent |
| B8 | Cloud honest |

Plus: `test:sources-capability-matrix` · `verify:production`

---

## Run

```bash
npm run test:pre-beta-readiness              # from repo root
BROWSER_CONNECT_URL=https://suhuella.com npm run test:pre-beta-readiness --prefix site
```

---

## Flow

```text
PRE-BETA-BENCHMARK-001  (agent)
        ↓
PRE-BETA-SANITY-001
        ↓
DESKTOP-RELEASE-HOSTING-001
        ↓
PRIVATE-BETA-001  (desirability · real users)
```

| Outcome | Next |
| --- | --- |
| **PASS** | [PRE-BETA-SANITY-001](PRE-BETA-SANITY-001.md) |
| **FAIL** | One blocker slice → re-run benchmark |

Supersedes engineering gate formerly named FIRST-IMPRESSION-BENCHMARK-001.
