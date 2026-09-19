import { productCopy } from './product-copy.ts'
import type { IndexedLocationSummary, SuggestedLocation, SuggestedLocationKind } from '../types.ts'

export type SourceSightGroup = 'computer' | 'external' | 'cloud'

export type SourceSightState =
  | 'indexed'
  | 'available'
  | 'not_connected'
  | 'unavailable'
  | 'limited'
  | 'coming_later'

export function sourceSightGroup(
  kind: SuggestedLocationKind | undefined,
  name: string,
  path: string,
): SourceSightGroup {
  const text = `${name} ${path}`.toLowerCase()
  if (kind === 'volume' || /\/volumes\/|\/media\/|^[a-z]:\\/i.test(path)) {
    if (!/users|documents and settings/i.test(text)) return 'external'
  }
  if (kind === 'cloud_folder' || /icloud|dropbox|onedrive|google drive|box|sharepoint/i.test(text)) {
    return 'cloud'
  }
  return 'computer'
}

export function sourceSightState(args: {
  included: boolean
  exists: boolean
  hostCanSee: boolean
  status?: IndexedLocationSummary['status']
}): SourceSightState {
  if (args.included) {
    if (
      !args.exists ||
      !args.hostCanSee ||
      args.status === 'unavailable' ||
      args.status === 'permission_denied' ||
      args.status === 'external_drive_disconnected'
    ) {
      return 'unavailable'
    }
    return 'indexed'
  }
  if (args.exists && args.hostCanSee) return 'available'
  return 'not_connected'
}

export function sourceUnavailableActionLabel(permissionLost: boolean): string {
  return permissionLost ? 'Restore permission' : 'Refresh'
}

export function sourcePickActionLabel(desktop: boolean): string {
  return desktop ? 'Add' : 'Connect'
}

export function sourceGrantActionLabel(): string {
  return 'Connect'
}

export function sourceAnotherFolderLabel(): string {
  return 'Choose another folder'
}

export function sourcesEmptyLead(): string {
  return 'No sources yet.'
}

export function sourcesEmptyBody(desktop = true): string {
  return desktop
    ? productCopy('No sources yet. Add a folder so SuHuella can see it.')
    : productCopy('No sources yet. Connect a folder so SuHuella can see it.')
}

export const SOURCES_PRIVACY_LINES = [
  'Your documents stay on this device.',
  'Nothing is uploaded.',
] as const

export function sourcesPrivacyCopy(): string {
  return SOURCES_PRIVACY_LINES.join(' ')
}

export function sourcesUnsupportedTitle(): string {
  return 'Folder access is not available in this browser.'
}

export function sourcesUnsupportedBody(): string {
  return 'Use Chrome or Edge, or download the desktop app.'
}

export function sourcesLimitedSupportCopy(): string {
  return productCopy('This browser can open a folder so SuHuella can see it, but it cannot move or rename documents. Use Chrome or Edge, or download the desktop app.')
}

export function isFolderPickAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export function isProtectedFolderConnectError(error: unknown): boolean {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase()
  const name = error instanceof Error ? error.name.toLowerCase() : ''
  return (
    (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'protected') ||
    name === 'securityerror' ||
    text.includes('system file') ||
    text.includes('contains system') ||
    text.includes("can't open this folder") ||
    text.includes('cannot open this folder') ||
    text.includes('no se puede abrir esta carpeta') ||
    text.includes('not available in this browser') ||
    text.includes('not allowed to access')
  )
}

export function folderConnectErrorMessage(error: unknown): string | null {
  if (isFolderPickAbort(error)) return null
  if (isProtectedFolderConnectError(error)) return null
  if (error instanceof Error) {
    const text = error.message.toLowerCase()
    if (text.includes('cannot choose files') || text.includes('cannot choose documents')) {
      return 'This browser cannot choose documents.'
    }
    if (text.includes('not available in this browser') || text.includes('requires chrome or edge')) {
      return `${sourcesUnsupportedTitle()} ${sourcesUnsupportedBody()}`
    }
    if (text.includes('permission') || text.includes('not allowed') || text.includes('denied')) {
      return null
    }
    if (text.includes('no longer available') || text.includes('unavailable')) {
      return 'That folder is no longer available. Choose it again if it is still on this device.'
    }
  }
  return `${productCopy('SuHuella could not open that folder.')} ${sourcesUnsupportedBody()}`
}

