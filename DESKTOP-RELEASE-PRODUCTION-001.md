# DESKTOP-RELEASE-PRODUCTION-001

```text
STATUS = IMPLEMENTED
COMMERCIAL DISTRIBUTION = DEFERRED (DECISION-PRIVATE-BETA-001)
TYPE = Publication (operations only)
SCOPE = First production-quality Desktop release
ARCHITECTURE = CLOSED — see RELEASE-PUBLISH-PIPELINE-001.md (DO NOT REOPEN)
PIPELINE = FROZEN · IMPLEMENTED · trusted commercial distribution deferred until signing enabled
```

Not architecture. Not pipeline design. **Execute, verify, log.**

The published binary must be exactly the packaged binary.

---

## Criterion (from here)

**Before:** Architecture → Refactor → Implementation

**Now:** User → Evidence → Bug → Implementation

When something fails during publication:

- ❌ Do not ask: *"Should we change the pipeline?"*
- ✅ Ask: *"What concrete bug caused this behaviour?"*

If it can be fixed as an implementation bug, the contract stays intact. Reopen architecture only via ADR (signing, auto-update, channels, storage change).

---

## Gated runbook

Run in order. **Do not advance until the current step is validated.**

```text
Gate 1   Package
Gate 2   Publish
Gate 3   Verify
Gate 4   Deploy
Gate 5   Smoke
Gate 6   Trusted Install        ← platform-by-platform (special gate)
Gate 7   First useful session   ← release gate; after Gate 6 for external beta
```

Gates 1–5 validate the **technical pipeline** (build · manifest · sha256 · worker · smoke). They remain useful while commercial distribution is deferred.

Gate 6 is **Trusted Install** — one status per platform (macOS · Windows · Linux). When `commercial-signing.json` status is `deferred`, Gate 6 is **DEFERRED** (not FAIL). Historical unsigned install failures are evidence only.

Commercial signing is **intentionally deferred** (DECISION-PRIVATE-BETA-001). `validate-release` returns **SKIPPED** (not FAIL). Pre-RC publication (Gates 1–5) continues. Promotion to `0.1.0-rc1` and external Private Beta stay blocked. See [PRE-RC-RELEASE-SEMANTICS.md](docs/governance/PRE-RC-RELEASE-SEMANTICS.md).

**Product maturity** (Search · Indexing · Organise · Onboarding · first useful session locally) continues — that is not Gate 7 the release gate.

When enabled, the contract is identical on every platform:

```text
mac      built · verified · signed · trusted · installable
windows  built · verified · signed · trusted · installable
linux    not opened
```

macOS: Developer ID, notarization, stapler, `spctl`. Windows: Authenticode (same bar — not lower).

**Private Beta = BLOCKED** until decision superseded. See [DECISION-PRIVATE-BETA-001.md](docs/governance/DECISION-PRIVATE-BETA-001.md).

Example gate (signing deferred):

```text
Gates 1–5            ✓   (technical pipeline — still valid)
Gate 6 Trusted Install DEFERRED
Gate 7 release         DEFERRED
Private Beta           BLOCKED
Product work           continues locally
```

Example gate (signing enabled):

```text
validate-release     PASS / FAIL per platform
Gate 6 global        PASS only if every advertised platform PASSes
```

---

## Flight recorder

One file per release — **historical evidence when closed**, not governance:

```text
RELEASE-v0.1.0-pre-rc-EXECUTION.md
RELEASE-v0.1.0-rc1-EXECUTION.md
RELEASE-v0.1.0-EXECUTION.md
```

Loop: `Runbook → Execute → Observe → Classify → Fix → Re-run → Prevent recurrence`

Incident table columns: **Issue · Classification · Fix · Prevent recurrence**

Classification (one per incident): Product · Release · Infrastructure · Environment · External service · Operator

Current run: [RELEASE-v0.1.0-pre-rc-EXECUTION.md](RELEASE-v0.1.0-pre-rc-EXECUTION.md)

---

## Definition of done

- [ ] DMG generated (`package:mac`)
- [ ] `npm run validate-release -- --platform mac` PASS (signed · trusted by OS · installable)
- [ ] `npm run validate-release -- --platform windows` PASS (Authenticode)
- [ ] Published with SHA256 sidecar (`publish:desktop-mac` · `publish:desktop-win`)
- [ ] `npm run verify:desktop-artifact -- --platform mac` PASS
- [ ] `npm run verify:desktop-artifact -- --platform windows` PASS
- [ ] Deploy live (site + download worker)
- [ ] `npm run smoke:desktop-download` PASS
- [ ] Manual download from suhuella.com PASS (preparing page, correct file, no blank tab)
- [ ] First launch PASS (icons, About version, SHA256 matches manifest)
- [ ] **First useful session** — connect folder → search → open a document

The downloaded DMG equals the packaged DMG.

**User bar:** someone who has never seen SuHuella reaches their first useful result without help.

---

## Not in scope

- Pipeline / release architecture (CLOSED — [RELEASE-PUBLISH-PIPELINE-001.md](RELEASE-PUBLISH-PIPELINE-001.md))
- Download UX design ([DOWNLOAD-EXPERIENCE-001.md](DOWNLOAD-EXPERIENCE-001.md) — implemented; validate in step 6)
- First launch onboarding depth ([FIRST-LAUNCH-EXPERIENCE-001.md](FIRST-LAUNCH-EXPERIENCE-001.md))
- Source Domain tracks

---

## Next

When all gates PASS → close this track · continue [PRIVATE-BETA-001.md](PRIVATE-BETA-001.md) with real users.
