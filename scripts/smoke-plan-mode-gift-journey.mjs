/**
 * Pre-rc real journey smoke — gift license (no Stripe) + Plan Mode temp executor + Prepare Plan actions.
 * Does not publish installers or change release flags.
 *
 *   node scripts/smoke-plan-mode-gift-journey.mjs
 *   node scripts/smoke-plan-mode-gift-journey.mjs --with-mac-artifact
 *   node scripts/smoke-plan-mode-gift-journey.mjs --playwright
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveBrandId } from '../brands/select.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandId = resolveBrandId()
const buildDir = path.join(root, 'desktop/.build', brandId)
const keyPath = path.join(buildDir, 'LICENSE-PRODUCTION-KEYPAIR.json')
const withMacArtifact = process.argv.includes('--with-mac-artifact')
const withPlaywright = process.argv.includes('--playwright')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(label, cmd, args, options = {}) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...options })
  if (result.status !== 0) fail(`${label} failed (${result.status})`)
  return result
}

function loadProductionKeys() {
  if (process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim()) {
    console.log('[smoke] Using SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS from environment')
    return
  }
  if (!existsSync(keyPath)) {
    fail(
      `Missing ${keyPath}\nRun: node scripts/provision-license-ed25519-production.mjs --write-local`,
    )
  }
  const keypair = JSON.parse(readFileSync(keyPath, 'utf8'))
  process.env.LICENSE_SIGNING_PRIVATE_KEY = keypair.privateKeyPkcs8Base64
  process.env.LICENSE_SIGNING_PUBLIC_KEYS = keypair.publicKeySpkiBase64
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64
  process.env.LICENSE_PRODUCTION_FINGERPRINT = keypair.fingerprint
  delete process.env.LICENSE_SIGNING_SECRET
  console.log(`[smoke] Production SPKI loaded (${keypair.fingerprint})`)
}

function mergeFunctionalLog(journeySteps) {
  mkdirSync(buildDir, { recursive: true })
  const logPath = path.join(buildDir, 'FUNCTIONAL-SMOKE-LOG.json')
  let existing = { entries: [], operatorChecklist: [] }
  if (existsSync(logPath)) {
    try {
      existing = JSON.parse(readFileSync(logPath, 'utf8'))
    } catch {
      // overwrite corrupt log
    }
  }
  const payload = {
    updatedAt: new Date().toISOString(),
    version: JSON.parse(readFileSync(path.join(root, 'desktop/package.json'), 'utf8')).version,
    entries: [
      ...(existing.entries ?? []),
      {
        step: 'plan-mode-gift-journey',
        result: 'PASS',
        detail: 'Gift activation + temp executor + Prepare Plan actions (no Stripe)',
        steps: journeySteps,
      },
    ],
    operatorChecklist: [
      'Install exact candidate bytes (SHA256 verified)',
      'Gatekeeper/SmartScreen warnings are diagnostic — Right-click → Open / More info → Run anyway',
      'Activate authorized gift/test license (Operations — no Stripe)',
      'Airplane mode: paid rights persist after restart',
      'Plan Mode: temp folder, move/rename/undo; cancel leaves files unchanged',
      'Live Stripe smoke still required per product (Monthly/Lifetime/Business/Partner)',
    ],
  }
  writeFileSync(logPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`\nLog: ${logPath}`)
}

function readJourneySteps() {
  const reportPath = path.join(buildDir, 'PLAN-MODE-GIFT-JOURNEY.json')
  if (!existsSync(reportPath)) return []
  return JSON.parse(readFileSync(reportPath, 'utf8')).steps ?? []
}

function main() {
  console.log('Plan Mode gift journey smoke (production SPKI, no Stripe, temp files only)')
  loadProductionKeys()

  run('plan-semantics', 'npm', ['run', 'test:plan-semantics', '--prefix', 'site'])
  run('plan-mode-gift-journey-check', 'npm', ['run', 'test:plan-mode-gift-journey', '--prefix', 'site'], {
    env: { ...process.env },
  })

  if (withMacArtifact) {
    run('mac-candidate-smoke', 'node', ['scripts/smoke-pre-rc-desktop-candidate.mjs', '--platform', 'mac'])
  }

  if (withPlaywright) {
    run('plan-mode-playwright-ui', process.execPath, [
      path.join(root, 'scripts/run-plan-mode-playwright.mjs'),
    ])
  }

  mergeFunctionalLog(readJourneySteps())
  console.log('\nPlan Mode gift journey smoke PASS')
}

main()
