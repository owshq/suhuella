/**
 * LICENSE-ED25519-PRODUCTION-DEPLOY-001 §5 — paid-user desktop update email.
 * Sends through the production Worker, which already holds RESEND_API_KEY.
 *
 *   node scripts/send-license-desktop-update-email.mjs --dry-run
 *   node scripts/send-license-desktop-update-email.mjs --send --confirm
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandBuild = path.join(root, 'desktop/.build/suhuella')
const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--send')
const confirm = process.argv.includes('--confirm')
const origin = process.env.SUHUELLA_PRODUCTION_ORIGIN?.trim() || 'https://suhuella.com'
const rotationPath = path.join(root, 'desktop/.build/suhuella/PHASE-2A-ROTATION-SECRETS.json')

const SUBJECT = 'SuHuella desktop update — improved offline license reliability'
const TEXT_BODY = `Hi,

A new SuHuella desktop release is available with improved offline license verification.

If you use SuHuella without an internet connection, this update helps your paid license stay
recognized reliably while you are offline.

Your license is tied to your account — installing the update does not remove or reset it.

Download the latest version for your computer:
  https://suhuella.com/download

Run the installer on top of your current install. SuHuella stays in the menu bar / tray as usual.

If anything looks wrong after updating, reply to this email — we read support@suhuella.com.

— SuHuella`

function fail(message) {
  console.error(message)
  process.exit(1)
}

function queryRecipients() {
  const wrangler = path.join(root, 'site/node_modules/.bin/wrangler')
  const sql =
    "SELECT DISTINCT normalized_email AS email FROM license_grant WHERE status = 'active' AND edition != 'free' ORDER BY normalized_email;"
  const result = spawnSync(
    wrangler,
    ['d1', 'execute', 'suhuella-license', '--remote', '--json', '--command', sql],
    { cwd: path.join(root, 'site'), encoding: 'utf8', env: process.env },
  )
  if (result.status !== 0) fail(result.stderr || result.stdout || 'D1 recipient query failed')
  const parsed = JSON.parse(result.stdout)
  return (parsed?.[0]?.results ?? [])
    .map((row) => String(row.email ?? '').trim().toLowerCase())
    .filter(Boolean)
}

function operatorToken() {
  const saved = JSON.parse(readFileSync(rotationPath, 'utf8'))
  const token = saved.PARTNER_SESSION_SECRET?.trim()
  if (!token) fail(`Missing PARTNER_SESSION_SECRET in ${rotationPath}`)
  return token
}

async function main() {
  const recipients = queryRecipients()
  console.log(`Recipients: ${recipients.length}`)

  if (dryRun) {
    for (const email of recipients.slice(0, 20)) console.log(`  ${email}`)
    if (recipients.length > 20) console.log(`  … and ${recipients.length - 20} more`)
    console.log('\nDry run — pass --send --confirm to deliver via the Worker (RESEND_API_KEY stays a Worker secret).')
    return
  }

  if (!confirm) fail('Refusing to send without --confirm')

  const response = await fetch(`${origin}/api/internal/license-desktop-update-notice`, {
    method: 'POST',
    headers: { 'x-suhuella-operator-token': operatorToken() },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.ok) {
    fail(`Worker notice failed (${response.status}): sent=${body.sent ?? 0} failed=${body.failed ?? 0} hmac=${body.hmacLegacyOk ?? false}`)
  }

  mkdirSync(brandBuild, { recursive: true })
  const logPath = path.join(brandBuild, 'LICENSE-DESKTOP-UPDATE-EMAIL-LOG.json')
  writeFileSync(
    logPath,
    `${JSON.stringify({ sentAt: new Date().toISOString(), subject: SUBJECT, sent: body.sent, hmacLegacyOk: body.hmacLegacyOk }, null, 2)}\n`,
    'utf8',
  )
  console.log(`✓ Worker sent ${body.sent} notice(s); HMAC legacy self-check ${body.hmacLegacyOk ? 'PASS' : 'FAIL'}`)
  console.log(`Log: ${logPath}`)
}

void main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
