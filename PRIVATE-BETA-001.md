# PRIVATE-BETA-001

```text
STATUS = BLOCKED
TYPE = External commercial validation
SCOPE = SuHuella Web + Desktop (macOS + Windows user-launchable)
REASON = Missing commercial code-signing — blocks promotion to 0.1.0-rc1 and this beta, not pre-RC development or artifact publication
CHECKOUT = OFF
LINUX = not opened
DECISION = DECISION-PRIVATE-BETA-001
SEMANTICS = docs/governance/PRE-RC-RELEASE-SEMANTICS.md
```

```text
Not a product blocker.
Not a release engineering blocker.
Does not block 0.1.0-pre-rc builds, uploads, downloads, or internal QA.

External prerequisite — Apple Developer + Authenticode before 0.1.0-rc1.

Primary metric: Can a first-time user obtain a useful result without assistance?

First useful session: understand product · connect folder · indexing · search · organise · daily use.

Private Beta reopens when:
  0.1.0-rc1 is promoted
  commercial-signing.json status = enabled
  validate-release PASS
  Gate 6 Trusted Install PASS (Mac + Windows if advertised)
```

See [docs/governance/DECISION-PRIVATE-BETA-001.md](docs/governance/DECISION-PRIVATE-BETA-001.md).

**Not** bug hunting alone. **Question:** after several days, would people choose to keep using SuHuella?

**Unblocked:** [PRE-BETA-SANITY-001.md](PRE-BETA-SANITY-001.md) **CLOSED · PASS** · [PRODUCT-FREEZE-001.md](PRODUCT-FREEZE-001.md) **OPEN**.

---

## Sequence

Signing gates **this** beta. It does not gate pre-RC publication. See [Pre-RC release semantics](docs/governance/PRE-RC-RELEASE-SEMANTICS.md).

```text
0.1.0-pre-rc                     active now
        ↓
Mac + Windows artifacts          published for technical testing
        ↓
/api/release + website downloads
        ↓
product / technical gates
        ↓
commercial signing gates
        ↓
0.1.0-rc1
        ↓
PRIVATE-BETA-001                 20–30 external users
        ↓
Public launch
```

Do not invite external beta users until `0.1.0-rc1` exists (trusted install on every advertised desktop platform). Keep building and publishing `0.1.0-pre-rc` until then.

### Desktop scope (decided 2026-09-20)

```text
Private Beta = Mac + Windows user-launchable
```

Both platforms use the same release validation contract. Neither is a lower bar.

| Platform | Gate 6 Trusted Install (when enabled) | Current status |
| --- | --- | --- |
| macOS | Chrome download · install · open (no `xattr`) | **DEFERRED** — requires Developer ID + notarization |
| Windows | Browser download · install · open | **DEFERRED** — requires Authenticode |
| Linux | — | **NOT OPENED** |

Gate 6 global: **DEFERRED** while `commercial-signing.json` status is `deferred`. Historical unsigned install failures are evidence — not the current operational status.

**While signing is deferred:** pre-RC Mac and Windows downloads may exist and must be labelled as technical pre-releases, not as a trusted external beta. Do not describe an unsigned build as a normal Private Beta install.

macOS-only is acceptable for **internal technical testing** only — not Private Beta when the site advertises Mac + Windows.

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
Decision: CONTINUE PUBLIC LAUNCH | EXTEND PRIVATE BETA
```

---

## Close statuses

```text
PRIVATE-BETA-001 — CLOSED · READY FOR PUBLIC LAUNCH
```

or

```text
PRIVATE-BETA-001 — CLOSED · EXTEND
```

---

## Out of scope

- checkout / Stripe live selling
- presenting `0.1.0-pre-rc` as Private Beta or as `rc1`
- partner mode · multibrand
- new connectors / OAuth
- PRODUCTION-READINESS-001 substitution (separate technical gate)

---

## Next after PASS

External beta runs on **0.1.0-rc1**, after trusted-install gates. It does not promote a pre-RC build, and passing beta is not what creates `rc1`.

This track is the external-distribution gate. Pre-RC downloads stay on the release pipeline.
