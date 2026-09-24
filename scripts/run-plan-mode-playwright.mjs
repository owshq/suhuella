/**
 * Start site dev server if needed, then run Plan Mode Playwright UI smokes.
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const siteRoot = path.join(root, 'site')
const BASE = process.env.BROWSER_CONNECT_URL ?? 'http://127.0.0.1:3000'

function probePath(pathname = '/') {
  const result = spawnSync(
    'curl',
    ['-sf', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '120', `${BASE}${pathname}`],
    { encoding: 'utf8', timeout: 130_000 },
  )
  return result.stdout?.trim() === '200'
}

function probe() {
  return probePath('/') && probePath('/plan-mode')
}

function run(label, cmd, args) {
  console.log(`\n▶ ${label}`)
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: process.env })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function waitForDev(maxMs = 240_000) {
  const started = Date.now()
  while (Date.now() - started < maxMs) {
    if (probe()) return
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`Dev server did not become ready at ${BASE}`)
}

function loadProductionKeys() {
  if (process.env.LICENSE_SIGNING_PRIVATE_KEY?.trim()) return
  const keyPath = path.join(root, 'desktop/.build/suhuella/LICENSE-PRODUCTION-KEYPAIR.json')
  if (!existsSync(keyPath)) {
    throw new Error(`Missing ${keyPath} for signed gift license Playwright fixture`)
  }
  const keypair = JSON.parse(readFileSync(keyPath, 'utf8'))
  process.env.LICENSE_SIGNING_PRIVATE_KEY = keypair.privateKeyPkcs8Base64
  process.env.LICENSE_SIGNING_PUBLIC_KEYS = keypair.publicKeySpkiBase64
  process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS = keypair.publicKeySpkiBase64
  process.env.LICENSE_PRODUCTION_FINGERPRINT = keypair.fingerprint
  delete process.env.LICENSE_SIGNING_SECRET
}

async function main() {
  loadProductionKeys()
  let devChild = null
  const startedHere = !probe()

  if (startedHere) {
    console.log(`Starting dev server (${BASE})…`)
    devChild = spawn('npm', ['run', 'dev', '--prefix', siteRoot], {
      cwd: root,
      stdio: 'ignore',
      detached: true,
      env: process.env,
    })
    devChild.unref()
    await waitForDev()
    console.log('Dev server ready')
  } else {
    console.log(`Dev server already up at ${BASE}`)
  }

  try {
    run('browser-organise-prompt-playwright', 'npm', [
      'run',
      'test:browser-organise-prompt-playwright',
      '--prefix',
      siteRoot,
    ])
    run('browser-plan-mode-confirm-undo-playwright', 'npm', [
      'run',
      'test:browser-plan-mode-confirm-undo-playwright',
      '--prefix',
      siteRoot,
    ])
  } finally {
    if (startedHere && devChild?.pid) {
      spawnSync('npm', ['run', 'dev:stop', '--prefix', siteRoot], { cwd: root, stdio: 'ignore' })
    }
  }

  console.log('\nPlan Mode Playwright UI smokes PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
