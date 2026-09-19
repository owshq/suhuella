# PRIVATE-BETA-001

```text
STATUS = CLOSED · SKIPPED
TYPE = Commercial validation
SCOPE = SuHuella Web + Desktop
CLOSED = 2026-09-19
REASON = Desirability proven when paying customers arrive — not a pre-launch gate
CHECKOUT = OFF
```

**Not** bug hunting alone. **Question:** after several days, would people choose to keep using SuHuella?

**Unblocked:** [PRE-BETA-SANITY-001.md](PRE-BETA-SANITY-001.md) **CLOSED · PASS** · [PRODUCT-FREEZE-001.md](PRODUCT-FREEZE-001.md) **OPEN**.

---

## Sequence

```text
PRODUCT-FREEZE-001  (OPEN)
        ↓
PRE-BETA-SANITY-001  (30–45 min · deploy gates PASS)
        ↓
PRIVATE-BETA-001
        ↓
    20–30 users · 7+ days each phase
        ↓
    0.1.0-rc1
        ↓
    Public launch
```

---

## Participants

**20–30 users** total across phases. **No project developers.**

| Phase | Count | Purpose |
| --- | --- | --- |
| 1 | 5 | Repeated friction surfaces early |
| 2 | 15–25 | Scale signals; trust and daily-use patterns |

**Mix:** office · freelancer · student · accountant · consultant · family — aligned with impression profiles where possible.

**Period:** minimum **7 consecutive days** per phase · real documents · not artificial demo folders.

**Entry:** `https://suhuella.com` — same public discovery as impression tests.

---

## Metrics (observable)

- install / first open
- folder connected
- first successful Search
- sessions per week
- documents found via Search
- Organise opened · Plan reviewed
- Activity viewed · Undo used (if Desktop later — Web limits honest)
- acceptance of recommendations (when applicable)

---

## After several days — ask only

1. Did it save time?
2. Did you trust it with your documents?
3. When did trust break?
4. Which action felt unnecessary?
5. What would make you use it daily?
6. Would you recommend it?
7. **Would you use it tomorrow?** (Yes / Maybe / No)

---

## Bug policy (during beta)

| Severity | Action |
| --- | --- |
| Critical | Fix immediately; document deploy |
| UX friction | Fix only when **repeated** across users |
| Feature requests | Record only — **never implement** during private beta |

Only **repeated** observations create new milestones. Architecture does not change during freeze.

---

## Exit criteria

- Users install and open **unassisted**
- Understand product purpose
- Connect a folder and **Search** successfully
- Trust local-only behaviour (no upload fear)
- **Continue after several days** without operator coaching
- Would recommend or use tomorrow (majority Yes/Maybe)
- No **critical** usability blockers remain

**Not success:** green CI · benchmark scores · developer approval alone.

---

## Deliverable

**Beta Summary** (one document):

```text
Participants (count + profiles)
Observed behaviour
Repeated friction (≥2 users)
Critical issues fixed
Roadmap changes (if any)
Decision: READY FOR RC1 | EXTEND PRIVATE BETA
```

---

## Close statuses

```text
PRIVATE-BETA-001 — CLOSED · READY FOR RC1
```

or

```text
PRIVATE-BETA-001 — CLOSED · EXTEND
```

---

## Out of scope

- checkout / Stripe live selling
- Desktop distribution in Web RC
- partner mode · multibrand
- new connectors / OAuth
- PRODUCTION-READINESS-001 substitution (separate technical gate)

---

## Next after PASS

Tag **0.1.0-rc1** when Web beta exit criteria met · then public launch planning.

Detail in README §9.2. This track is the **Web RC** gate; Desktop remains parallel and frozen.