export function browserLocalFoldersLabel(locale: 'es' | 'en'): string {
  return locale === 'es' ? 'Local' : 'Local'
}

export function browserConnectFolderLabel(locale: 'es' | 'en'): string {
  return locale === 'es' ? 'Conectar carpeta' : 'Connect folder'
}

export function browserIntegrationsActionLabel(locale: 'es' | 'en'): string {
  return locale === 'es' ? 'Integraciones' : 'Integrations'
}

export function browserConnectFolderHint(locale: 'es' | 'en'): string {
  return locale === 'es'
    ? 'Elige una carpeta de trabajo o una subcarpeta. Tus archivos permanecen en este dispositivo.'
    : 'Choose a work folder or subfolder. Your files stay on this device.'
}

export function browserConnectFolderNote(locale: 'es' | 'en'): string {
  return locale === 'es'
    ? 'Algunas carpetas del sistema pueden estar protegidas por el navegador.'
    : 'Some system folders may be protected by the browser.'
}

export function browserConnectDialogCopy(locale: 'es' | 'en') {
  if (locale === 'es') {
    return {
      title: 'Conecta una carpeta local',
      body: 'Elige una carpeta de trabajo para que SuHuella pueda aprender de sus nombres y ayudarte a organizar documentos. Tus archivos permanecen en este dispositivo. Nada se sube. Para usar todas las funciones, descarga la app de escritorio.',
      note: 'Si el navegador bloquea una carpeta del sistema, elige una subcarpeta normal.',
      primary: 'Elegir carpeta',
      secondary: 'Cancelar',
    }
  }
  return {
    title: 'Connect a local folder',
    body: 'Choose a work folder so SuHuella can learn from its names and help you organise documents. Your files stay on this device. Nothing is uploaded. To use every function, download the desktop app.',
    note: 'If the browser blocks a system folder, choose a regular subfolder.',
    primary: 'Choose folder',
    secondary: 'Cancel',
  }
}

export function browserBlockedFolderDialogCopy(locale: 'es' | 'en') {
  if (locale === 'es') {
    return {
      title: 'Esta carpeta no está disponible en este navegador',
      body: 'El navegador no puede usar esa carpeta. Elige una carpeta de trabajo o una subcarpeta. Tus archivos permanecen en este dispositivo. Para usar todas las funciones, descarga la app de escritorio.',
      primary: 'Elegir otra carpeta',
      secondary: 'Cancelar',
    }
  }
  return {
    title: 'This folder is not available in this browser',
    body: 'The browser cannot use that folder. Choose a regular work folder or a subfolder. Your files stay on this device. To use every function, download the desktop app.',
    primary: 'Choose another folder',
    secondary: 'Cancel',
  }
}

export function sourceDisplayName(
  name: string | undefined,
  path: string,
  isTechnicalId: (value: string) => boolean,
): string {
  const visible = name?.trim()
  if (visible && !isTechnicalId(visible)) return visible
  const last = path.split(/[/\\]/).filter(Boolean).at(-1) ?? path
  if (last && !isTechnicalId(last)) return last
  return 'Folder'
}

export function sourceSightLabel(state: SourceSightState, scanning?: boolean): string {
  if (scanning && state === 'indexed') return 'Indexed'
  if (state === 'indexed') return 'Indexed'
  if (state === 'available') return 'Available'
  if (state === 'unavailable') return 'Unavailable'
  if (state === 'limited') return 'Limited in browser'
  if (state === 'coming_later') return 'Coming later'
  return 'Not connected'
}

export function sourcesWhatCanSeeCopy(locale: 'es' | 'en'): string {
  return locale === 'es' ? 'Qué puede ver SuHuella.' : productCopy('What SuHuella can see.')
}

export function browserSystemFoldersLabel(locale: 'es' | 'en'): string {
  return locale === 'es' ? 'Carpetas del sistema' : 'System folders'
}

export function browserSystemFolderHint(locale: 'es' | 'en'): string {
  return locale === 'es'
    ? 'El navegador puede bloquear algunas carpetas del sistema. Elige una subcarpeta normal dentro de Documentos o Descargas.'
    : 'The browser may block some system folders. Choose a regular subfolder inside Documents or Downloads.'
}

