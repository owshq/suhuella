import {
  browserCapabilityDialogCopy,
  type BrowserLimitationPresentation,
} from './browser-capability-notice.ts'
import { productCopy } from './product-copy.ts'
import type { HostAccessCapabilities } from './platform-capabilities.ts'
import { isTechnicalSourceId, resolveSourceDisplayName } from './source-display-name.ts'
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
      args.status === 'external_drive_disconnected' ||
      args.status === 'missing' ||
      args.status === 'error'
    ) {
      return 'unavailable'
    }
    return 'indexed'
  }
  if (args.exists && args.hostCanSee) return 'available'
  return 'not_connected'
}

export function sourceUnavailableActionLabel(permissionLost: boolean): string {
  return permissionLost ? 'Restore permission' : 'Locate again'
}

function connectGrantFrom(
  access: boolean | Pick<HostAccessCapabilities, 'connectGrant'>,
): boolean {
  return typeof access === 'boolean' ? !access : access.connectGrant
}

export function sourcePickActionLabel(
  access: boolean | Pick<HostAccessCapabilities, 'connectGrant'>,
): string {
  return connectGrantFrom(access) ? 'Connect' : 'Add'
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

export function sourcesEmptyBody(
  access: boolean | Pick<HostAccessCapabilities, 'connectGrant'> = { connectGrant: false },
): string {
  return connectGrantFrom(access)
    ? productCopy('No sources yet. Connect a folder so SuHuella can see it.')
    : productCopy('No sources yet. Add a folder so SuHuella can see it.')
}

export function searchNoSourcesCopy(
  access: boolean | Pick<HostAccessCapabilities, 'connectGrant'> = { connectGrant: true },
): string {
  return connectGrantFrom(access)
    ? 'Connect a folder first.'
    : 'Add a folder first.'
}

export function searchEmptyQueryCopy(
  access: boolean | Pick<HostAccessCapabilities, 'connectGrant'>,
  sourceCount: number,
  locale: 'en' | 'es' = 'en',
): string {
  if (sourceCount === 0) return searchNoSourcesCopy(access)
  if (locale === 'es') {
    return productCopy('Escribe un nombre para buscar en tus fuentes conectadas.')
  }
  return productCopy('Type a name to search your connected sources.')
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

export function folderConnectPermissionCopy(): string {
  return productCopy('Permission was not granted. Choose the folder again so SuHuella can see it.')
}

export function folderConnectFailedCopy(): string {
  return productCopy('SuHuella could not open that folder. Choose it again, or pick a different work folder.')
}

function folderAccessErrorCode(error: unknown): string | null {
  if (error instanceof Error && 'code' in error && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code
  }
  return null
}

export function folderConnectErrorMessage(error: unknown): string | null {
  if (isFolderPickAbort(error)) return null
  if (isProtectedFolderConnectError(error)) return null
  const code = folderAccessErrorCode(error)
  if (code === 'denied') return folderConnectPermissionCopy()
  if (code === 'failed') return folderConnectFailedCopy()
  if (code === 'unavailable') {
    return 'That folder is no longer available. Choose it again if it is still on this device.'
  }
  if (error instanceof Error) {
    const text = error.message.toLowerCase()
    if (text.includes('cannot choose files') || text.includes('cannot choose documents')) {
      return 'This browser cannot choose documents.'
    }
    if (text.includes('not available in this browser') || text.includes('requires chrome or edge')) {
      return `${sourcesUnsupportedTitle()} ${sourcesUnsupportedBody()}`
    }
    if (text.includes('permission') || text.includes('not allowed') || text.includes('denied')) {
      return folderConnectPermissionCopy()
    }
    if (text.includes('no longer available') || text.includes('unavailable')) {
      return 'That folder is no longer available. Choose it again if it is still on this device.'
    }
  }
  return folderConnectFailedCopy()
}

/** Idle Add stays Add. Idle Connect stays Connect. Busy never looks like a dead button. */
export function sourceWorkingActionLabel(idle: string | null | undefined, busy?: boolean): string | null {
  if (!idle) return null
  if (!busy) return idle
  if (idle === 'Add' || idle === 'Choose another folder') return 'Adding…'
  if (idle === 'Restore permission') return 'Restoring…'
  if (idle === 'Locate again' || idle === 'Retry') return 'Trying again…'
  if (idle === 'Remove') return 'Removing…'
  return 'Connecting…'
}

export type SourceConnectWaitKind = 'picker' | 'add' | 'restore' | 'retry' | 'remove'

export function sourceConnectWaitKind(idleLabel: string, opensPicker: boolean): SourceConnectWaitKind {
  if (idleLabel === 'Restore permission') return 'restore'
  if (idleLabel === 'Locate again' || idleLabel === 'Retry') return 'retry'
  if (idleLabel === 'Remove') return 'remove'
  if (opensPicker) return 'picker'
  return 'add'
}

/** Announced wait copy. No percent — the picker and grant prompt have no known duration. */
export function sourceConnectWaitingStatus(
  workingLabel: string | null | undefined,
  kind?: SourceConnectWaitKind | null,
): string | null {
  if (!workingLabel && !kind) return null
  if (kind === 'picker') return 'Opening folder picker…'
  if (kind === 'add') return 'Adding folder…'
  if (kind === 'restore') return 'Asking for permission again.'
  if (kind === 'retry') return 'Checking this folder again.'
  if (kind === 'remove') return 'Removing this source…'
  if (workingLabel === 'Adding…' || workingLabel === 'Connecting…') return 'Opening folder picker…'
  if (workingLabel === 'Restoring…') return 'Asking for permission again.'
  if (workingLabel === 'Trying again…') return 'Checking this folder again.'
  if (workingLabel === 'Removing…') return 'Removing this source…'
  return workingLabel ?? null
}

export function sourceConnectWaitingHint(
  workingLabel: string | null | undefined,
  kind?: SourceConnectWaitKind | null,
): string | null {
  if (kind === 'restore' || kind === 'retry' || kind === 'add' || kind === 'remove') return null
  if (workingLabel === 'Adding…') {
    return productCopy('Choose a folder to add to SuHuella.')
  }
  if (workingLabel === 'Connecting…' || kind === 'picker') {
    return productCopy('Choose a folder so SuHuella can see it.')
  }
  return null
}

export function sourceRemovedCopy(
  name: string,
  access: boolean | Pick<HostAccessCapabilities, 'connectGrant'> = { connectGrant: false },
): string {
  const again = connectGrantFrom(access) ? 'Connect it again' : 'Add it again'
  return productCopy(`Removed ${sourceDisplayName(name, name)}. ${again} if you still want SuHuella to see it.`)
}

export function sourceRemoveFailedCopy(name?: string): string {
  const label = name ? sourceDisplayName(name, name) : 'that source'
  return productCopy(`SuHuella could not remove ${label}. Try again.`)
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
      body: 'Elige una carpeta de trabajo para que SuHuella pueda ver sus documentos y ayudarte a organizarlos. Tus archivos permanecen en este dispositivo. Nada se sube. Si el navegador bloquea una carpeta, descarga la aplicación de escritorio para trabajar con ella. Las funciones disponibles dependen de tu licencia.',
      note: 'Si el navegador bloquea una carpeta del sistema, elige una subcarpeta normal.',
      primary: 'Elegir carpeta',
      secondary: 'Cancelar',
    }
  }
  return {
    title: 'Connect a local folder',
    body: 'Choose a work folder so SuHuella can see its documents and help you organise them. Your files stay on this device. Nothing is uploaded. If the browser blocks a folder, download the desktop app to work with it. Available features depend on your license.',
    note: 'If the browser blocks a system folder, choose a regular subfolder.',
    primary: 'Choose folder',
    secondary: 'Cancel',
  }
}

