# CHECKOUT-PRODUCTION-ENABLEMENT-001

```text
CHECKOUT-PRODUCTION-ENABLEMENT-001
STATUS = CLOSED · READY FOR STRIPE
PUBLIC_CHECKOUT_ENABLED = NO
SELLING = NO
SCOPE = SUHUELLA ONLY
```

Production checkout is guarded, testable, and fail-closed. This track did **not** start selling and did **not** deploy.

```text
BrandConfig.paidCheckoutEnabled = true   (SuHuella eligibility only)
PAID_CHECKOUT_ENABLED           = false  (production sales switch)
Lifetime / Monthly              = unavailable
Business                        = Contact Sales
verify-session                  = fail-closed
Resend                          = not connected here
```

---

## Decision

**Ready for Stripe. Not selling.**

When a human decides to sell, only the production switch and live Stripe secrets should turn checkout on. No license-model, UX-architecture, or BrandConfig rewrite.

SuHuella checkout is scoped only to the SuHuella production brand.
No other project, brand, or company is part of this checkout track.

SuHuella checkout stays scoped to SuHuella only.
Resend stays on **RESEND-PRODUCTION-001**.
Dbasenet `paidCheckoutEnabled` stays `false`.

---

## What is ready

| Path | Ready |
| --- | --- |
| Checkout Session create | Yes. `/checkout/{lifetime\|monthly}` creates a Stripe session only when the public switch is on, a price ID exists, and the secret is allowed for the origin |
| Success / cancel URLs | Yes. In code: `/license/success`, `/settings?prefs=license`, `/license?checkout=canceled`. `{CHECKOUT_SESSION_ID}` is literal |
| `verify-session` | Yes. Forged, missing, unpaid, incomplete, test-on-live, and secret/session mismatch fail closed. No grant |
| `activate-from-checkout` | Yes. Same Stripe verify + bound activation-attempt consume. Unbound / replay / expired fail closed |
| Paid grant write | Yes. Verified paid session → `LICENSE_DB` via `fulfillLicenseFromCheckout`. Stripe customer alone invents nothing |
| License page | Yes. Follows `isPaidCheckoutPubliclyEnabled()`. Off → Coming soon / unavailable. On → Buy once / Subscribe without a copy rewrite |
| Production var | Yes. `wrangler.jsonc` has `"PAID_CHECKOUT_ENABLED": "false"`. No Payment Links, secrets, or price IDs in that file |
| Test vs live | Yes. `suhuella.com` / `www.suhuella.com` reject `sk_test_` and `cs_test_`. Local / preview may use test material |
| Business | Yes. Stays `mailto:sales@suhuella.com`. No automated Stripe checkout |

Payment Links (`STRIPE_LIFETIME_PAYMENT_LINK`, `STRIPE_MONTHLY_PAYMENT_LINK`) remain gated helpers. They stay unused while the switch is off. Checkout Session + price IDs is the production path.

---

## What is still gated

| Item | Gate | Until |
| --- | --- | --- |
| Public Lifetime / Monthly | `PAID_CHECKOUT_ENABLED` must be exactly `"true"` **and** SuHuella BrandConfig allows paid checkout | A human decides to sell |
| Live Stripe charge | Live `STRIPE_SECRET_KEY` + `STRIPE_*_PRICE_ID` secrets | Same decision, plus secrets stored |
| Payment Links | Same public switch | Prefer not to use. Sessions already set return URLs |
| Dbasenet checkout | `paidCheckoutEnabled: false` in Dbasenet BrandConfig | Not this track. Do not flip BrandConfig |
| Post-purchase / receipt email | Not implemented in app | Stripe Dashboard receipts later. **Not Resend** |
| Resend / OTP deliverability | Separate P0 | **RESEND-PRODUCTION-001** |
| Stripe webhooks | Not added | Optional later if a buyer closes before return |
| Desktop installer after pay | Strategy B. No public installer | **DESKTOP-RELEASE-DISTRIBUTION-001** (closed, Desktop out of RC) |

Live Worker (read-only smoke, no deploy):

| Check | Live now |
| --- | --- |
| `/checkout/lifetime` | 302 → `/license?checkout=unavailable&plan=lifetime` |
| `/checkout/monthly` | 302 → `/license?checkout=unavailable&plan=monthly` |
| `/checkout/business` | 302 → `mailto:sales@suhuella.com` |
| `/api/verify-session?session_id=fake` | 400 `invalid_session` |
| `/api/verify-session?session_id=cs_test_forged` | 400 `invalid_session` |
| `/license` | `paidCheckoutEnabled: false`. Lifetime / Monthly = Aún no disponible |

