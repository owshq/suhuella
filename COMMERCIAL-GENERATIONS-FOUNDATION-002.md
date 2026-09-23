# COMMERCIAL-GENERATIONS-FOUNDATION-002

```text
STATUS = FOUNDATION COMPLETE · ENFORCEMENT BLOCKED (see GENERATION-ENFORCEMENT · LICENSE-VERSION-MODEL)
TYPE = Commercial generation / license-version infrastructure
DEPENDS = LICENSE-COPY-AND-RIGHTS-AUDIT-001
```

## Objective

Separate **binary semver**, **commercial generation**, **generation-gated capabilities**, and **license edition / status / validity**. Capture generation at checkout on the server, preserve it through webhooks and retries, and keep existing grants operational without retroactive assignment.

## Rules observed

- No remote D1 migrations applied or deployed.
- No checkout activation, Lifetime Upgrade sales, release aliases, or binary changes.
- No invented production generation ids, cutover dates, or legacy rights.
- No auto-assignment from install version, login date, or first activation.
- Browser / Stripe session metadata is **not** authoritative for generation.
- Enforcement remains off unless `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED=true` (not set in production config).

---

## Model

| Concept | Stored where | Notes |
| --- | --- | --- |
| App binary version | Desktop `appVersion`, release manifest | Technical semver only |
| Commercial generation | `commercial_generation` registry + grant / signed context | Opaque id; operator-defined |
| Capabilities requiring a generation | `requiredCapabilities` on registry row | Not used for enforcement yet |
| License edition | `LicenseGrant.edition` | Lifetime / Monthly / Business |
| License validity | `status`, `validUntil`, subscription fields | Unchanged |
| Checkout binding | `checkout_generation_binding` | Frozen at Stripe session creation |
| Purchase history | `license_acquisition` | Append-only; duplicates deduped |

### Access modes (`GenerationAccessMode`)

| Mode | Meaning |
| --- | --- |
| `legacy_unassigned` | **Recognized** pre-model grant or pre-cutover checkout without binding |
| `purchased_generation` | Lifetime: version at purchase (when bound) |
| `active_subscription` | Monthly/Business: current versions while entitled (when bound) |
| `version_binding_required` | Post-model **new** fulfillment without server binding — not legacy |

Lifetime stores `commercialGenerationId` on the grant when a binding exists. Upgrades append to `license_acquisition`; effective rights use the **cumulative** acquired version set (see LICENSE-VERSION-MODEL-001).

### Sessions without binding

| When | Result |
| --- | --- |
| Before `LICENSE_VERSION_MODEL_ACTIVE` | `legacy_unassigned` if no binding |
| After model active, **new** grant | `version_binding_required` — Ops must repair |
| After model active, **existing** legacy grant | Stays `legacy_unassigned` |

**No version is inferred** from Stripe metadata, catalog changes after checkout, or delayed webhooks.

---

## Implementation

| Area | Path |
| --- | --- |
| Types & fixtures | `site/lib/commercial-generations/types.ts` |
| Registry / price resolution | `site/lib/commercial-generations/registry.ts` |
| Checkout bind | `site/lib/commercial-generations/bind-at-checkout.ts` |
| Fulfillment apply | `site/lib/commercial-generations/grant-application.ts` |
| Persistence helpers | `site/lib/commercial-generations/persistence.ts` |
| Enforcement gate (off) | `site/lib/commercial-generations/enforcement.ts` |
| Grant / signed context fields | `site/lib/license-context.ts` |
| D1 migration (local only) | `site/migrations/0011_commercial_generations.sql` |
| Checkout wiring | `site/lib/checkout-session.ts` |
| Webhook / reconcile | `site/lib/checkout-reconciliation.ts`, `site/lib/license-fulfillment.ts` |

### Local migration

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --local --config wrangler.jsonc
```

Do **not** run `--remote` until operator decisions and a promotion plan exist.

### Server configuration (optional, not production)

- `COMMERCIAL_GENERATION_PRICE_MAP` — JSON array of `{ priceId, commercialGenerationId, product }`
- `COMMERCIAL_GENERATION_CHECKOUT_ID` — fallback generation when map entry missing (requires registry row with `effectiveFrom`)
- `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED` — must stay unset/false until enforcement track

Fixture ids (`gen_fixture_alpha`, `gen_fixture_beta`) are for tests only.

---

## Compatibility

| Case | Behaviour |
| --- | --- |
| Legacy grants without generation fields | Continue to activate; signed tokens omit generation until explicitly set |
| Legacy signed tokens | `readSignedLicenseToken` accepts payloads without generation keys |
| Gifts / manual / internal / test | No automatic generation; remain `legacy_unassigned` unless Ops assigns later |
| Replay / duplicate Stripe events | Acquisition deduped by `(checkout_session_id, kind)` and `stripe_event_id` |
| Delayed webhook after registry change | Uses checkout binding from session creation, not current catalog |
| Security patches | `securityPatchBypassesGenerationGate()` documents intent; patches are not sold as upgrades |

---

## Tests

```bash
npm run test:commercial-generations --prefix site
```

Covers: file + local D1 reopen, server-bound purchase, delayed webhook, duplicate events, metadata-only checkout, legacy grant, expired monthly vs active lifetime, legacy signed token read, wrangler flags unchanged.

---

## Operator decisions required (confirm before enforcement or remote migration)

| Decision | Status |
| --- | --- |
| First real commercial generation id and label | **Pending** |
| Capability ↔ generation ↔ semver correspondence | **Pending** |
| Policy for pre-model Lifetime grants (grandfather / upgrade / opt-in) | **Pending** |
| Policy for gifts, manual, internal, test, partner grants | **Pending** |
| Security patch delivery outside generation gates | **Pending** (intent: always free to entitled installs) |

Do not populate production registry or price map until this block is approved.

---

## Remote / restriction confirmation

- `wrangler.jsonc`: `PAID_CHECKOUT_ENABLED` remains `"false"`.
- No `COMMERCIAL_GENERATION_ENFORCEMENT_ENABLED` in worker env.
- Migration `0011` exists in repo only; not promoted to remote D1.
- No release binaries, aliases, or Lifetime Upgrade checkout changes in this track.
