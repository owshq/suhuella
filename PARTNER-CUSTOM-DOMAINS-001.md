# PARTNER-CUSTOM-DOMAINS-001

```text
STATUS = READY · code complete (deploy separately · no flag changes in this track)
TYPE = Cloudflare for SaaS Custom Hostnames
SCOPE = Multi-partner custom domains · generic · no Connect
```

## Architecture

```text
partner hostname (browser URL unchanged)
        ↓
Cloudflare Custom Hostname (TLS + routing)
        ↓
Worker suhuella
        ↓
normalized_hostname → partner_domain → brand_id
        ↓
partner brand configuration
```

One Worker. Zero partner-specific hardcoding. Catalog brand names (e.g. a future test partner) are Ops data only — never special-cased in code.

## Entitlement model (not a license edition)

| Concept | Storage | Values |
| --- | --- | --- |
| Person license | `license_grant.edition` | `personal_lifetime`, `personal_monthly` |
| Organisation license | `license_grant.edition` | `business` |
| Partner platform right | `partner_entitlement` | `origin` = `gift` / `manual` / `internal` / `test` (Ops) or `stripe` (reconcile only) |

There is **no** `license_grant.edition = partner` and **no** edition named `full`.
Do **not** mint `origin=stripe` partner entitlements from Ops.
Existing Business gift licenses for individuals stay as Business gifts during trials — they are **not** auto-converted into partner entitlements.

One partner type. Roles inside that partner:

| Role | Can |
| --- | --- |
| `partner_admin` | branding, domains, onboarding invites, refresh/revoke own hostname |
| `partner_member` | read status / use the branded app |
| SuHuella `SUPER_ADMIN` | create/suspend/revoke partners · read domain status · emergency revoke only — **does not** register hostnames or edit branding |

## Operations hostname (`ops.suhuella.com`)

`ops.suhuella.com` is a **platform** hostname. Middleware must return `NextResponse.next()` and must **never**:

- resolve it as a partner domain
- rewrite it to `/hostname-status`
- `fetch()` same-origin APIs (re-enters Cloudflare Access → redirect loops)
- touch `/cdn-cgi/*` or Access well-known paths

See `site/lib/partners/middleware-gate.ts`.

## Required env (names only)

| Name | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Custom Hostnames API |
| `CLOUDFLARE_ACCOUNT_ID` | Account scope |
| `CLOUDFLARE_SAAS_ZONE_ID` | SaaS zone that owns Custom Hostnames |
| `CLOUDFLARE_SAAS_CNAME_TARGET` | Public **traffic** CNAME target partners point at |

Missing any of these → fail closed (`503 cloudflare_not_configured`). Never log token values.
Do not invent the CNAME target. Do not use `workers.dev` as the traffic target.

**Production enforcement:** `registerPartnerCustomDomain` and `refreshPartnerCustomDomain` reject requests with `503 cloudflare_not_configured` when the Cloudflare API is not fully configured — even if `CLOUDFLARE_SAAS_CNAME_TARGET` alone is set. No pending D1 rows are written in that state.

**Local dev sim:** non-production runtimes without the Cloudflare API use fixture DNS instructions; Refresh can activate without Cloudflare.

## Manual Cloudflare setup

1. Enable **Cloudflare for SaaS** on the zone that will terminate partner hostnames.
2. Configure the **fallback origin** that serves Worker `suhuella`.
3. Put the four secrets on Worker `suhuella` (or `.dev.vars` for local only).
4. Do **not** put Access on public partner hostnames.
5. Keep Access on `ops.suhuella.com` (and optional `ops.<partner-domain>`).

## Hostname choice (partner decides)

- The partner chooses the **full hostname** (FQDN). The subdomain label is **not fixed** — `app`, `documents`, `portal`, etc. are all valid if free at their DNS provider.
- Input is **hostname only**: no `https://`, paths, or ports.
- **Saving** a hostname registers it as **pending**. It is **not verified or active** until DNS ownership + TLS validation complete and Refresh shows `active`.
- **Reserved platform hostnames** (`suhuella.com`, `ops.suhuella.com`, `*.workers.dev`, localhost, …) cannot be registered.
- **Apex** (`example.com`) may require ALIAS/ANAME; prefer a subdomain when possible.

Examples (reserved, not real defaults): `documents.example.com`, `documentos.example.com`, `files.example.org`, `archivos.example.org`.

## DNS partners configure (standard path)

For a normal subdomain such as `documents.example.com`, use **only** the records Custom Hostnames returns:

```text
CNAME  documents  →  <CLOUDFLARE_SAAS_CNAME_TARGET>     (traffic / routing)
TXT    <exact name>  →  <exact value>                    (ownership / SSL as returned)
```

Keep nameservers at GoDaddy, Hostinger, or the partner’s current provider.
SuHuella never moves nameservers.

