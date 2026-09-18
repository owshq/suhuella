# SuHuella

Paid desktop utility that suggests the right folder when a Save / Save As dialog appears. Monorepo: public site + Electron app.

## Architecture (frozen)

```
Architecture is frozen.

Do not introduce new folders.
Do not introduce new frameworks.
Do not rename existing concepts.
Do not move files.
Only implement the requested slice.
```

**SuHuella never owns the Save operation. It only assists.** It recommends a folder; the user confirms with the native Save button. Settings and Suggestion never appear together. The desktop app has no login, payments, cloud, or analytics. Internet is never required in the app.

**SuHuella must feel invisible.** Never open windows unexpectedly. Never interrupt the user’s flow. Respond in under ~200 ms. Disappear immediately after a folder is chosen. Use almost no resources while idle.

```text
SITE (site/)
  Landing → Stripe → /download?session_id=… → verify → installers

DESKTOP — Main Process (desktop/electron/)
  Tray · Windows · IPC · Settings store · Recommendation engine · Suggestion controller

DESKTOP — Renderer (desktop/src/)
  Onboarding · Settings · Suggestion

DESKTOP — Native (Phase 3, not built)
  Windows detector · Folder navigator

STORAGE
  {userData}/settings.json

FUTURE
  ONNX · Local learning · Auto-update
```

Package-level detail: [desktop/README.md](desktop/README.md) · [site/README.md](site/README.md)

## Repository structure

```text
suhuella/
├── site/          Next.js — landing, Stripe, download, legal
├── desktop/       Electron — tray, settings, suggestion
├── package.json   Convenience scripts only (no dependencies)
├── README.md
└── LICENSE
```

Root `package.json` has no dependencies — only shortcuts. Each package keeps its own `package.json`, install, and build. No Turborepo, Nx, Lerna, `shared/`, `core/`, or `packages/`.

## Development

From the repo root:

```bash
npm run dev       # Next.js site — http://localhost:3000
npm run site      # same as npm run dev
npm run desktop   # Electron app
```

First-time setup (once per package):

```bash
cd site && cp .env.example .env.local && npm install
cd desktop && npm install
```

Or run directly inside each package:

```bash
cd site && npm run dev
cd desktop && npm run dev
```

Build:

```bash
npm run build:site
npm run build:desktop
```

## Current roadmap

```text
suhuella.com → Landing → Stripe → Download → Installer → Tray → Wizard → Preview Suggestions
```

Then: Cloudflare + domain + Stripe in production → desktop polish → rules engine → Windows detector → ONNX (same I/O contract).

| Step | Status |
| --- | --- |
| Site live on `suhuella.com` | **Now** — Cloudflare, Stripe, verified `/download` |
| Desktop polish | Next — tray, onboarding, settings, suggestion UI |
| Recommendation engine | After polish — spec in [desktop/README.md](desktop/README.md) |
| Windows detector + navigation | Later — do not start until requested |

Do not implement Windows UI Automation, macOS Accessibility, or ONNX before their step.

## Rules for AI agents

1. Read this file first.
2. Then read only the package README for your task — do not re-read the same facts elsewhere.
3. Each fact lives in exactly one place:

| Topic | Source |
| --- | --- |
| Frozen architecture, roadmap, repo layout | This file |
| Desktop IPC, settings, recommendation engine, build | [desktop/README.md](desktop/README.md) |
| Landing, Stripe, Cloudflare, env vars | [site/README.md](site/README.md) |

4. Do not duplicate content across README files.
5. Do not invent new folders, frameworks, or renames.
