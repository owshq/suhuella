/**
 * LICENSE-ED25519-PRODUCTION-DEPLOY-001 §3 — post-deploy smoke.
 *
 * 3a  Production Worker returns ed25519.* on /api/license/check
 * 3b  Desktop offline verify (automated proxy via license-offline-verify)
 * 3c  HMAC legacy server check (optional — requires LICENSE_SIGNING_SECRET in env)
 *
 *   node scripts/smoke-license-ed25519-production.mjs
 *   LICENSE_SIGNING_SECRET=… node scripts/smoke-license-ed25519-production.mjs
 */
import { createHmac, createPrivateKey, sign } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function textToBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function signEd25519LicenseTokenBody(body, privateKeyPkcs8Base64) {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyPkcs8Base64, 'base64url'),
    format: 'der',
    type: 'pkcs8',
  })
  const signature = sign(null, Buffer.from(body, 'utf8'), key).toString('base64url')
  return `ed25519.${body}.${signature}`
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteRoot = path.join(root, 'site')
const brandBuild = path.join(root, 'desktop/.build/suhuella')
const keyPath = path.join(brandBuild, 'LICENSE-PRODUCTION-KEYPAIR.json')
const productionOrigin = process.env.SUHUELLA_PRODUCTION_ORIGIN?.trim() || 'https://suhuella.com'

const SMOKE_LICENSE_ID = 'lic_ed25519_smoke_deploy'
const SMOKE_EMAIL = 'smoke-ed25519-deploy@suhuella.com'
const SMOKE_DEVICE = 'dev_ed25519_smoke_deploy'

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(label, cmd, args, options = {}) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: options.env ?? process.env })
  if (result.status !== 0) fail(`${label} failed (${result.status})`)
}

function wranglerExecute(sql) {
  const wrangler = path.join(siteRoot, 'node_modules/.bin/wrangler')
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  const result = spawnSync(
    wrangler,
    ['d1', 'execute', 'suhuella-license', '--remote', '--json', '--command', oneLine],
    { cwd: siteRoot, encoding: 'utf8', env: process.env, timeout: 60_000 },
  )
  if (result.status !== 0) fail(result.stderr || result.stdout || 'wrangler d1 execute failed')
  if (result.error) fail(result.error.message)
  const jsonStart = result.stdout.indexOf('[')
  if (jsonStart === -1) fail('wrangler d1 execute returned no JSON')
  return JSON.parse(result.stdout.slice(jsonStart))
}

function loadKeypair() {
  if (!existsSync(keyPath)) {
    fail(`Missing ${keyPath} — run provision:license-ed25519 first`)
  }
  const keypair = JSON.parse(readFileSync(keyPath, 'utf8'))
  process.env.TEST_LICENSE_SIGNING_PRIVATE_KEY = keypair.privateKeyPkcs8Base64
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64
  delete process.env.LICENSE_SIGNING_PRIVATE_KEY
  delete process.env.LICENSE_SIGNING_PUBLIC_KEYS
  delete process.env.LICENSE_SIGNING_SECRET
  return keypair
}

function seedPayload(now) {
  return {
    licenseId: SMOKE_LICENSE_ID,
    customerId: 'cust_smoke_ed25519',
    email: SMOKE_EMAIL,
    edition: 'personal_lifetime',
    status: 'active',
    capabilities: ['recommend_folder', 'create_folder', 'rename_file', 'move_file'],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 2,
    activatedDevices: 1,
    validUntil: null,
    lastCheckedAt: now,
    offlineUntil: new Date(Date.now() + 86_400_000 * 30).toISOString(),
    channel: 'stable',
    commercialGenerationId: null,
    acquiredCommercialGenerationIds: [],
    generationAccessMode: 'purchased_generation',
    generationEnforcementActive: false,
    policyRevision: null,
    signedContractVersion: 1,
  }
}

function signHmacToken(bodyObj, secret) {
  const body = textToBase64Url(JSON.stringify(bodyObj))
  const signature = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}

async function productionCheck(licenseToken) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${productionOrigin}/api/license/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: SMOKE_DEVICE,
        licenseToken,
        deviceName: 'Smoke Deploy',
      }),
      signal: controller.signal,
    })
    const json = await response.json()
    return { status: response.status, json }
  } finally {
    clearTimeout(timer)
  }
}

