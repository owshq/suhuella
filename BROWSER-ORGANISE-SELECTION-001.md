# BROWSER-ORGANISE-SELECTION-001

```text
STATUS = CLOSED · PASS
TYPE = Browser Organise blocker
SCOPE = SuHuella Web / Organise / Browser document selection
DATE = 2026-09-19
```

Organise in the browser can create a Plan without uploading files and without Desktop. Execution limits are separate from selection.

## Product

Organise answers: **What should happen?**

Web selection:

1. Documents already indexed from connected Sources
2. Choose files (`<input type="file" multiple>` / `showOpenFilePicker`)
3. Choose folder (`showDirectoryPicker` / `webkitdirectory`)

Files stay on this device. No upload language. `DESKTOP_IN_RC = NO` — Desktop is not required to create a Plan.

## Behaviour

| State | UI |
| --- | --- |
| First paint | No red “This browser cannot choose documents.” |
| Sources connected | Select from Sources · Choose files · Choose folder. Source list with document counts. |
| No sources | Connect a folder · Choose files · Choose folder. |
| Folder picker unsupported | “This browser cannot choose folders. Choose files instead.” |
| Plan created | Same Knowledge Set (`path` + `kind`). Browser ids are virtual (`src_…/relative` or `picked/…`). |
| Execution unsupported | Plan stays preview. “This browser can prepare the Plan. Some file changes may require additional permission.” |

## Tests

```text
npm run test:browser-organise-selection --prefix site
npm run test:browser-organise-selection-playwright --prefix site
npm run check:app-host --prefix site
```

| Check | Result |
| --- | --- |
| No default dead-end banner | PASS |
| Constructive CTAs | PASS |
| Source files → Plan draft | PASS |
| File/folder descriptors, no absolute paths | PASS |
| No upload / no Desktop required | PASS |
| Localhost demo: Load demo → Organise → factura-enero.pdf → Plan | PASS |

## Localhost

`http://localhost:3000/organise` after Load demo data on Sources. Select from source **dev-data**, choose `factura-enero.pdf`, Plan draft appears. Choose files opens the browser picker.

## Production

Deployed 2026-09-19. Worker `444619e8-1128-47e7-8511-b68498379c5f`.

`https://suhuella.com/organise`:

- No dead-end banner
- Connect a folder · Choose files · Choose folder
- No upload language
- No Desktop required to start a Plan

## Do not

Change Plan architecture, Recommendation Engine, Activity, checkout, Stripe, Resend, Desktop RC, BYOK, Automations, Multibrand. Do not run FIRST-RUN or PRODUCTION-READINESS as a substitute.