Apex (`partner-domain.com`):

```text
May require ALIAS/ANAME, DNS delegation, or a Cloudflare apex mode.
Universal CNAME compatibility is not guaranteed.
```

## DCV Delegation (optional — not for standard subdomains)

DCV Delegation is a **separate, optional** Cloudflare account/zone capability. Use it only when you need:

- apex / root domains;
- wildcards;
- hostnames without proxy;
- certificate renewal without repeating TXT challenges.

It is **not** required for ordinary partner subdomains like `documents.example.com`.
A standard partner uses the Custom Hostname CNAME + TXT path above.

If DCV Delegation is enabled later for a specific hostname:

```text
_acme-challenge.<domain>  CNAME  <domain>.<dcv-zone>.dcv.cloudflare.com
```

`<dcv-zone>` is **account/zone specific**. Never hardcode it in source. Store it as a secure config value or use the value Cloudflare returns when the feature is turned on.

Distinguish clearly:

| Record | Purpose |
| --- | --- |
| Custom Hostnames CNAME target (`CLOUDFLARE_SAAS_CNAME_TARGET`) | **Traffic** routing to SuHuella |
| DCV Delegation CNAME (`*.dcv.cloudflare.com`) | **Certificate** validation only |

This track does **not** activate DCV Delegation or change production DNS.

## States

| Status | Behaviour |
| --- | --- |
| `pending` | Public status page only (“site not yet available”) — no DNS instructions |
| `active` | Serve partner brand |
| `failed` | Public status page — no technical instructions |
| `suspended` | Public status page — temporarily unavailable |
| `revoked` | Public status page — no longer available |

Public `/hostname-status` is a **visitor notice**, not partner onboarding. DNS steps live in `/partners/onboarding/complete` (authenticated partner session) and Operations.

Unknown hostnames do not leak another brand’s data.

## Permissions

| Actor | Domains |
| --- | --- |
| platform superadmin | all partners |
| `partner_admin` | create / refresh / revoke own |
| `partner_member` | read only |
| public | no domain admin APIs |

Client cannot set `partner_id`, `brand_id`, `role`, `status`, Cloudflare IDs, or DNS target.

## Migrations

1. `0007_partners.sql` (if not applied)
2. `0008_partner_domain.sql` — columns for CF SaaS

```bash
cd site
npx wrangler d1 migrations apply suhuella-license --remote
```

## Rollback

```bash
cd site
npx wrangler deployments list
npx wrangler rollback
```

Custom Hostname rows in Cloudflare may need manual delete if a domain was provisioned.

## Limits / cost

Cloudflare for SaaS bills per Custom Hostname. Prefer subdomains. Revoke unused hostnames.

## Partner self-service flow

1. SUPER_ADMIN creates partner + invite in Operations (`origin=gift|manual|internal|test`, optional `valid_until`).
2. SUPER_ADMIN may invite additional emails as `partner_admin` or `partner_member`.
3. Partner opens `/partners/onboarding/<token>`, verifies email (OTP), accepts.
4. Accept issues an HttpOnly partner session cookie and removes the token from the URL (`/partners/onboarding/complete`).
5. `partner_admin` configures display name, logo URL, accent, and a public hostname they choose (e.g. `documents.example.com` — any free subdomain label).
6. Server creates the Cloudflare Custom Hostname (fail-closed `503 cloudflare_not_configured` if secrets missing — no incomplete D1 row).
7. UI shows CNAME + TXT for the partner’s DNS provider. Nameservers stay with the partner. No DCV Delegation for this path.
8. Partner presses Refresh until status is `active`. The partner URL stays in the browser (rewrite, no redirect to suhuella.com).

## Request brand context

Server resolves `Host` → `normalized_hostname` → active `partner_domain` → `partner_brand` (D1).

| Hostname | Brand |
| --- | --- |
| `suhuella.com` / `www` / `localhost` / `*.workers.dev` / `ops.suhuella.com` | Platform SuHuella |
| Active partner Custom Hostname | That partner’s `display_name`, `logo_url`, `accent` |
| pending / failed / suspended / revoked | Status page only — no partner app brand |
| Unknown | No brand (never another partner, never SuHuella fallback) |

Client hydration receives only public fields: `brandId`, `displayName`, `logoUrl`, `accent`, `onAccent`.

Example (generic): `documents.example.com` active → brand_id from slug, logo/accent from partner branding.

## Ops alta checklist (generic)

1. Partners → Create partner (slug, display name, owner email, `origin=gift`, no primary domain unless needed).
2. Optional `valid_until` (+12 months) or blank for indefinite courtesy.
3. Invite additional members with explicit role (`partner_admin` / `partner_member`).
4. Partner completes onboarding → branding → hostname → DNS CNAME/TXT → Refresh → Active.
