# Change Classification Policy

```text
STATUS = ACTIVE · PERMANENT
EFFECTIVE = 2026-09-19
```

Every change belongs to **exactly one** class. Each class follows a different approval process.

---

## Classes

| Class | Examples | Evidence | ADR required? |
| --- | --- | --- | --- |
| **1. Bug** | Crash, wrong result, broken flow | One reproducible case | No |
| **2. UX improvement** | Copy, empty state, discoverability | Users **or** telemetry | No |
| **3. Feature** | New capability, new screen action | Business or user need (see [Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md)) | No |
| **4. Infrastructure** | Deploy, hosting, CI, Operations tooling | Operational need | No |
| **5. Architecture** | New version authority, new manifest, principle change | Documented decision | **Yes** |

---

## Rules

1. **Pick one class before coding.** If it fits two, choose the **higher-risk** class (Architecture > Infrastructure > Feature > UX > Bug).
2. **Architecture changes** require an ADR in [docs/architecture/decisions/](../architecture/decisions/) and explicit approval. They are rare while [Release Architecture](../architecture/constitution/release-architecture.md) and Architecture Freeze v1.1 remain in force.
3. **“Is this a bug or a feature?”** — If it worked as designed and users struggle → **UX**. If it broke vs spec → **Bug**. If it adds capability → **Feature**.
4. **One class → one narrow change.** Do not bundle UX + Feature + Infrastructure in one PR unless each class is declared and justified.

---

## Related

- [Product Evolution Policy](../../PRODUCT-EVOLUTION-POLICY.md) — evidence bar per change type
- [Release Process (frozen)](RELEASE-PROCESS-FROZEN.md) — ship phases
