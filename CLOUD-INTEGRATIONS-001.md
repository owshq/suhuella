# CLOUD-INTEGRATIONS-001

```text
STATUS = GOOGLE DRIVE + ONEDRIVE BROWSE · GATED OFF
TYPE = Cloud OAuth → encrypted connection → SourceHandle → Sources browse
SCOPE = Google Drive + OneDrive connect + browsable Source · Dropbox / Box stubs · Gmail/Outlook later (Communications)
```

## Separation (do not mix)

| System | Purpose |
|---|---|
| Cloudflare Access | Operations operators only |
| Stripe | Payments / licenses |
| Cloud OAuth | User authorises their cloud **file** account |
| Communications (later) | Gmail / Outlook — separate Source group, not Cloud |
| `brand_id` | Isolate suhuella.com / dbasenet.com connections and callbacks |

Public `Source` stays `{ id, displayName }`. Provider metadata lives on `SourceHandle` / adapter.

## What works when `CLOUD_INTEGRATIONS_ENABLED=true`

1. Sources → Cloud → Connect (**Google Drive** or **OneDrive**)
2. OAuth (state, PKCE, allowlisted callbacks)
3. Tokens encrypted in D1 (`cloud_connection` + `cloud_credential`)
4. Connection projects a SourceHandle + Sources Open
5. Browse sections + folders via `GET /api/sources/:id/children` (paged, no full index)
   - Google: My Drive / Shared with me
   - OneDrive: My files / Shared

## What is still not done

- Indexing into Search / Organise
- Full library sync / Queue worker
- Dropbox / Box enablement
- Gmail / Outlook (Communications Source group — next after cloud file providers)

## Routes

| Method | Path |
|---|---|
| GET | `/api/integrations` |
| POST | `/api/integrations/google-drive/start` |
| GET | `/api/integrations/google-drive/callback` |
| POST | `/api/integrations/onedrive/start` |
| GET | `/api/integrations/onedrive/callback` |
| GET | `/api/integrations/:id/status` |
| POST | `/api/integrations/:id/disconnect` |
| POST | `/api/integrations/:id/reconnect` |
| GET | `/api/sources/:id/children` |

## Env (names only)

- `CLOUD_INTEGRATIONS_ENABLED`
- `CLOUD_TOKEN_ENCRYPTION_KEY`
- `CLOUD_GOOGLE_DRIVE_CLIENT_ID`
- `CLOUD_GOOGLE_DRIVE_CLIENT_SECRET`
- `CLOUD_ONEDRIVE_CLIENT_ID`
- `CLOUD_ONEDRIVE_CLIENT_SECRET`

## Callbacks to register

**Google Cloud (Web application)**

- `http://localhost:3000/api/integrations/google-drive/callback`
- `https://suhuella.com/api/integrations/google-drive/callback`

**Microsoft Azure AD app (Web)**

- `http://localhost:3000/api/integrations/onedrive/callback`
- `https://suhuella.com/api/integrations/onedrive/callback`

Platforms: Accounts in any organisational directory **and** personal Microsoft accounts.

Delegated API permissions: `Files.Read`, `User.Read`, `openid`, `email`, `profile`, `offline_access`.

## Activate later (do not run now)

```bash
# Secrets (interactive Wrangler — after local proof):
npx wrangler secret put CLOUD_TOKEN_ENCRYPTION_KEY --config wrangler.jsonc
npx wrangler secret put CLOUD_GOOGLE_DRIVE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put CLOUD_GOOGLE_DRIVE_CLIENT_SECRET --config wrangler.jsonc
npx wrangler secret put CLOUD_ONEDRIVE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put CLOUD_ONEDRIVE_CLIENT_SECRET --config wrangler.jsonc
# Then set CLOUD_INTEGRATIONS_ENABLED=true in wrangler.jsonc and deploy.
```

## Rollback

Set `CLOUD_INTEGRATIONS_ENABLED=false` and redeploy. Do not drop D1 tables.

## Tests

```bash
npm run test:cloud-integrations --prefix site
```

## PAID_CHECKOUT_ENABLED

Stays `false` until Gate C. Unrelated to cloud OAuth.
