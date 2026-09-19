# DESKTOP-DMG-HOSTING-UNBLOCK-001

```text
STATUS = CLOSED · PASS
PRIORITY = LOW
TYPE = Hosting unblock
SCOPE = SuHuella Mac DMG only
BLOCKER = no public HTTPS host for DMG
DESKTOP_IN_RC = NO
FIRST_RUN = WEB ONLY
MAC_DOWNLOAD = NOT PUBLIC
WINDOWS = DEFERRED
SIGNED = NO
NOTARIZED = NO
```

**Frozen.** Off the Web RC critical path. Do not reopen until GitHub Releases, R2, or operator HTTPS is ready. Prefer **GitHub Releases** when that day comes.

Publish the already-built SuHuella macOS DMG to a real public HTTPS URL. Update release/download only after that URL is verified.

This track did not rebuild Desktop. It did not change BrandConfig.

Close: **CLOSED · BLOCKED**.

---

## Verdict

| Gate | Result |
| --- | --- |
| Local DMG present | PASS — `desktop/.build/suhuella/release/SuHuella-0.1.0-pre-rc.dmg` (125 MB) |
| A) Cloudflare R2 | **Blocked** — API `403` / code `10042` (R2 not enabled) |
| B) GitHub Release | **Blocked** — `gh` is not authenticated |
| C) Operator HTTPS URL | **Not provided** |
| Public HTTPS URL verified | FAIL |
| `/api/release` Mac URL | not set |
| `/download` Mac available | no |

```text
DESKTOP_DMG_PUBLIC = NO
DESKTOP_IN_RC = NO
MAC_DOWNLOAD = NOT PUBLIC
WINDOWS = DEFERRED
FIRST-RUN = Web only
```

`/download` stays: Web available, Desktop unavailable.

---

## Hosting probes (2026-09-19)

**A) R2** — stopped, as required.

```text
Please enable R2 through the Cloudflare Dashboard. [code: 10042]
account: a7da4b3dc29b6b03f455cf00c4106824
```

No bucket create. No upload. No fake `r2.dev` URL.

**B) GitHub Release** — stopped, as required.

```text
You are not logged into any GitHub hosts. To log in, run: gh auth login
repo: github.com/owshq/suhuella
```

Operator must authenticate `gh` against that repository. Do not publish to a personal or wrong repo.

**C) Operator URL** — none supplied in this prompt.

Worker/Pages static hosting was not used (125 MB exceeds platform limits). No tunnel. No localhost.

---

## What was not changed

- BrandConfig
- `brands/suhuella/release.json` (`mac` remains `""`)
- `site/release.json`
- `/api/release` public payload (still version only)
- checkout
- license / activation
- Windows
- Desktop package

No fake URL. No “available” state.

---

## To unblock

Exactly one of:

1. Enable R2 in the Cloudflare Dashboard for this account, then reopen this track.
2. Run `gh auth login` for `owshq/suhuella`, then reopen this track.
3. Provide a public HTTPS URL that already hosts `SuHuella-0.1.0-pre-rc.dmg` without login.

Then this track (or a thin reopen) only: verify HTTP 200 + size > 0, set `mac` to that URL, show Mac on `/download` with the unsigned/not-notarized warning, deploy, smoke.

---

## Frozen

Not opened: architecture, BrandConfig, checkout, Stripe, Resend, license model, Multibrand, auto-updater, signing/notarization, PRODUCTION-READINESS-001, rc1, FIRST-RUN-EXPERIENCE-001.
