# RC-POLISH-001

**STATUS:** CLOSED · PASS

**TYPE:** Release Candidate visual polish

Does not add features. Does not change Recommendation, Knowledge, Plan, Activity, License, or host architecture.

---

## Closed after

```text
RC-CONSISTENCY-001            CLOSED · PASS
RC-HOST-INTEGRATION-001       CLOSED · PASS WITH GAPS
```

---

## Changes

| Before | After | Files | Reason | Risk |
|---|---|---|---|---|
| Settings tab active `slate-900` | Same `--nav-active-*` as product nav | `PreferencesPanel.tsx` | One active treatment | Low |
| Folder-access banner on every screen | Only on Sources | `SettingsWindow.tsx` | Home/Search/Activity stay one question | Low |
| Drop on Home/Search/Activity added Sources | Drop only on Sources | `SettingsWindow.tsx` | Predictable destination | Low |
| Recents opened Finder and Sources | Recents opens Sources only | `SettingsWindow.tsx` | One destination | Low |
| Rebuild index jumped to Sources | Rebuild stays in Settings | `SettingsWindow.tsx` | Settings is not Sources | Low |
| Search Open/Reveal/Activity hidden until hover | Always visible | `SearchPanel.tsx` | Keyboard / discoverability | Low |
| Organise notices always emerald | Rose when the notice is a failure | `OrganisePanel.tsx` | Error ≠ success | Low |
| Activity Try again `slate-900` full-width | Brand `#0084FF` capsule | `ActivityPanel.tsx` | One primary button | Low |
| Onboarding H1 + “1 minute setup” + “files stay” | 28px H1, documents stay | `OnboardingWindow.tsx` | Same tokens / vocabulary | Low |
| Save As “Choose another folder...” | “Choose another folder” | `SuggestionWindow.tsx` | Same label as Sources | Low |

---

## Tests

```text
desktop tsc -b     (run with this slice)
```

---

## Next

```text
RC-CHECKLIST-001
        ↓
FIRST-IMPRESSION-TEST-001
        ↓
REAL-USER-VALIDATION-001
```
