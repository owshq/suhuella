# APPLICATION-LIFECYCLE-001

```text
STATUS = ACTIVE · PRODUCT UX CONTRACT
TYPE = Product experience
CLASS = UX
SCOPE = Desktop window · tray · quit (Windows · macOS · Linux)
NOT = Constitution · ADR · adapter work
```

Not architecture. Not Source Domain. Not a new Settings surface.

**Open always shows the app. Closing the window hides it. Quit terminates it.**

Same rule on every platform. Only OS chrome differs (taskbar, Dock, menu bar, system tray).

Silent launch to tray is a **UX bug**. The user should never think: *I opened SuHuella — where is it?*

---

## Contract

```text
Application Lifecycle

Launch
✓ Always create, show, and focus the main window
  (onboarding until first run, then Home).
✓ If already running, focus the existing window.
✗ Never launch silently to tray by default.
✗ Never start a second instance.

Close window (X · ⌘W)
✓ Hide the window.
✓ Keep background services running.
✓ Keep the tray / menu bar icon.
✓ Continue indexing and monitoring.

Exit / Quit (⌘Q · Tray → Quit · Exit)
✓ Stop background workers.
✓ Destroy the tray / menu bar icon.
✓ Terminate the process.

Linux without a tray
✓ Close window exits (no invisible process).

macOS
✓ Red button hides the window; the process stays alive
  (same family as Mail / Preview, not “quit on close”).

Login items (when the user enables them)
✓ Start at login           OFF by default
✓ Open window after login  ON by default
□ Start hidden             reserved · advanced · OFF · not shipped
```

---

## Launch

Applies to double-click, Start menu, Spotlight, Launchpad, Dock, shortcuts, and associated documents.

```text
Launch
    ↓
Already running?
    ↓ no                         ↓ yes
Create main window          Focus existing window
Show + focus
```

Protocol / license deep links still open a window (license or main). They are not a silent launch.

---

## Close vs Quit

```text
X / ⌘W / Close window
        ↓
Hide window
        ↓
Tray mode (index · watch · listen)

Quit / ⌘Q / Tray → Quit
        ↓
Stop background
Destroy tray
Process exits
```

**Never use Connected-style language here.** Tray mode is “still running”, not a source state.

---

## Settings (shipped vs reserved)

Shipped:

```text
☐ Launch SuHuella when I sign in     (OFF by default)
```

Reserved — do not ship yet:

```text
☐ Start hidden in the system tray    (advanced · OFF)
```

`Start hidden` is the only legal way to skip the window. It must never be the default.

---

## Out of scope

- Source Domain, Lifecycle, Presentation, or Handle adapters
- Browser host (no tray)
- New first-run steps
- Implementing `Start hidden`

First-session content remains [FIRST-LAUNCH-EXPERIENCE-001.md](../../../FIRST-LAUNCH-EXPERIENCE-001.md). This contract governs every launch after that, including the first.

---

## Check

```bash
npm run test:application-lifecycle --prefix site
```
