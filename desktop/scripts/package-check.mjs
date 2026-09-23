import { constants } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandIdentity, brandReleasePath, resolveBrandId } from '../../brands/select.mjs'

import { spawnSync } from 'node:child_process'

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(desktopRoot, '..')

const releaseGate = spawnSync(process.execPath, ['brands/run-release-gate.mjs'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
})
if (releaseGate.status !== 0) {
  process.exit(releaseGate.status ?? 1)
}
const requireMac = process.argv.includes('--require-mac')
const requireWin = process.argv.includes('--require-win')
const brandId = resolveBrandId()
const identity = brandIdentity(brandId)
const generatedConfigPath = path.join(desktopRoot, '.build', brandId, 'electron-builder.json')

const errors = []
const notes = []

function fail(message) {
  errors.push(message)
}

function note(message) {
  notes.push(message)
}

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function expectedWindowsName(version) {
  return `${identity.desktopProductName}-${version}.exe`
}

function expectedMacName(version) {
  return `${identity.desktopProductName}-${version}.dmg`
}

function urlFileName(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return ''
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) ?? '')
  } catch {
    return ''
  }
}

const packageJson = await readJson(path.join(desktopRoot, 'package.json'))
const manifest = await readJson(brandReleasePath(brandId))
const version = typeof packageJson.version === 'string' ? packageJson.version.trim() : ''

if (!version) {
  fail('desktop/package.json is missing version.')
}

if (!process.env.SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS?.trim()) {
  if (process.env.SUHUELLA_DESKTOP_CI === '1') {
    console.warn(
      '[package-check] SUHUELLA_DESKTOP_CI: building without SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS — offline Ed25519 verify will fail in this artifact',
    )
  } else {
    fail(
      'SUHUELLA_LICENSE_VERIFY_PUBLIC_KEYS must be set for release builds (comma-separated Ed25519 SPKI public keys).',
    )
  }
}

if (manifest.brandId && manifest.brandId !== brandId) {
  fail(`brands/${brandId}/release.json brandId must be ${brandId}.`)
}

if (manifest.version !== version) {
  fail(`brands/${brandId}/release.json version ${manifest.version} must match desktop ${version}.`)
}

if (manifest.minimumVersion !== version) {
  fail(`brands/${brandId}/release.json minimumVersion ${manifest.minimumVersion} must match desktop ${version}.`)
}

if (manifest.channel !== 'stable' && manifest.channel !== 'beta') {
  fail(`release channel must be stable or beta, got ${manifest.channel}.`)
}

const expectedWin = expectedWindowsName(version)
const expectedMac = expectedMacName(version)

function checkInstallerUrl(label, url, expectedName) {
  const trimmed = typeof url === 'string' ? url.trim() : ''
  if (!trimmed) {
    note(`release ${label} URL is empty — upload is still operational.`)
    return
  }
  const fileName = urlFileName(trimmed)
  if (!fileName) {
    fail(`release ${label} URL must be a valid https URL ending with ${expectedName}.`)
    return
  }
  if (fileName !== expectedName) {
    fail(`release ${label} URL must end with ${expectedName}, got ${fileName}.`)
  }
}

checkInstallerUrl('windows', manifest.windows, expectedWin)
checkInstallerUrl('mac', manifest.mac, expectedMac)

const { writeElectronBuilderConfig } = await import('./brand-build.mjs')
await writeElectronBuilderConfig(brandId)

if (await exists(generatedConfigPath)) {
  const generated = await readJson(generatedConfigPath)
  if (generated.appId !== identity.desktopAppId) {
    fail(`generated electron-builder appId must be ${identity.desktopAppId}.`)
  }
  if (generated.productName !== identity.desktopProductName) {
    fail(`generated electron-builder productName must be ${identity.desktopProductName}.`)
  }
  if (generated.protocols?.[0]?.schemes?.[0] !== identity.desktopProtocol) {
    fail(`generated electron-builder protocol must be ${identity.desktopProtocol}.`)
  }
  if (generated.mac?.extendInfo?.CFBundleIdentifier !== identity.desktopAppId) {
    fail(`generated mac.extendInfo.CFBundleIdentifier must be ${identity.desktopAppId}.`)
  }
  if (!String(generated.afterPack ?? '').includes('sign-mac-app')) {
    fail('generated afterPack must sign the Mac app (sign-mac-app.cjs).')
  }
  if (!String(generated.afterSign ?? '').includes('notarize')) {
    fail('generated afterSign must notarize when Developer ID credentials exist.')
  }
} else {
  note(`generated ${path.relative(desktopRoot, generatedConfigPath)} missing — run npm run build before package.`)
}

note(
  `desktop/package.json Brand fields are compatibility leftovers. Packaging authority is BrandConfig/${brandId}.`,
)

const macArtifact = path.join(desktopRoot, '.build', brandId, 'release', expectedMac)
const winArtifact = path.join(desktopRoot, '.build', brandId, 'release', expectedWin)

if (await exists(macArtifact)) {
  const info = await stat(macArtifact)
  note(`local macOS installer present: ${macArtifact} (${info.size} bytes)`)
} else {
  note(`local macOS installer missing: ${macArtifact}`)
  if (requireMac) fail(`package:mac has not produced ${expectedMac} on this machine.`)
}

if (await exists(winArtifact)) {
  const info = await stat(winArtifact)
  note(`local Windows installer present: ${winArtifact} (${info.size} bytes)`)
} else {
  note(`local Windows installer missing: ${winArtifact}`)
  if (requireWin) fail(`package:win has not produced ${expectedWin} on this machine.`)
}

if (process.platform === 'win32') {
  const helper = path.join(desktopRoot, 'native', 'win-save-watcher', 'publish', 'SuhuellaSaveWatcher.exe')
  if (!(await exists(helper))) {
    note('Windows helper is not published yet. package:win will compile it.')
  }
} else {
  note('Windows .exe is blocked on this machine. Run npm run package:win on Windows with the .NET SDK.')
}

if (process.platform !== 'darwin' && requireMac) fail('package:mac must be run on macOS.')
if (process.platform !== 'win32' && requireWin) fail('package:win must be run on Windows.')

for (const line of notes) {
  console.log(`[${brandId}] ${line}`)
}

if (errors.length > 0) {
  for (const line of errors) {
    console.error(`[${brandId}] package:check failed: ${line}`)
  }
  process.exit(1)
}

console.log(`[${brandId}] package:check passed for ${version}.`)