The origin / test-material guards in this slice are in source only until a later deploy. Live selling is already off.

---

## Fixes in this slice

Fail-closed gaps closed without turning selling on:

1. `verify-session` and `activate-from-checkout` now take the request origin. `suhuella.com` rejects test secrets and test sessions **before** calling Stripe.
2. A live secret cannot verify a test session (and the reverse). Mode mismatch does not call Stripe.
3. Stripe’s returned `session.id` must match the requested id.
4. `payment_status=paid` is not enough if `status` is present and not `complete`.
5. License page metadata and intro follow the public switch, so enabling later does not require a copy edit.
6. Enablement tests prove the ready path with a mocked Stripe create, then prove the switch turns it off again.

---

## How a later human enables Stripe safely

Do this in order. Do **not** connect Resend. Do **not** enable Dbasenet. Do **not** change BrandConfig, license schema, or package versions.

```text
1. Local only
   PAID_CHECKOUT_ENABLED=true
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_LIFETIME_PRICE_ID=price_...
   STRIPE_MONTHLY_PRICE_ID=price_...
   npm run test:checkout --prefix site
   Pay with 4242 4242 4242 4242 against localhost / preview
   Confirm /license/success verifies and writes a grant
   Set PAID_CHECKOUT_ENABLED=false again

2. Store live secrets (still not selling)
   cd site
   npx wrangler secret put STRIPE_SECRET_KEY          # sk_live_...
   npx wrangler secret put STRIPE_LIFETIME_PRICE_ID
   npx wrangler secret put STRIPE_MONTHLY_PRICE_ID
   Confirm wrangler.jsonc still has PAID_CHECKOUT_ENABLED=false
   Confirm Cloudflare Worker vars match that false

3. Optional Stripe Dashboard
   Enable Stripe’s own receipt emails if wanted
   Do not add RESEND_API_KEY for checkout
   Do not create public Payment Links as the buy path

4. Sell (config only)
   Set Worker var PAID_CHECKOUT_ENABLED=true
   Deploy site (this track did not)
   Smoke: /checkout/lifetime → checkout.stripe.com
          /checkout/monthly → checkout.stripe.com
          /checkout/business → mailto sales
          forged verify-session still 400

5. Stop selling
   Set PAID_CHECKOUT_ENABLED=false
   Deploy or update the Worker var
   Lifetime / Monthly return to unavailable
```

Fail closed if any of these are true:

- switch missing, empty, `false`, `1`, or anything other than `true`
- BrandConfig `paidCheckoutEnabled` is not `true`
- secret missing, or `sk_test_` on suhuella.com
- price ID missing or not `price_...`
- session id forged / unpaid / incomplete / `cs_test_` on suhuella.com

---

## Tests run

Site, no deploy:

- `npm run test:checkout` — passed
- `npm run test:license` — passed
- `npm run test:grant-durability` — passed

Desktop, Resend, BrandConfig architecture, version authority, First-run, and Windows were not opened.

---

## Remaining limitations

- Live Worker does not yet run the new origin guards until a later site deploy. Selling is already off on that Worker.
- Live Stripe secrets / price IDs may still be unset. That is correct while not selling. Store them in step 2 above, still with the switch off.
- No Stripe webhook. A buyer who never returns from Checkout will not get a grant until they open the success URL or activate-from-checkout. Add a webhook only if that becomes a real miss.
- Post-purchase email is Stripe Dashboard later, not this app, not Resend.
- Success / download still contains installer copy. Desktop is out of this RC, so that path is not a public promise.

---

## Impact on PRE-RC-TRACKS-001

Track 1 **CHECKOUT-PRODUCTION-ENABLEMENT-001** is **CLOSED · PASS WITH FIXES**.

- PRODUCTION-READINESS-001 stays deferred.
- Do not tag `0.1.0-rc1` from this close.
- Do not start charging.
- Next P0 that remains open: **RESEND-PRODUCTION-001**.

Frozen domains were not opened: Resend DNS/templates/OTP, version authority, First-run, Windows, Desktop packaging, Recommendation / Knowledge / Organise / licensing schema, BrandConfig architecture, Commercial Authority Model, Multibrand, BYOK, Connections, Automations.
