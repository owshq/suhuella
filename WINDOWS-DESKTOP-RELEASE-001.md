# WINDOWS-DESKTOP-RELEASE-001

```text
STATUS = OPEN
TYPE = Windows desktop distribution
SCOPE = SuHuella Desktop Windows (NSIS + save watcher)
DEPENDS = DESKTOP-RELEASE-HOSTING-001 CLOSED · PASS
DATE = 2026-09-19
```

Windows installer must be built on **Windows** (native `SuhuellaSaveWatcher.exe` + electron-builder).

---

## Build (CI)

```bash
npm run build:desktop-win-ci
# or: gh workflow run desktop-windows-build.yml
```

Workflow: [.github/workflows/desktop-windows-build.yml](.github/workflows/desktop-windows-build.yml)

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

- [ ] CI build PASS
- [ ] `/api/release` windows available
- [ ] `download.suhuella.com/latest/win` → 302 → GitHub asset
- [ ] `/download` shows Windows installer