export function browserBlockedFolderDialogCopy(locale: 'es' | 'en') {
  const copy = browserCapabilityDialogCopy('protected_folder', locale)
  return {
    title: copy.title,
    body: copy.body,
    primary: copy.primary ?? '',
    secondary: copy.secondary,
  }
}

export function presentFolderConnectError(
  error: unknown,
  host: 'browser' | 'electron' | string = 'browser',
  locale: 'es' | 'en' = 'en',
): BrowserLimitationPresentation {
  if (isFolderPickAbort(error)) return { kind: 'silent' }
  if (host !== 'browser') return { kind: 'silent' }
  const code = folderAccessErrorCode(error)
  if (code === 'denied') {
    return { kind: 'desktop_dialog', notice: browserCapabilityDialogCopy('permission_denied', locale) }
  }
  if (code === 'unsupported') {
    return { kind: 'desktop_dialog', notice: browserCapabilityDialogCopy('browser_unsupported', locale) }
  }
  if (code === 'protected' || isProtectedFolderConnectError(error)) {
    return { kind: 'desktop_dialog', notice: browserCapabilityDialogCopy('protected_folder', locale) }
  }
  if (code === 'failed' || code === 'unavailable') {
    return { kind: 'inline', message: folderConnectFailedCopy() }
  }
  if (error instanceof Error) {
    const text = error.message.toLowerCase()
    if (text.includes('not available in this browser') || text.includes('requires chrome or edge')) {
      return { kind: 'desktop_dialog', notice: browserCapabilityDialogCopy('browser_unsupported', locale) }
    }
    if (text.includes('permission') || text.includes('not allowed') || text.includes('denied')) {
      return { kind: 'desktop_dialog', notice: browserCapabilityDialogCopy('permission_denied', locale) }
    }
  }
  return { kind: 'inline', message: folderConnectFailedCopy() }
}

