import type { IndexedLocationSummary } from '../types.ts'

export type HomeOrganiseLocation = Pick<
  IndexedLocationSummary,
  'path' | 'name' | 'fileCount' | 'status' | 'exists'
> & {
  capabilities?: IndexedLocationSummary['capabilities']
  presentation?: IndexedLocationSummary['presentation']
}

export type HomeOrganiseOpportunity = {
  line: string
  actionLabel: string
  scopeName: string | null
}

const BLOCKED_HOME_SCOPE = new Set<IndexedLocationSummary['status']>([
  'unavailable',
  'permission_denied',
  'missing',
  'error',
  'external_drive_disconnected',
])

export function homeOrganiseScope(locations: HomeOrganiseLocation[]): HomeOrganiseLocation | null {
  const ready = locations.filter((location) => {
    if (location.fileCount <= 0 || location.exists === false) return false
    if (BLOCKED_HOME_SCOPE.has(location.status)) return false
    const organisable = location.presentation?.capabilities.organisable ?? location.capabilities?.organisable
    return organisable !== false
  })
  return ready.length === 1 ? ready[0] ?? null : null
}

export function homeOrganiseOpportunity(
  fileCount: number,
  scopeName?: string | null,
): HomeOrganiseOpportunity | null {
  if (fileCount <= 0) return null
  const line = scopeName
    ? fileCount === 1
      ? `1 document in ${scopeName} looks ready for a Plan`
      : `${fileCount.toLocaleString()} documents in ${scopeName} look ready for a Plan`
    : fileCount === 1
      ? '1 document looks ready for a Plan'
      : `${fileCount.toLocaleString()} documents look ready for a Plan`
  return {
    line,
    actionLabel: scopeName ? `Plan ${scopeName}` : 'Plan documents',
    scopeName: scopeName ?? null,
  }
}

export function homeOrganiseActionLabel(fileCount: number, scopeName?: string | null): string | null {
  return homeOrganiseOpportunity(fileCount, scopeName)?.line ?? null
}
