# OPERATIONS-ACCESS-VERIFY-001

```text
STATUS = OPEN
TYPE = Infrastructure verification
SCOPE = Cloudflare Access only
NO PRODUCT CHANGES · NO UI CHANGES · NO WORKER LOGIC CHANGES
```

Closed audit of why Operations appears reachable without Cloudflare Access login. **No application code was modified.**

Related: [OPERATIONS-PRODUCTION-ACTIVATION-001.md](OPERATIONS-PRODUCTION-ACTIVATION-001.md) · [OPERATIONS-ACCESS-CLOSEOUT-001.md](OPERATIONS-ACCESS-CLOSEOUT-001.md).

---

## CAUSE

**Not a single failure — three separate facts explain the observed behaviour.**

### A. Cloudflare Access on `ops.suhuella.com` is active and working

Anonymous requests to **`https://ops.suhuella.com`** are intercepted by Cloudflare Access and redirected to the Zero Trust login page. Access is **not** disabled and **not** attached to the wrong zone for this hostname.

### B. `suhuella.com/_ops` bypasses Access entirely (wrong URL)

**`https://suhuella.com/_ops`** returns **HTTP 200** straight from the Worker / Next.js app with **no** Access redirect and **no** `www-authenticate: Cloudflare-Access` header. The Access application protects **`ops.suhuella.com`**, not the path `/_ops` on the apex domain.

Anyone opening `suhuella.com/_ops` (or following **`/admin` → `/_ops`** on the currently deployed `main` build) sees the SuHuella Operations error page **without ever hitting Cloudflare Access**. This matches the screenshot showing *“Operations is not configured”* on the apex host.

### C. Worker secrets are not set on production

Even after a valid Access login on `ops.suhuella.com`, the Worker returns **503 / not configured** until these secrets exist:

- `SUPERADMIN_EMAILS`
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`

Production today serves the old unconfigured message on `suhuella.com/_ops` (pre–generic-error deploy).

### D. Canonical redirect code is not deployed (build failures)

Cloudflare build history shows **failed** deploys for branch `operations-access-closeout-001` (commits `904577b`, `2d6ce31`). Production still runs **`main`**, where:

- `/admin` → **307** → `/_ops` (not `https://ops.suhuella.com`)
- `suhuella.com/_ops` is **not** redirected to the ops subdomain

### E. Cached Access session can look like “no login”

If the browser already holds a valid **`CF_Authorization`** cookie for `ops.suhuella.com`, Cloudflare Access will not show the login screen again. The user goes straight to the Worker — which today shows the unconfigured page. This can be mistaken for “Access is skipped” when it is actually a **valid existing session**.

---

## EVIDENCE

Captured **2026-09-19** from production (anonymous `curl`, Madrid edge).

### 1. `ops.suhuella.com` — Access intercepts (expected)

```http
GET https://ops.suhuella.com/
→ HTTP/2 302
→ location: https://wispy-dew-bfae.cloudflareaccess.com/cdn-cgi/access/login/ops.suhuella.com?...
→ www-authenticate: Cloudflare-Access resource_metadata="https://ops.suhuella.com/.well-known/cloudflare-access-protected-resource/"
→ set-cookie: CF_AppSession=...
```

**Conclusion:** Flow is `Browser → Cloudflare Access → (login) → Worker`. Access is **not** bypassed on this hostname for anonymous clients.

**Values visible in redirect (for Worker secret setup):**

