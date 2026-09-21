# PRE-RC-TRACKS-001

```text
STATUS = OPEN · MAINTENANCE ONLY
TYPE = Pre-RC work list (closed items + active evidence-driven work)
PRODUCTION-READINESS-001 = DEFERRED
POLICY = PRODUCT-EVOLUTION-POLICY — no new architecture tracks
```

New tracks open only from **evidence** (users · telemetry · confirmed incidents). See [PRODUCT-EVOLUTION-POLICY.md](PRODUCT-EVOLUTION-POLICY.md).

Constitution (stable architecture): [docs/architecture/constitution/README.md](docs/architecture/constitution/README.md). Roadmap lives here — not in the constitution.

**Primary metric:** Can a first-time user obtain a useful result without assistance?

**First useful session:** understand product · connect folder · indexing · search · organise · daily use.

Release pipeline is **implemented**; trusted commercial distribution is **deferred** ([DECISION-PRIVATE-BETA-001](docs/governance/DECISION-PRIVATE-BETA-001.md)).

---

## Product roadmap (current)

Changes weekly. Not constitutional.

```text
Browser Adapter wiring
        ↓
Electron Adapter
        ↓
Desktop Release
        ↓
Download Experience
        ↓
Private Beta
        ↓
Real feedback → one narrow slice → repeat
```

**After beta (reserved, not opened yet):** Google Drive → Dropbox → OneDrive → iOS → Android.

Each new track must answer yes to at least one: works better · easier to use · fixes an observed problem. See [Decision precedence](docs/governance/DECISION-PRECEDENCE.md).

---

