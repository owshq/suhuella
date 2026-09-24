/**
 * End-to-end license activation + offline verify using production keypair file
 * (no Stripe, no commercial code signing).
 *
 *   node scripts/verify-production-license-activation.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveBrandId } from '../brands/select.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandId = resolveBrandId()
const keyPath = path.join(root, 'desktop/.build', brandId, 'LICENSE-PRODUCTION-KEYPAIR.json')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function main() {
  if (!existsSync(keyPath)) {
    fail(`Missing ${keyPath} — run scripts/provision-license-ed25519-production.mjs --write-local first`)
  }
  const keypair = JSON.parse(readFileSync(keyPath, 'utf8'))
  const env = {
    ...process.env,
    LICENSE_SIGNING_PRIVATE_KEY: keypair.privateKeyPkcs8Base64,
    LICENSE_SIGNING_PUBLIC_KEYS: keypair.publicKeySpkiBase64,
    SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS: keypair.publicKeySpkiBase64,
  }
  delete env.LICENSE_SIGNING_SECRET

  console.log('Production license activation verify (Ed25519, no Stripe)')
  console.log(`SPKI fingerprint: ${keypair.fingerprint}`)
  console.log('')

  const checks = [
    ['site signed-license-rights-delivery', 'npm', ['run', 'test:signed-license-rights-delivery', '--prefix', 'site']],
    ['desktop license-offline-verify', 'npm', ['run', 'test:license-offline-verify', '--prefix', 'desktop']],
    ['desktop license-dual-verify', 'npm', ['run', 'test:license-dual-verify', '--prefix', 'desktop']],
    ['site license-hmac-retirement-2b', 'npm', ['run', 'test:license-hmac-retirement-2b', '--prefix', 'site']],
  ]

  for (const [label, cmd, args] of checks) {
    console.log(`▶ ${label}`)
    const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env })
    if (result.status !== 0) fail(`${label} failed (${result.status})`)
    console.log(`✓ ${label}\n`)
  }

  console.log('verify-production-license-activation PASS')
  console.log('Next: package Mac/Windows with SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS, then validate-release (pre-rc, no certs)')
}

main()
