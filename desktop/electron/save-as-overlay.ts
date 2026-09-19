import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  ConfidenceLabel,
  FileFamily,
  FileProfile,
  RecommendedFolder,
  SaveAsAssistantState,
  SaveAsComingLater,
  SaveAsDestination,
  SaveAsDocumentView,
  SaveAsMatchLabel,
  SuggestedLocation,
  SuggestionMode,
  SuggestionPayload,
} from '@suhuella/product/types.ts'
import { applyBrandPresentation } from '@suhuella/brand'
import { fileTypeLabel, prettyToken } from '@suhuella/product/lib/save-as-copy.ts'

const MAX_LEARNED = 5
const MAX_AVAILABLE = 6
const EXCLUDED_PLACE_IDS = new Set(['public', 'applications'])
const CLOUD_CONNECTORS: Array<{ id: string; label: string; aliases: string[] }> = [
  { id: 'google_drive', label: 'Google Drive', aliases: ['google drive', 'googledrive'] },
  { id: 'dropbox', label: 'Dropbox', aliases: ['dropbox'] },
  { id: 'onedrive', label: 'OneDrive', aliases: ['onedrive'] },
  { id: 'gmail', label: 'Gmail', aliases: ['gmail'] },
  { id: 'outlook', label: 'Outlook', aliases: ['outlook'] },
]

export type SaveAsOverlayInput = {
  fileName: string
  sourceApp: string
  currentFolder: string
  mode: SuggestionMode
  extension?: string
  recommendations: RecommendedFolder[]
  profile?: Pick<
    FileProfile,
    'fileFamily' | 'documentHints' | 'entities' | 'dates' | 'languageHints' | 'tokens' | 'extension'
  >
  availableLocations: SuggestedLocation[]
  indexedLocations: string[]
  learnedFolderCount: number
  homeDir?: string
}

function normalizePath(value: string): string {
  return path.normalize(value.trim()).replace(/[\\/]+$/, '')
}

function samePath(left: string, right: string): boolean {
  return normalizePath(left).toLowerCase() === normalizePath(right).toLowerCase()
}

function pathKey(value: string): string {
  return normalizePath(value).toLowerCase()
}

