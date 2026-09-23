# LICENSE-VERSION-MODEL-001

```text
STATUS = PROPOSED (commercial model · naming · operator decisions pending)
TYPE = License version and upgrade semantics
BLOCKS = GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003 · Lifetime Upgrade activation
```

## Product language

Use **versión de licencia** (EN: **license version**) in user-facing copy. Retire **generación** / **generation** in customer text once enforcement ships.

Internal identifiers (`commercialGenerationId`, registry tables) may remain until a rename migration is scheduled.

---

## Commercial model (proposed)

| Purchase | License version rights |
| --- | --- |
| **Lifetime 1.x** | Use 1.x permanently, including security/maintenance fixes within 1.x |
| **2.x release** | Existing Lifetime 1.x licenses keep 1.x — no automatic loss |
| **Upgrade to 2.x** | Same license gains 2.x rights; **1.x rights remain** (cumulative) |
| **Monthly / Business** | Latest license version available while subscription rights are active |

### Upgrade rules

- Upgrade checkout **pins the target license version at purchase time** — never “current” or “latest”.
- If a newer version ships later, an earlier Upgrade purchase does **not** expand automatically.
- Each license stores:
  - Original purchased version
  - **Cumulative set** of versions acquired (initial + upgrades) — append-only acquisition history
  - Payment / acquisition references

### Effective rights (evaluator contract)

| Source | Rule |
| --- | --- |
| `commercialGenerationId` alone | **Insufficient** — initial purchase version only |
| `acquiredCommercialGenerationIds[]` (server-signed) | **Authoritative cumulative set** — union of capabilities from all acquired versions in registry |
| Upgrade fulfillment | Appends target version to acquisition history; does not replace prior versions |
| Subscription | Current effective registry versions while entitled — not cumulative lifetime set |

Server must derive and sign `acquiredCommercialGenerationIds` from `license_acquisition` before Desktop enforcement can trust cumulative rights.

### Download vs execute

- **Download remains public** (installers, release manifest).
- **Execute checks rights** (server-signed capabilities + version set + local executor gate).
- **Web:** served build must not remove rights the license already includes.
- **Worker env alone cannot enforce on old executables** — signed policy delivery + minimum app build required.

---

## Legacy (pre-model) grants

**Operator decision required — do not infer from registry.**

| Wrong | Right |
| --- | --- |
| “Earliest registry row” defines legacy rights | Explicit legacy version policy, stable and approved |
| Registry reorder changes legacy entitlements | Legacy policy frozen at cutover |
| New purchase without binding → `legacy_unassigned` | **`version_binding_required`** after model cutover |

Until legacy policy is approved:

- **Do not version-restrict** recognized `legacy_unassigned` grants (enforcement may apply to post-model grants only).
- Do not activate enforcement that narrows legacy users without comms + Ops plan.

Pre-release Lifetime decisions still open:

- Which license version do existing grants receive?
- No-cost path to first commercial version?
- Which boundaries require paid Upgrade?

Do **not** infer version from install semver, login date, or activation date.

---

## Post-model checkout without binding

After `LICENSE_VERSION_MODEL_ACTIVE=true`:

| Case | Access mode |
| --- | --- |
| Pre-model open checkout / existing grant without binding | `legacy_unassigned` (recognized old session) |
| **New** fulfillment without server checkout binding | `version_binding_required` → invalid until Ops repairs |

Fulfillment: [`grant-application.ts`](site/lib/commercial-generations/grant-application.ts) + [`version-model.ts`](site/lib/commercial-generations/version-model.ts).

---

## Undo / recovery

Undo is **not** a client flag on the rights evaluator.

| Requirement | Owner |
| --- | --- |
| Build inverse plan from **recorded Activity run** | Desktop host (`undo.ts`) |
| Path, permission, conflict checks | Existing undo safety (`inspectActivityItemUndo`, etc.) |
| Skip version gate only after verification | `executeOrganisationPlanForVerifiedUndo` — **not on IPC** |
| Prove manipulated IPC `executePlan` cannot undo or run new paid work | Required before activation |

---

## Engineering alignment

| Track | Status |
| --- | --- |
| Evaluator contract (invalid grant, empty registry, dates, cumulative ids) | Local — not activation-ready |
| Legacy explicit policy | **Pending operator** |
| Desktop signed enforcement + version set + registry | **Not done** |
| Undo host-only recovery proof | **Not done** (structure in place) |
| Upgrade SKU + pinned target version | **Blocked** — checkout stays off |
| Rename generation → license version in UI | Pending commercial approval |

---

## Related docs

- [COMMERCIAL-GENERATIONS-FOUNDATION-002.md](./COMMERCIAL-GENERATIONS-FOUNDATION-002.md)
- [GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003.md](./GENERATION-ENFORCEMENT-WEB-AND-DESKTOP-003.md)
- [CHECKOUT-COMPLETE-BY-PRODUCT-001.md](./CHECKOUT-COMPLETE-BY-PRODUCT-001.md)
