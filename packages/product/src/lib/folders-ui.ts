import { productCopy } from './product-copy.ts'
import type { FoldersKnowledgeQuality, IndexedLocationStatus, LocationUsefulness } from '../types.ts'

export function thisComputerLabel(platform: 'darwin' | 'win32' | 'linux' | string): string {
  if (platform === 'darwin') return 'This Mac'
  if (platform === 'win32') return 'This PC'
  return 'This computer'
}

import { isGenericDeviceName } from './device-identity.ts'

export function displayComputerName(options: {
  osName?: string | null
  licenseName?: string | null
  platform?: 'darwin' | 'win32' | 'linux' | string
}): string {
  const licenseName = options.licenseName?.trim()
  if (licenseName && !isGenericDeviceName(licenseName)) return licenseName
  const osName = options.osName?.trim()
  if (osName && !isGenericDeviceName(osName)) return osName
  return thisComputerLabel(options.platform ?? 'darwin')
}

export function formatLearnedAgo(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const ms = Date.now() - date.getTime()
  if (ms < 45_000) return 'just now'
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min ago`
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date >= today) {
    const hours = Math.max(1, Math.round(ms / 3_600_000))
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date >= yesterday) return 'yesterday'
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export function formatLastUpdated(iso: string | null): string {
  if (!iso) return 'Not yet'
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date >= today) {
    return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date >= yesterday) return 'Yesterday'
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export function formatDayLabel(iso: string | null): string {
  if (!iso) return 'Not yet'
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date >= today) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date >= yesterday) return 'Yesterday'
  return date.toLocaleDateString()
}

export function statusLabel(status: IndexedLocationStatus): string {
  switch (status) {
    case 'indexing':
      return 'Indexing'
    case 'needs_refresh':
      return 'Needs refresh'
    case 'unavailable':
      return 'Unavailable'
    case 'permission_denied':
      return 'Needs permission'
    case 'external_drive_disconnected':
      return 'Drive disconnected'
    case 'cancelled':
      return 'Cancelled'
    case 'not_indexed':
      return 'Not ready yet'
    default:
      return 'Indexed'
  }
}

export function usefulnessLabel(usefulness: LocationUsefulness): string {
  switch (usefulness) {
    case 'very_useful':
      return 'Learning well'
    case 'useful':
      return 'Learning'
    case 'rarely_used':
      return 'Light learning'
    default:
      return 'Not learned yet'
  }
}

export function qualityLabel(quality: FoldersKnowledgeQuality): string {
  switch (quality) {
    case 'excellent':
      return 'Excellent'
    case 'good':
      return 'Good'
    case 'learning':
      return 'Learning'
    default:
      return 'Needs more folders'
  }
}

export function learningStatusLabel(
  quality: FoldersKnowledgeQuality | null,
  scanning: boolean,
): string {
  if (scanning) return 'Learning in progress'
  if (!quality || quality === 'needs_more' || quality === 'learning') return 'Learning in progress'
  return 'Excellent'
}

export function isHealthyStatus(status: IndexedLocationStatus): boolean {
  return status === 'ready' || status === 'needs_refresh' || status === 'indexing'
}

/** Connectors and mail — same learning contract when they ship. */
export const COMING_LATER_SOURCES = [
  { id: 'google_drive', label: 'Google Drive' },
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'onedrive', label: 'OneDrive' },
  { id: 'sharepoint', label: 'SharePoint' },
  { id: 'nas', label: 'NAS' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'gmail', label: 'Gmail' },
] as const

/** @deprecated Use COMING_LATER_SOURCES */
export const CLOUD_SOURCES_LATER = COMING_LATER_SOURCES.filter((source) =>
  ['google_drive', 'dropbox', 'onedrive', 'gmail', 'outlook'].includes(source.id),
)

/** @deprecated Use COMING_LATER_SOURCES */
export const NETWORK_SOURCES_LATER = COMING_LATER_SOURCES.filter((source) =>
  ['sharepoint', 'nas'].includes(source.id),
)

export const FUTURE_SOURCES = COMING_LATER_SOURCES

export const WHY_FOLDER_STEPS = [
  { id: 'choose', label: 'You choose folders' },
  { id: 'learn', label: productCopy('SuHuella learns') },
  { id: 'document', label: 'New document' },
  { id: 'recommend', label: 'Recommendation' },
  { id: 'control', label: 'You stay in control' },
] as const
