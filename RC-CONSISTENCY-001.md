# RC-CONSISTENCY-001

**STATUS:** CLOSED · PASS

**TYPE:** Release Candidate Consistency Audit

---

## Objective

Make SuHuella speak with one voice.

This milestone did **NOT** add features, redesign screens, or change behaviour.

It **ONLY** removed inconsistencies.

---

## Public vocabulary (frozen)

| Concept | Public name |
|---------|-------------|
| What SuHuella knows / finds / organises | Document |
| What SuHuella can see | Source |
| Place on disk | Folder |
| Confirmed work | Plan |
| History | Activity |
| Saved Plan you reuse | Workflow |
| Commercial grant | License |
| Configuration | Settings |
| Desktop folder action | Add |
| Browser folder action | Connect |
| Plan action | Confirm Plan |
| History action | Undo |
| License action | Activate |
| Device action | Deactivate |
| Workflow action | Use workflow |

Never: Connected · Favourite folders · Suggested folders · Learn from this folder · Choose local folder · Licence · Organize · Local only · Apply · Run · Execute.

---

## Changes

| Current wording | Correct wording | Affected files | Reason | Risk |
|---|---|---|---|---|
| Add source / Add a source to begin (Browser) | Connect / Connect a source to begin | `HomePanel.tsx`, `capabilities.ts` | Desktop Add, Browser Connect | Home empty CTA label only |
| Drop documents or choose files | Drop or select documents | `organise-copy.ts` | One noun, one picker verb | Empty Organise copy |
| Select files / Choose folder | Select documents / Select folder | `OrganisePanel.tsx`, `PlanEditor.tsx`, `main.ts` | One noun; one picker verb | Native dialog title only |
| Run workflow | Use workflow | `OrganisePanel.tsx`, `WorkflowsList.tsx` | Run is forbidden | Button label only |
| Apply N changes | Confirm Plan | `plan-presentation.ts` | Plans have one verb | Primary Plan CTA label |
| Organisation Run #N / Undo Run #N | Plan #N / Undo #N | `activity-copy.ts` | Run is forbidden | Activity titles |
| Undo this run / Move files back | Undo | `ActivityPanel.tsx` | History verb is Undo | Confirm button label |
| File details / N files | Documents / N documents | Organise, Activity, Plan, Sources | One noun | Counts and details copy |
| Available locations | Available folders | `PlanEditor.tsx` | folder, not location | Destination picker heading |
| Connected (AI) | Ready | `PreferencesPanel.tsx`, `ByokAssistCard.tsx` | Connected is deprecated | AI status label |
| Local only | Everything stays on your device | `license-plans.ts` | One privacy line | Free plan summary |
| What stays local | Everything stays on your device | `PreferencesPanel.tsx` | One privacy line | Settings Privacy heading |
| This file can only be opened… / not available in this browser | Open the desktop app to… | `host-action-copy.ts` | Host language, not “feature only available” | Capability notices |
| Type to find a document / Nothing matches | Type a name… / Try another name | `SearchPanel.tsx` | Empty state must teach | Search empty copy |
| Organise documents (Activity empty) | Organise | `ActivityPanel.tsx` | One next action, one screen name | Empty Activity CTA |
| Work completed / time saved / top destinations | History counts only | `ActivityPanel.tsx` | Activity is history-only | Removed extra questions |
| Sources H1 34px; Activity/Settings slate-900 | 28px / `--app-fg` | `SourcesPanel.tsx`, `ActivityPanel.tsx`, `PreferencesPanel.tsx` | Same heading hierarchy | Typography tokens |
| Keep these files… / never changes files / plans you can run | documents / Use workflow | `plan-assistant-copy.ts`, `plan-presentation.ts` | Same noun and verb | Assistant chips and replies |
| N files in Sources header | N documents | `SourcesPanel.tsx` | One noun | Count line |

---

## Screen questions (unchanged)

| Screen | Question |
|--------|----------|
| Home | What does SuHuella know? |
| Sources | What can SuHuella see? |
| Search | What can I find? |
| Organise | What should happen? |
| Activity | What happened? |
| Settings | How is SuHuella configured? |

---

## Out of scope (untouched)

- Host action behaviour (Search open, Organise picker mechanics, Save As, exports)
- Recommendation Engine, Knowledge / Plan / Activity / Workflow models
- BrandConfig, licensing schema, Stripe, Resend, Multibrand
- Onboarding wizard verbs
- Unused `IndexedLocationsPanel`

---

## Checks

- `desktop`: `tsc -b` PASS
- `desktop`: `check:knowledge-set` PASS
- `site`: `check:app-host` PASS

---

## Definition of Done

A user reading the product does not have to translate vocabulary.

Every concept has one name. Every action has one verb. Every screen answers one question.

No functionality changes. No architectural changes. Only consistency.

---

## Next

```text
RC-CONSISTENCY-001             CLOSED · PASS
        ↓
RC-POLISH-001
        ↓
RC-CHECKLIST-001
        ↓
FIRST-IMPRESSION-TEST-001
        ↓
REAL-USER-VALIDATION-001
        ↓
PRIVATE-BETA-001
```