export function browserChooseSubfolderLabel(locale: 'es' | 'en'): string {
  return locale === 'es' ? 'Elegir subcarpeta' : 'Choose subfolder'
}

export function browserCloudComingLaterCopy(locale: 'es' | 'en'): string {
  return locale === 'es'
    ? 'Las fuentes en la nube no están disponibles en esta vista previa.'
    : 'Cloud sources are not available in this preview.'
}

export type BrowserCatalogCapability = 'limited' | 'coming_later'

export type BrowserCapabilityCard = {
  id: string
  label: string
  path: string
  kind: SuggestedLocationKind
  group: SourceSightGroup
  capability: BrowserCatalogCapability
}

export function browserCapabilityCatalog(
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): BrowserCapabilityCard[] {
  const system: BrowserCapabilityCard[] = [
    { id: 'documents', label: 'Documents', path: 'suhuella:documents', kind: 'user_folder', group: 'computer', capability: 'limited' },
    { id: 'downloads', label: 'Downloads', path: 'suhuella:downloads', kind: 'user_folder', group: 'computer', capability: 'limited' },
    { id: 'desktop', label: 'Desktop', path: 'suhuella:desktop', kind: 'user_folder', group: 'computer', capability: 'limited' },
    { id: 'pictures', label: 'Pictures', path: 'suhuella:pictures', kind: 'user_folder', group: 'computer', capability: 'limited' },
  ]
  const cloud: BrowserCapabilityCard[] = [
    ...(platform === 'darwin'
      ? [{
          id: 'icloud',
          label: 'iCloud Drive',
          path: 'suhuella:icloud',
          kind: 'cloud_folder' as const,
          group: 'cloud' as const,
          capability: 'coming_later' as const,
        }]
      : []),
    { id: 'google_drive', label: 'Google Drive', path: 'suhuella:google-drive', kind: 'cloud_folder', group: 'cloud', capability: 'coming_later' },
    { id: 'onedrive', label: 'OneDrive', path: 'suhuella:onedrive', kind: 'cloud_folder', group: 'cloud', capability: 'coming_later' },
    { id: 'dropbox', label: 'Dropbox', path: 'suhuella:dropbox', kind: 'cloud_folder', group: 'cloud', capability: 'coming_later' },
  ]
  return [...system, ...cloud]
}

export function sourceKindHint(source: Pick<SuggestedLocation, 'kind' | 'label' | 'path'>): string | null {
  if (source.kind === 'volume') return 'External drive'
  if (source.kind === 'cloud_folder') return 'Cloud folder'
  const text = `${source.label} ${source.path}`.toLowerCase()
  if (/dropbox|onedrive|google drive|icloud|cloudstorage/.test(text)) return 'Cloud folder'
  return null
}

export function subtleStatusLabel(
  status: IndexedLocationSummary['status'],
  scanning: boolean,
): string | null {
  if (scanning && (status === 'ready' || status === 'needs_refresh' || status === 'indexing')) return 'Updating…'
  if (status === 'indexing') return 'Updating…'
  if (status === 'needs_refresh') return 'Needs refresh'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'permission_denied') return 'Needs permission'
  if (status === 'external_drive_disconnected') return 'Unavailable'
  if (status === 'ready') return 'Indexed'
  return null
}

export function formatDocumentCount(count: number): string {
  return `${count.toLocaleString()} document${count === 1 ? '' : 's'}`
}

export function lastUpdatedCopy(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date >= today) return 'Last updated today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date >= yesterday) return 'Last updated yesterday'
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays < 7) return `Last updated ${diffDays} days ago`
  return `Last updated ${date.toLocaleDateString()}`
}

export function includedStatusLabel(
  status: IndexedLocationSummary['status'],
  scanning: boolean,
): string {
  if (scanning && (status === 'ready' || status === 'needs_refresh' || status === 'indexing')) {
    return 'Indexed'
  }
  if (status === 'indexing') return 'Indexed'
  if (status === 'needs_refresh') return 'Indexed'
  if (status === 'unavailable' || status === 'permission_denied' || status === 'external_drive_disconnected') {
    return 'Unavailable'
  }
  return 'Indexed'
}
