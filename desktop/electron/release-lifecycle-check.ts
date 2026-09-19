import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareAppVersions,
  decideReleaseState,
  installerUrlForPlatform,
  parseAppVersion,
  publicReleaseAliases,
} from '../src/lib/release-lifecycle.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function run(): void {
  assert(parseAppVersion('0.1.0-pre-rc')?.prerelease === 'pre-rc', 'parses pre-rc')
  assert(parseAppVersion('0.2.1')?.patch === 1, 'parses release')
  assert(parseAppVersion('latest') === null, 'rejects aliases that are not versions')

  assert(compareAppVersions('0.1.0-pre-rc', '0.1.0-pre-rc') === 0, 'same version is equal')
  assert((compareAppVersions('0.1.0-pre-rc', '0.1.0') ?? 0) < 0, 'pre-rc is older than 0.1.0')
  assert((compareAppVersions('0.1.0', '0.1.1') ?? 0) < 0, '0.1.0 is older than 0.1.1')
  assert((compareAppVersions('0.2.0', '0.1.1') ?? 0) > 0, '0.2.0 is newer than 0.1.1')

  const current = decideReleaseState({
    installed: '0.1.0-pre-rc',
    latest: '0.1.0-pre-rc',
    minimum: '0.1.0-pre-rc',
  })
  assert(current.kind === 'current', 'same published version is current')
  assert(current.canInstall === false, 'current without URL cannot install')

  const available = decideReleaseState({
    installed: '0.1.0-pre-rc',
    latest: '0.1.1',
    minimum: '0.1.0-pre-rc',
    url: 'https://downloads.example.com/SuHuella-0.1.1.dmg',
  })
  assert(available.kind === 'update_available', 'newer latest offers update')
  assert(available.canInstall === true, 'https URL can install')

  const mandatoryFloor = decideReleaseState({
    installed: '0.1.0-pre-rc',
    latest: '0.2.0',
    minimum: '0.2.0',
    url: 'https://downloads.example.com/SuHuella-0.2.0.dmg',
  })
  assert(mandatoryFloor.kind === 'update_mandatory', 'installed below minimum is mandatory')

  const mandatoryFlag = decideReleaseState({
    installed: '0.1.0-pre-rc',
    latest: '0.1.1',
    minimum: '0.1.0-pre-rc',
    mandatory: true,
    url: 'https://downloads.example.com/SuHuella-0.1.1.dmg',
  })
  assert(mandatoryFlag.kind === 'update_mandatory', 'mandatory flag forces update')

  const noUrl = decideReleaseState({
    installed: '0.1.0-pre-rc',
    latest: '0.1.1',
    minimum: '0.1.0-pre-rc',
  })
  assert(noUrl.kind === 'update_available', 'newer version is still an update without a URL')
  assert(noUrl.canInstall === false, 'no installer URL means no install action')

  const downgrade = decideReleaseState({
    installed: '0.2.0',
    latest: '0.1.1',
    minimum: '0.1.0',
    url: 'https://downloads.example.com/SuHuella-0.1.1.dmg',
  })
  assert(downgrade.kind === 'downgrade_blocked', 'older published release does not downgrade')
  assert(downgrade.canInstall === false, 'downgrade never installs')

  assert(installerUrlForPlatform({ mac: 'https://x/a.dmg' }, 'darwin') === 'https://x/a.dmg', 'mac url')
  assert(installerUrlForPlatform({ windows: 'https://x/a.exe' }, 'win32') === 'https://x/a.exe', 'windows url')
  assert(installerUrlForPlatform({ mac: 'https://x/a.dmg' }, 'win32') === null, 'wrong platform has no url')

  const aliases = publicReleaseAliases({
    version: '0.1.0-pre-rc',
    channel: 'stable',
    minimumVersion: '0.1.0-pre-rc',
    mandatory: false,
  })
  assert(aliases.latest === aliases.version, 'latest aliases version')
  assert(aliases.minimum === aliases.minimumVersion, 'minimum aliases minimumVersion')
  assert(aliases.notes === '', 'notes default empty')

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
  const storage = readFileSync(path.join(root, 'storage-paths.ts'), 'utf8')
  const licenseStore = readFileSync(path.join(root, 'license-store.ts'), 'utf8')
  assert(storage.includes('userDataDir'), 'app data layout is under userData')
  assert(!storage.includes('app.getAppPath()'), 'app data is not inside the app bundle')
  assert(licenseStore.includes("app.getPath('userData')"), 'license lives in userData')

  console.log('RELEASE-LIFECYCLE-001 kernel check passed')
}

run()