```text
PRE-RC-TRACKS-001
    OPEN

P0 CHECKOUT-PRODUCTION-ENABLEMENT-001
    CLOSED · PASS WITH FIXES · READY FOR STRIPE

P0 RESEND-PRODUCTION-001
    CLOSED · OTP PRODUCTION PROVEN

P0 RESEND-LIVE-OTP-PROOF-001
    CLOSED · PASS

P0 RESEND-LIVE-INBOX-VERIFY-001
    CLOSED · PASS (alias — see RESEND-LIVE-OTP-PROOF-001)

P0 APP-MODAL-SHELL-001
    CLOSED · PASS

P0 APP-MODAL-SHELL-PRODUCTION-DEPLOY-001
    CLOSED · PASS

P0 COMBINED-PRE-RC-SMOKE-001
    CLOSED · PASS (post-deploy rerun 2026-09-19)

P0 DOWNLOAD-PAGE-SEMANTICS-001
    NOT OPENED — superseded by APP-MODAL-SHELL-001

P1 VERSION-CONSISTENCY-001
    CLOSED · PASS WITH FIXES

P1 FIRST-RUN-EXPERIENCE-PREP-001
    CLOSED · READY

P0 BROWSER-CONNECT-SOURCE-001
    CLOSED · PASS

P0 BROWSER-SOURCES-BRAND-FLOW-001
    CLOSED · PASS

P0 BROWSER-SOURCE-INDEX-SEARCH-001
    CLOSED · PASS (same slice)

P0 SOURCES-CAPABILITY-MATRIX-001
    CLOSED · PASS

P0 BROWSER-ORGANISE-SELECTION-001
    CLOSED · PASS

P0 ORGANISE-SOURCES-BRIDGE-001
    CLOSED · PASS

P0 SOURCE-DOMAIN-MODEL-001
    FROZEN · CORE — identity / handle / health / lifecycle / presentation

P0 SOURCE-PLATFORM-READINESS-001
    CLOSED · PASS — domain ready for iOS/Android (no mobile UI)

P0 MULTI-PLATFORM-SOURCE-ADAPTERS-001
    FROZEN · PASS — Handle adapters only; domain unchanged

P1 BROWSER-SOURCE-ADAPTER-001
    OPEN · REFERENCE IMPLEMENTATION

P1 BROWSER-ADAPTER-WIRING-001
    OPEN · AUTOMATED PASS · MANUAL PENDING · FREEZE BLOCKED

P1 BROWSER-SOURCE-ADAPTER-INTEGRATION-001
    CLOSED · PASS — browser host uses SourceHandle only for access

P1 ELECTRON-SOURCE-ADAPTER-001
    CLOSED · PASS — Desktop path → SourceHandle

P1 DESKTOP-RELEASE-PRODUCTION-001
    OPEN · NOW — infrastructure only (binary = published binary)

P1 DOWNLOAD-EXPERIENCE-001
    OPEN — immediately after Desktop Release PASS (same user flow)

P1 FIRST-LAUNCH-EXPERIENCE-001
    OPEN — after Download Experience PASS (Install → first source)

P1 PRIVATE-BETA-001
    OPEN — after Desktop binary + Download + First Launch PASS

P1 GOOGLE-DRIVE-SOURCE-ADAPTER-001
    RESERVED — after Browser + Desktop are impeccable

P1 IOS-SOURCE-ADAPTER-001
    RESERVED

P1 ANDROID-SOURCE-ADAPTER-001
    RESERVED

P1 CLOUD-ADAPTERS-RESERVED
    Dropbox · OneDrive · NAS · SMB — not opened yet

P0 PRE-BETA-BENCHMARK-001
    CLOSED · PASS (2026-09-19 · https://suhuella.com)

P1 PRE-BETA-SANITY-001
    CLOSED · PASS — 2026-09-19

P1 FIRST-IMPRESSION-TEST-001
    CLOSED · PASS — operator waived · 2026-09-19

P1 FIRST-IMPRESSION-OBSERVATION-MODE-001
    SUPERSEDED

P1 FIRST-IMPRESSION-SUMMARY-001
    CLOSED · PASS — operator waived · 2026-09-19

P1 PRODUCT-FREEZE-001
    OPEN — 2026-09-19

P1 PRIVATE-BETA-001
    OPEN — 2026-09-19

P1 FIRST-RUN-EXPERIENCE-001
    SUPERSEDED — see FIRST-IMPRESSION-TEST-001

P1 RELEASE-PUBLISH-PIPELINE-001
    OPEN — operator checklist; publish without product code changes

P1 RELEASE-LIFECYCLE-001
    OPEN · PHASE A PASS — Phase B deferred until pipeline + hosting

P1 DESKTOP-RELEASE-HOSTING-001
    CLOSED · PASS (2026-09-19 · Mac via download.suhuella.com)

P1 DESKTOP-RELEASE-ARTIFACTS-001
    CLOSED · PASS — Mac public via alias

P1 DESKTOP-DMG-HOSTING-UNBLOCK-001
    CLOSED · PASS

P1 BRAND-THEME-TOKENS-001
    CLOSED · PASS

P1 BRANDING-HIERARCHY-001
    SUPERSEDED — ADR-003 Brand Identity Hierarchy (permanent)

P1 OPERATIONS-ACCESS-CLOSEOUT-001
    CLOSED · PASS

P1 WINDOWS-VALIDATION-001
    DEFERRED — Desktop not in RC
```

Do not run **PRODUCTION-READINESS-001** until the tracks below are closed.

That gate is the last technical audit before people. Resend OTP is proven. Checkout off. Version closed.

**Critical path (Web — engineering gates done):**

```text
SOURCE-PLATFORM-READINESS-001     CLOSED · PASS
BROWSER-SOURCE-ADAPTER-001        reference
ELECTRON-SOURCE-ADAPTER-001      CLOSED · PASS
PRE-BETA-BENCHMARK-001            CLOSED · PASS
PRE-BETA-SANITY-001               CLOSED · PASS
```

**Critical path (Desktop delivery — active now):**

```text
DESKTOP-RELEASE-PRODUCTION-001    OPEN · NOW (infra only)
        ↓
DOWNLOAD-EXPERIENCE-001           (same user flow · product)
        ↓
FIRST-LAUNCH-EXPERIENCE-001       (Install → Launch → License → Home → first source)
        ↓
PRIVATE-BETA-001                    (20–30 users · desirability)
        ↓
0.1.0-rc1
        ↓
Public launch
```

