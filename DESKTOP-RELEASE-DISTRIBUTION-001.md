# DESKTOP-RELEASE-DISTRIBUTION-001

```text
STATUS = CLOSED · PASS
TYPE = Pre-RC blocker
DESKTOP_IN_RC = NO
STRATEGY = B
RELEASE_VERSION = 0.1.0-pre-rc
```

## Decision record

**Strategy B.** Desktop is not part of this RC. The browser app is the only public entry point.

Reason: no truthful public installer path exists in this slice.

- R2 `suhuella-downloads` is not enabled (API 403 / code 10042).
- Windows cannot be packaged on this Mac.
- The local DMG cannot be published to a production-accessible URL.
- Strategy A would require real macOS and Windows installers, or hiding Windows completely, plus hosted URLs. That path is not completable here.

If YES had been chosen, this report would list platforms, host, signing, warnings, and installed version. Those fields do not apply.

If NO (this close):

- Browser is the only public RC entry point (`/home`).
- Desktop remains internal / later validation.
- No public install promise.
- Windows validation is not an RC gate until Desktop is reintroduced.
- Desktop download returns only when a real distribution path exists.

Strategy A was re-entered in [DESKTOP-RELEASE-ARTIFACTS-001.md](tracks/archive/DESKTOP-RELEASE-ARTIFACTS-001.md). A local SuHuella DMG was produced. Hosting follow-up [DESKTOP-DMG-HOSTING-UNBLOCK-001.md](DESKTOP-DMG-HOSTING-UNBLOCK-001.md) is **FROZEN · BLOCKED**. Desktop is off the Web RC critical path. This distribution decision stays **Strategy B** until a public URL exists. Reopen with GitHub Releases preferred.

```text
A user must never be told to download something that does not exist.
```

## Landing CTA

| | Before | After |
| --- | --- | --- |
| Primary | Open SuHuella → `/home` (already after RC-DOWNLOAD-JOURNEY-001) | **Open SuHuella** → `/home` |
| Secondary | View plans | **View plans** → `/license` |
| Download primary | Absent | Absent |
| Mac / Windows buttons | Absent | Absent |
| Under mockup | Coming soon + “Haven't purchased yet?” | Coming soon only: desktop later, open in this browser |
| Features / FAQ | Tray and Save As as if Desktop were live | Browser now; desktop later |
| License Free CTA | “Download SuHuella” → `/home` | **Open SuHuella** → `/home` |

Allowed wording used: “Desktop app coming later”, “SuHuella Web lets you try SuHuella locally”, “Desktop will provide the full native experience”.

## `/api/release`

Before (already Strategy B after RC-DOWNLOAD-JOURNEY-001) and after this deploy:

```json
{
  "ok": true,
  "release": {
    "version": "0.1.0-pre-rc",
    "channel": "stable",
    "minimumVersion": "0.1.0-pre-rc",
    "mandatory": false
  }
}
```

No `windows` / `mac` keys. No empty strings. No fake URLs.

## Release version

Public surfaces checked in this slice:

- `/api/release` = `0.1.0-pre-rc`
- Landing badge = `v0.1.0-pre-rc`
- Site `package.json` = `0.1.0-pre-rc`

Deeper `appVersion` alignment stays in VERSION-CONSISTENCY-001.

## Desktop availability statement

**Desktop is not downloadable in this RC.** There is no public Mac installer, no public Windows installer, and no signed or unsigned installer for users to run. Desktop stays internal until a real publish path exists. Then this decision can be reopened as Strategy A.

## License / plans

- Free card opens `/home`. It does not promise a download.
- Activation copy points at the browser. No `suhuella://` protocol CTA.
- Lifetime / Monthly checkout stay unavailable (`/license?checkout=unavailable`).
- Business stays Contact Sales (`mailto:sales@suhuella.com`).
- Pricing unchanged. Charging not enabled.

## App entry

- Open SuHuella → `/home` (200)
- PWA `start_url` = `/home`
- `/app` → 308 `/home`
- No user-facing `/app` links
- Browser can be used without downloading anything

## Production smoke

Worker version: `df34ed42-9ec7-4f9e-9cdd-2b9485c32fd4` (2026-09-19). `LICENSE_DB` bound.

| Check | Result |
| --- | --- |
| Landing primary CTA | Open SuHuella → `/home` |
| Landing secondary CTA | View plans → `/license` |
| GET `/api/release` | version only; no installer keys |
| Unavailable download buttons | None |
| Install FAQ | None |
| `/app` | 308 → `/home` |
| `/home` | 200 |
| `/manifest.webmanifest` `start_url` | `/home` |
| Checkout lifetime / monthly | 302 unavailable |
| Checkout business | mailto sales |
| GET `/api/verify-session?session_id=cs_test_forged` | 400 `invalid_session` |
| Routes | `npm run verify:production` passed after deploy |

No browser MCP in this session. Smoke is HTTP + HTML of the live pages.

## Tests run

Site:

- `npm run check:app-host`
- `npm run test:service-health`
- `npm run test:license`
- `npm run build`
- `npm run deploy` (includes `verify:production`)

Desktop tests were not run. Strategy A only.

## Remaining limitations

- R2, signing, notarization, and Windows packaging are not started.
- `/download` is a public version catalog (DOWNLOAD-PAGE-SEMANTICS-001). Post-checkout flow uses `/license/success`.
- Feature card 1 still says SuHuella can work offline. That is not a download CTA. Leave to later copy if needed.
- VERSION-CONSISTENCY-001, FIRST-RUN-EXPERIENCE-001, CHECKOUT-PRODUCTION-ENABLEMENT-001, and RESEND-PRODUCTION-001 remain open.
- WINDOWS-VALIDATION-001 is not an RC gate while Desktop is out.

## Impact on PRE-RC-TRACKS-001

Track 3 **DESKTOP-RELEASE-DISTRIBUTION-001** is **CLOSED · PASS**.

- PRODUCTION-READINESS-001 stays deferred.
- Do not tag `0.1.0-rc1` from this close.
- Track 6 (Windows validation) waits until Desktop is reintroduced with a real distribution path.
- Next P0 tracks: checkout enablement (ready-for-Stripe, not sell) and Resend production.

Frozen domains were not opened: architecture, licensing model, Commercial Authority Model, BrandConfig, Multibrand, Stripe charging, Resend implementation, BYOK, Connections, Automations, Recommendation Engine, Knowledge Engine, Plan / Activity / Workflow.
