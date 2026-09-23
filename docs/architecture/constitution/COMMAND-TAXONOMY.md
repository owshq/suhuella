# Command taxonomy

```text
STATUS = CONSTITUTION · PERMANENT RULE
EFFECTIVE = 2026-09-19
```

Part of [constitution/README.md](./README.md). Precedence: [Decision precedence](../../governance/DECISION-PRECEDENCE.md).

Four command families. Each answers a different question. Do not merge them.

```text
health → build → publish → smoke
```

| Command | Question | Modifies project? | Can fail CI? |
| --- | --- | --- | --- |
| **health** | Is the project healthy? | **No** | Yes — real inconsistencies only (versions, BrandConfig, release coherence). Not disk size. |
| **build** | Does it compile and package? | **Yes** | Yes |
| **publish** | Is the release live? | **Yes** | Yes |
| **smoke** | Does the published release work? | **No** | Yes — when part of the release pipeline |

---

## health

Diagnostic only. Never deletes, never cleans, never syncs files.

```bash
npm run health          # operator — weekly
npm run health:ci       # CI — Build Health blocks; Development skipped
npm run health:build    # explicit Build Health gate
```

Cleanup is always separate and manual: `clean:dev`, `clean:test-artifacts`, `clean:caches`.

See [health.md](./health.md).

---

## build

Constructs artifacts. May write `.next`, `dist`, `.build`, etc.

```bash
npm run build
npm run build:site
npm run build:desktop
```

Build runs release sync gates via `prebuild` — that is build, not health.

---

## publish

Uploads, updates manifest, deploys worker/site.

```bash
npm run validate-release -- --platform mac|windows
npm run publish:desktop-mac
npm run publish:desktop-win
npm run cf:deploy
```

`validate-release` is the same contract on every OS (built · verified · signed · trusted · installable). Publish refuses if it fails. Prepublish also runs **Build Health** (`scripts/build-health.mjs`) — still not Smoke.

Platform implementations differ; the contract does not. macOS: Developer ID, notarization, stapling, `spctl`. Windows: Authenticode and signature verification. Linux: not opened. See [docs/release/README.md](../../release/README.md).

---

## smoke

Verifies production: URLs, redirects, hashes, `/api/release`. Network. May download installers.

```bash
npm run smoke
npm run smoke:desktop-download
```

**Never run Smoke inside Health.** Run after publish / before trusting a release.

---

## Operator sequence

```text
health             → project OK?
build / package    → artifacts OK?
validate-release   → OS will trust this artifact?
publish            → release live?
verify             → published file = packaged file?
smoke              → users can download?
```

Health observes. Build and publish modify. Smoke verifies what is already public.
