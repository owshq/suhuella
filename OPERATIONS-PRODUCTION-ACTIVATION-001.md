# OPERATIONS-PRODUCTION-ACTIVATION-001

```text
STATUS = READY · operator activation
TYPE = Production activation
SCOPE = Operations only
```

Code gates are in place. This track closes **PASS** only after the operator sets the three Worker secrets and the production checks below succeed. Checkout stays off (`PAID_CHECKOUT_ENABLED=false`).

Activate Operations production access using the **existing** Cloudflare Access application **`ops.suhuella.com`**.

No authentication redesign. No changes to Sources, Checkout, Licensing, Desktop, or Browser.

Parent closeout: [OPERATIONS-ACCESS-CLOSEOUT-001.md](OPERATIONS-ACCESS-CLOSEOUT-001.md).

---

## Objective

Set Worker secrets, verify Cloudflare Access on **`https://ops.suhuella.com`**, and close this track.

After activation, superadmins reach Operations through Cloudflare Access only. No password login.

---

## URL model (frozen)

```text
suhuella.com
    Public product website · download · license API · release API

ops.suhuella.com
    Internal Operations Console (Cloudflare Access · superadmin)
    /  → console

Path aliases exist for today's sections. Operator IA is not frozen —
validate against real support work (person / license first) before treating
/devices or /usage as top-level nav.
```

```text
https://suhuella.com/admin   →  301  →  https://ops.suhuella.com
https://suhuella.com/_ops    →  301  →  https://ops.suhuella.com
https://suhuella.com/ops     →  301  →  https://ops.suhuella.com
https://ops.suhuella.com/_ops → 301  →  https://ops.suhuella.com/
```

Do **not** share or bookmark `/_ops`. Local dev only:

```text
http://localhost:3000/ops
```

---

## Secret formats

Invalid values are treated as missing. Production then returns **503** with no checklist.

| Secret | Exact format | Example |
| --- | --- | --- |
| `SUPERADMIN_EMAILS` | Comma-separated emails. Trimmed and lowercased. No display names. | `admin@suhuella.com` or `admin@suhuella.com,ops@suhuella.com` |
| `CF_ACCESS_TEAM_DOMAIN` | Hostname only. No `https://`, path, port, or slash. | `suhuella.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Application Audience (AUD) tag, copied exactly. Case-sensitive. 16–256 characters: letters, digits, `.` `_` `~` `-`. No spaces. | value from the Access application Overview |

JWT checks, after those secrets parse:

- Header `Cf-Access-Jwt-Assertion`, algorithm `RS256`
- `iss` must be `https://<CF_ACCESS_TEAM_DOMAIN>`
- `aud` must equal `CF_ACCESS_AUD` (string or array containing it)
- `exp` / `nbf` enforced, 60s clock skew
- `kid` must match a key from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`
- `email` must be in `SUPERADMIN_EMAILS`

The same check applies on `ops.suhuella.com`, `*.workers.dev`, and any other hostname that reaches Worker **`suhuella`**. A spoofed `Cf-Access-Authenticated-User-Email` header is not enough.

---

## Routes

Worker **`suhuella`**. `workers_dev` is on. Do not send customers to `*.workers.dev`.

| Surface | Route |
| --- | --- |
| Console | `https://ops.suhuella.com/` → `/ops` |
| Customers | `https://ops.suhuella.com/customers` |
| Business | `https://ops.suhuella.com/business` |
| Licenses | `https://ops.suhuella.com/licenses` |
| Billing | `https://ops.suhuella.com/billing` |
| Activity | `https://ops.suhuella.com/activity` |
| Snapshot | `GET /api/operations/state` |
| Session | `GET /api/operations/session` |
| Mutations | `POST /api/operations/actions` |
| Business admin API | `GET` / `POST /api/admin/business` |

`https://suhuella.com/admin`, `/ops`, and `/_ops` **301** to `https://ops.suhuella.com`.

Ops may create `gift`, `promo`, `manual`, `internal`, and `test` licenses. `origin=stripe` is rejected. Audit records drop secret, token, and JWT fields.

---

## Required Worker secrets

| Secret | Required | Purpose |
| --- | --- | --- |
| `SUPERADMIN_EMAILS` | Yes | App allowlist after Access login |
| `CF_ACCESS_TEAM_DOMAIN` | Yes | Zero Trust team host (JWT issuer) |
| `CF_ACCESS_AUD` | Yes | Access application audience tag |

Optional:

| Secret | Purpose |
| --- | --- |
| `OPS_BASE_URL` | Canonical Operations URL for redirects and links (default `https://ops.suhuella.com`) |
| `OPERATIONS_WORKER_ID` | Short label in identity panel (e.g. `688364c5`) |

Do **not** set `OPERATIONS_ALLOW_DEV_ACCESS=true` in production.

---

## Where to copy Cloudflare values

Access application **already exists** for **`ops.suhuella.com`**.

### Team domain → `CF_ACCESS_TEAM_DOMAIN`

1. Cloudflare Zero Trust → **Settings** (team URL in dashboard header).
2. Team URL: `https://<team>.cloudflareaccess.com`.
3. Copy **`<team>.cloudflareaccess.com`** (hostname only).

### Application Audience (AUD) → `CF_ACCESS_AUD`

