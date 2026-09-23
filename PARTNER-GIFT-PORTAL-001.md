# PARTNER-GIFT-PORTAL-001

```text
STATUS = LOCAL ADVANCE · production NOT accepted
SCOPE = Partner gift portal + closed payment code
DBASENET = local fixture only · authorized owner, duration, and reason still missing
CHECKOUT = CLOSED
PUBLICATION = none
```

Local scripts can open a gift portal against an isolated SQLite file. That is not production provisioning, not a connected local server session, and not a paid-checkout validation.

## Surfaces

| Record | Meaning |
| --- | --- |
| `partner_application` | Interest. No operating right. |
| `partner_entitlement` origin `gift` / `manual` / `internal` / `test` | Platform right to operate one brand. |
| `partner_entitlement` origin `stripe` | Same right after a verified paid subscription. Not used for Dbasenet. |
| `partner_member` | Who may open `/partners/portal`. |
| Customer `LicenseGrant.issuedByOperator` | End-customer license for that partner. Not the platform fee. |
| `partner_domain` | Hostname. Brand is served only when status is `active`. |

A pending or rejected interest row does not block a verified Stripe payment. Payment provisioning is separate and stays unreachable while checkout flags are false.

## Gift portal

1. Operations `create_partner` with `origin=gift` (existing action). It does not create a Stripe customer, subscription, or Checkout Session.
2. The owner opens `https://suhuella.com/partners/portal` and verifies the same email (`PARTNER_PORTAL`).
3. That login activates a pending gift entitlement and membership. The invite URL is not required for later visits.
4. The panel lists the platform license, brand, domain instructions, and customer licenses scoped by `issuedByOperator`.
5. A public applicant with only an interest row receives `no_membership`.

Customer grants are created by Operations `create_license` with optional `issuedByOperator` set to the partner id. Origin stays `gift` / `manual` / `internal` / `test`. The partner panel consults those rows. It does not create, edit, or revoke them. That is the initial scope, not autonomous license management from the partner panel. The panel cannot turn those into Stripe payments.

Partner-owned Stripe for end customers is **not connected**. The panel says so. SuHuella does not store those keys. No Stripe Connect.

## Payment code (closed)

`POST /api/partners/checkout` exists and returns checkout closed while `PAID_CHECKOUT_ENABLED` and `PARTNER_CHECKOUT_ENABLED` are `false`. It does not call Stripe in that state. There is no public flag bypass and no Dbasenet test purchase.

Webhook reconciliation for `operator_license` / `partner_annual` grants a partner only when Stripe reports `payment_status=paid` and the subscription is `active`. Same event and same subscription do not create a second partner. `invoice.payment_failed` does not change status.

End-customer suspension when a partner subscription ends is an **open commercial decision**. The code does not delete brand, domain, or customer licenses, and it does not invent a grace period. A deleted Stripe subscription suspends that Stripe entitlement only.

## Dbasenet

Two different records. Do not treat the fixture as the authorized gift.

| | Local fixture | Authorized conditions |
| --- | --- | --- |
| What it is | Smoke target used by `provision:dbasenet-gift` and `test:partner-gift-portal` | What an operator may copy to production |
| Owner email | `info.linkeram@gmail.com` | **missing** in `brands/dbasenet/identity.json` (`emails` and `supportEmail` are null) |
| Duration | `validUntil` omitted in the script (null in the SQLite row) | **missing**. Null is not an authorized indefinite gift |
| Reason | Script string `Partner platform gift — Dbasenet brand (Ops manual)` | **missing** as a commercial decision |
| Display name / accent | Dbasenet · `#0B5F63` | Same public brand facts, from `identity.json` |
| Primary domain | `dbasenet.com`, recorded only | Not approval to replace the live site |

Do not invent a legal name or a validity date. Do not move the fixture to production with an omitted `validUntil`. An indefinite gift requires an explicit operator decision, recorded as such. A dated gift requires `validUntil`. Until one of those is written down, do not call `create_partner` on the remote database.

Public DNS was read on 2026-09-23 and not changed:

| Record | Observed |
| --- | --- |
| NS | `ns33.domaincontrol.com`, `ns34.domaincontrol.com` |
| `dbasenet.com` A | `76.223.105.230`, `13.248.243.5` |
| `www.dbasenet.com` CNAME | `dbasenet.com` |

The apex already has addresses. Do not replace that site, mail, or nameservers from this track. Apex CNAME is not assumed to work on this DNS. When an owner confirms the hostname, prefer a subdomain such as `documents.dbasenet.com` unless they explicitly choose an apex setup their DNS can serve. DNS and TLS stay technical checks. They are not commercial approval.

## Production steps still manual

Do not run these from the agent track. Checkout stays closed. This list is not authorization to deploy.

1. On `suhuella-license`, list pending migrations before applying any. Read each pending file against the live schema: base already present, SQL, and compatibility. Apply only that pending file. Do not re-apply `0007`–`0010` as a batch because their names are in this track.
2. Deploy the candidate that contains this portal only after that list is reviewed. Deploying the previous Worker does not revert D1 rows or tables. Do not enable checkout flags in that deploy.
3. Confirm `PAID_CHECKOUT_ENABLED=false` and `PARTNER_CHECKOUT_ENABLED=false`.
4. Collect from the operator, and only the operator: owner email, display confirmation, reason, and either `validUntil` or an explicit indefinite gift. The fixture email and the omitted duration are not that collection.
5. In Operations, `create_partner` once with those authorized fields: slug `dbasenet`, origin `gift`. If slug or owner email already exists, do not create another partner; issue a portal login for the existing member.
6. Local fixture (no Stripe): `npm run test:partner-gift-portal` provisions a memory gift for `info.linkeram@gmail.com` and calls the portal function without checkout. That call injects the verified email. It is not an OTP login.
7. Local E2E: `npm run provision:dbasenet-gift:local-dev`, restart dev, open `http://localhost:3000/partners/portal`, OTP in terminal → session cookie → panel. Partner session cookie takes precedence over localhost Operations auto-auth on `/api/partners/*`.
8. Owner registers the confirmed hostname. Brand traffic stays on the status page until DNS and TLS are active.
9. Customer licenses, if any, remain Operations `create_license` rows with `issuedByOperator` set to the Dbasenet partner id. The panel only lists them.

## Tests

```bash
npm run test:partner-gift-portal --prefix site
npm run test:partner-public-program --prefix site
npm run test:partners --prefix site
```

Gift durability uses an isolated SQLite file with the D1 schema (`site/.data/partner-gift-portal.sqlite` and `site/.data/dbasenet-gift-provision.sqlite`). Reopening the file shows the script wrote rows that are still there. That does not show that the local application server is bound to that file, and it does not show an OTP → session → panel login. It is not a Live purchase.
