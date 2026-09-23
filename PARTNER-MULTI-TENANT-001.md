# PARTNER-MULTI-TENANT-001

```text
STATUS = READY · Phase 1 production-ready (not deployed · migration not applied remote)
TYPE = Multi-tenant partners
SCOPE = Partners · branding · domains · onboarding · Ops · no Stripe Connect
```

## Decision: Ops hosts

| Host | Who |
| --- | --- |
| `ops.suhuella.com` | SuHuella platform Ops (global). Always. |
| `ops.<partner-domain>` | Optional partner admin panel later. |
| `partner.suhuella.com` | Not an admin panel in Phase 1. |

Access only on `ops.*`. Public brand sites stay public. `SUPERADMIN_EMAILS` is SuHuella-only.

## Entitlement vs user licenses

`partner_entitlement` is the platform right for one partner tenant. It is **not** a `license_grant.edition`.
Valid Ops origins: `gift`, `manual`, `internal`, `test`. Stripe annual partner fee is reconciliation-only (`origin=stripe` never from Ops forms).
Individual Business gift licenses remain Business gifts until explicitly retired — no automatic conversion.

One partner product. Roles: `partner_admin` (configure) and `partner_member` (read/use).

## Stripe

1. Partner → SuHuella annual platform fee (normal Stripe reconcile). Ops cannot mint `origin=stripe`.
2. Customer → Partner via Connect = **Phase 2**.

## Phase 1 code complete

- D1 store on `LICENSE_DB` (memory only for tests; production fail-closed if D1 missing)
- Migration `0007_partners.sql` + `0008_partner_domain.sql`
- Public program entry: `/partners` (discover + apply — see [PARTNER-PUBLIC-PROGRAM-001.md](./PARTNER-PUBLIC-PROGRAM-001.md))
- Private onboarding: `/partners/onboarding/<token>` + session cookie after accept
- Self-service branding + Custom Hostname + DNS instructions
- Hostname → `brand_id`; unknown hostnames rejected; domains unique
- Ops Partners: create gift|manual|internal|test, invite with role, suspend, reactivate, revoke, domains, branding
- `PAID_CHECKOUT_ENABLED=false` / `CLOUD_INTEGRATIONS_ENABLED=false` unchanged by this track

## Manual commands (operator — do not run from this agent)

```bash
# 1) Apply partner tables to remote D1
cd site
npx wrangler d1 migrations apply suhuella-license --remote

# 2) Confirm local/dev migration if needed
npx wrangler d1 migrations apply suhuella-license --local

# 3) Deploy when you accept the diff
npm run deploy

# 4) Rollback Worker only
npx wrangler deployments list
npx wrangler rollback
```

## Cloudflare for SaaS (generic partners)

Do **not** add a Worker Custom Domain per partner. Use Cloudflare for SaaS Custom Hostnames on the shared Worker `suhuella`. See [PARTNER-CUSTOM-DOMAINS-001.md](./PARTNER-CUSTOM-DOMAINS-001.md).

Partners keep their DNS provider and only add the CNAME/TXT Cloudflare returns. Never enable Access on the partner’s public hostname. Optional later: `ops.<partner-domain>` + Access for that partner’s admins only. Platform Access stays on `ops.suhuella.com`.

## Tests

```bash
npm run test:partners --prefix site
npm run test:operations-control-center --prefix site
npm run test:operations-access --prefix site
npm run test:admin --prefix site
npm run test:license --prefix site
npm run verify:production --prefix site
```

## Risks

- Full-document D1 rewrite for partner tables is atomic via `batch`, but concurrent Ops+onboarding writers can last-write-win until row-level updates land.
- Migration must be applied **before** production traffic hits partner APIs (otherwise 503).
- Onboarding OTP requires Resend + `LICENSE_SIGNING_SECRET` in production (same as license OTP).
- Connect still absent: partners cannot charge their customers inside SuHuella yet.