function upsertSmokeGrant(now) {
  const grant = {
    licenseId: SMOKE_LICENSE_ID,
    customerId: 'cust_smoke_ed25519',
    email: SMOKE_EMAIL,
    edition: 'personal_lifetime',
    origin: 'test',
    status: 'active',
    deviceLimit: 2,
    validUntil: null,
    acceptedBrands: ['suhuella'],
    createdAt: now,
    updatedAt: now,
  }
  const payload = JSON.stringify(grant)
  wranglerExecute(`
    INSERT INTO license_grant (
      license_id, normalized_email, customer_id, edition, status, origin,
      valid_until, device_limit, created_at, updated_at, payload
    ) VALUES (
      '${SMOKE_LICENSE_ID}', '${SMOKE_EMAIL}', 'cust_smoke_ed25519', 'personal_lifetime', 'active', 'test',
      NULL, 2, '${now}', '${now}', '${payload.replace(/'/g, "''")}'
    )
    ON CONFLICT(license_id) DO UPDATE SET
      status = 'active', updated_at = '${now}', normalized_email = '${SMOKE_EMAIL}';
  `)
  wranglerExecute(`
    INSERT INTO license_activation (
      license_id, device_id, device_name, platform, app_version,
      activated_at, last_seen, status
    ) VALUES (
      '${SMOKE_LICENSE_ID}', '${SMOKE_DEVICE}', 'Smoke Deploy', 'darwin', '0.1.0-pre-rc',
      '${now}', '${now}', 'active'
    )
    ON CONFLICT(license_id, device_id) DO UPDATE SET
      status = 'active', last_seen = '${now}';
  `)
}

function cleanupSmokeGrant() {
  wranglerExecute(`DELETE FROM license_activation WHERE license_id = '${SMOKE_LICENSE_ID}';`)
  wranglerExecute(`DELETE FROM license_grant WHERE license_id = '${SMOKE_LICENSE_ID}';`)
}

async function smoke3a(keypair) {
  const now = new Date().toISOString()
  upsertSmokeGrant(now)
  const body = seedPayload(now)
  const bodyB64 = textToBase64Url(JSON.stringify(body))
  const token = signEd25519LicenseTokenBody(bodyB64, keypair.privateKeyPkcs8Base64)
  if (!token.startsWith('ed25519.')) fail('local token must use ed25519 prefix')

  const { status, json } = await productionCheck(token)
  if (!json.ok) {
    fail(`3a production check failed (${status}): ${JSON.stringify(json)}`)
  }
  const refreshed =
    json.license?.licenseToken ??
    json.session?.context?.licenseToken ??
    json.context?.licenseToken ??
    ''
  if (!String(refreshed).startsWith('ed25519.')) {
    fail(`3a expected refreshed ed25519.* token, got prefix: ${String(refreshed).slice(0, 16)}…`)
  }
  console.log('✓ 3a Worker — production check returns ed25519.* token')
  return refreshed
}

async function smoke3cHmac(keypair) {
  const secret = process.env.LICENSE_SIGNING_SECRET?.trim()
  if (!secret) {
    console.log('○ 3c HMAC legacy — skipped (set LICENSE_SIGNING_SECRET to test server HMAC path on production)')
    return
  }
  const now = new Date().toISOString()
  upsertSmokeGrant(now)
  const body = seedPayload(now)
  const hmacToken = signHmacToken(body, secret)
  const { json } = await productionCheck(hmacToken)
  if (!json.ok) fail(`3c HMAC production check failed: ${JSON.stringify(json)}`)
  console.log('✓ 3c HMAC legacy — production server verify still accepts legacy token')
}

async function main() {
  const keypair = loadKeypair()
  const log = {
    updatedAt: new Date().toISOString(),
    productionOrigin,
    fingerprint: keypair.fingerprint,
    steps: [],
  }

  try {
    await smoke3a(keypair)
    log.steps.push({ step: '3a-worker-ed25519', result: 'PASS' })

    run('3b desktop offline verify', 'npm', ['run', 'test:license-offline-verify', '--prefix', 'desktop'])
    run('3b desktop dual-verify', 'npm', ['run', 'test:license-dual-verify', '--prefix', 'desktop'])
    log.steps.push({ step: '3b-desktop-offline-proxy', result: 'PASS' })

    await smoke3cHmac(keypair)
    log.steps.push({
      step: '3c-hmac-legacy',
      result: process.env.LICENSE_SIGNING_SECRET?.trim() ? 'PASS' : 'SKIP',
    })

    log.steps.push({
      step: '3b-airplane-packaged',
      result: 'MANUAL',
      detail: 'Install published DMG, activate gift, airplane mode, confirm paid persists',
    })
  } finally {
    try {
      cleanupSmokeGrant()
    } catch {
      // best-effort cleanup
    }
  }

  mkdirSync(brandBuild, { recursive: true })
  const logPath = path.join(brandBuild, 'LICENSE-ED25519-SMOKE-LOG.json')
  writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf8')
  console.log(`\nSmoke log: ${logPath}`)
  console.log('\nLICENSE-ED25519 production smoke PASS (automated sections)')
}

void main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
