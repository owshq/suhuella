# LICENSE-COPY-AND-RIGHTS-AUDIT-001

```text
STATUS = COMPLETE (copy + tests · no deploy · no checkout activation)
TYPE = License copy alignment with implemented rights
SCOPE = /license · Settings → License · license-plans copy
```

## Objective

Align license marketing and Settings copy with **implemented** capabilities — without expanding or reducing legal rights, and without promising enforcement that does not exist.

## Rules observed

- No deploy, checkout activation, Stripe/D1 remote, releases, or installers changed.
- Certificates frozen.
- No Dbasenet or Windows candidate mixing.

---

## Rights matrix (implemented vs pending)

| Plan | Effective capabilities (code) | Validity / expiry | Device limit (enforced) | Download / update | Web vs Desktop |
| --- | --- | --- | --- | --- | --- |
| **Free** | Local folder sources; no paid organisation features | No expiry; local-only token | Not licensed (no server activation) | Public download/open; release check via `/api/release` | Same product shell; Desktop has Save As preview/full per platform |
| **Personal Lifetime** | Personal capabilities + cloud source types (Drive, Dropbox, OneDrive) | `lifetimeHasNoExpiry` — no `validUntil` on grant | **1 active device** (`deviceLimitForEdition`, server `device_limit`) | Same installer for all personal plans; **no** “current version” pin enforced | Activation via OTP + `/api/license/activate`; browser stores local activation |
| **Personal Monthly** | Live collab capabilities (+ Gmail/Outlook sources vs Lifetime) | `validUntil` / subscription; `expired` status blocks activation | **1 active device** (same enforcement) | Same binary as Lifetime; rights differ by **subscription period**, not build | Same activation path; periodic re-check |
| **Business** | Business branding, org seats, admin panel | Seat + org subscription via Stripe; `expired`/`revoked` handling | **1 device per seat** (override possible via Ops) | Per-seat activation | Owner/admin org management in License panel |

### Separated concepts (copy)

| Stage | What happens | UI |
| --- | --- | --- |
| Public download | Installer or `/home` — no payment | `/download`, `/license` Free card |
| Verified payment | Stripe Checkout → grant in D1 | Checkout routes (closed while flags off) |
| Verified identity | Email OTP (`request` / `verify`) | Settings → License → Activate |
| Device activation | `activate` / `activate-from-checkout` binds device | Status block + device section |
| Usage rights | Edition capabilities + expiry rules | Plan card summaries + status detail |

### Policies **not** implemented (copy must not imply)

| Claim | Status |
| --- | --- |
| “Current version” / “Latest version” product restriction | **Not enforced** — removed from plan cards |
| Unlimited updates for Lifetime | **Not promised** |
| Lifetime Upgrade purchase | **Closed** (`lifetimeUpgradeSaleEnabled() === false`) |
| License generation / upgrade eligibility model | **Pending** commercial decision |
| Version pinning by edition | **Pending** — no server or Desktop gate found |

---

## Final copy (ES / EN)

Source of truth: `packages/product/src/lib/license-plans.ts`

### Plan cards

Each card: **summary** (billing + device) + **features[]** (implemented product capabilities).

| Plan | EN summary | ES summary |
| --- | --- | --- |
| Free | Everything stays on your device. No account needed. | Todo permanece en tu dispositivo. Sin cuenta. |
| Personal Lifetime | One-time purchase. Personal use. One active device. No subscription expiry. | Pago único. Uso personal. Un dispositivo activo. Sin caducidad por suscripción. |
| Personal Monthly | Monthly subscription. Personal use. One active device. Active while subscribed. | Suscripción mensual. Uso personal. Un dispositivo activo. Vigente mientras la suscripción esté activa. |
| Business | Per-seat subscription. One active device per assigned seat. Organisation admin. | Suscripción por plazas. Una plaza, un dispositivo activo. Administra tu organización. |

Feature bullets source: `planFeaturesFor()` in `license-plans.ts` — aligned with `capabilitiesForEdition()` and `knowledgeSourcesForEdition()`.

### Activation (Settings)

- **EN:** Enter the email on your purchase or license. We send a 6-digit code; verifying it activates this device.
- **ES:** Introduce el email de tu compra o licencia. Te enviamos un código de 6 dígitos; al verificarlo, activamos este dispositivo.

Email appears **once** in the status block (`StatusRows`) when licensed; input lives only under **Activate this device**.

### Journey list (`/license`)

Five steps: Open/download → Verified payment → Verified identity → Device activation → Usage rights (`licenseJourneySteps()`).

---

## Files modified

| File | Change |
| --- | --- |
| `packages/product/src/lib/license-plans.ts` | Centralized EN/ES plan copy, `planFeaturesFor()` feature bullets, journey + activation strings |
| `packages/product/src/lib/license-checkout.ts` | Re-exports |
| `packages/product/src/components/PlanFeatureList.tsx` | Shared feature bullet list for plan cards |
| `packages/product/src/components/LicenseStatusPanel.tsx` | Email once in status; OTP copy; locale plan cards + feature bullets |
| `site/components/LicensePlansPage.tsx` | Journey section; centralized cards; `PlanFeatureList`; purchase vs activation |
| `desktop/electron/license-status-check.ts` | Assertions updated |
| `site/lib/license-copy-audit-check.ts` | New audit test |
| `site/package.json` | `test:license-copy-audit` |

---

## Tests

```bash
npm run test:license-copy-audit --prefix site
npm run test:plan-semantics --prefix site
npm run test:checkout-complete-by-product --prefix site
cd desktop && npm run test:license-status
```

---

## Pending commercial decisions (not invented)

1. **Lifetime Upgrade:** generation model, eligibility, anti-repurchase — see `CHECKOUT-COMPLETE-BY-PRODUCT-001.md`.
2. **Version policy:** whether Lifetime should ever pin to a release generation (no enforcement today).
3. **Capability delta Lifetime vs Monthly:** Monthly includes extra knowledge sources in `knowledgeSourcesForEdition` — document if marketed later.

---

## Production flags (unchanged)

| Flag | Value |
| --- | --- |
| `PAID_CHECKOUT_ENABLED` | `false` |
| `PARTNER_CHECKOUT_ENABLED` | `false` |
| `STRIPE_CATALOG.lifetime_upgrade.checkoutEnabled` | `false` |

No deploy executed in this track.
