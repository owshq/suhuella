# SuHuella desktop

Electron + React + TypeScript. Tray assistant for Save / Save As. Roadmap and agent rules: [../README.md](../README.md).

## Desktop architecture

```text
electron/
  main.ts              Tray, window lifecycle, IPC handlers
  preload.ts           Typed bridge (renderer ↔ main)
  settings-store.ts    settings.json read/write
  recommendations.ts   Rules engine (recommendationModel: "rules")

src/
  windows/OnboardingWindow.tsx
  windows/SettingsWindow.tsx
  windows/SuggestionWindow.tsx
  components/

Native (Phase 3 — not built)
  C# UI Automation helper → stdout JSON → main process
  Folder navigator via same helper
```

| Window | When |
| --- | --- |
| Tray | Always after launch |
| Notification | Once on first run |
| Onboarding | **Open Settings** while `firstRunCompleted == false` — never auto-opens |
| Settings | **Open Settings** after first run |
| Suggestion | **Preview Suggestions** today; real Save As in Phase 3 |

Settings and Suggestion are never visible together. First launch shows tray only — no Settings window. `favouriteFolders` starts empty; never pre-seed system folders.

**Preview Suggestions:** About → Preview, onboarding step 3, tray, or `⌘⌥S` / `Ctrl+Alt+S`. If Suggestion is already open, ignore. Hide Settings/wizard, show Suggestion alone, restore previous surface on close.

Tray menu: Open Settings · Preview Suggestions · Quit. Closing Settings/wizard returns to tray; does not quit.

## IPC

All privileged access goes through `preload.ts`. The renderer never reads the filesystem or calls native APIs directly.

Main process exposes settings, folder pickers, window show/hide, and recommendation requests to the renderer via the preload bridge defined in `electron/preload.ts` and consumed in `src/lib/api.ts`.

## Settings

File: `{userData}/settings.json`

- macOS: `~/Library/Application Support/SuHuella/settings.json`
- Windows: `%APPDATA%\SuHuella\settings.json`

```json
{
  "favouriteFolders": [],
  "firstRunCompleted": false,
  "launchAtLogin": true,
  "welcomeNotificationShown": false,
  "recommendationModel": "rules"
}
```

| Field | Purpose |
| --- | --- |
| `favouriteFolders` | User paths; never pre-seeded |
| `firstRunCompleted` | `false` until onboarding wizard finishes |
| `launchAtLogin` | Default `true`; `app.setLoginItemSettings` |
| `welcomeNotificationShown` | First-run notification sent once |
| `recommendationModel` | `"rules"` now; `"onnx"` later — no migration needed |

Settings UI: three tabs — General (launch at login), Folders (add/remove, reveal file), About (version, Preview Suggestions).

Onboarding wizard (max 3 screens): choose folders → launch at login → optional preview. Opens only via **Open Settings** when `firstRunCompleted == false`.

## Recommendation engine

Implementation: `electron/recommendations.ts`. **Update this section before changing scoring logic.**

### Model

| `recommendationModel` | Engine |
| --- | --- |
| `"rules"` (default) | Token scoring in `scoreFolder()` |
| `"onnx"` (future) | Same contract; replaces scoring internals |

### Input → output

**Input:** `fileName`, `sourceApp`, `favouriteFolders` (required); `recentFolders`, `frequentFolders` (future).

**Output:** Top 3 `{ folder, score, label }` — score 0–100, sorted descending.

### Scoring (`rules`)

Base **8**, cap **100**.

| Factor | Weight |
| --- | --- |
| File token ↔ path token (exact) | +34 (+16 if 4-digit year) |
| File token ↔ path token (partial) | +16 |
| File token ↔ leaf folder (exact / partial) | +18 / +10 |
| Extension in path | +20 |
| Extension / app hints | +10 each, max +24 |
| Office ext + generic `Documents` leaf | +20 |
| Recent folder | +12 |
| Frequent folder | +2 per use, max +16 |
| Path depth (>3 segments) | +2 each, max +8 |

Stop words: `untitled`, `document`, `file`, etc. Extension and app hint maps live in `recommendations.ts`.

### Learning (future)

On folder pick: increment `frequentFolders`, prepend `recentFolders` (cap ~20), persist locally. No cloud. Wrong picks are not penalized globally.

### ONNX (future)

Keep `RecommendationInput` / `RecommendedFolder[]` unchanged. When `recommendationModel === "onnx"`, swap scorer; fall back to `"rules"` if model missing. Do not add ONNX deps until explicitly requested.

## Build

```bash
cd desktop
npm install
npm run dev          # Vite + Electron
npm run build        # Typecheck + bundle
npm run package:win  # Windows installer
npm run package:mac  # macOS app
```

```text
desktop/
├── electron/
├── src/
├── assets/
├── scripts/
└── package.json
```

## Known limitations

- No Windows Save As detection (Phase 3)
- No macOS Accessibility
- No native dialog folder navigation
- No cloud, accounts, payments, or analytics in the app
- No ONNX runtime
- Start-minimized not implemented
- Windows UI Automation permission only when Save Detection ships (Phase 3)

Purchase and download flow lives in [../site/README.md](../site/README.md).
