# OPERATIONS-ACCESS-CLOSEOUT-001

```text
STATUS = CLOSED · PASS
TYPE = PR + documentation + smoke
SCOPE = /_ops access only
```

Operations access closeout for SuHuella. No password login. Cloudflare Access is the only production authentication layer.

Report: this file. PR: *Operations access: /_ops route with Cloudflare Access and localhost dev mode*.

---

## Objective

Document and ship the Operations access architecture so production can be enabled with Cloudflare Access configuration only — no further application code changes.

---

## Route model

| Context | URL | Auth |
| --- | --- | --- |
| Local dev | `http://localhost:3000/_ops` | None (localhost / 127.0.0.1 only) |
| Production | `https://suhuella.com/_ops` | Cloudflare Access + `SUPERADMIN_EMAILS` |
| Optional alias | `https://ops.suhuella.com` | Same as production (infra) |
| Legacy | `https://suhuella.com/admin` | Redirect → `/_ops` |

Next.js does not expose App Router folders whose names start with `_` as public routes. The public path `/_ops` is rewritten to `/ops` in `site/next.config.ts`.

Implementation:

- `site/app/ops/` — internal route
- rewrite `/_ops` → `/ops`
- redirect `/admin` → `/_ops`

---

## Local development

Open:

```text
http://localhost:3000/_ops
```

Expected behaviour:

- No Cloudflare login
- Operations UI opens immediately
- Identity panel shows **Local dev** (or host-based local label)
- Environment shows **Local**
- Works only on `localhost`, `127.0.0.1`, or `[::1]`

Legacy check:

```text
http://localhost:3000/admin  →  redirect to /_ops
```

Optional non-localhost dev (LAN IP, custom hostname): set `OPERATIONS_ALLOW_DEV_ACCESS=true` and `OPERATIONS_DEV_EMAIL` in `.env.local`. Not required for normal localhost work.

---

## Production access

### Required Worker / environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPERADMIN_EMAILS` | Yes | Comma-separated allowlist after Cloudflare Access login |
| `CF_ACCESS_TEAM_DOMAIN` | Yes | Cloudflare Access team domain (JWT issuer) |
| `CF_ACCESS_AUD` | Yes | Access application audience tag |
| `OPERATIONS_WORKER_ID` | No | Optional label in identity panel (e.g. deployment id prefix) |

Do **not** set `OPERATIONS_ALLOW_DEV_ACCESS=true` in production.

### Expected behaviour

| Case | Result |
| --- | --- |
| No Access JWT / not logged in | 401 — no admin UI, no password form |
| Access configured but env missing | 503 — access unconfigured |
| Valid Access, email not in allowlist | **403** |
| Valid Access, email in `SUPERADMIN_EMAILS` | Operations UI |
| `Host: localhost` on production | Does **not** bypass — production runtime ignores localhost bypass |

Identity panel in production:

- Display name from Cloudflare (`cf-access-authenticated-user-name`) or derived from email
- **Authenticated by Cloudflare Access**
- Environment: **Production**
- Worker, Version, Brand

---

## Cloudflare Access setup (manual — not created by this PR)

Cloudflare Access infrastructure is **not** created by the application PR. Configure in the Cloudflare Zero Trust dashboard after deploy.

### 1. Create Access application

1. Cloudflare Zero Trust → **Access** → **Applications** → **Add an application**
2. Type: **Self-hosted**
3. Application name: e.g. `SuHuella Operations`
4. Session duration: per policy (e.g. 24h)

### 2. Protect the route

Choose one (or both with same policy):

- **Path:** `https://suhuella.com/_ops` (and optionally `/api/operations/*` if you want Access on APIs at the edge)
- **Subdomain:** `https://ops.suhuella.com` (see DNS below)

Application domain settings must match how users reach Operations.

### 3. Identity provider

1. Zero Trust → **Settings** → **Authentication**
2. Add **Google** and/or **Microsoft** as identity providers
3. In the Operations application policy, allow login via those IdPs

### 4. Access policy

Create an **Allow** policy, e.g.:

- **Include:** Emails in `SUPERADMIN_EMAILS` (or a Google Group / Azure group that matches)
- **Require:** MFA if desired (recommended — Cloudflare handles MFA)

Application code still enforces `SUPERADMIN_EMAILS` after JWT validation. Edge policy + app allowlist should align.

### 5. Audience and team domain

From the Access application:

1. Copy **Application Audience (AUD)** → set `CF_ACCESS_AUD` on the Worker
2. Team domain is your Zero Trust team host (e.g. `yourteam.cloudflareaccess.com`) → set `CF_ACCESS_TEAM_DOMAIN`