Do not start **PRIVATE-BETA-001** until Desktop binary, Download experience, and First launch experience are **CLOSED · PASS**. Entry criterion — not “all tests green”: [Would we watch a stranger complete their first session without help?](docs/governance/DECISION-PRECEDENCE.md#private-beta-entry)

**Next:** **DESKTOP-RELEASE-PRODUCTION-001**. **No new architecture tracks until after Private Beta PASS.** No cloud or mobile adapters until Browser + Desktop are impeccable and beta feedback is in.

**User evidence drives priority.** **Architecture is validated through shipped product and user evidence.** Scoreboard — user behaviours, not deliverables ([DECISION-PRECEDENCE.md](docs/governance/DECISION-PRECEDENCE.md#operational-scoreboard)):

```text
□ User downloads SuHuella
□ User installs it
□ User launches it
□ User understands what to do
□ User connects a folder
□ User finds a document
□ User completes a first successful session
```

Delivery flow (all energy here): Desktop Release → Download → Install → First Launch → Connect Folder → Search → External User Feedback.

**Post-beta architecture:** only when observed evidence proves insufficiency — not because it feels cleaner. Priority: Critical (cannot continue) → High (confused) → Medium (friction) → Low (developer preference · waits).

Domain frozen — [SOURCE-DOMAIN-MODEL-001.md](SOURCE-DOMAIN-MODEL-001.md) · validation Browser ✓ · Electron ✓ · Google Drive after beta.

[BROWSER-ORGANISE-SELECTION-001.md](BROWSER-ORGANISE-SELECTION-001.md) is **CLOSED · PASS**. Browser Organise can create a Plan from connected sources or a local picker. Execution limits stay separate.

Web engineering gates are done. Desktop delivery is the active path (see above).

```text
DESKTOP_IN_RC = NO          (Web RC scope unchanged)
/download = unified flow    (infra → UX → first launch → beta)
```

Hosting prerequisites (**DESKTOP-RELEASE-HOSTING-001** **CLOSED · PASS**) are met. Remaining work is production publish + product experience, not packaging architecture.

Do not open Google Drive, Dropbox, OneDrive, NAS, SMB, iOS, or Android adapters until Browser + Desktop are impeccable.

After Desktop delivery tracks pass, stop opening internal audits unless a real user finds a problem.

Do not add architecture tracks. Do not open BYOK, Connections, Automation, or Multibrand.

---

## P0

### 1. CHECKOUT-PRODUCTION-ENABLEMENT-001 — CLOSED · PASS WITH FIXES

`READY_FOR_STRIPE = YES`. `PUBLIC_CHECKOUT_ENABLED = NO`.

Lifetime / Monthly stay unavailable. Business stays Contact Sales. `PAID_CHECKOUT_ENABLED=false`. `verify-session` fail-closed on forged and on test material at suhuella.com. Turning sales on later is configuration only.

Report: [CHECKOUT-PRODUCTION-ENABLEMENT-001.md](CHECKOUT-PRODUCTION-ENABLEMENT-001.md).

### 2. RESEND-PRODUCTION-001 — CLOSED · OTP PRODUCTION PROVEN

Live OTP received and verified on production. Controlled test inbox provider `gmail.com`. Sending domain remains `suhuella.com`. From `licenses@suhuella.com`, Reply-To `support@suhuella.com`.

Report: [RESEND-PRODUCTION-001.md](RESEND-PRODUCTION-001.md).

Operator close: [RESEND-LIVE-OTP-PROOF-001.md](RESEND-LIVE-OTP-PROOF-001.md) — **CLOSED · PASS** (2026-09-19).

Deploy: [APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md](APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md) — **CLOSED · PASS** (2026-09-19). Worker `688364c5-7834-4b5c-9069-27c7ddc17026`.

Combined smoke: [COMBINED-PRE-RC-SMOKE-001.md](COMBINED-PRE-RC-SMOKE-001.md) — **CLOSED · PASS** (post-deploy rerun 2026-09-19).

Browser sources: [BROWSER-SOURCES-BRAND-FLOW-001.md](BROWSER-SOURCES-BRAND-FLOW-001.md) — **CLOSED · PASS**. Next: [PRE-BETA-SANITY-001.md](PRE-BETA-SANITY-001.md) — **OPEN**.

### 3. DESKTOP-RELEASE-DISTRIBUTION-001 — CLOSED · PASS

**Strategy B.** `DESKTOP_IN_RC = NO`.

Browser `/home` is the only public RC entry. No public Download CTA. `/api/release` has version only, no installer URLs. Desktop stays internal until a real publish path exists.

Report: [DESKTOP-RELEASE-DISTRIBUTION-001.md](DESKTOP-RELEASE-DISTRIBUTION-001.md).

---

## P1

### 4. VERSION-CONSISTENCY-001 — CLOSED · PASS WITH FIXES

One version authority: **`0.1.0-pre-rc`** until tagged **rc1**.

```text
BrandConfig → release.json → desktop → About → browser → Worker
```

No mixed public `0.1.0` / `0.1.0-pre-rc` / `0.1.0-web`. Leftover `0.1.0` is compatibility or history only.

Report: [VERSION-CONSISTENCY-001.md](VERSION-CONSISTENCY-001.md).

### 5. APP-MODAL-SHELL-001 — CLOSED · PASS

Combined smoke blocker fix (corrected). Replaces [DOWNLOAD-PAGE-SEMANTICS-001.md](DOWNLOAD-PAGE-SEMANTICS-001.md) (not opened). Route-backed overlays at `/`, `/license`, `/download`, `/license/success` inside app shell — no `?modal=` URLs. Reuses existing route content. Fixes `/download` semantics and `verify-session` forged id classification.

Report: [APP-MODAL-SHELL-001.md](APP-MODAL-SHELL-001.md).

### 6. APP-MODAL-SHELL-PRODUCTION-DEPLOY-001 — CLOSED · PASS

Production deploy and verification of **APP-MODAL-SHELL-001** on https://suhuella.com. Worker `688364c5-7834-4b5c-9069-27c7ddc17026`. `/download` post-purchase copy absent; `verify-session` forged id returns 400 `invalid_session`. All post-deploy tests pass.

Report: [APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md](APP-MODAL-SHELL-PRODUCTION-DEPLOY-001.md).

### 7. COMBINED-PRE-RC-SMOKE-001 — CLOSED · PASS

Post-deploy rerun (2026-09-19) on Worker `688364c5-7834-4b5c-9069-27c7ddc17026`. Previous blockers resolved: `/download` no post-purchase copy; `verify-session` forged id → 400 `invalid_session`. All smoke tests pass.

Report: [COMBINED-PRE-RC-SMOKE-001.md](COMBINED-PRE-RC-SMOKE-001.md).

### 8. FIRST-RUN-EXPERIENCE-PREP-001 — CLOSED · READY

Session preparation only: participant criteria, folder plan, observer script, timing/observation templates, post-session questions, pass criteria. Does **not** run the live session.

Report: [FIRST-RUN-EXPERIENCE-PREP-001.md](FIRST-RUN-EXPERIENCE-PREP-001.md).

Participant profile fields remain **TBD — operator selects** until scheduling.

### 8b. BROWSER-CONNECT-SOURCE-001 — CLOSED · PASS

Browser Connect commits the source before scan. Production Worker `ad7d2436-f60e-48dd-8163-7a927be5229e`. Playwright seam on https://suhuella.com **PASS**.

Report: [BROWSER-CONNECT-SOURCE-001.md](BROWSER-CONNECT-SOURCE-001.md).

### 8c. BROWSER-SOURCES-BRAND-FLOW-001 — CLOSED · PASS

Same slice as **BROWSER-SOURCE-INDEX-SEARCH-001**. Browser no longer presents Documents / Downloads / Pictures as guaranteed sources. Connected folder shows the human name. Search finds filename substrings from the same index. Production Worker `4babd6bf-f2f8-4d37-8f51-942f96f816ff`.

Report: [BROWSER-SOURCES-BRAND-FLOW-001.md](BROWSER-SOURCES-BRAND-FLOW-001.md).

### 8d. SOURCES-CAPABILITY-MATRIX-001 — CLOSED · PASS

Localhost and production `https://suhuella.com/sources` show Local / Limited in browser / Coming later. Connect folder, document count, Search, and Remove hold. Developer Sources stays localhost-only. Worker `ed49bf08-79a4-4c52-ad31-faadb9740078`.

Report: [SOURCES-CAPABILITY-MATRIX-001.md](SOURCES-CAPABILITY-MATRIX-001.md).

### 8e. SOURCE-DOMAIN-MODEL-001 — FROZEN · CORE

Canonical Source contract. Lifecycle is a chapter, not the top-level name.

```text
Source is identity.
Handle is access.
Presentation is derived.
The UI never decides.
```

React receives `SourcePresentation` `{ summary, status, actions }` only. Domain speaks action IDs (`retry`), never button copy.

Report: [SOURCE-DOMAIN-MODEL-001.md](SOURCE-DOMAIN-MODEL-001.md).

### 8e2. MULTI-PLATFORM-SOURCE-ADAPTERS-001 — FROZEN · PASS

Handle adapters only. Source, Lifecycle, and Presentation stay frozen. Replacing a Browser FSA adapter with Drive (or any other) keeps Source ID, Activity, Plans, Search history, and document identity.

Report: [MULTI-PLATFORM-SOURCE-ADAPTERS-001.md](MULTI-PLATFORM-SOURCE-ADAPTERS-001.md).

### 8e2b. BROWSER-ADAPTER-WIRING-001 — OPEN · AUTOMATED PASS · MANUAL PENDING · FREEZE BLOCKED

Store talks only to `browserHandles`. Connect / Restore / Refresh / Remove / Probe go Registry → Store. Do not write FROZEN until 5-minute Chrome smoke passes (Connect → Index → Search → Restore → Remove). Close rule: no further browser wiring refactors unless a functional bug is found; new providers use Registry only.

Report: [BROWSER-ADAPTER-WIRING-001.md](tracks/archive/BROWSER-ADAPTER-WIRING-001.md).

### 8e2c. BROWSER-SOURCE-ADAPTER-INTEGRATION-001 — CLOSED · PASS

Browser host access goes through SourceHandle. Scan opens the handle first. Grant remains the IndexedDB token.

Report: [BROWSER-SOURCE-ADAPTER-INTEGRATION-001.md](BROWSER-SOURCE-ADAPTER-INTEGRATION-001.md).

### 8e2d. ELECTRON-SOURCE-ADAPTER-001 — CLOSED · PASS

Desktop path access goes through `createElectronHandleAdapter` and the Electron registry. Add / refresh / availability / Remove dispose stay the same for the user.

Report: [ELECTRON-SOURCE-ADAPTER-001.md](ELECTRON-SOURCE-ADAPTER-001.md).

### 8e2e. DESKTOP-RELEASE-PRODUCTION-001 — OPEN · NOW

Infrastructure only. The published binary equals the packaged binary. DMG, SHA256, GitHub Release, sidecar, `release.json`, `/api/release`, `download.suhuella.com`, `verify:desktop-artifact`, smoke. No UX.

Report: [DESKTOP-RELEASE-PRODUCTION-001.md](DESKTOP-RELEASE-PRODUCTION-001.md).

### 8e2f. DOWNLOAD-EXPERIENCE-001 — OPEN

Product experience immediately after Desktop Release PASS. One user flow: click → preparing → download → install guidance → first launch. User never sees GitHub or raw URLs.

Report: [DOWNLOAD-EXPERIENCE-001.md](DOWNLOAD-EXPERIENCE-001.md).

### 8e2g. FIRST-LAUNCH-EXPERIENCE-001 — OPEN

Product only. Install → Launch → License → First Home → Connect first source. No domain or adapter work. Gate before beta.

Launch always shows the window. Close hides; Quit exits. [APPLICATION-LIFECYCLE-001.md](docs/architecture/product/application-lifecycle.md).

Report: [FIRST-LAUNCH-EXPERIENCE-001.md](FIRST-LAUNCH-EXPERIENCE-001.md).

### 8e3. SOURCE-PLATFORM-READINESS-001 — CLOSED · PASS

Phase 6 of SOURCE-DOMAIN-EVOLUTION-001. Hosts declare access capabilities. Home, Sources, and Organise ask `connectGrant` / `directoryCatalog` / `organiseFromIndexedSources`, not `host === 'browser'`. iOS and Android profiles are reserved. No mobile UI. Web Connect and Desktop Add are unchanged.

Report: [SOURCE-PLATFORM-READINESS-001.md](SOURCE-PLATFORM-READINESS-001.md).

### 8f. BROWSER-ORGANISE-SELECTION-001 — CLOSED · PASS

Browser Organise no longer dead-ends on “This browser cannot choose documents.” Select from Sources, Choose files, and Choose folder create a Plan draft. Execution limits are honest and do not require Desktop.

Report: [BROWSER-ORGANISE-SELECTION-001.md](BROWSER-ORGANISE-SELECTION-001.md).

### 8z. FIRST-IMPRESSION-OBSERVATION-MODE-001 — SUPERSEDED

Report: [FIRST-IMPRESSION-OBSERVATION-MODE-001.md](tracks/archive/FIRST-IMPRESSION-OBSERVATION-MODE-001.md).

### 9. FIRST-IMPRESSION-TEST-001 — CLOSED · PASS

Operator waived session templates (2026-09-19). Engineering gate [PRE-BETA-BENCHMARK-001.md](PRE-BETA-BENCHMARK-001.md) already **PASS**.

Report: [FIRST-IMPRESSION-TEST-001.md](tracks/archive/FIRST-IMPRESSION-TEST-001.md).

### 9b. FIRST-RUN-EXPERIENCE-001 — SUPERSEDED

Replaced by **FIRST-IMPRESSION-TEST-001** for the Web RC path. Kept for reference.

Report: [FIRST-RUN-EXPERIENCE-001.md](FIRST-RUN-EXPERIENCE-001.md).

### 9c. FIRST-IMPRESSION-SUMMARY-001 — CLOSED · PASS

Operator sign-off (2026-09-19). Session notes waived.

Report: [FIRST-IMPRESSION-SUMMARY-001.md](tracks/archive/FIRST-IMPRESSION-SUMMARY-001.md).

### 9d. PRODUCT-FREEZE-001 — OPEN

Active since summary **PASS** (2026-09-19). No functional tracks except critical bugs or narrow beta fixes.

Report: [PRODUCT-FREEZE-001.md](PRODUCT-FREEZE-001.md).

### 9d2. PRE-BETA-SANITY-001 — CLOSED · PASS

30–45 min product pass (2026-09-19). Deploy gates + Playwright benchmark + browser checks.

Report: [PRE-BETA-SANITY-001.md](PRE-BETA-SANITY-001.md).

### 9e. PRIVATE-BETA-001 — OPEN (gated)

20–30 users · 7+ days · product freeze active. Exit → **0.1.0-rc1**.

**Do not start** until **DESKTOP-RELEASE-PRODUCTION-001**, **DOWNLOAD-EXPERIENCE-001**, and **FIRST-LAUNCH-EXPERIENCE-001** are **CLOSED · PASS**.

Report: [PRIVATE-BETA-001.md](PRIVATE-BETA-001.md).

### 9f. RELEASE-PUBLISH-PIPELINE-001 — OPEN

**Before hosting or Phase B.** One operator workflow to publish any version (web + desktop) without editing product code. Covers canonical release source, version mirrors, `/api/release` authority, publication sequence, rollback. Hosting (GitHub → domain alias) is implementation detail deferred to **DESKTOP-RELEASE-HOSTING-001**.

Report: [RELEASE-PUBLISH-PIPELINE-001.md](RELEASE-PUBLISH-PIPELINE-001.md).

### 9g. RELEASE-LIFECYCLE-001 — OPEN · PHASE A PASS

Version lifecycle contract. Download ≠ update. `/api/release` is authority for Desktop + Website. Clients never see GitHub — artifacts on GitHub Releases, stable alias on `download.suhuella.com`, manifest `mac` on your domain only. Phase A: compare kernel + Settings check. **Phase B deferred** until RELEASE-PUBLISH-PIPELINE-001 closes and DESKTOP-RELEASE-HOSTING-001 opens. Does not block Web first-impression.

Report: [RELEASE-LIFECYCLE-001.md](tracks/open/RELEASE-LIFECYCLE-001.md).

### Desktop delivery (active)

**DESKTOP-RELEASE-PRODUCTION-001** — **OPEN · NOW** — see §8e2e.

**DOWNLOAD-EXPERIENCE-001** — **OPEN** — see §8e2f.

**FIRST-LAUNCH-EXPERIENCE-001** — **OPEN** — see §8e2g.

**DESKTOP-RELEASE-ARTIFACTS-001** — **CLOSED · PASS**

Mac public via alias. Superseded for active work by **DESKTOP-RELEASE-PRODUCTION-001**.

Report: [DESKTOP-RELEASE-ARTIFACTS-001.md](tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md).

**DESKTOP-DMG-HOSTING-UNBLOCK-001** — **CLOSED · PASS**

Hosting follow-up closed blocked. Do not reopen without a host.

Report: [DESKTOP-DMG-HOSTING-UNBLOCK-001.md](DESKTOP-DMG-HOSTING-UNBLOCK-001.md).

**Policy (frozen):**

- Download is public when published; license controls use, not download.
- Artifact storage when reopened: **GitHub Releases** (beta). Client URLs: **`download.suhuella.com`** via **`/api/release`** — never `github.com` in the app.
- `/download` should eventually read a release manifest; new platforms appear without React changes. Not in scope until Desktop reopens.

### 10. BRAND-THEME-TOKENS-001 — CLOSED · PASS

Phase A. `theme.accent` / `theme.onAccent` on BrandConfig. Site layout and desktop shell inject CSS variables. Public shell (nav, overlays, landing CTAs) uses tokens. SuHuella `#0084FF`. Dbasenet `#0B5F63`.

Does not open Ops/Partner color editors. Does not enable checkout or Desktop RC.

Report: [BRAND-THEME-TOKENS-001.md](BRAND-THEME-TOKENS-001.md).

### 10b. BRANDING-HIERARCHY-001 — SUPERSEDED → ADR-003

Permanent policy: [docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md](docs/architecture/decisions/ADR-003-brand-identity-hierarchy.md). Commercial Identity ≠ Effective Brand Identity. Per-field merge. `identityVersion: 1`. Field ownership table. `useEffectiveBrandIdentity()`.

Index alias: [BRANDING-HIERARCHY-001.md](BRANDING-HIERARCHY-001.md).

### 11. OPERATIONS-ACCESS-CLOSEOUT-001 — CLOSED · PASS

`/_ops` replaces `/admin`. Production: Cloudflare Access + `SUPERADMIN_EMAILS` (403 if not allowlisted). Local: `localhost:3000/_ops` with no login. Cloudflare Access app is manual infra — not created by the PR.

Report: [OPERATIONS-ACCESS-CLOSEOUT-001.md](OPERATIONS-ACCESS-CLOSEOUT-001.md).

### 12. WINDOWS-VALIDATION-001 — DEFERRED — Desktop not in RC

Not an RC gate while Desktop is out of this RC. Reopen only if Strategy A returns with a real installer path.

Almost all proof is macOS. Check installer, tray, Explorer, Save As, notifications, launch at login, paths, UNC, long paths.

---

## Then

One **PRODUCTION-READINESS-001**. Production is the only authority. If it fails, it should be unexpected.

If that gate PASSes: **PRIVATE-BETA-001** (after Desktop Release + Download + First Launch PASS).

If it is BLOCKED: one slice only.
