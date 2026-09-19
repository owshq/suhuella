# Product Evolution Policy

```text
STATUS = ACTIVE · PERMANENT
EFFECTIVE = 2026-09-19
TYPE = Engineering policy (not a track)
SUPERSEDES = PRODUCT-DEVELOPMENT-POLICY-001 · opinion-driven tracks · internal redesigns
```

The greatest risk is no longer technical. It is changing a product that not enough people have used yet.

> **Architecture is frozen; user experience is not. Experience evolves only when real usage evidence shows it must.**

Freezing architecture is not a barrier to improving the product. It prevents redesign by intuition — not response to clear patterns from users, sessions, or telemetry.

---

## Stable foundation (do not rewrite)

Constitutional index: **[docs/governance/README.md](docs/governance/README.md)**

**Do not create new “master” documents** for areas already covered there.

**Before:** think architecture → implement.  
**Now:** users → observe → one narrow fix → repeat.

---

## Frozen

| Area | Status | Rule |
| --- | --- | --- |
| Release architecture | **FROZEN** | [RELEASE-ARCHITECTURE-FROZEN.md](RELEASE-ARCHITECTURE-FROZEN.md) |
| Brand identity hierarchy | **FROZEN** | [ADR-003](docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md) |
| Product architecture | **FROZEN** | Architecture Freeze v1.1 — FINAL |
| Navigation structure | **FROZEN** | Screen order and names — until UX evidence says otherwise |
| Release model | **FROZEN** | `release.json` → build → `/api/release` → clients |

**Do not open new architecture tracks.**

Implementation (e.g. [DESKTOP-RELEASE-HOSTING-001](DESKTOP-RELEASE-HOSTING-001.md)) builds **on** frozen architecture — it does not redesign it.

---

## Navigation (frozen until evidence)

```text
Landing → Home → Sources → Search → Organise → Activity → Settings
```

Until **UX evidence** shows the same navigation problem (see evidence bar below):

- Do not move buttons.
- Do not change menus.
- Do not rename screens.

Copy, empty states, and in-screen clarity **inside** a screen may still change — with evidence.

---

## How we work

**Before:**

```text
Problem → Track → Code → PASS
```

**Now:**

```text
User → Observation → Real problem → One narrow fix → Observe again
```

One observed problem → one track → one fix. Do not redesign adjacent areas.

---

## Evidence bar (not always three users)

**Opinion is not sufficient. Telemetry is evidence.**

| Change type | Evidence required |
| --- | --- |
| **UX / discoverability** (copy, layout, navigation, empty states) | Multiple users **or** strong telemetry (e.g. 95% abandon Connect Folder) |
| **Functional bugs** | One reproducible case |
| **Security** | One confirmed issue |
| **Data loss** | One confirmed issue |

```text
UX / discoverability     → evidence from multiple users OR telemetry

Functional bugs          → one reproducible case

Security                 → one confirmed issue

Data loss                → one confirmed issue
```

For UX, three users with the same problem is a safe default — not a rule for emergencies.

Valid evidence sources:

- First Impression sessions ([FIRST-IMPRESSION-TEST-001](FIRST-IMPRESSION-TEST-001.md))
- Private Beta · support · ops · bug reports
- **Production telemetry** (funnels, drop-off, errors, session replay where available)

---

## What justifies a track

```text
Evidence (users · telemetry · confirmed incident)
        ↓
One narrow track (e.g. SOURCE-COPY-001)
        ↓
One fix
        ↓
Observe again
```

Not four parallel tracks for one comment:

```text
SOURCE-COPY-001 · SOURCE-CARD-001 · SOURCE-HOME-001 · SOURCE-CTA-001  ✗
```

---

## No internal redesigns

- No new “master” or architecture exploration documents.
- No speculative UX overhauls.
- No parallel tracks for the same observation.
- Production blockers and bugfixes: yes — minimal scope.
- Architecture changes: **documented architectural decision** + explicit approval only.

---

## Product path (evidence-driven)

Frozen process: [docs/governance/RELEASE-PROCESS-FROZEN.md](docs/governance/RELEASE-PROCESS-FROZEN.md)

```text
Develop → Internal testing → First Impression → Private Beta → Feedback → RC → Public Release
```

No phase may be skipped except critical incident. Tracks after First Impression come from **users and telemetry** — not internal planning.

---

## Agent rule

> **Architecture frozen. Navigation structure frozen. Release model frozen. User experience evolves only with evidence — from users, sessions, telemetry, or confirmed incidents. One problem → one narrow fix.**

Read this policy before opening any new track.
