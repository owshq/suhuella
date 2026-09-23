# DBASENET-GIFT-PROVISION-001

```text
TYPE = Local fixture (not an authorized production gift)
FIXTURE OWNER = info.linkeram@gmail.com
AUTHORIZED OWNER / DURATION / REASON = missing
STRIPE = none
REMOTE D1 = not modified by this track
CHECKOUT = CLOSED
```

The email below is a smoke target. It is not the owner recorded in `brands/dbasenet/identity.json`, and it is not permission to create the remote partner.

## Local fixture

Equivalent only to a local `create_partner` against an isolated SQLite file:

| Field | Fixture value | Production meaning |
| --- | --- | --- |
| slug | `dbasenet` | Same slug only after operator authorization |
| displayName | `Dbasenet` | Public brand name |
| ownerEmail | `info.linkeram@gmail.com` | Test inbox. Authorized owner email is still missing |
| origin | `gift` | Gift path, not Stripe |
| primaryDomain | `dbasenet.com` | Recorded only. Do not change public DNS |
| validUntil | omitted (null in the row) | Not an indefinite gift. Do not copy this omission to production |
| reason | script string for the fixture | Not a recorded commercial decision |

```bash
cd site
npm run provision:dbasenet-gift
npm run test:dbasenet-gift-provision
```

Writes:

- SQLite: `site/.data/dbasenet-gift-provision.sqlite`
- Licenses: `site/.data/dbasenet-gift-provision-licenses.json`
- Log: `DBASENET-GIFT-PROVISION-001-EXEC.log` (repo root)

What the script checks: rows survive in that file, `openPartnerPortalForVerifiedEmail` accepts the fixture email, Partner checkout returns `already_covered` with no Stripe calls, and an optional sample customer license is visible to that partner id.

What it does not check: the running local server reading this file, or a person signing in with a real OTP, receiving a session, and opening the panel. The test passes the email in directly.

## Local dev portal (wrangler D1)

To sign in at `/partners/portal` and configure brand + DNS manually in the panel:

```bash
cd site
npm run provision:dbasenet-gift:local-dev
npm run dev:stop && npm run dev
# or one step: npm run dev:partner
```

- Writes partner gift rows into **wrangler local D1** (`site/.wrangler/state/.../*.sqlite`) — the same store `dev:cf` uses.
- **Portal URL:** `http://localhost:3000/partners/portal` (platform host only — not on partner brand hostnames).
- Does **not** pre-create a hostname row; add `app.dbasenet.test` (or another subdomain) from **Partner panel → Brand & hostname**.
- OTP codes print in the terminal as `[dev] Your SuHuella verification code for info.linkeram@gmail.com: …`.
- After provision, plain `npm run dev` reads the same wrangler local D1 file when it exists.
- **Restart the dev server after provisioning** so the store cache picks up wrangler local D1.
- **Brand test:** add `127.0.0.1 app.dbasenet.test` to `/etc/hosts`, register that hostname in the panel, click Refresh → `active`, then open `http://app.dbasenet.test:3000`.

The sample customer license is created inside the script. It is not evidence that the partner panel can issue licenses. Operations `create_license` remains the writer.

## Production (not accepted)

Do not run this from the local script.

1. List pending migrations on remote `suhuella-license`. Review base, SQL, and compatibility for each pending file. Do not apply `0007`–`0010` as a batch.
2. Keep `PAID_CHECKOUT_ENABLED=false` and `PARTNER_CHECKOUT_ENABLED=false`.
3. Collect an authorized owner email, reason, and either `validUntil` or an explicit indefinite gift. Then Operations `create_partner`. The fixture row is not that collection.
4. Owner verifies at `https://suhuella.com/partners/portal` through OTP → session → panel.
5. Register hostname when DNS/TLS plan is confirmed. Do not replace the apex site without owner approval.

Deploying an older Worker does not undo D1 tables or rows. Remote D1 is not updated by the local script above.