| Worker secret | Value to use |
| --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | `wispy-dew-bfae.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Copy from Zero Trust → Access app → **Application Audience (AUD) Tag** (confirm matches app; do not guess from URL alone) |

### 2. `suhuella.com/_ops` — Access bypass (problem)

```http
GET https://suhuella.com/_ops
→ HTTP/2 200
→ x-powered-by: Next.js
→ (no Cloudflare-Access redirect)
```

Body includes:

```text
Operations is not configured
Set SUPERADMIN_EMAILS, CF_ACCESS_TEAM_DOMAIN, and CF_ACCESS_AUD ...
```

**Conclusion:** Apex path `/_ops` reaches the Worker **without** Access. This is the bypass path.

### 3. `suhuella.com/admin` — legacy redirect to unprotected path

```http
GET https://suhuella.com/admin
→ HTTP/2 307
→ location: /_ops
```

**Conclusion:** `/admin` on production still sends users to the **unprotected** `/_ops` route, not to `ops.suhuella.com`.

### 4. Application code — no production anonymous bypass

Reviewed (no changes made):

| Check | Result |
| --- | --- |
| `authenticateLocalhost()` | Gated by `!isProductionRuntime()` **and** localhost host |
| `authenticateProduction()` | Requires `CF-Access-Jwt-Assertion` + allowlist |
| Host spoof `Host: localhost` in production | Does **not** enable localhost bypass |
| Production unconfigured | Returns 503; no anonymous Operations UI |

**Conclusion:** No Worker logic bug demonstrated. The bypass is at the **Cloudflare edge routing / hostname** layer, not in SuHuella auth code.

### 5. Cloudflare build status

Worker **Build history** (operator screenshot): latest builds on `operations-access-closeout-001` **failed**. Production Worker remains on last successful **`main`** deploy.

---

## FIX

**No code changes required to fix Access on the canonical URL.** Configuration and deploy steps only.

### Step 1 — Use only the protected URL

Bookmark and share **only**:

```text
https://ops.suhuella.com
```

Do **not** use `suhuella.com/_ops` for Operations. That path is not behind Access today.

### Step 2 — Set Worker secrets (required)

Cloudflare → Workers & Pages → **`suhuella`** → Settings → Variables and Secrets:

```bash
cd site
wrangler secret put SUPERADMIN_EMAILS      # your Google/Microsoft email
wrangler secret put CF_ACCESS_TEAM_DOMAIN  # wispy-dew-bfae.cloudflareaccess.com
wrangler secret put CF_ACCESS_AUD          # from Access app Overview → AUD tag
wrangler secret put OPS_BASE_URL           # optional: https://ops.suhuella.com
```

Until these exist, authenticated users will still see an error after Access login.

### Step 3 — Verify Access application (dashboard)

Zero Trust → Access → Applications → app for **`ops.suhuella.com`**:

- [ ] Application **enabled**
- [ ] Domain: **`ops.suhuella.com`** (subdomain, not path on apex)
- [ ] At least one **Allow** policy with Google/Microsoft IdP
- [ ] No **Bypass** policy matching your test IP/email unintentionally

Do **not** create a duplicate app on `suhuella.com/_ops` unless you intentionally want path-based protection on apex (not recommended — subdomain is canonical).

### Step 4 — Fix failed deploy (recommended, not blocking Access on ops)

Merge or redeploy `operations-access-closeout-001` after fixing the Cloudflare build failure so production gets:

- `/admin` → **301** → `https://ops.suhuella.com`
- `suhuella.com/_ops` → **301** → `https://ops.suhuella.com`

Until deploy succeeds, **`/admin` and `/_ops` on apex remain an unprotected side door** even though `ops.suhuella.com` is correct.

Investigate build logs for commits `904577b` / `2d6ce31` in Cloudflare Workers build history.

### Step 5 — Verification matrix (manual)

| Test | URL | Expected |
| --- | --- | --- |
| Anonymous | `https://ops.suhuella.com` | Cloudflare Access login (Google/Microsoft) |
| Wrong host | `https://suhuella.com/_ops` | Today: **200 unprotected** (until Step 4 deploy) |
| After secrets + superadmin login | `https://ops.suhuella.com` | Operations UI |
| Non-superadmin after Access login | `https://ops.suhuella.com` | **403** |
| Legacy | `https://suhuella.com/admin` | After Step 4: **301** → `ops.suhuella.com` |

Clear cookies or use incognito when testing the anonymous → login flow.

---

## Definition of done

Close **PASS** only when:

```text
Anonymous → Cloudflare Login → Operations   (on ops.suhuella.com)
Superadmin → Operations
Other user → 403
```

**Current status:**

| Criterion | Status |
| --- | --- |
| Access intercepts `ops.suhuella.com` (anonymous) | **PASS** — verified 302 to login |
| Worker secrets configured | **FAIL** — not set |
| Superadmin → Operations UI | **BLOCKED** — secrets + login |
| Non-superadmin → 403 | **NOT TESTED** — needs secrets |
| Apex `/_ops` not a public bypass | **FAIL** — unprotected until deploy Step 4 |

```text
OPERATIONS-ACCESS-VERIFY-001 — OPEN
```

*(Re-mark CLOSED · PASS after Step 2 secrets are set and Step 5 matrix passes on `ops.suhuella.com`.)*
