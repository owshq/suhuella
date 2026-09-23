# HOSTNAME-RESOLUTION-001

```text
STATUS = COMPLETE (code + tests · no deploy · no external changes)
TYPE = Hostname normalization · platform classification · brand resolution
SCOPE = site/lib/partners/domains.ts · request-brand · middleware · requestHost
```

## Root cause

Two independent bugs produced **“Unknown hostname”** and the neutral gray accent in local dev:

1. **`normalizeHostname("localhost")` returned `null`** because the FQDN regex requires at least one dot. Loopback literals were listed in platform classification but never reached it.
2. **`isPlatformPublicHostname` treated every `*.workers.dev` as SuHuella platform**, which violates multi-tenant isolation and the “do not trust all workers.dev” rule.

A related inconsistency: **`hostnameFromRequestHeaders` (middleware)** accepted `X-Forwarded-Host` as a fallback on any request, while **`requestHost` (brand/layout)** only trusted it on Worker dev origins — allowing divergent behavior and header spoofing on public hosts.

## Architecture (four layers)

```text
Host / X-Forwarded-Host
        ↓
1. normalizeHostname()          strip port, case, scheme; accept loopback literals
        ↓
2. isPlatformPublicHostname()   explicit SuHuella + dev loopback + authorized workers.dev
        ↓
3. isReservedPlatformHostname()   partner registration blocklist (includes ALL *.workers.dev)
        ↓
4. resolvePartnerDomainState()    D1 partner_domain + verified status → partner brand
```

**Important:** layer 2 (platform brand) and layer 3 (registration) are different. `localhost` is platform for dev but **never partner-registerable**.

## X-Forwarded-Host trust decision

| Direct `Host` | `X-Forwarded-Host` | Effective host | Rationale |
| --- | --- | --- | --- |
| `suhuella.<account>.workers.dev` | `ops.suhuella.com` | forwarded | Cloudflare Worker dev origin; prevents ops redirect loops |
| `suhuella.<account>.workers.dev` | `suhuella.com` | forwarded | Same — public hostname routed through Worker |
| `suhuella.com` | any | `Host` only | Client must not override public hostname |
| `localhost:3000` | any | `Host` only | Dev spoofing blocked |
| `evil.workers.dev` | `ops.suhuella.com` | `Host` only | Foreign Worker cannot inherit platform hostname |
| empty | `partner.example` | forwarded | Test / edge only; normalize then classify |

Only **`suhuella.<account>.workers.dev`** (Worker name from `CF_WORKER_NAME`, default `suhuella`) is an authorized dev origin.

## Hostname → expected result

| Hostname | normalize | Platform brand | Partner registerable | Brand resolution |
| --- | --- | --- | --- | --- |
| `suhuella.com` | ✓ | ✓ SuHuella | ✗ | `kind=platform` |
| `www.suhuella.com` | ✓ | ✓ SuHuella | ✗ | `kind=platform` |
| `ops.suhuella.com` | ✓ | ✓ SuHuella (ops shell) | ✗ | `kind=platform` |
| `localhost` / `:3000` | ✓ | ✓ SuHuella (dev) | ✗ | `kind=platform` |
| `127.0.0.1` / `:8787` | ✓ | ✓ SuHuella (dev) | ✗ | `kind=platform` |
| `[::1]:3000` | ✓ | ✓ SuHuella (dev) | ✗ | `kind=platform` |
| `suhuella.<acct>.workers.dev` | ✓ | ✓ SuHuella (Worker dev) | ✗ | `kind=platform` |
| `evil.workers.dev` | ✓ | ✗ | ✗ reserved | `kind=unknown` |
| `192.168.x.x` | ✓ | ✗ | ✓ if registered | `kind=unknown` until partner DNS |
| Active partner host | ✓ | ✗ | ✓ | `kind=partner` |
| Pending partner host | ✓ | ✗ | ✓ | `kind=status` (no app brand) |
| Suspended / revoked | ✓ | ✗ | ✓ | `kind=status` |
| Unknown FQDN | ✓ | ✗ | ✓ | `kind=unknown` |
| `localhost` (register) | ✓ | — | ✗ rejected | — |

## Files modified

| File | Change |
| --- | --- |
| `site/lib/partners/domains.ts` | Split normalize / platform / reserved / registerable; restrict workers.dev platform trust |
| `site/lib/operations/host.ts` | Align `requestHost` with authorized workers.dev; loopback via normalize |
| `site/lib/partners/middleware-gate.ts` | Use `requestHost` + `normalizeHostname` |
| `site/lib/partners/request-brand.ts` | Single normalize path; drop redundant ops check |
| `site/lib/partners/service.ts` | `resolvePartnerDomainState` uses `isPlatformPublicHostname` |
| `site/lib/partners/index.ts` | Export new classifiers |
| `site/lib/hostname-resolution-check.ts` | Dedicated test track |
| `site/lib/partners-check.ts` | localhost + workers.dev assertions |
| `site/lib/operations-auth-check.ts` | Header spoofing guards |
| `site/package.json` | `test:hostname-resolution` script |

## Tests

```bash
npm run test:hostname-resolution --prefix site
npm run test:partners --prefix site
npm run test:operations-auth --prefix site
```

## Remaining risks

- **Private LAN IPs** normalize successfully but resolve as `unknown` unless registered as partner domains — intentional; do not add to platform list.
- **IPv6 non-loopback** is rejected at normalization today.
- **Partner store last-write-win** under concurrent Ops writers (pre-existing).
- **Full URLs with paths** are stripped defensively; partner APIs should still validate registration input shape.

## Out of scope (confirmed not done)

- No deploy, DNS, D1 remote, secrets, Stripe, licenses, releases
- No UI / color changes
- No automatic conversion of unknown hosts to SuHuella
