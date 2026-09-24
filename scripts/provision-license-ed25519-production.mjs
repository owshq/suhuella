/**
 * Generate (or reuse) production Ed25519 license keypair and wire secrets.
 * Does NOT touch commercial code signing. Does NOT rotate OTP/partner secrets.
 *
 *   node scripts/provision-license-ed25519-production.mjs --write-local
 *   node scripts/provision-license-ed25519-production.mjs --deploy-worker
 *   node scripts/provision-license-ed25519-production.mjs --set-github-secret
 */
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveBrandId } from '../brands/select.mjs'
import { spkiFingerprint } from '../desktop/scripts/license-key-provenance.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandId = resolveBrandId()
const keyPath = path.join(root, 'desktop/.build', brandId, 'LICENSE-PRODUCTION-KEYPAIR.json')
const devVarsPath = path.join(root, 'site/.dev.vars')

const writeLocal = process.argv.includes('--write-local')
const deployWorker = process.argv.includes('--deploy-worker')
const setGithubSecret = process.argv.includes('--set-github-secret')

function loadOrCreateKeypair() {
  if (existsSync(keyPath)) {
    const saved = JSON.parse(readFileSync(keyPath, 'utf8'))
    if (saved.publicKeySpkiBase64 && saved.privateKeyPkcs8Base64) {
      console.log(`Reusing keypair from ${keyPath}`)
      console.log('Do NOT re-run provisioning as routine — copy private key to a secrets manager first.')
      console.log('desktop/.build/ is temporary even though gitignored.')
      if (process.argv.includes('--force-new')) {
        console.warn('--force-new: generating a new keypair (invalidates prior Worker/desktop alignment until redeployed)')
      } else {
        return saved
      }
    }
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const keypair = {
    createdAt: new Date().toISOString(),
    algorithm: 'ed25519',
    publicKeySpkiBase64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'),
    privateKeyPkcs8Base64: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url'),
    fingerprint: '',
    notes: [
      'Operator backup — gitignored under desktop/.build/',
      'Private key → Worker LICENSE_SIGNING_PRIVATE_KEY only',
      'Public SPKI → LICENSE_SIGNING_PUBLIC_KEYS + SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS',
    ],
  }
  keypair.fingerprint = spkiFingerprint(keypair.publicKeySpkiBase64)
  mkdirSync(path.dirname(keyPath), { recursive: true })
  writeFileSync(keyPath, `${JSON.stringify(keypair, null, 2)}\n`, 'utf8')
  console.log(`Generated production keypair → ${keyPath}`)
  console.log(`Public SPKI fingerprint: ${keypair.fingerprint}`)
  return keypair
}

function upsertDevVarsPublicKeys(publicSpki) {
  let content = existsSync(devVarsPath) ? readFileSync(devVarsPath, 'utf8') : ''
  const lines = content.split('\n')
  const keyLine = `LICENSE_SIGNING_PUBLIC_KEYS=${publicSpki}`
  let replaced = false
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('LICENSE_SIGNING_PUBLIC_KEYS=')) {
      lines[i] = keyLine
      replaced = true
      break
    }
  }
  if (!replaced) {
    if (lines.length && lines.at(-1)?.trim()) lines.push('')
    lines.push('# Ed25519 license verify (production SPKI — local dev only)')
    lines.push(keyLine)
  }
  writeFileSync(devVarsPath, `${lines.join('\n')}\n`, 'utf8')
  console.log(`Updated ${devVarsPath} LICENSE_SIGNING_PUBLIC_KEYS`)
}

function wranglerPut(name, value) {
  const wrangler = path.join(root, 'site/node_modules/.bin/wrangler')
  const result = spawnSync(wrangler, ['secret', 'put', name], {
    cwd: path.join(root, 'site'),
    input: value,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `wrangler secret put ${name} failed`)
    process.exit(result.status ?? 1)
  }
  console.log(`✓ Worker secret ${name} deployed (value not logged)`)
}

function ghSecretSet(name, value) {
  const result = spawnSync('gh', ['secret', 'set', name, '--body', value], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || `gh secret set ${name} failed`)
    process.exit(result.status ?? 1)
  }
  console.log(`✓ GitHub secret ${name} set (value not logged)`)
}

function main() {
  const keypair = loadOrCreateKeypair()
  const publicSpki = keypair.publicKeySpkiBase64

  if (writeLocal) {
    upsertDevVarsPublicKeys(publicSpki)
    console.log('')
    console.log('Local build env:')
    console.log(`  export SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS="${publicSpki}"`)
    console.log(`  export LICENSE_SIGNING_PUBLIC_KEYS="${publicSpki}"`)
    console.log(`  export LICENSE_SIGNING_PRIVATE_KEY="<see ${keyPath}>"`)
  }

  if (deployWorker) {
    wranglerPut('LICENSE_SIGNING_PRIVATE_KEY', keypair.privateKeyPkcs8Base64)
    wranglerPut('LICENSE_SIGNING_PUBLIC_KEYS', publicSpki)
    console.log('LICENSE_SIGNING_SECRET unchanged — HMAC legacy activations preserved')
  }

  if (setGithubSecret) {
    ghSecretSet('SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS', publicSpki)
  }

  if (!writeLocal && !deployWorker && !setGithubSecret) {
    console.log('Usage:')
    console.log('  node scripts/provision-license-ed25519-production.mjs --write-local')
    console.log('  node scripts/provision-license-ed25519-production.mjs --deploy-worker')
    console.log('  node scripts/provision-license-ed25519-production.mjs --set-github-secret')
    console.log('  node scripts/provision-license-ed25519-production.mjs --write-local --deploy-worker --set-github-secret')
  }
}

main()