export function sourceDisplayName(
  name: string | undefined,
  path: string,
  isTechnicalId: (value: string) => boolean = isTechnicalSourceId,
): string {
  const last = path.split(/[/\\]/).filter(Boolean).at(-1) ?? path
  return resolveSourceDisplayName(name, isTechnicalId(last) ? undefined : last)
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

export function hostCapabilityCatalog(
  access: Pick<HostAccessCapabilities, 'connectGrant' | 'directoryCatalog' | 'limitedSystemFolders'>,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): BrowserCapabilityCard[] {
  return browserCapabilityCatalog(platform).filter((card) => {
    if (card.capability === 'limited') return access.limitedSystemFolders
    if (card.capability === 'coming_later') return access.connectGrant && !access.directoryCatalog
    return false
  })
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

export type HomeQuickConnectSource = {
  id: string
  label: string
  path: string
  connectable: boolean
  statusNote?: string
}

export function homeQuickConnectSources(
  access: Pick<HostAccessCapabilities, 'connectGrant' | 'limitedSystemFolders' | 'directoryCatalog'>,
  platform: 'darwin' | 'win32' | 'linux' | string = 'darwin',
): { visible: HomeQuickConnectSource[]; more: HomeQuickConnectSource[] } {
  if (!access.connectGrant && access.directoryCatalog) {
    const shortcuts: HomeQuickConnectSource[] = [
      { id: 'documents', label: 'Documents', path: '', connectable: true },
      { id: 'downloads', label: 'Downloads', path: '', connectable: true },
      { id: 'desktop', label: 'Desktop', path: '', connectable: true },
      { id: 'pictures', label: 'Pictures', path: '', connectable: true },
    ]
    return { visible: shortcuts.slice(0, 3), more: shortcuts.slice(3) }
  }

  const catalog = browserCapabilityCatalog(platform)
  const mapped = catalog.map((card): HomeQuickConnectSource => {
    if (card.capability === 'limited') {
      return {
        id: card.id,
        label: card.label,
        path: card.path,
        connectable: access.limitedSystemFolders,
      }
    }
    return {
      id: card.id,
      label: card.label,
      path: card.path,
      connectable: false,
      statusNote: 'Coming later',
    }
  })
  const computer = mapped.filter((item) => catalog.find((card) => card.id === item.id)?.group === 'computer')
  const cloud = mapped.filter((item) => catalog.find((card) => card.id === item.id)?.group === 'cloud')
  const connectableComputer = computer.filter((item) => item.connectable)
  return {
    visible: connectableComputer.slice(0, 3),
    more: [...connectableComputer.slice(3), ...cloud],
  }
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
  if (
    status === 'unavailable' ||
    status === 'permission_denied' ||
    status === 'external_drive_disconnected' ||
    status === 'missing' ||
    status === 'error'
  ) {
    return 'Unavailable'
  }
  return 'Indexed'
}