export function isSystemSavePath(folderPath: string): boolean {
  const normalized = folderPath.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  if (!normalized || normalized === '/') return true
  const unixRoots = ['/system', '/library', '/private', '/usr', '/bin', '/sbin']
  if (unixRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`))) return true
  if (/^[a-z]:\/windows(\/|$)/.test(normalized)) return true
  if (/^[a-z]:\/program files( \(x86\))?(\/|$)/.test(normalized)) return true
  return normalized.split('/').includes('node_modules')
}

function displayPath(folderPath: string, homeDir: string): string {
  const home = homeDir ? normalizePath(homeDir) : ''
  const normalized = normalizePath(folderPath)
  if (home && (samePath(normalized, home) || normalized.toLowerCase().startsWith(`${home.toLowerCase()}${path.sep}`))) {
    const relative = normalized.slice(home.length).replace(/\\/g, '/')
    return relative ? `~${relative}` : '~'
  }
  return normalized.replace(/\\/g, '/')
}

function destinationName(folderPath: string, fallback: string): string {
  const segments = folderPath.split(/[/\\]+/).filter(Boolean)
  if (segments.length === 0) return fallback
  if (segments.length === 1) return segments[0]
  const last = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  const grandparent = segments[segments.length - 3]
  if (parent && ['users', 'home'].includes(parent.toLowerCase())) return last
  if (grandparent && ['users', 'home'].includes(grandparent.toLowerCase())) {
    return last
  }
  if (parent && last) return `${parent} / ${last}`
  return last || fallback
}

function productMatchLabel(label: ConfidenceLabel): SaveAsMatchLabel {
  if (label === 'Weak match') return 'Possible match'
  return label
}

function isIndexed(folderPath: string, indexedLocations: string[]): boolean {
  const key = pathKey(folderPath)
  return indexedLocations.some((location) => {
    const root = pathKey(location)
    return key === root || key.startsWith(`${root}${path.sep}`)
  })
}

export function availableSavePlaces(locations: SuggestedLocation[]): SuggestedLocation[] {
  return locations.filter((location) => {
    if (!location.exists) return false
    if (EXCLUDED_PLACE_IDS.has(location.id)) return false
    if (isSystemSavePath(location.path)) return false
    return true
  })
}

function starterPlaceIds(fileFamily: FileFamily | undefined): string[] {
  if (fileFamily === 'image') return ['pictures', 'documents', 'desktop', 'downloads']
  if (fileFamily === 'video') return ['movies', 'videos', 'documents', 'desktop', 'downloads']
  if (fileFamily === 'audio') return ['music', 'documents', 'desktop', 'downloads']
  return ['documents', 'desktop', 'downloads', 'pictures']
}

function sourceAppLabel(sourceApp: string): string {
  const trimmed = sourceApp.trim()
  return trimmed || 'Unknown'
}

function languageLabel(hints: string[]): string | null {
  const hint = hints.find(Boolean)
  if (!hint) return null
  const lower = hint.toLowerCase()
  if (lower.startsWith('en')) return 'English'
  if (lower.startsWith('es') || lower === 'spanish') return 'Spanish'
  if (lower.startsWith('ca') || lower === 'catalan') return 'Catalan'
  return prettyToken(hint)
}

export function buildSaveAsDocumentView(input: SaveAsOverlayInput): SaveAsDocumentView {
  const extension =
    input.extension?.replace(/^\./, '') ||
    input.profile?.extension ||
    input.fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ||
    null
  const looksLike = (input.profile?.documentHints ?? []).slice(0, 3).map(prettyToken)
  const detected = [
    ...(input.profile?.entities ?? []).slice(0, 3),
    ...(input.profile?.dates ?? []).slice(0, 2),
  ].map((item) => (item === item.toUpperCase() ? item : prettyToken(item)))
  const simulatedCurrent =
    input.currentFolder === 'Current folder — simulated Save As location' ? '' : input.currentFolder.trim()

  return {
    fileName: input.fileName.trim(),
    extension,
    typeLabel: fileTypeLabel(extension, input.profile?.fileFamily),
    sourceApp: input.sourceApp.trim() ? sourceAppLabel(input.sourceApp) : '',
    currentFolder: simulatedCurrent,
    currentFolderLabel: simulatedCurrent
      ? destinationName(simulatedCurrent, path.basename(simulatedCurrent))
      : '',
    looksLike,
    detected,
    language: languageLabel(input.profile?.languageHints ?? []),
  }
}

function learnedDestination(item: RecommendedFolder, indexedLocations: string[]): SaveAsDestination {
  const reasons = item.reasons.filter(Boolean)
  return {
    id: `learned:${pathKey(item.folder)}`,
    folder: item.folder,
    label: item.label,
    pathLabel: item.folder,
    matchLabel: productMatchLabel(item.confidenceLabel),
    reason: reasons[0] || 'This folder is among your learned sources.',
    reasons:
      reasons.length > 0
        ? reasons
        : ['This folder is among your learned sources.'],
    origin: 'learned',
    included: isIndexed(item.folder, indexedLocations),
    exists: true,
  }
}

function availableDestination(
  location: SuggestedLocation,
  options: {
    matchLabel: SaveAsMatchLabel
    reason: string
    included: boolean
    origin?: SaveAsDestination['origin']
    homeDir: string
  },
): SaveAsDestination {
  return {
    id: `${options.origin ?? 'available'}:${location.id}`,
    folder: location.path,
    label: location.label,
    pathLabel: displayPath(location.path, options.homeDir),
    matchLabel: options.matchLabel,
    reason: options.reason,
    reasons: [options.reason],
    origin: options.origin ?? 'available',
    included: options.included,
    exists: location.exists,
  }
}

function comingLaterSources(available: SuggestedLocation[]): SaveAsComingLater[] {
  const present = new Set(
    available.flatMap((location) => {
      const haystack = `${location.id} ${location.label}`.toLowerCase()
      return CLOUD_CONNECTORS.filter((connector) =>
        connector.aliases.some((alias) => haystack.includes(alias)),
      ).map((connector) => connector.id)
    }),
  )

  return CLOUD_CONNECTORS.filter((connector) => !present.has(connector.id)).map((connector) => ({
    id: connector.id,
    label: connector.label,
    status: connector.id === 'gmail' || connector.id === 'outlook' ? 'Coming later' : 'Not connected',
  }))
}

function resolveState(input: SaveAsOverlayInput, hasUnincluded: boolean): SaveAsAssistantState {
  if (!input.fileName.trim()) {
    return input.mode === 'preview' ? 'preview' : 'no_filename'
  }
  if (input.learnedFolderCount <= 0) return 'first_use'
  if (input.recommendations.length === 0) return 'no_match'
  if (hasUnincluded) return 'partial'
  return 'learned'
}

export function composeSaveAsOverlay(input: SaveAsOverlayInput): Pick<
  SuggestionPayload,
  'document' | 'destinations' | 'comingLater' | 'saveAsState' | 'learnedFolderCount'
> {
  const homeDir = input.homeDir ?? os.homedir()
  const indexed = input.indexedLocations.map(normalizePath).filter(Boolean)
  const available = availableSavePlaces(input.availableLocations)
  const document = buildSaveAsDocumentView(input)
  const learned = input.recommendations.slice(0, MAX_LEARNED).map((item) => {
    const destination = learnedDestination(item, indexed)
    return {
      ...destination,
      pathLabel: displayPath(item.folder, homeDir),
    }
  })

  const used = new Set(learned.map((item) => pathKey(item.folder)))
  if (document.currentFolder) used.add(pathKey(document.currentFolder))

  const unincluded = available.filter((location) => !isIndexed(location.path, indexed))
  const extras: SaveAsDestination[] = []

  if (document.currentFolder) {
    const current = available.find((location) => samePath(location.path, document.currentFolder))
    const alreadyLearned = learned.some((item) => samePath(item.folder, document.currentFolder))
    if (!alreadyLearned) {
      extras.push(
        availableDestination(
          current ?? {
            id: 'current',
            label: document.currentFolderLabel || 'Current folder',
            path: document.currentFolder,
            exists: true,
            kind: 'user_folder',
          },
          {
            matchLabel: 'Available place',
            reason: 'This is the current save location.',
            included: isIndexed(document.currentFolder, indexed),
            origin: 'current',
            homeDir,
          },
        ),
      )
    }
  }

  if (learned.length === 0) {
    const preferred = starterPlaceIds(input.profile?.fileFamily)
    const ordered = [...available].sort((left, right) => {
      const leftRank = preferred.indexOf(left.id)
      const rightRank = preferred.indexOf(right.id)
      return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank)
    })
    for (const location of ordered.slice(0, MAX_AVAILABLE)) {
      if (used.has(pathKey(location.path))) continue
      const isStarter = extras.every((item) => item.origin !== 'available')
      extras.push(
        availableDestination(location, {
          matchLabel: isStarter ? 'Starter suggestion' : 'Available place',
          reason: isStarter
            ? applyBrandPresentation('Because SuHuella has not learned yet, this is a starter suggestion.')
            : applyBrandPresentation('Available folder. SuHuella has not learned it yet.'),
          included: isIndexed(location.path, indexed),
          homeDir,
        }),
      )
      used.add(pathKey(location.path))
    }
  } else {
    for (const location of unincluded.slice(0, MAX_AVAILABLE)) {
      if (used.has(pathKey(location.path))) continue
      extras.push(
        availableDestination(location, {
          matchLabel: 'Needs learning',
          reason: 'Available folder. Add this source to improve future recommendations.',
          included: false,
          homeDir,
        }),
      )
      used.add(pathKey(location.path))
    }
  }

  const destinations = [...learned, ...extras]
  const hasUnincluded = extras.some((item) => !item.included && item.origin !== 'current')
  return {
    document,
    destinations,
    comingLater: comingLaterSources(available),
    saveAsState: resolveState(input, hasUnincluded),
    learnedFolderCount: input.learnedFolderCount,
  }
}

export function markDestinationIncluded(
  payload: SuggestionPayload,
  folder: string,
): SuggestionPayload {
  const rootKey = pathKey(folder)
  const destinations = (payload.destinations ?? []).map((item) => {
    const itemKey = pathKey(item.folder)
    const included =
      item.included || itemKey === rootKey || itemKey.startsWith(`${rootKey}${path.sep}`)
    return included ? { ...item, included: true } : item
  })
  return { ...payload, destinations }
}

export function refreshDestinationInclusion(
  payload: SuggestionPayload,
  indexedLocations: string[],
): SuggestionPayload {
  const indexed = indexedLocations.map(normalizePath).filter(Boolean)
  const destinations = (payload.destinations ?? []).map((item) => ({
    ...item,
    included: isIndexed(item.folder, indexed),
  }))
  return { ...payload, destinations }
}

export function appendBrowsedDestination(
  payload: SuggestionPayload,
  folder: string,
  options?: { included?: boolean; homeDir?: string },
): SuggestionPayload {
  const existing = (payload.destinations ?? []).find((item) => samePath(item.folder, folder))
  if (existing) return payload
  const homeDir = options?.homeDir ?? os.homedir()
  const label = destinationName(folder, path.basename(folder) || folder)
  const destination: SaveAsDestination = {
    id: `browse:${pathKey(folder)}`,
    folder,
    label,
    pathLabel: displayPath(folder, homeDir),
    matchLabel: 'Available place',
    reason: 'Folder you chose just now.',
    reasons: ['Folder you chose just now.'],
    origin: 'available',
    included: Boolean(options?.included),
    exists: true,
  }
  return {
    ...payload,
    destinations: [...(payload.destinations ?? []), destination],
  }
}

export function runSaveAsOverlayChecks(): void {
  const invoiceRec: RecommendedFolder = {
    folder: '/Users/demo/Documents/Clients/ACME/Invoices',
    score: 82,
    confidenceLabel: 'Strong match',
    label: 'Clients / ACME / Invoices',
    reasons: ['ACME appears in the filename and this folder contains similar invoices.'],
    contributions: [],
  }
  const places: SuggestedLocation[] = [
    { id: 'documents', label: 'Documents', path: '/Users/demo/Documents', exists: true, kind: 'user_folder' },
    { id: 'desktop', label: 'Desktop', path: '/Users/demo/Desktop', exists: true, kind: 'user_folder' },
    { id: 'downloads', label: 'Downloads', path: '/Users/demo/Downloads', exists: true, kind: 'user_folder' },
    { id: 'pictures', label: 'Pictures', path: '/Users/demo/Pictures', exists: true, kind: 'user_folder' },
    { id: 'applications', label: 'Applications', path: '/Applications', exists: true, kind: 'user_folder' },
    { id: 'dropbox', label: 'Dropbox', path: '/Users/demo/Dropbox', exists: true, kind: 'cloud_folder' },
  ]

  const firstUse = composeSaveAsOverlay({
    fileName: 'Invoice_ACME_2026.pdf',
    sourceApp: 'Word',
    currentFolder: '',
    mode: 'save-dialog',
    extension: 'pdf',
    recommendations: [],
    profile: {
      fileFamily: 'document',
      extension: 'pdf',
      documentHints: ['invoice'],
      entities: ['ACME'],
      dates: ['2026'],
      languageHints: ['en'],
      tokens: ['invoice', 'acme', '2026'],
    },
    availableLocations: places,
    indexedLocations: [],
    learnedFolderCount: 0,
    homeDir: '/Users/demo',
  })

  if (firstUse.saveAsState !== 'first_use') {
    throw new Error('Save As overlay should use first-use when nothing is learned')
  }
  if (!firstUse.destinations?.some((item) => item.matchLabel === 'Starter suggestion')) {
    throw new Error('Save As overlay should offer starter suggestions before learning')
  }
  if (firstUse.destinations?.some((item) => item.matchLabel === 'Strong match')) {
    throw new Error('Starter suggestions must not look like learned recommendations')
  }
  if (firstUse.destinations?.some((item) => item.label === 'Applications')) {
    throw new Error('Save As overlay must not recommend system folders')
  }
  if (firstUse.document?.fileName !== 'Invoice_ACME_2026.pdf') {
    throw new Error('Save As overlay must show the document being saved')
  }
  if (!firstUse.document?.looksLike.includes('Invoice')) {
    throw new Error('Save As overlay must explain what it sees about the document')
  }
  if (!firstUse.comingLater?.some((item) => item.label === 'Google Drive' && item.status === 'Not connected')) {
    throw new Error('Disconnected cloud connectors must appear as not connected, not as recommendations')
  }
  if (firstUse.comingLater?.some((item) => item.label === 'Dropbox')) {
    throw new Error('Local cloud sync folders must not be listed as coming later')
  }

  const learned = composeSaveAsOverlay({
    fileName: 'Invoice_ACME_2026.pdf',
    sourceApp: 'Word',
    currentFolder: '/Users/demo/Downloads',
    mode: 'save-dialog',
    extension: 'pdf',
    recommendations: [invoiceRec],
    profile: {
      fileFamily: 'document',
      extension: 'pdf',
      documentHints: ['invoice'],
      entities: ['ACME'],
      dates: ['2026'],
      languageHints: [],
      tokens: ['invoice', 'acme'],
    },
    availableLocations: places,
    indexedLocations: ['/Users/demo/Documents'],
    learnedFolderCount: 12,
    homeDir: '/Users/demo',
  })

  if (learned.destinations?.[0]?.matchLabel !== 'Strong match') {
    throw new Error('Learned recommendations must keep the existing engine labels')
  }
  if (learned.destinations?.[0]?.label !== 'Clients / ACME / Invoices') {
    throw new Error('Learned recommendations must come from the existing engine')
  }
  if (!learned.destinations?.some((item) => item.matchLabel === 'Needs learning' && item.label === 'Desktop')) {
    throw new Error('Partial knowledge should still show available but not-yet-included sources')
  }

  const unnamed = composeSaveAsOverlay({
    fileName: '',
    sourceApp: '',
    currentFolder: '',
    mode: 'save-dialog',
    recommendations: [],
    availableLocations: places,
    indexedLocations: [],
    learnedFolderCount: 0,
    homeDir: '/Users/demo',
  })
  if (unnamed.saveAsState !== 'no_filename') {
    throw new Error('Save As overlay should explain when no file name is detected')
  }
  if (!unnamed.destinations?.length) {
    throw new Error('Missing file name must still show available places')
  }

  const cwd = process.cwd()
  const overlaySource = existsSync(path.join(cwd, 'electron/save-as-overlay.ts'))
    ? readFileSync(path.join(cwd, 'electron/save-as-overlay.ts'), 'utf8')
    : readFileSync(path.join(cwd, 'desktop/electron/save-as-overlay.ts'), 'utf8')
  if (/^import .+ from ['"]\.\/recommendations/m.test(overlaySource)) {
    throw new Error('Save As overlay must not import the Recommendation Engine')
  }

  const cwdWindow = existsSync(path.join(cwd, 'src/windows/SuggestionWindow.tsx'))
    ? path.join(cwd, 'src/windows/SuggestionWindow.tsx')
    : path.join(cwd, 'packages/product/src/windows/SuggestionWindow.tsx')
  const windowSource = readFileSync(cwdWindow, 'utf8')
  if (windowSource.includes('Add folders first')) {
    throw new Error('Save As popup must not use Add folders first as the main experience')
  }

  const marked = markDestinationIncluded(
    {
      fileName: 'Invoice.pdf',
      sourceApp: '',
      currentFolder: '',
      mode: 'preview',
      recommendations: [],
      destinations: [
        {
          id: 'a',
          folder: '/Users/demo/Documents',
          label: 'Documents',
          pathLabel: '~/Documents',
          matchLabel: 'Needs learning',
          reason: 'test',
          reasons: ['test'],
          origin: 'available',
          included: false,
          exists: true,
        },
        {
          id: 'b',
          folder: '/Users/demo/Documents/Clients',
          label: 'Clients',
          pathLabel: '~/Documents/Clients',
          matchLabel: 'Needs learning',
          reason: 'test',
          reasons: ['test'],
          origin: 'available',
          included: false,
          exists: true,
        },
      ],
    },
    '/Users/demo/Documents',
  )
  if (!marked.destinations?.every((item) => item.included)) {
    throw new Error('Include this source should mark nested destinations under the included root')
  }
}
