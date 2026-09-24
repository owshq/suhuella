/**
 * HMAC → Ed25519 transition verification (no real purchases, no publish).
 *
 * Runs automated dual-verify + offline checks, then prints operator checklist
 * for Worker secret deploy and desktop rebuild with matching SPKI.
 *
 *   npm run verify:license-ed25519-transition
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  describeLicenseKeyProvenance,
  formatLicenseKeyProvenanceSummary,
} from '../desktop/scripts/license-key-provenance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(label, cmd, args, cwd = root) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env })
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed (${result.status})`)
    process.exit(result.status ?? 1)
  }
  console.log(`✓ ${label}`)
}

function wranglerSecretNames() {
  const wrangler = path.join(root, 'site/node_modules/.bin/wrangler')
  const result = spawnSync(wrangler, ['secret', 'list'], {
    cwd: path.join(root, 'site'),
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) {
    return { ok: false, names: [], error: result.stderr || result.stdout || 'wrangler secret list failed' }
  }
  try {
    const parsed = JSON.parse(result.stdout)
    const names = Array.isArray(parsed) ? parsed.map((row) => row.name).filter(Boolean) : []
    return { ok: true, names }
  } catch {
    return { ok: false, names: [], error: 'could not parse wrangler secret list output' }
  }
}

function main() {
  console.log('License signing transition verification (HMAC → Ed25519, preserve activations)')
  console.log('Automated tests use ephemeral keypairs — production deploy is a separate operator step.')
  console.log('')

  run('site signed-license-rights-delivery', 'npm', ['run', 'test:signed-license-rights-delivery', '--prefix', 'site'])
  run('desktop license-offline-verify', 'npm', ['run', 'test:license-offline-verify', '--prefix', 'desktop'])
  run('desktop license-dual-verify', 'npm', ['run', 'test:license-dual-verify', '--prefix', 'desktop'])
  run('site license-hmac-retirement-2b', 'npm', ['run', 'test:license-hmac-retirement-2b', '--prefix', 'site'])

  const provenance = describeLicenseKeyProvenance()
  console.log('\nLocal env license key provenance:')
  console.log(formatLicenseKeyProvenanceSummary(provenance))

  const secrets = wranglerSecretNames()
  console.log('\nProduction Worker secrets (names only):')
  if (!secrets.ok) {
    console.log(`  (skipped — ${secrets.error.trim()})`)
  } else {
    const required = [
      'LICENSE_SIGNING_SECRET',
      'LICENSE_SIGNING_PRIVATE_KEY',
      'LICENSE_SIGNING_PUBLIC_KEYS',
    ]
    for (const name of required) {
      const present = secrets.names.includes(name)
      console.log(`  ${present ? '✓' : '○'} ${name}`)
    }
    if (!secrets.names.includes('LICENSE_SIGNING_PRIVATE_KEY')) {
      console.log('\n  Worker still on HMAC-only signing until LICENSE_SIGNING_PRIVATE_KEY is deployed.')
      console.log('  Existing HMAC activations remain valid during Phase 2B dual-verify.')
    }
  }

  console.log('\nOperator checklist (before updating public downloads):')
  console.log('  License signing (Ed25519) and commercial code signing (Developer ID / Authenticode) are independent.')
  console.log('  Pre-rc publish does NOT require paid Apple/Microsoft certificates — only production SPKI alignment.')
  console.log('')
  console.log('  1. Generate Ed25519 keypair offline — see LICENSE-ED25519-PRODUCTION-DEPLOY-001.md §2 Paso B')
  console.log('  2. wrangler secret put LICENSE_SIGNING_PRIVATE_KEY + LICENSE_SIGNING_PUBLIC_KEYS (same SPKI as desktop build)')
  console.log('  3. Keep LICENSE_SIGNING_SECRET until 2B retires legacy HMAC tokens')
  console.log('  4. Rebuild Mac + Windows with SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS=<production SPKI> (adhoc/unsigned OK)')
  console.log('  5. npm run validate-release -- --platform mac|windows — PreRcReleaseValidation, no Gate 6')
  console.log('  6. Gift/test activation + offline verify on a real device — no Stripe purchase required')
  console.log('  7. Only then: npm run publish:desktop-mac / publish:desktop-win (Gatekeeper/SmartScreen warnings expected)')
  console.log('')
  console.log('verify:license-ed25519-transition PASS — automated transition tests OK')
}

main()
