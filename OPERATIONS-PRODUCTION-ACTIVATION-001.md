# OPERATIONS-PRODUCTION-ACTIVATION-001

```text
STATUS = OPEN
TYPE = Production activation
SCOPE = Operations only
```

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
Primary (use this)
https://ops.suhuella.com

Internal (dev / implementation only)
/_ops  →  /ops  (Next.js rewrite — not a public URL)

Legacy
https://suhuella.com/admin  →  301  →  https://ops.suhuella.com
https://suhuella.com/_ops   →  301  →  https://ops.suhuella.com  (production)
```

Do **not** share or bookmark `/_ops` or `suhuella.com/_ops` for normal use.

Local dev only:

```text
http://localhost:3000/_ops
```

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
npm run test:admin --prefix site
```

| Scenario | Environment | Expected |
| --- | --- | --- |
| No secrets | Production | 503 generic message |
| Missing one secret | Localhost dev | 503 + diagnostic |
| All secrets, no JWT | Production | 401 or Access login |
| JWT, not allowlisted | Production | 403 |
| JWT, allowlisted | Production | Operations UI |
| `/admin` | Production | 301 → `ops.suhuella.com` |

---

## Definition of done

Close **PASS** when:

- [ ] `SUPERADMIN_EMAILS`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` set on Worker **`suhuella`**
- [ ] `https://ops.suhuella.com` Access login works
- [ ] Non-superadmin → **403**; superadmin → Operations UI
- [ ] Incomplete config on production → generic **503** (no infra leak)
- [ ] `/admin` → **301** → `https://ops.suhuella.com`
- [ ] No password auth; no unrelated product changes

```text
OPERATIONS-PRODUCTION-ACTIVATION-001 — CLOSED · PASS
```

*(Mark CLOSED · PASS after manual verification on production.)*
