# Pre-RC release semantics

```text
STATUS = ACTIVE · PERMANENT POLICY
ID = PRE-RC-RELEASE-SEMANTICS-001
EFFECTIVE = 2026-09-21
TYPE = Governance (not architecture)
DOES NOT CHANGE = docs/architecture/constitution/release-architecture.md
```

`0.1.0-pre-rc` and `0.1.0-rc1` are different claims. Signing blocks the second. It does not block the first.

Release Architecture stays the only version authority: `brands/suhuella/release.json` → `/api/release`. GitHub and `download.suhuella.com` are hosting.

---

## Two versions

| | `0.1.0-pre-rc` | `0.1.0-rc1` |
| --- | --- | --- |
| What it is | Active development / pre-release | Candidate for external Private Beta |
| `/api/release` | Required | Required |
| Mac and Windows downloads | Required, real artifacts | Required, and trusted by the OS |
| GitHub Release assets and `download.suhuella.com` aliases | Required | Required |
| Who it is for | Development, QA, internal use, technical validation | External testers |
| Unsigned / not notarized | Allowed if labelled honestly as a technical pre-release | Not allowed |
| Commercial signing | Does not block publication | Blocks promotion until Gate 6 passes |

Do not use this sequence:

```text
pre-rc → wait for signing → nothing else can move
```

Use this sequence:

```text
0.1.0-pre-rc
    ↓
development / internal QA
    ↓
real Mac + Windows artifacts
    ↓
GitHub Release assets
    ↓
download.suhuella.com aliases
    ↓
/api/release metadata
    ↓
website downloads work
    ↓
product / technical gates
    ↓
commercial signing gates
    ↓
0.1.0-rc1
    ↓
Private Beta
```

`rc1` means the applicable trusted-install gates pass: Developer ID + notarization for Mac when Mac is an external download, Authenticode for Windows when Windows is announced as a normal external download.

---

## Signing

Commercial signing is an external prerequisite for **promotion** to `0.1.0-rc1` and for **external** Private Beta.

It is not a product blocker. It is not a release-engineering blocker. It does not block building, uploading, downloading, or testing `0.1.0-pre-rc`.

`validate-release` stays **SKIPPED** (not FAIL) while `commercial-signing.json` status is `deferred`. That skip means “not attempting a trusted external release”. It does not mean “do not publish the pre-rc artifacts”.

Unsigned or notarization-deferred artifacts are for internal and technical testing. Say that honestly. Do not present them as a commercially trusted install.

---

## Names the customer sees

Release channel is internal metadata. Product version is user-facing.

```text
Internal     0.1.0-pre-rc · 0.1.0-rc1 · git tags · release.json · CI · gates
User-facing  0.1.0 · or simply SuHuella
Trial state  Private Beta / Beta — a product badge, not a version suffix
```

Never expose `pre-rc` or `rcN` in normal customer-facing UI, About, public download copy, or installer filenames unless the build is explicitly for testers.

This rule is frozen here. Applying it across the website, About, and filenames is a separate change. It must not add a second version authority or bypass `/api/release`.

---

## Stale statements

These are not current policy, including when they remain inside closed historical tracks:

```text
DESKTOP_IN_RC = NO
FIRST_RUN = WEB ONLY
Web RC path does not wait on Desktop installers
hosting not opened
Publish remains blocked (while signing is deferred)
```

Closed tracks may still contain them as a record of what was true then. Living docs must not.

Current authority for release behaviour: [release-architecture.md](../architecture/constitution/release-architecture.md).  
This document only defines what `pre-rc` and `rc1` mean.  
[RELEASE-LIFECYCLE-001.md](../../tracks/open/RELEASE-LIFECYCLE-001.md) is an open track, not a second authority.
