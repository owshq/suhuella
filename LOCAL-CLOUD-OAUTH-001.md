# LOCAL-CLOUD-OAUTH-001

```text
STATUS = LOCAL PROOF — GOOGLE + ONEDRIVE BEFORE PROD
TYPE = Release checklist
SCOPE = Google Drive + OneDrive OAuth + browse — local only
NEXT = Gmail / Outlook as Communications sources (not Cloud)
```

Do **not** flip production `CLOUD_INTEGRATIONS_ENABLED`. Do **not** deploy until Connect / Open / Renew / Disconnect succeed for **both** Google Drive and OneDrive locally.

**Shipped UI:** single Cloud group; Google Drive + OneDrive Connect when flagged; Dropbox Coming later; no Box; platform title + logo; post-OAuth → `/sources`; Open → section roots.

## 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → project.
2. **OAuth consent screen** — External, **Testing**, App name `SuHuella`.
3. **Test users** — add `narcis.clavell@gmail.com` (required while Testing).
4. **Credentials → OAuth client ID → Web application**.
5. Origins: `http://localhost:3000` (+ later `https://suhuella.com`).
6. Redirect URIs:
   - `http://localhost:3000/api/integrations/google-drive/callback`
   - `https://suhuella.com/api/integrations/google-drive/callback`
7. Enable **Google Drive API**.
8. Scopes: `openid`, `email`, `https://www.googleapis.com/auth/drive.readonly`.

## 2. Microsoft Azure AD app (OneDrive)

1. [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `SuHuella`.
3. Supported account types: **Accounts in any org directory and personal Microsoft accounts**.
4. Redirect URI (Web):
   - `http://localhost:3000/api/integrations/onedrive/callback`
   - later: `https://suhuella.com/api/integrations/onedrive/callback`
5. **Certificates & secrets** → New client secret (copy once).
6. **API permissions** → Microsoft Graph → Delegated:
   - `Files.Read`
   - `User.Read`
   - `openid`
   - `email`
   - `profile`
   - `offline_access`
7. Copy **Application (client) ID** and the client secret into local env only.

## 3. Local env (interactive — never print secrets)

```bash
cd /Users/narcisclavell/Documents/suhuella/site

# Flag + encryption key (local only)
grep -q '^CLOUD_INTEGRATIONS_ENABLED=' .dev.vars 2>/dev/null || \
  printf '\nCLOUD_INTEGRATIONS_ENABLED=true\n' >> .dev.vars
grep -q '^CLOUD_TOKEN_ENCRYPTION_KEY=' .dev.vars 2>/dev/null || \
  printf 'CLOUD_TOKEN_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)" >> .dev.vars

# Google
printf 'CLOUD_GOOGLE_DRIVE_CLIENT_ID=' >> .dev.vars
read CLIENT_ID && printf '%s\n' "$CLIENT_ID" >> .dev.vars
printf 'CLOUD_GOOGLE_DRIVE_CLIENT_SECRET=' >> .dev.vars
read -s CLIENT_SECRET && printf '%s\n' "$CLIENT_SECRET" >> .dev.vars && echo

# OneDrive
printf 'CLOUD_ONEDRIVE_CLIENT_ID=' >> .dev.vars
read MS_ID && printf '%s\n' "$MS_ID" >> .dev.vars
printf 'CLOUD_ONEDRIVE_CLIENT_SECRET=' >> .dev.vars
read -s MS_SECRET && printf '%s\n' "$MS_SECRET" >> .dev.vars && echo

# Mirror CLOUD_* into .env.local if needed
```

Keep `PAID_CHECKOUT_ENABLED=false`.

## 4. Local proof

```bash
cd /Users/narcisclavell/Documents/suhuella/site
npx wrangler d1 migrations apply LICENSE_DB --local --config wrangler.jsonc
npm run dev:cf
```

For **each** of Google Drive and OneDrive:

1. Sources → Cloud → **Connect**
2. Consent → back to `/sources?integration=connected`
3. Card shows platform name + logo + account email
4. Open → section roots (My Drive / Shared with me, or My files / Shared) → folder
5. Renew → Disconnect
6. Search / Organise still without cloud index

## 5. Later (not this release)

- **Gmail** and **Outlook** as **Communications** sources (separate Source group — not under Cloud).

## 6. Production secrets (after both local proofs)

```bash
cd /Users/narcisclavell/Documents/suhuella/site
npx wrangler secret put CLOUD_TOKEN_ENCRYPTION_KEY --config wrangler.jsonc
npx wrangler secret put CLOUD_GOOGLE_DRIVE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put CLOUD_GOOGLE_DRIVE_CLIENT_SECRET --config wrangler.jsonc
npx wrangler secret put CLOUD_ONEDRIVE_CLIENT_ID --config wrangler.jsonc
npx wrangler secret put CLOUD_ONEDRIVE_CLIENT_SECRET --config wrangler.jsonc
# Then CLOUD_INTEGRATIONS_ENABLED=true in wrangler.jsonc + deploy (pending)
```

## 7. Rollback

`CLOUD_INTEGRATIONS_ENABLED=false` + redeploy. Do not drop D1 tables.

## 8. Deploy (pending only)

```bash
cd /Users/narcisclavell/Documents/suhuella/site && npm run deploy
```
