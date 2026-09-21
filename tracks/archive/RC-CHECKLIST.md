# SuHuella 0.1.0-pre-rc

Pre-release candidate — **not** tagged `0.1.0-rc1` until Desktop · Web · production routes · and installer all pass together.

Architecture, model, and principles are **frozen**. Work from here is **LICENSE-PAID-GRANT-DURABILITY-001 → PRODUCTION-READINESS-001 recheck → promote to rc1 → RC checklist → REAL-USER-VALIDATION-001**.

---

## In this RC

- Recommendation
- Sources
- Search
- Organise
- Activity
- Workflows
- BYOK
- Desktop polish (in progress)
- Web shell (local)

---

## Known issues

- **Production gate** — PRODUCTION-READINESS-001 **BLOCKED · NOT READY FOR RC**. One P0: paid grants still use Worker process memory. Routes / forged success / Organise regression pass. Next: LICENSE-PAID-GRANT-DURABILITY-001, then reverify the gate.
- **Windows packaging** — Save As channel not validated on Windows (WINDOWS-COMPATIBILITY-001 BLOCKED).

---

## Manual checklist

Run on **Desktop (Mac)** and **Browser** before tagging the next RC. Mark each line when it passes.

```text
Release Candidate

□ Install
□ Open
□ Dock / taskbar
□ Tray
□ Sources
□ Search
□ Organise
□ Confirm Plan
□ Activity
□ Undo
□ Browser (/home)
□ Settings
□ About
□ Notifications
□ Save As (Desktop · where supported)

PASS
```

Notes: _______________________________________________

Tester: _______________  Date: _______________  Host: Desktop / Browser

---

## First impression (5 minutes)

Give someone the app for **five minutes**. Say **nothing**. Observe only.

When they finish, ask **one question**:

> What does this application do?

**PASS** if they answer something like:

> Organises my documents and recommends where to save them.

**FAIL** if they answer:

> I'm not sure…

Fix UX friction. Tag **0.1.0-rc2**. Repeat until five to ten people use it without help — then ship **0.1.0**.

---

## Release rhythm

```text
0.1.0-pre-rc  →  PRODUCTION-READINESS-001  →  0.1.0-rc1  →  test  →  fix  →  0.1.0  →  Beta
```

Operations:

- DEPLOYMENT-PIPELINE-001 — **CLOSED · PASS** (`npm run verify:production`)
- LICENSE-AUDIT-001 — **CLOSED · PASS** (paid = customer right · gifts revocable with audit · admin manages access/support · billing provider controls paid entitlement)
- LICENSE-CHECKOUT-UX-001 — **CLOSED · PASS** (download ≠ purchase ≠ activation · verify Stripe then auto-activate)
- PRODUCTION-READINESS-001 — **OPEN** (assets · SEO · PWA · browsers · responsive)
- BROWSER-CAPACITY-AND-GRACEFUL-DEGRADATION-AUDIT-001 — **CLOSED · PASS** (`npm run test:service-health --prefix site`). High traffic ≠ browser disabled. Service health is one persisted state (NORMAL / DEGRADED / WEB_CAPACITY_LIMITED). Local Home · Search · Organise stay available. OTP/Stripe limits do not shed Organise.
- WINDOWS-COMPATIBILITY-001 — Save As on Windows
