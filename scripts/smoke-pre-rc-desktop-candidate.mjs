/**
 * Pre-rc desktop functional smoke — automated checks + operator checklist log.
 * Does NOT replace human Plan Mode / offline license steps on a real session.
 *
 *   node scripts/smoke-pre-rc-desktop-candidate.mjs --platform mac
 *   node scripts/smoke-pre-rc-desktop-candidate.mjs --platform windows --verify-remote
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { resolveBrandId } from '../brands/select.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandId = resolveBrandId()
const buildDir = path.join(root, 'desktop/.build', brandId)
const version = JSON.parse(readFileSync(path.join(root, 'desktop/package.json'), 'utf8')).version

const platform =
  process.argv.find((a) => a.startsWith('--platform='))?.split('=')[1] ??
  process.argv[process.argv.indexOf('--platform') + 1] ??
  'mac'
const verifyRemote = process.argv.includes('--verify-remote')

const EXPECTED = {
  mac: {
    file: path.join(buildDir, 'release', `SuHuella-${version}.dmg`),
    sha256: null,
    report: path.join(buildDir, 'CANDIDATE-mac.json'),
  },
  windows: {
    sha256: 'b25ca4135fd600caaf1e82e4ed3ee6d38855982daa447257f781b9da81f8680e',
    size: null,
    githubSidecar:
      'https://github.com/owshq/suhuella/releases/download/v0.1.0-pre-rc/SuHuella-0.1.0-pre-rc.exe.sha256',
  },
}

function sha256File(filePath) {
  const buf = readFileSync(filePath)
  return createHash('sha256').update(buf).digest('hex')
}

function run(label, cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options })
  return { label, cmd, args, ...result }
}

function loadMacExpected() {
  if (existsSync(EXPECTED.mac.report)) {
    const report = JSON.parse(readFileSync(EXPECTED.mac.report, 'utf8'))
    EXPECTED.mac.sha256 = report.sha256
  }
  if (!EXPECTED.mac.sha256 && existsSync(EXPECTED.mac.file)) {
    EXPECTED.mac.sha256 = sha256File(EXPECTED.mac.file)
  }
}

function writeLog(entries) {
  mkdirSync(buildDir, { recursive: true })
  const logPath = path.join(buildDir, 'FUNCTIONAL-SMOKE-LOG.json')
  const payload = {
    updatedAt: new Date().toISOString(),
    version,
    platform,
    entries,
    operatorChecklist: [
      'Install exact candidate bytes (SHA256 verified below)',
      'Document Gatekeeper/SmartScreen warnings separately from real failures',
      'Activate authorized gift/test license (Operations — no Stripe)',
      'Airplane mode: paid rights persist after restart',
      'Plan Mode: temp folder, move/rename/undo; cancel leaves files unchanged; delete plan does not delete documents',
    ],
  }
  writeFileSync(logPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`\nLog: ${logPath}`)
  return logPath
}

function smokeMac() {
  loadMacExpected()
  const entries = []
  const dmg = EXPECTED.mac.file

  if (!existsSync(dmg)) {
    entries.push({ step: 'artifact-present', result: 'FAIL', detail: `Missing ${dmg}` })
    writeLog(entries)
    process.exit(1)
  }

  const digest = sha256File(dmg)
  const shaOk = digest === EXPECTED.mac.sha256
  entries.push({
    step: 'sha256-match',
    result: shaOk ? 'PASS' : 'FAIL',
    expected: EXPECTED.mac.sha256,
    observed: digest,
  })
  if (!shaOk) {
    writeLog(entries)
    process.exit(1)
  }

  const attach = run('hdiutil attach', 'hdiutil', ['attach', '-nobrowse', '-readonly', dmg])
  entries.push({
    step: 'dmg-attach',
    result: attach.status === 0 ? 'PASS' : 'FAIL',
    stdout: attach.stdout?.trim(),
    stderr: attach.stderr?.trim(),
  })
  if (attach.status !== 0) {
    writeLog(entries)
    process.exit(1)
  }

  const mountLine = attach.stdout.split('\n').find((line) => line.includes('/Volumes/'))
  const mountPath = mountLine?.split('\t').pop()?.trim() ?? ''
  const appPath = path.join(mountPath, 'SuHuella.app')
  entries.push({ step: 'mount-path', result: mountPath ? 'PASS' : 'FAIL', mountPath, appPath })

  const codesign = run('codesign verify', 'codesign', ['--verify', '--deep', '--strict', appPath])
  entries.push({
    step: 'codesign-verify',
    result: codesign.status === 0 ? 'PASS' : 'FAIL',
    note: 'adhoc expected — not Developer ID',
    stderr: codesign.stderr?.trim(),
  })

  const spctl = run('spctl assess', 'spctl', ['--assess', '--type', 'execute', appPath])
  entries.push({
    step: 'gatekeeper-spctl',
    result: spctl.status === 0 ? 'PASS' : 'EXPECTED_UNSIGNED_REJECTION',
    note: 'Gatekeeper rejection is diagnostic only on pre-rc — use Right-click → Open',
    stderr: spctl.stderr?.trim(),
  })

  const staging = mkdtempSync(path.join(tmpdir(), 'suhuella-smoke-'))
  const stagedApp = path.join(staging, 'SuHuella.app')
  run('ditto copy', 'ditto', [appPath, stagedApp])
  const launch = run('open app', 'open', ['-a', stagedApp], { timeout: 15_000 })
  entries.push({
    step: 'launch-staged-copy',
    result: launch.status === 0 ? 'PASS' : 'FAIL',
    detail: 'Launched staged copy — confirm UI in foreground manually',
    stderr: launch.stderr?.trim(),
  })

  spawnSync('pkill', ['-f', 'SuHuella.app'], { encoding: 'utf8' })
  run('hdiutil detach', 'hdiutil', ['detach', mountPath, '-quiet'])
  rmSync(staging, { recursive: true, force: true })

  const giftSmoke = run('plan-mode-gift-journey', process.execPath, [
    path.join(root, 'scripts/smoke-plan-mode-gift-journey.mjs'),
  ], { env: process.env })
  entries.push({
    step: 'plan-mode-gift-journey-automated',
    result: giftSmoke.status === 0 ? 'PASS' : 'FAIL',
    detail: 'Gift license + temp executor + Prepare Plan actions (no Stripe)',
    stderr: giftSmoke.stderr?.trim(),
  })
  if (giftSmoke.status !== 0) {
    writeLog(entries)
    process.exit(1)
  }

  entries.push({
    step: 'manual-required',
    result: 'PENDING',
    items: [
      'Install candidate on clean machine; activate Operations gift against production Worker',
      'offline-rights after restart',
      'Plan Mode confirm/undo on real indexed folder',
    ],
  })

  writeLog(entries)
  const failed = entries.some((e) => e.result === 'FAIL')
  console.log(failed ? 'Mac automated smoke FAIL' : 'Mac automated smoke PASS (manual steps still pending)')
  process.exit(failed ? 1 : 0)
}

async function smokeWindowsRemote() {
  const entries = []
  const sidecarRes = await fetch(EXPECTED.windows.githubSidecar)
  const sidecarText = await sidecarRes.text()
  const match = sidecarText.trim().match(/^([a-f0-9]{64})/i)
  const observed = match?.[1]?.toLowerCase() ?? ''
  const shaOk = observed === EXPECTED.windows.sha256
  entries.push({
    step: 'github-sidecar-sha256',
    result: shaOk ? 'PASS' : 'FAIL',
    expected: EXPECTED.windows.sha256,
    observed,
  })

  entries.push({
    step: 'manual-required-windows',
    result: 'PENDING',
    items: [
      'Install SuHuella-0.1.0-pre-rc.exe from GitHub Release or CI artifact',
      'SmartScreen warning expected — More info → Run anyway',
      'Launch, reopen, gift activation, offline, Plan Mode temp folder',
    ],
  })

  writeLog(entries)
  if (!shaOk) process.exit(1)
  console.log('Windows remote SHA256 PASS — run installer smoke on windows-latest or a Windows machine')
}

async function main() {
  console.log(`Pre-rc functional smoke (${platform})`)
  if (platform === 'mac') smokeMac()
  else if (platform === 'windows' && verifyRemote) await smokeWindowsRemote()
  else {
    console.error('Usage: --platform mac | --platform windows --verify-remote')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
