/**
 * LICENSE-ED25519-PRODUCTION-DEPLOY-001 — operator deploy orchestrator.
 *
 *   node scripts/deploy-license-ed25519-production.mjs --dry-run
 *   node scripts/deploy-license-ed25519-production.mjs --step 1
 *   node scripts/deploy-license-ed25519-production.mjs --step all
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteRoot = path.join(root, 'site')
const brandBuild = path.join(root, 'desktop/.build/suhuella')
const rotationSecretsPath = path.join(brandBuild, 'PHASE-2A-ROTATION-SECRETS.json')
const releaseJsonPath = path.join(root, 'brands/suhuella/release.json')

const dryRun = process.argv.includes('--dry-run')
const stepArg =
  process.argv.find((a) => a.startsWith('--step='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--step') + 1] ??
  'all'

function fail(message) {
  console.error(message)
  process.exit(1)
}

function log(message) {
  console.log(dryRun ? `[dry-run] ${message}` : message)
}

function run(cmd, args, cwd = root) {
  if (dryRun) {
    log(`${cmd} ${args.join(' ')}`)
    return { status: 0 }
  }
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
  if (result.status !== 0) fail(`${cmd} ${args.join(' ')} failed (${result.status})`)
  return result
}

function wranglerSecretNames() {
  const wrangler = path.join(siteRoot, 'node_modules/.bin/wrangler')
  const result = spawnSync(wrangler, ['secret', 'list'], {
    cwd: siteRoot,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) return []
  try {
    return JSON.parse(result.stdout).map((row) => row.name)
  } catch {
    return []
  }
}

function wranglerPut(name, value) {
  if (dryRun) {
    log(`wrangler secret put ${name} (value not logged)`)
    return
  }
  const wrangler = path.join(siteRoot, 'node_modules/.bin/wrangler')
  const result = spawnSync(wrangler, ['secret', 'put', name], {
    cwd: siteRoot,
    input: value,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) fail(result.stderr || result.stdout || `wrangler secret put ${name} failed`)
  console.log(`✓ Worker secret ${name} deployed`)
}

function loadOrCreateRotationSecrets() {
  if (existsSync(rotationSecretsPath)) {
    return JSON.parse(readFileSync(rotationSecretsPath, 'utf8'))
  }
  const secrets = {
    createdAt: new Date().toISOString(),
    LICENSE_EMAIL_OTP_SECRET: randomBytes(32).toString('hex'),
    PARTNER_SESSION_SECRET: randomBytes(32).toString('hex'),
    notes: ['gitignored — backup in password manager before deleting this file'],
  }
  mkdirSync(brandBuild, { recursive: true })
  writeFileSync(rotationSecretsPath, `${JSON.stringify(secrets, null, 2)}\n`, 'utf8')
  console.log(`Generated rotation secrets → ${rotationSecretsPath}`)
  return secrets
}

function step1Secrets() {
  console.log('\n=== Step 1 — Worker secrets ===')
  const names = wranglerSecretNames()
  const ed25519Ready =
    names.includes('LICENSE_SIGNING_PRIVATE_KEY') && names.includes('LICENSE_SIGNING_PUBLIC_KEYS')
  if (ed25519Ready) {
    console.log('✓ Ed25519 keys already on Worker (skipping put)')
  } else {
    log('Deploy Ed25519 via: node scripts/provision-license-ed25519-production.mjs --deploy-worker')
    if (!dryRun && !ed25519Ready) {
      run(process.execPath, ['scripts/provision-license-ed25519-production.mjs', '--deploy-worker'])
    }
  }

  const rotation = loadOrCreateRotationSecrets()
  if (!names.includes('LICENSE_EMAIL_OTP_SECRET')) {
    wranglerPut('LICENSE_EMAIL_OTP_SECRET', rotation.LICENSE_EMAIL_OTP_SECRET)
  } else {
    console.log('✓ LICENSE_EMAIL_OTP_SECRET already present')
  }
  if (!names.includes('PARTNER_SESSION_SECRET')) {
    wranglerPut('PARTNER_SESSION_SECRET', rotation.PARTNER_SESSION_SECRET)
  } else {
    console.log('✓ PARTNER_SESSION_SECRET already present')
  }

  const after = dryRun ? names : wranglerSecretNames()
  for (const required of [
    'LICENSE_SIGNING_PRIVATE_KEY',
    'LICENSE_SIGNING_PUBLIC_KEYS',
    'LICENSE_SIGNING_SECRET',
    'LICENSE_EMAIL_OTP_SECRET',
    'PARTNER_SESSION_SECRET',
  ]) {
    const present = after.includes(required)
    console.log(`  ${present ? '✓' : '○'} ${required}`)
    if (!present && !dryRun) fail(`Missing Worker secret: ${required}`)
  }
}

function step2Migration() {
  console.log('\n=== Step 2 — D1 migration 0013 ===')
  if (dryRun) {
    log('wrangler d1 migrations apply suhuella-license --remote')
    return
  }
  run(path.join(siteRoot, 'node_modules/.bin/wrangler'), [
    'd1',
    'migrations',
    'apply',
    'suhuella-license',
    '--remote',
  ], siteRoot)

  const result = spawnSync(
    path.join(siteRoot, 'node_modules/.bin/wrangler'),
    [
      'd1',
      'execute',
      'suhuella-license',
      '--remote',
      '--json',
      '--command',
      "SELECT name FROM pragma_table_info('license_activation') WHERE name = 'last_presented_token_algorithm';",
    ],
    { cwd: siteRoot, encoding: 'utf8', env: process.env },
  )
  if (result.status !== 0) fail('Could not verify 0013 column on remote D1')
  const parsed = JSON.parse(result.stdout)
  const found = (parsed?.[0]?.results ?? []).some((row) => row.name === 'last_presented_token_algorithm')
  if (!found) fail('last_presented_token_algorithm column missing after migration')
  console.log('✓ Migration 0013 verified on remote D1')
}

function step3DesktopRelease() {
  console.log('\n=== Step 3 — Desktop release (production SPKI) ===')
  if (dryRun) {
    log('npm run prepare:candidate:mac')
    log('npm run publish:desktop-mac')
    log('npm run build:desktop-win-ci  # Windows workflow_dispatch')
    return
  }

  if (!existsSync(path.join(brandBuild, 'LICENSE-PRODUCTION-KEYPAIR.json'))) {
    run(process.execPath, ['scripts/provision-license-ed25519-production.mjs', '--write-local'])
  }
  const keypair = JSON.parse(readFileSync(path.join(brandBuild, 'LICENSE-PRODUCTION-KEYPAIR.json'), 'utf8'))
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64

  const candidateReport = path.join(brandBuild, 'CANDIDATE-mac.json')
  if (!existsSync(candidateReport)) {
    run(process.execPath, ['scripts/prepare-desktop-candidate.mjs', '--platform', 'mac'])
  } else {
    console.log(`✓ Mac candidate report exists (${candidateReport})`)
  }

  run(process.execPath, ['scripts/publish-desktop-mac-release.mjs'])
  run('npm', ['run', 'build:desktop-win-ci'])
}

function step4Smoke() {
  console.log('\n=== Step 4 — Smoke §3a–§3c ===')
  run(process.execPath, ['scripts/smoke-license-ed25519-production.mjs'])
}

function step5Communication() {
  console.log('\n=== Step 5 — Communication §5 (email B+C) ===')
  const manifest = JSON.parse(readFileSync(releaseJsonPath, 'utf8'))
  manifest.mandatory = true
  manifest.notes =
    'Improved offline license verification. Install over your current version — your license is unchanged.'

  if (dryRun) {
    log(`Update ${releaseJsonPath} mandatory=true + notes`)
    log('node brands/project-release.mjs && npm run cf:deploy')
    log('node scripts/send-license-desktop-update-email.mjs --dry-run')
    return
  }

  writeFileSync(releaseJsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log('✓ Updated brands/suhuella/release.json (mandatory + notes)')
  run(process.execPath, ['brands/project-release.mjs'])
  run('npm', ['run', 'cf:deploy'])

  run(process.execPath, ['scripts/send-license-desktop-update-email.mjs', '--dry-run'])
  if (process.env.RESEND_API_KEY?.trim()) {
    run(process.execPath, ['scripts/send-license-desktop-update-email.mjs', '--send', '--confirm'])
  } else {
    console.log('○ Email send skipped — set RESEND_API_KEY and re-run send-license-desktop-update-email.mjs --send --confirm')
  }
}

function step6Monitor() {
  console.log('\n=== Step 6 — Monitor HMAC retirement (2B) ===')
  run(process.execPath, ['scripts/monitor-license-hmac-retirement.mjs', '--json'])
}

const steps = {
  1: step1Secrets,
  2: step2Migration,
  3: step3DesktopRelease,
  4: step4Smoke,
  5: step5Communication,
  6: step6Monitor,
  all: () => {
    step1Secrets()
    step2Migration()
    step3DesktopRelease()
    step4Smoke()
    step5Communication()
    step6Monitor()
  },
}

const step = steps[stepArg]
if (!step) fail(`Unknown --step ${stepArg} (use 1-6 or all)`)

console.log(`LICENSE-ED25519 production deploy — step ${stepArg}${dryRun ? ' (dry-run)' : ''}`)
step()
console.log(`\nStep ${stepArg} complete.`)
