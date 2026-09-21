# FIRST-LAUNCH-EXPERIENCE-001

```text
STATUS = CLOSED · PASS (implementation)
TYPE = Product experience
SCOPE = Desktop first 30 seconds
VALIDATED = 2026-09-19 (automated: test:first-launch-experience — manual Desktop Gate 7 pending operator)
```

Not architecture. Not Source Domain. Not new adapters.

The user judges the product during the first launch. This track closes the gap between **download complete** and **first useful moment**.

Do not start until [DESKTOP-RELEASE-PRODUCTION-001.md](DESKTOP-RELEASE-PRODUCTION-001.md) and [DOWNLOAD-EXPERIENCE-001.md](DOWNLOAD-EXPERIENCE-001.md) are **CLOSED · PASS**.

## Flow

```text
Install
    ↓
Launch
    ↓
License
    ↓
First Home
    ↓
Connect first source
```

Launch always shows the main window. Silent tray start is a UX bug. Window close vs Quit: [APPLICATION-LIFECYCLE-001.md](docs/architecture/product/application-lifecycle.md).

Nothing else. No Settings tour. No Organise. No Activity history.

## Definition of done

During the first session, the user never has to ask:

- Did it install correctly?
- How do I open it?
- What is my license for?
- What am I looking at on Home?
- How do I let SuHuella see my files?

If any of those questions appear, the flow is not finished.

## Out of scope

- Source Domain, Lifecycle, Presentation, or Handle adapter contracts
- Google Drive, Dropbox, OneDrive, NAS, SMB, iOS, Android
- New features beyond what Browser + Desktop already support

## Gate before beta

```text
Desktop binary          ✓
Download experience     ✓
First launch experience ✓
        ↓
PRIVATE-BETA-001
```
