# SuHuella email foundation

This document applies to **SuHuella only** (`suhuella.com`). No other project, brand, or company is part of this mail setup.

```text
INBOUND     Cloudflare Email Routing  (receive @suhuella.com → real mailboxes)
OUTBOUND    Resend                    (Worker sends transactional OTP only, for now)
ADDRESSES   BrandConfig               (operational map — not secrets)
API KEY     Worker secret             (RESEND_API_KEY only)
```

Do not mix Cloudflare routing DNS with Resend sending DNS. When Resend provides records, copy them exactly and reconcile any existing SPF — never create incompatible duplicate SPF TXT records.

## Frozen operational map

Authority: `brands/suhuella/brand.ts` → `emails`.

| Address | Role | Receive (Routing) | Send from app (Resend) |
| --- | --- | --- | --- |
| `licenses@suhuella.com` | License OTP / recovery | Yes → support group | **Yes** — `RESEND_FROM` |
| `support@suhuella.com` | Customer support | Yes | No (initially) |
| `sales@suhuella.com` | Lifetime / Monthly / Business | Yes | No (initially) |
| `partners@suhuella.com` | Future partners / white-label | Yes | No (initially) |
| `billing@suhuella.com` | Payment / invoice questions | Yes | No (initially) |
| `privacy@suhuella.com` | Privacy / data requests | Yes | No |
| `security@suhuella.com` | Security incidents | Yes | No |
| `operations@suhuella.com` | Internal platform ops | Yes (internal) | No |

No `noreply@suhuella.com`. License emails use **Reply-To: support@suhuella.com** so users can reply.

## Routing groups (one or two real mailboxes)

Forward aliases to verified destination addresses — no paid mailbox per alias.

```text
support@suhuella.com    ─┐
licenses@suhuella.com   ├──→ SUPPORT_DEST (your main support inbox)
billing@suhuella.com    ┤
privacy@suhuella.com    ┤
security@suhuella.com   ┘

sales@suhuella.com      ─┐
partners@suhuella.com   ├──→ SALES_DEST (commercial inbox, or yours)
operations@suhuella.com ┘
```

## Phase 1 — Cloudflare Email Routing (before Resend)

1. Enable Email Routing for `suhuella.com` (Cloudflare Dashboard or `wrangler email routing enable suhuella.com`).
2. Add destination addresses and complete verification links in each real inbox:
   ```bash
   cd site
   npx wrangler email routing addresses create you@example.com
   ```
3. Create one rule per alias (literal match on `to` → forward):
   ```bash
   npx wrangler email routing rules create suhuella.com \
     --name "licenses" --match-type literal --match-field to \
     --match-value licenses@suhuella.com --action-type forward \
     --action-value you@example.com
   ```
4. Send one real email to each `@suhuella.com` alias and confirm delivery.
5. Only then proceed to Resend.

Helper script (optional): `site/scripts/suhuella-email-routing-setup.mjs` — prints commands after you set `SUPPORT_DEST` and `SALES_DEST`.

Current account state (check anytime):

```bash
npx wrangler email routing settings suhuella.com
npx wrangler email routing addresses list
npx wrangler email routing rules list suhuella.com
npx wrangler email routing dns get suhuella.com
```

## Phase 2 — Resend (after routing verified)

This is the outbound send proof. Use the SuHuella Resend account and suhuella.com only.

1. SuHuella Resend account. Do not share it with another project or brand.
2. Add and verify `suhuella.com` in Resend — use **exact** dashboard DNS values. Do not invent SPF/DKIM strings.
3. Reconcile SPF with existing Cloudflare routing SPF if both exist on the apex. One `v=spf1` TXT per name.
4. Cloudflare CNAMEs from Resend must be **DNS-only** (grey cloud).
5. Create sending API key → `npx wrangler secret put RESEND_API_KEY` on Worker `suhuella`. Never commit the key.
6. Keep `RESEND_FROM=SuHuella <licenses@suhuella.com>` in `wrangler.jsonc`.
7. Inspect public DNS (no secrets):

   ```bash
   cd site
   npm run test:resend-dns
   # after the registrar records exist:
   npm run test:resend-dns -- --require
   ```

8. Live OTP without selling: Operations gift / manual / test grant for an inbox you control, then:

   ```bash
   RESEND_OTP_PROOF_EMAIL=you@example.com npm run test:resend-otp-proof
   ```

   HTTP 200 is not delivery. Confirm From `licenses@suhuella.com` and Reply-To `support@suhuella.com` in the inbox. Production ignores `LICENSE_GRANTS` env.

## Product wiring (current)

| Surface | Address |
| --- | --- |
| License OTP From | `licenses@suhuella.com` via `RESEND_FROM` |
| License OTP Reply-To | `support@suhuella.com` via `licenseOtpReplyTo()` |
| Site / checkout copy | `support@suhuella.com`, `sales@suhuella.com` via BrandConfig |
| Superadmin allowlist | `SUPERADMIN_EMAILS` (separate from public aliases) |

Future: external Operators use their own Resend account and verified domain. Email presentation remains Brand-scoped; API keys remain Operator-scoped Worker secrets.
