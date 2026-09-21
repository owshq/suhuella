# CLOUD-INTEGRATIONS-001

```text
STATUS = FOUNDATION · SHIPPED (gated off)
TYPE = Cloud account OAuth + encrypted credentials + resumable sync jobs
SCOPE = Google Drive (complete contract) · Dropbox / OneDrive / Box (same contract, disabled)
```

## Audit: what we want vs what is implemented

### Three separate systems (must never mix)

| System | Purpose | Identity | Storage |
|---|---|---|---|
| **Cloudflare Access** | Admin login to `ops.suhuella.com` | OTP / IdP for operators | Access JWT → `SUPERADMIN_EMAILS` |
| **Stripe** | Payments & licenses | Checkout Session → `license_grant` | D1 license tables |
| **Cloud OAuth** | User authorises *their* Drive/Dropbox/… | Device (or later license) + provider account | `cloud_connection` + encrypted `cloud_credential` |

Cloudflare Access is **not** a cloud source login. Stripe is **not** a cloud source login. Connecting Google Drive does **not** log anyone into Operations.

### Why `brand_id` appears next to cloud

Not because “cloud = brand”. Because **one Worker (`suhuella`) can serve more than one public brand** (`suhuella.com`, later `dbasenet.com`).

Without `brand_id` on connections + callback allowlists:

- a SuHuella device could accidentally attach to a Dbasenet OAuth client / redirect URI
- partner tenants would share the same connection rows

So `brand_id` is **tenant isolation for multi-brand packaging**, same idea as BrandConfig — not Access, not Stripe.

| Field | Meaning |
|---|---|
| `brand_id` | Which public product site owns the connection (`suhuella` vs `dbasenet`) |
| `owner_kind` + `owner_id` | Which user/device owns it (`device` today) |
| `provider` | Google Drive / Dropbox / … |

If SuHuella stays single-brand forever, `brand_id` is still cheap insurance and matches the existing BrandConfig hierarchy (ADR-003).

### What clicking a Source does today

| Surface | Click | Result |
|---|---|---|
| Indexed local / Desktop folder | Open | Browse that folder (`onOpenSource` → source browse) |
| Available local folder | Add / Connect | Grant access + index |
| Coming later cloud card | — | Disabled |
| **Cloud accounts** (new) | Connect | Starts OAuth (when `CLOUD_INTEGRATIONS_ENABLED=true`) |
| **Cloud accounts** connected | Renew / Disconnect | Re-auth or revoke |

**Not yet:** OAuth connection → `SourceHandle` → appears as an Indexed source you can open like a folder. That is the next adapter track (`createGoogleDriveHandle`). Until then, Connect only stores credentials + enqueues a sync job; it does not project files into Search/Organise.

### Correct placement: Sources, not Settings

Workspace rule: Sources = “What can SuHuella see?”. Cloud accounts answer that. Settings stays license / AI / privacy / diagnostics.

## Implemented

- D1 migration `0006_cloud_integrations.sql` (idempotent `CREATE IF NOT EXISTS`)
- Provider registry + brand callback allowlist
- OAuth: state, PKCE S256, redirect allowlist, CSRF, no browser tokens
- Google Drive: authorize, exchange, refresh, userinfo, id_token iss/aud/nonce checks, paged Drive list
- AES-GCM credential vault (`CLOUD_TOKEN_ENCRYPTION_KEY`), encryption version field
- API routes under `/api/integrations…`
- Sync jobs with checkpoint, backoff, cancel, webhook receipt idempotency
- Sources UI: `CloudAccountsSection`
- Gate: `CLOUD_INTEGRATIONS_ENABLED` (default **false** in wrangler — same posture as paid checkout)

## Not implemented yet (honest)

- Live Google OAuth client in production secrets
- JWKS signature verification for Google `id_token` (claims checked; exchange is server-side with client_secret)
- Cloudflare Queue + `suhuella-sync` worker (D1 jobs are the foundation)
- Real Dropbox / OneDrive / Box OAuth clients
- `SourceHandle` adapter that turns a connection into a browsable Source
- Indexing cloud files into the local knowledge index

## Env vars (names only)

| Name | Role |
|---|---|
| `CLOUD_INTEGRATIONS_ENABLED` | Public switch (`true` / else off) |
| `CLOUD_TOKEN_ENCRYPTION_KEY` | Base64 32-byte AES-GCM key |
| `CLOUD_GOOGLE_DRIVE_CLIENT_ID` | Google OAuth client id |
| `CLOUD_GOOGLE_DRIVE_CLIENT_SECRET` | Google OAuth client secret |
| `CLOUD_DROPBOX_CLIENT_ID` / `_SECRET` | Future |
| `CLOUD_ONEDRIVE_CLIENT_ID` / `_SECRET` | Future |
| `CLOUD_BOX_CLIENT_ID` / `_SECRET` | Future |

Do **not** put secrets in Git or wrangler `vars`.

## Callbacks

| Environment | Exact redirect URI |
|---|---|
| Production SuHuella | `https://suhuella.com/api/integrations/google_drive/callback` |
| Local | `http://localhost:3000/api/integrations/google_drive/callback` |
| Future Dbasenet | `https://dbasenet.com/api/integrations/google_drive/callback` |

## Manual Google Cloud setup (when enabling)

1. Google Cloud Console → OAuth client (Web)
2. Authorized origins: `https://suhuella.com`, `http://localhost:3000`
3. Redirect URIs: the callback URLs above
4. Worker secrets: `CLOUD_GOOGLE_DRIVE_CLIENT_ID`, `CLOUD_GOOGLE_DRIVE_CLIENT_SECRET`, `CLOUD_TOKEN_ENCRYPTION_KEY`
5. Set `CLOUD_INTEGRATIONS_ENABLED=true` and redeploy
6. Apply D1 migration `0006` if not already applied

## Rollback

1. Set `CLOUD_INTEGRATIONS_ENABLED=false` and deploy
2. Optionally delete OAuth client secrets from Worker
3. Do **not** drop D1 tables (preserves encrypted rows for later)

## Tests

```bash
npm run test:cloud-integrations --prefix site
```

## PAID_CHECKOUT_ENABLED

Unchanged. Remains `false` until Gate C is explicitly activated.
