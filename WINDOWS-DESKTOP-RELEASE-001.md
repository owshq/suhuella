# WINDOWS-DESKTOP-RELEASE-001

```text
STATUS = CLOSED · PASS
TYPE = Windows desktop distribution
SCOPE = SuHuella Desktop Windows (NSIS + save watcher)
DEPENDS = DESKTOP-RELEASE-HOSTING-001 CLOSED · PASS
DATE = 2026-09-19
CLOSED = 2026-09-19
```

Windows installer built on **windows-latest** CI and published via `download.suhuella.com/latest/win`.

---

## Evidence

| Check | Result |
|---|---|
| CI run `35431551626` | PASS — `SuHuella-Setup-0.1.0-pre-rc.exe` on `v0.1.0-pre-rc` |
| `npm run publish:desktop-win` | PASS — manifest + worker + deploy + smoke |
| `/api/release` windows | `https://download.suhuella.com/latest/win` |
| Redirect smoke | 302 → GitHub asset (clients never see github.com) |

---

## Build (CI)

```bash
gh workflow run desktop-windows-build.yml
```

Workflow: [.github/workflows/desktop-windows-build.yml](.github/workflows/desktop-windows-build.yml)

- Branch default: `main`
- `SUHUELLA_DESKTOP_CI=1` skips site/wrangler version matrix on desktop-only builds
- `windows-latest` · `dotnet` · `npm run package:win`
- Uploads `SuHuella-Setup-{version}.exe` to GitHub Release `v{version}`

---

## Publish (operator, after CI)

```bash
npm run publish:desktop-win
```

Updates `release.json` → `windows.url: https://download.suhuella.com/latest/win` · worker redirect · deploy · smoke.

---

## Close criteria

- [x] CI build PASS
- [x] `/api/release` windows available
- [x] `download.suhuella.com/latest/win` → 302 → GitHub asset
- [x] `/download` shows Windows installer
