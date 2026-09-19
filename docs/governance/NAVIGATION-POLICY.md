# Navigation Policy

```text
STATUS = FROZEN
EFFECTIVE = 2026-09-19
```

Screen order and names are fixed until **UX evidence** says otherwise ([Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md)).

---

## Canonical order

```text
Landing → Home → Sources → Search → Organise → Activity → Settings
```

Each screen answers **one question** (see workspace rule `one-question-per-screen`).

| Screen | Question |
| --- | --- |
| Home | What does SuHuella know? |
| Sources | What can SuHuella see? |
| Search | What can I find? |
| Organise | What should happen? |
| Activity | What happened? |
| Settings | How is SuHuella configured? |

---

## Until evidence

Do not move buttons, change menus, or rename screens without the UX evidence bar (multiple users or strong telemetry).

In-screen copy and clarity **may** change with evidence — without restructuring navigation.

---

## Change class

Navigation structure changes are **Architecture** or **UX improvement** depending on scope. See [Change Classification Policy](CHANGE-CLASSIFICATION-POLICY.md).