### 6. Deploy env vars to Worker

```bash
cd site
# wrangler secret / vars — examples
wrangler secret put CF_ACCESS_AUD
wrangler secret put CF_ACCESS_TEAM_DOMAIN
# SUPERADMIN_EMAILS as secret or var (comma-separated)
npm run deploy
```

Optional:

```text
OPERATIONS_WORKER_ID=688364c5
```

(Example prefix from production Worker; full id is `688364c5-7834-4b5c-9069-27c7ddc17026`.)

### 7. Verification

| Step | Expected |
| --- | --- |
| Open `/_ops` logged out | Cloudflare Access login or 401 from app |
| Login with non-superadmin email | **403** |
| Login with `SUPERADMIN_EMAILS` user | Operations UI |
| Identity panel | Authenticated by Cloudflare Access · Production |
| Open `/admin` | Redirect to `/_ops` (still protected) |

---

## DNS for optional `ops.suhuella.com`

If using a dedicated subdomain:

1. **DNS:** CNAME `ops` → same target as `suhuella.com` (Worker / Pages route)
2. **Worker route:** ensure `ops.suhuella.com/*` is attached to the `suhuella` worker
3. **Access application:** add `ops.suhuella.com` as application domain (or separate app with identical policy)
4. Same `SUPERADMIN_EMAILS`, `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN` behaviour

No separate admin password or session store.

---

## Security rules (implemented)

- Local bypass only when runtime is **not** production
- Local bypass only on localhost / 127.0.0.1 / `[::1]`
- `Host: localhost` spoofing does not unlock production
- Production requires Cloudflare Access JWT with valid team + audience
- Non-superadmin Access identity → **403**
- No fallback that opens admin when Access is missing
- `/admin` never renders a separate UI — redirect only
- No password login, query-param auth, magic links, OTP admin, or DB users

---

## Tests (automated)

```bash
npm run test:operations-auth --prefix site
npm run test:admin --prefix site
npm run build --prefix site
npm run lint --prefix site
```

| # | Assertion | How verified |
| --- | --- | --- |
| 1 | `/admin` → `/_ops` | `site/next.config.ts` redirects + `site/app/admin/page.tsx` |
| 2 | `/_ops` on localhost | `authenticateLocalhost()` when dev + localhost host |
| 3 | Local dev identity visible | `OperationsIdentityPanel` + `buildOperationsSession()` |
| 4 | Production without Access config | `authenticateProduction()` → 503 if env incomplete |
| 5 | Production requires Access JWT | No token → 401 |
| 6 | Non-superadmin → 403 | `authenticateProduction()` allowlist check |
| 7 | Host spoof blocked in production | `isProductionRuntime()` gate before localhost bypass |
| 8 | No query-param admin | No such code paths |
| 9 | Identity panel fields | session: environment, worker, version, brand |
| 10 | No password login | No admin password UI or credential store |

---

## Manual acceptance

### Local

1. `cd site && npm run dev`
2. Open `http://localhost:3000/_ops` — Operations UI, identity **Local dev**
3. Open `http://localhost:3000/admin` — redirects to `/_ops`

### Production before Access configuration

1. `/_ops` — must not expose admin console (401/503; no password form)
2. `/admin` — redirect to `/_ops` without bypassing protection

### Production after Access configuration

1. Unauthorized email → **403**
2. `SUPERADMIN_EMAILS` user → Operations UI
3. Identity: **Authenticated by Cloudflare Access**, Environment **Production**

---

## Product decision (frozen)

**Keep:** Cloudflare Access as sole production auth; localhost dev bypass with visible Local identity.

**Do not add:** password login, custom admin sessions, admin query params, magic links, DB users, email OTP for admin, second auth system.

---

## Relation to RC

Not a user-facing first-run feature. Does not block Web RC unless `/_ops` breaks the public app.

After close:

1. **SOURCES-CAPABILITY-MATRIX-001** (if still OPEN)
2. **FIRST-RUN-EXPERIENCE-001**

No additional Operations work unless production access fails in practice.

---

## Definition of done

- [x] PR ready
- [x] `/_ops` documented
- [x] `/admin` legacy redirect documented
- [x] Localhost behaviour documented
- [x] Production Cloudflare Access steps documented
- [x] Required env vars documented
- [x] `test:operations-auth`, `test:admin`, `build` pass
- [x] Security guards implemented in code
- [x] No password auth
- [x] Unrelated domains untouched (checkout, Stripe, Resend, Sources, etc.)

```text
OPERATIONS-ACCESS-CLOSEOUT-001 — CLOSED · PASS
```
