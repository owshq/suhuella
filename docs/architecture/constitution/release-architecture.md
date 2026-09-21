# Release Architecture

```text
STATUS = CONSTITUTION · FROZEN

Changes require a documented architectural decision.

Do not introduce:
- second version authority
- second release manifest
- client knowledge of hosting provider
- release information outside release.json

All future work must build on this architecture.
```

```text
EFFECTIVE = 2026-09-19
REOPENS = Never — bugfixes only. DESKTOP-RELEASE-HOSTING-001 is implementation on this architecture, not a redesign.
GOVERNED BY = PRODUCT-EVOLUTION-POLICY
```

Do not open new version-authority or release-pipeline architecture tracks.

---

## Operator model

```text
brands/suhuella/release.json   ← only editable release file
        ↓
npm run build                  (sync + version check run automatically)
        ↓
/api/release
        ↓
Desktop · Website · /download · About
```

Operators edit **`brands/suhuella/release.json`** and run **any build**. They never run `release:sync` manually in normal workflow.

See [Command taxonomy](./COMMAND-TAXONOMY.md): **build** modifies; **health** observes; **smoke** verifies production.

---

## Manifest contract

`release.json` is the long-lived release contract:

```json
{
  "version": "0.1.0-pre-rc",
  "channel": "stable",
  "mandatory": false,
  "downloads": {
    "web": { "available": true },
    "mac": { "available": false, "url": null },
    "windows": { "available": false, "url": null }
  },
  "minimumVersion": "0.1.0-pre-rc",
  "releaseDate": "2026-09-19",
  "notes": ""
}
```

Derived automatically: `site/release.json`, package versions, wrangler env, `BrandConfig.release`, bundled Worker manifest.

---

## Build gate

Every site and desktop build runs:

```text
project-release.mjs  →  Build Health (release-version)  →  build
```

Entry: `brands/run-release-gate.mjs` via `site` `prebuild`, desktop `build.mjs`, `package:check`.

Canonical checks: `scripts/build-health.mjs`.

---

## Runtime rules

| Rule | Detail |
| --- | --- |
| Single editable source | `brands/suhuella/release.json` |
| Single runtime authority | `GET /api/release` |
| Clients | Never know where binaries are hosted |
| Hosting | GitHub · R2 · domain aliases — implementation details only |
| Second version authority | **Rejected** |

---

## Related (closed)

- [VERSION-CONSISTENCY-001.md](../../../VERSION-CONSISTENCY-001.md)
- [RELEASE-LIFECYCLE-001.md](../../../tracks/open/RELEASE-LIFECYCLE-001.md) Phase A
- [RELEASE-PUBLISH-PIPELINE-001.md](../../../RELEASE-PUBLISH-PIPELINE-001.md)

**Release process (frozen):** [RELEASE-PROCESS-FROZEN.md](../../governance/RELEASE-PROCESS-FROZEN.md)
