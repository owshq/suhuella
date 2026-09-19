import { app } from 'electron'
import { licenseApiBaseUrl } from './license-store.ts'
import {
  decideReleaseState,
  installerUrlForPlatform,
  type PublicRelease,
  type ReleaseDecision,
} from '@suhuella/product/lib/release-lifecycle.ts'

function emptyDecision(installed: string): ReleaseDecision {
  return decideReleaseState({
    installed,
    latest: installed,
    minimum: installed,
  })
}

function parsePublicRelease(data: unknown): PublicRelease | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const release =
    record.release && typeof record.release === 'object'
      ? (record.release as Record<string, unknown>)
      : record
  const version = typeof release.version === 'string' ? release.version.trim() : ''
  const latest = typeof release.latest === 'string' && release.latest.trim() ? release.latest.trim() : version
  const minimumVersion =
    typeof release.minimumVersion === 'string' ? release.minimumVersion.trim() : ''
  const minimum =
    typeof release.minimum === 'string' && release.minimum.trim() ? release.minimum.trim() : minimumVersion
  if (!latest) return null
  return {
    latest,
    version: version || latest,
    minimum: minimum || latest,
    minimumVersion: minimumVersion || latest,
    mandatory: release.mandatory === true,
    channel: release.channel === 'beta' ? 'beta' : 'stable',
    notes: typeof release.notes === 'string' ? release.notes : '',
    mac: typeof release.mac === 'string' ? release.mac : undefined,
    windows: typeof release.windows === 'string' ? release.windows : undefined,
  }
}

export async function checkDesktopRelease(): Promise<ReleaseDecision> {
  const installed = app.getVersion()
  try {
    const response = await fetch(`${licenseApiBaseUrl()}/api/release`, { cache: 'no-store' })
    if (!response.ok) return emptyDecision(installed)
    const parsed = parsePublicRelease(await response.json())
    if (!parsed) return { ...emptyDecision(installed), kind: 'unknown' }
    return decideReleaseState({
      installed,
      latest: parsed.latest,
      minimum: parsed.minimum,
      mandatory: parsed.mandatory,
      notes: parsed.notes,
      url: installerUrlForPlatform(parsed, process.platform),
    })
  } catch {
    return { ...emptyDecision(installed), kind: 'unknown' }
  }
}
