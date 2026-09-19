# DESKTOP-RELEASE-ARTIFACTS-001

```text
STATUS = FROZEN · BLOCKED
PRIORITY = LOW
TYPE = Desktop distribution re-entry
STRATEGY = A
SCOPE = SuHuella Desktop only
RELEASE_VERSION = 0.1.0-pre-rc
DESKTOP_IN_RC = NO
FIRST_RUN = WEB ONLY
WINDOWS = DEFERRED
BLOCKER = no public artifact hosting
```

**Off the Web RC critical path.** Do not reopen until a public artifact host exists.

Reintroduce SuHuella Desktop downloads truthfully. This track reopened Strategy A for Mac only.

```text
No mostrar botón Mac activo hasta que exista un DMG real,
publicado en una URL real,
generado desde BrandConfig,
y verificado descargable desde /download.
```

Close: **CLOSED · BLOCKED**. The DMG exists locally and is branded correctly. It is not publicly downloadable. `/download` therefore still says Mac is not available.

Hosting follow-up: [DESKTOP-DMG-HOSTING-UNBLOCK-001.md](DESKTOP-DMG-HOSTING-UNBLOCK-001.md) — **CLOSED · BLOCKED** (same host gap).

---

## Verdict

| Gate | Result |
| --- | --- |
| macOS DMG exists | PASS — `SuHuella-0.1.0-pre-rc.dmg` (125 MB) |
| Generated from BrandConfig | PASS |
| Version `0.1.0-pre-rc` | PASS |
| Hosted at a public production URL | **FAIL** |
| URL downloads successfully | not started |
| `/api/release` exposes Mac URL | not set — still omitted |
| `/download` shows Mac available | no — remains unavailable |
| Windows unavailable | PASS |
| Checkout off | PASS |
| Activation separate from download | PASS |
| No other brand | PASS |

```text
DESKTOP_IN_RC remains NO
WINDOWS = DEFERRED
FIRST-RUN stays Web only
```

---

## Artifact

| Field | Value |
| --- | --- |
| Name | `SuHuella-0.1.0-pre-rc.dmg` |
| Version | `0.1.0-pre-rc` |
| Path | `desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg` |
| Size | 125 MB (`131435610` bytes) |
| Host | none |
| URL | none |
| Signing | unsigned — `mac.identity = null` |
| Notarization | not notarized |

Canonical BrandConfig name is `${productName}-${version}.${ext}`. That is `SuHuella-0.1.0-pre-rc.dmg`. The `.dmg` extension is the Mac marker. Not renamed to `*-mac.dmg`.

Unsigned copy is ready for `/download` when a URL exists:

```text
macOS may show a security warning because this pre-RC build is not notarized.
```

Do not present this build as signed or notarized.

---

## Brand check

Packaged `SuHuella.app` Info.plist:

| Field | Value |
| --- | --- |
| CFBundleDisplayName | SuHuella |
| CFBundleName | SuHuella |
| CFBundleIdentifier | com.suhuella.desktop |
| CFBundleShortVersionString | 0.1.0-pre-rc |
| CFBundleVersion | 0.1.0-pre-rc |
| protocol | suhuella |

Generated electron-builder config from BrandConfig/`suhuella`. No Dbasenet. No generic Electron product name.

Leftover: `desktop/package.json` still repeats `appId` / `productName` / protocol for older tools. Packaging authority is BrandConfig. `package:check` already records this.

---

## Hosting

Tried allowed hosts:

| Path | Result |
| --- | --- |
| A) R2 `suhuella-downloads` | **Blocked.** Wrangler: enable R2 in the Cloudflare Dashboard. API `403` / code `10042`. Same blocker as DESKTOP-RELEASE-DISTRIBUTION-001. |
| B) Worker/Pages static asset | Not used. 125 MB exceeds Worker/Pages file limits. |
| C) GitHub Release | Not used. `gh` is not authenticated on this machine. |
| D) Other operator URL | None provided. |

No fake URL was written. `brands/suhuella/release.json` `mac` stays `""`. `publicReleasePayload` still omits `mac` and `windows`.

To unblock, the operator must do one of:

1. Enable R2 on account `a7da4b3dc29b6b03f455cf00c4106824`, create `suhuella-downloads`, upload the DMG, attach a public domain, then set `mac` to that HTTPS URL.
2. Authenticate GitHub and publish a public Release asset, then set `mac` to that HTTPS URL.
3. Provide another explicit public HTTPS URL they control.

Then reopen this track (or a thin follow-up) only to set the real URL, show Mac available, and run production smoke. Do not show the button before that.

---

## `/download` and `/api/release`

Still truthful for the current host:

- SuHuella Web: available now
- SuHuella Desktop Mac: not available
- SuHuella Desktop Windows: not available yet

Catalog UI now has separate Mac and Windows cards. They stay inactive until a real URL exists. Tests prove Mac becomes available only with a real HTTPS URL, and Windows stays off on a Mac-only fixture.

Checkout remains off. Activation is not granted by download.

---

## Tests run

Desktop:

- `npm run build`
- `npm run package:mac`
- `npm run package:check` (local DMG present)
- `npm run test:license --prefix desktop`

Brand:

- `npm run test:brand-config`

Site:

- `npm run check:app-host --prefix site`
- `npm run test:download-page --prefix site`
- `npm run test:desktop-artifacts --prefix site`
- `npm run test:license --prefix site`
- `npm run test:service-health --prefix site`
- `npm run test:checkout --prefix site`
- `npm run build --prefix site`

Production smoke was **not** rerun. No public installer URL was added. COMBINED-PRE-RC-SMOKE-001 does not need a rerun from this track.

---

## Frozen domains

Not opened: license model, checkout, Stripe, Resend, Commercial Authority Model, Multibrand, BYOK, Connections, Automations, Recommendation Engine, Knowledge Engine, Plan / Activity / Workflow. Paid checkout not enabled. rc1 not tagged. PRODUCTION-READINESS-001 not run. FIRST-RUN-EXPERIENCE-001 not run.

---

## Impact

- DESKTOP-RELEASE-DISTRIBUTION-001 stays Strategy B for the public RC.
- WINDOWS-VALIDATION-001 stays deferred.
- FIRST-RUN-EXPERIENCE-001 stays Web only.

---

## When Desktop reopens (not now)

**Frozen strategy** (see [RELEASE-LIFECYCLE-001.md](RELEASE-LIFECYCLE-001.md)):

```text
GitHub Releases     → store binaries (operator publish)
download.suhuella.com/latest/mac  → stable alias (redirect or Worker)
/api/release        → authority; mac URL is always on your domain
Desktop + Website   → never see github.com
```

**Publish flow (Phase B):**

1. Upload `SuHuella-{version}.dmg` to GitHub Releases (or copy to R2 later).
2. Point `download.suhuella.com/latest/mac` at the current artifact (redirect is fine).
3. Set `brands/suhuella/release.json` `mac` to `https://download.suhuella.com/latest/mac` (not the GitHub URL).
4. Deploy Worker so `/api/release` exposes that URL.
5. Smoke: `/download`, Settings → About → Check for updates, HTTP GET on the alias.

**Download vs license:** Public download → install → open → activate license. Server verifies edition, version, channel, capabilities. License controls use, not download. Checkout stays separate.

**Future `/download` shape:** Manifest-driven artifacts list (mac, windows, signed/notarized flags). UI renders what is published; new platforms appear without React changes. Implement only when Desktop track reopens.
