# Health

```text
STATUS = CONSTITUTION · FROZEN · PASS
EFFECTIVE = 2026-09-19
REOPENS = Never — add checks inside the framework only; do not redesign the model.
```

> **Health reports the state of the project. It never modifies it automatically.**

```text
health → detects → recommends → operator decides
```

Never:

```text
health → deletes caches → removes builds → modifies files
```

Cleanup is always explicit: `clean:dev`, `clean:test-artifacts`, `clean:caches` (manual).

Part of [Command taxonomy](./COMMAND-TAXONOMY.md): **health** is diagnostic only — not build, publish, or smoke.

---

## Operator entry point

```bash
npm run health
```

Aliases: `health:dev`, `cursor-health`, `health:cursor`.

CI: `npm run health:ci` (Build Health blocks; Development Health skipped).

---

## Health vs Smoke

| Command | Question | Speed |
| --- | --- | --- |
| `npm run health` | Is the project healthy? | Seconds |
| `npm run smoke` | Does the published release work? | Network · downloads · hashes |

**Never mix Smoke inside Health.**

Run smoke after deploy / before trusting a release in production — not in the weekly health routine.

---

## Model (shared across SuHuella)

```text
Health
  ↓
Observation
  ↓
Severity   (✓ ok · ⚠ warn · ✗ action required)
  ↓
Recommendation
  ↓
Operator action
```

Same pattern as Service Health, Source Health, Release Health.

---

## Layers

**Development Health** — Cursor DB, disk trends, build/release/test artifact thresholds, caches (observation only).

**Build Health** — `scripts/build-health.mjs` (single implementation):

- `release.json`
- Package versions
- BrandConfig
- Release lifecycle

Used by: `health`, `health:ci`, `brands/run-release-gate.mjs`, publish prepublish.

---

## Adding a check

1. Add one entry to `BUILD_HEALTH_CHECKS` in `scripts/build-health.mjs`, **or** extend Development Health in `scripts/health-development.mjs`.
2. Do not duplicate check lists elsewhere.
3. Do not add OS monitoring (CPU, RAM, SSD, uptime).

---

## Routine

```text
Weekly:  npm run health     → OK → nothing
Warn:    npm run clean:dev   → npm run health
Persist: npm run clean:caches (manual)
Publish: npm run smoke       (separate — after deploy)
```
