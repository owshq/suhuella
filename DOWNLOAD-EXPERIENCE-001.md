# DOWNLOAD-EXPERIENCE-001

```text
STATUS = CLOSED · PASS
TYPE = Product experience
SCOPE = Desktop download
VALIDATED = 2026-09-19 (Desktop Release Gate 6 — smoke + /download/preparing)
```

Desktop download must feel like a finished product — not a raw artifact link.

Pipeline architecture is closed ([RELEASE-PUBLISH-PIPELINE-001.md](RELEASE-PUBLISH-PIPELINE-001.md)). Remaining work is **operational validation**, not redesign.

```text
Click Download
      ↓
/download/preparing
      ↓
Download starts (via stable alias — user never sees GitHub)
      ↓
Installation guidance (platform-neutral + one contextual hint)
      ↓
First launch  →  FIRST-LAUNCH-EXPERIENCE-001
```

## Implemented (2026-09-19)

- [x] OS detection → `/download/preparing?platform=…`
- [x] Preparing / in-progress state (`DownloadPreparingContent`)
- [x] Automatic download trigger
- [x] Retry (`Download again`)
- [x] Installation instructions (neutral copy; Mac/Windows hint on step 2)
- [x] Other platform path (`Looking for another platform?`)
- [x] Stable distribution API consumed internally (`download.suhuella.com/latest/*`)

## Validate in production (not design)

Run during [DESKTOP-RELEASE-PRODUCTION-001.md](DESKTOP-RELEASE-PRODUCTION-001.md) step 6. The user must never ask:

- Is it downloading?
- What file is this?
- What do I do now?
- Where is the file?
- Did it fail?
- Do I have Mac or Windows?
- Do I need to go back?

If any question appears → **implementation bug**, not pipeline change.

A user downloading SuHuella never sees GitHub, a blank page, or a raw `download.suhuella.com` URL in the address bar.

## Not in scope

- Release pipeline / artifact integrity ([RELEASE-PUBLISH-PIPELINE-001.md](RELEASE-PUBLISH-PIPELINE-001.md) — CLOSED)
- Post-install first launch ([FIRST-LAUNCH-EXPERIENCE-001.md](FIRST-LAUNCH-EXPERIENCE-001.md))

## Next

Validate in manual download gate → [FIRST-LAUNCH-EXPERIENCE-001.md](FIRST-LAUNCH-EXPERIENCE-001.md).