1. Zero Trust → **Access** → **Applications**.
2. Open the **`ops.suhuella.com`** application.
3. **Overview** → **Application Audience (AUD) Tag**.
4. Copy the full audience string.

### Superadmin allowlist → `SUPERADMIN_EMAILS`

Exact email from Google / Microsoft after Access login. Comma-separate multiple admins.

### Canonical URL → `OPS_BASE_URL` (optional)

```text
OPS_BASE_URL=https://ops.suhuella.com
```

Used for `/admin` redirect and production canonical routing. Change here if the Operations hostname ever moves — no code change required.

---

## Activation checklist

### A. Cloudflare Access (already done)

- [ ] Application on **`ops.suhuella.com`**
- [ ] Google and/or Microsoft IdP
- [ ] Allow policy includes superadmin email(s)
- [ ] DNS routes `ops.suhuella.com` to Worker **`suhuella`**

### B. Worker secrets

**Dashboard:** Workers & Pages → **`suhuella`** → Settings → Variables and Secrets.

| Step | Secret |
| --- | --- |
| 1 | `SUPERADMIN_EMAILS` |
| 2 | `CF_ACCESS_TEAM_DOMAIN` |
| 3 | `CF_ACCESS_AUD` |
| 4 | `OPS_BASE_URL` (optional, recommended) |

**CLI:**

```bash
cd site
wrangler secret put SUPERADMIN_EMAILS
wrangler secret put CF_ACCESS_TEAM_DOMAIN
wrangler secret put CF_ACCESS_AUD
wrangler secret put OPS_BASE_URL   # optional: https://ops.suhuella.com
```

### C. Deploy

```bash
cd site && npm run deploy
# or: npm run cf:deploy
```

### D. Verify production behaviour

| # | Action | Expected |
| --- | --- | --- |
| 1 | Open `https://ops.suhuella.com` with secrets missing | **503** — “Operations temporarily unavailable. Contact the administrator.” **No** config checklist |
| 2 | Set all three required secrets, open logged out | Cloudflare Access login |
| 3 | Login, email not in allowlist | **403** |
| 4 | Login, email in `SUPERADMIN_EMAILS` | Operations UI |
| 5 | Identity panel | Authenticated by Cloudflare Access · Production |
| 6 | Open `https://suhuella.com/admin` | **301** → `https://ops.suhuella.com` |
| 7 | Open `https://suhuella.com/_ops` | **301** → `https://ops.suhuella.com` |

---

## Configuration errors

### Production (public)

Generic only — never exposes which secrets are missing:

```text
Operations temporarily unavailable.

Contact the administrator.
```

Same for `/api/operations/*` JSON on **503** (no `config` map).

### Development / localhost only

Per-variable diagnostic (✓ / ✗) when `NODE_ENV !== production`:

```text
Operations configuration incomplete

Missing configuration
✓ SUPERADMIN_EMAILS
✗ CF_ACCESS_AUD
✓ CF_ACCESS_TEAM_DOMAIN
```

Use `http://localhost:3000/_ops` to debug missing secrets locally.

---

## Smoke tests

Automated:

```bash
npm run test:operations-auth --prefix site
npm run test:operations-access --prefix site
npm run test:admin --prefix site
```

| Scenario | Environment | Expected |
| --- | --- | --- |
| No secrets | Production | 503 generic message |
| Missing one secret | Localhost dev | 503 + diagnostic |
| All secrets, no JWT | Production | 401 or Access login |
| JWT, not allowlisted | Production | 403 |
| Forged JWT or wrong audience | Production | 401 |
| JWT, allowlisted | Production, including `*.workers.dev` | Operations UI / API |
| `/admin` | Production | 301 → `ops.suhuella.com` |
| `POST /api/operations/actions` with `origin: stripe` | Production | 400, no paid grant |

---

## Post-deploy

```bash
curl -sI https://ops.suhuella.com/ | head -n 20
curl -sI https://suhuella.com/admin | head -n 15
curl -s -o /dev/null -w "%{http_code}\n" https://ops.suhuella.com/api/operations/state
```

Expected before a browser login: Access challenge or **401** on the API, **301** from `/admin`. A **200** JSON snapshot without an Access session is a failure.

Then log in with an allowlisted email and confirm the identity panel says Cloudflare Access · Production.

Leave `PAID_CHECKOUT_ENABLED` as `false`.

---

## Rollback

Secrets stay on the Worker across deploys. To undo the code:

```bash
cd site
npx wrangler deployments list
npx wrangler rollback
```

Emergency lock without a deploy: delete `CF_ACCESS_AUD` (or clear `SUPERADMIN_EMAILS`). Ops then returns **503** on every hostname, including `*.workers.dev`. Restore the secret to reopen. Do not turn checkout on as part of this rollback.

---

## Definition of done

Close **PASS** when:

- [ ] `SUPERADMIN_EMAILS`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` set on Worker **`suhuella`**
- [ ] `https://ops.suhuella.com/` Access login → Operations console (not the product app)
- [ ] Non-superadmin → **403**; superadmin → Operations UI
- [ ] Incomplete config on production → generic **503** (no infra leak)
- [ ] `/admin` → **301** → `https://ops.suhuella.com`
- [ ] No password auth; no unrelated product changes

```text
OPERATIONS-PRODUCTION-ACTIVATION-001 — CLOSED · PASS
```

*(Mark CLOSED · PASS after manual verification on production.)*
