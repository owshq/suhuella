export type ReleaseChannel = 'stable' | 'beta'

export type PublicRelease = {
  latest: string
  version: string
  minimum: string
  minimumVersion: string
  mandatory: boolean
  channel: ReleaseChannel
  notes: string
  mac?: string
  windows?: string
}

export type ReleaseDecisionKind =
  | 'current'
  | 'update_available'
  | 'update_mandatory'
  | 'downgrade_blocked'
  | 'unknown'

export type ReleaseDecision = {
  kind: ReleaseDecisionKind
  installed: string
  latest: string
  minimum: string
  notes: string
  url: string | null
  canInstall: boolean
}

export type ParsedAppVersion = {
  major: number
  minor: number
  patch: number
  prerelease: string
}

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

export function parseAppVersion(value: string): ParsedAppVersion | null {
  const match = VERSION_RE.exec(value.trim())
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? '',
  }
}

/** Negative if a < b, 0 if equal, positive if a > b. Pre-release is older than the same numbers. */
export function compareAppVersions(left: string, right: string): number | null {
  const a = parseAppVersion(left)
  const b = parseAppVersion(right)
  if (!a || !b) return null
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (!a.prerelease && !b.prerelease) return 0
  if (!a.prerelease) return 1
  if (!b.prerelease) return -1
  return a.prerelease.localeCompare(b.prerelease)
}

export function installerUrlForPlatform(
  release: Pick<PublicRelease, 'mac' | 'windows'>,
  platform: 'darwin' | 'win32' | 'linux' | string,
): string | null {
  if (platform === 'darwin') return release.mac?.trim() || null
  if (platform === 'win32') return release.windows?.trim() || null
  return null
}

export function decideReleaseState(input: {
  installed: string
  latest: string
  minimum: string
  mandatory?: boolean
  notes?: string
  url?: string | null
}): ReleaseDecision {
  const installed = input.installed.trim()
  const latest = input.latest.trim()
  const minimum = input.minimum.trim() || latest
  const notes = input.notes?.trim() ?? ''
  const url = input.url?.trim() || null
  const canInstall = Boolean(url)
  const vsLatest = compareAppVersions(installed, latest)
  const vsMinimum = compareAppVersions(installed, minimum)

  if (vsLatest === null || vsMinimum === null) {
    return { kind: 'unknown', installed, latest, minimum, notes, url, canInstall }
  }
  if (vsLatest === 0) {
    return { kind: 'current', installed, latest, minimum, notes, url, canInstall }
  }
  if (vsLatest > 0) {
    return { kind: 'downgrade_blocked', installed, latest, minimum, notes, url, canInstall: false }
  }

  const mustUpdate = vsMinimum < 0 || input.mandatory === true
  return {
    kind: mustUpdate ? 'update_mandatory' : 'update_available',
    installed,
    latest,
    minimum,
    notes,
    url,
    canInstall,
  }
}

export function publicReleaseAliases(release: {
  version: string
  channel: ReleaseChannel
  minimumVersion: string
  mandatory: boolean
  notes?: string
  windows?: string
  mac?: string
}): Pick<PublicRelease, 'latest' | 'version' | 'minimum' | 'minimumVersion' | 'mandatory' | 'channel' | 'notes'> {
  return {
    latest: release.version,
    version: release.version,
    minimum: release.minimumVersion,
    minimumVersion: release.minimumVersion,
    mandatory: release.mandatory,
    channel: release.channel,
    notes: release.notes?.trim() ?? '',
  }
}
