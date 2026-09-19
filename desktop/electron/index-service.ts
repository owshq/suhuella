import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, type BrowserWindow } from 'electron'
import { buildFolderIndex } from './indexer.ts'
import { clearIndex, loadIndex, saveIndex } from './index-store.ts'
import { loadSettings, updateIndexMetadata } from './settings-store.ts'
import { recognisedFromNames, uniqueNameCount } from '../src/lib/recognised-names.ts'
import {
  browseParentPath,
  isDirectBrowseChild,
  isBrowsePathUnder,
  normalizeBrowsePath,
} from '../src/lib/source-browse.ts'
import type {
  AppSettings,
  FoldersKnowledgeQuality,
  FoldersKnowledgeSummary,
  IndexedLocationStatus,
  IndexedLocationSummary,
  IndexBrowse,
  IndexScanProgress,
  SourceBrowse,
  SourceBrowseEntry,
  KnowledgeIndexHealth,
  LocationUsefulness,
  SuggestedLocation,
  SuggestedLocationKind,
} from '../src/types.ts'

const STALE_INDEX_DAYS = 14

const SPANISH_HINTS = ['factura', 'contrato', 'presupuesto', 'impuesto', 'documento', 'informe']
const CATALAN_HINTS = ['factura', 'contracte', 'pressupost', 'impost', 'informe', 'document']
const ENGLISH_HINTS = ['invoice', 'contract', 'budget', 'tax', 'document', 'report', 'project']

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  xls: 'Excel',
  xlsx: 'Excel',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  txt: 'Text',
  md: 'Text',
  jpg: 'Images',
  jpeg: 'Images',
  png: 'Images',
  zip: 'Archives',
}

const IDLE_SCAN: IndexScanProgress = {
  status: 'idle',
  foldersScanned: 0,
  filesSeen: 0,
  currentPath: '',
  startedAt: null,
  finishedAt: null,
  estimatedRemainingSeconds: null,
}

function estimateRemainingSeconds(progress: IndexScanProgress): number | null {
  if (!progress.startedAt || progress.foldersScanned < 12) {
    return null
  }

  const elapsedMs = Date.now() - new Date(progress.startedAt).getTime()
  if (elapsedMs <= 0) return null

  const foldersPerMs = progress.foldersScanned / elapsedMs
  if (foldersPerMs <= 0) return null

  const estimatedTotalFolders = Math.max(progress.foldersScanned + 1, progress.foldersScanned * 2.5)
  const remainingFolders = Math.max(0, estimatedTotalFolders - progress.foldersScanned)
  return Math.max(1, Math.round(remainingFolders / foldersPerMs / 1000))
}

function withScanEstimate(partial: Partial<IndexScanProgress>): IndexScanProgress {
  const next = { ...scanState, ...partial }
  return {
    ...next,
    estimatedRemainingSeconds:
      next.status === 'scanning' ? estimateRemainingSeconds(next) : null,
  }
}

let scanState: IndexScanProgress = { ...IDLE_SCAN }
let cancelRequested = false
let activeScan: Promise<AppSettings> | null = null

type ScanProgressListener = (progress: IndexScanProgress) => void
const scanProgressListeners = new Set<ScanProgressListener>()

export function onScanProgress(listener: ScanProgressListener): () => void {
  scanProgressListeners.add(listener)
  listener({ ...scanState })
  return () => {
    scanProgressListeners.delete(listener)
  }
}

function broadcastProgress(windows: Array<BrowserWindow | null>): void {
  const progress = { ...scanState }
  for (const listener of scanProgressListeners) {
    listener(progress)
  }
  for (const window of windows) {
    if (window && !window.isDestroyed()) {
      window.webContents.send('index:progress', progress)
    }
  }
}

export function getScanProgress(): IndexScanProgress {
  return { ...scanState }
}

function safeAppPath(name: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'): string | null {
  try {
    return app.getPath(name)
  } catch {
    return null
  }
}

function cloudFolderLabel(folderName: string): string {
  const lower = folderName.toLowerCase()
  if (lower.startsWith('googledrive')) return 'Google Drive'
  if (lower.startsWith('dropbox')) return 'Dropbox'
  if (lower.startsWith('onedrive')) return 'OneDrive'
  if (lower.startsWith('icloud')) return 'iCloud Drive'
  return folderName.replace(/-/g, ' ')
}

function listExistingVolumes(): Array<{ id: string; label: string; path: string; kind: SuggestedLocationKind }> {
  if (process.platform === 'darwin') {
    const root = '/Volumes'
    if (!existsSync(root)) return []
    try {
      return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .filter((entry) => !['Macintosh HD', 'Macintosh HD - Data'].includes(entry.name))
        .filter((entry) => !entry.name.startsWith('com.apple.TimeMachine'))
        .map((entry) => ({
          id: `volume-${entry.name}`,
          label: entry.name,
          path: path.join(root, entry.name),
          kind: 'volume' as const,
        }))
    } catch {
      return []
    }
  }

  if (process.platform === 'win32') {
    const volumes: Array<{ id: string; label: string; path: string; kind: SuggestedLocationKind }> = []
    for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
      const drivePath = `${letter}:\\`
      if (existsSync(drivePath)) {
        volumes.push({
          id: `volume-${letter}`,
          label: `${letter}:`,
          path: drivePath,
          kind: 'volume',
        })
      }
    }
    return volumes
  }

  if (process.platform === 'linux') {
    const volumes: Array<{ id: string; label: string; path: string; kind: SuggestedLocationKind }> = []
    const seen = new Set<string>()
    for (const root of ['/media', '/mnt']) {
      if (!existsSync(root)) continue
      try {
        for (const entry of readdirSync(root, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith('.')) continue
          if (['efi', 'boot', 'bootefi', 'recovery'].includes(entry.name.toLowerCase())) continue
          const mountPath = path.join(root, entry.name)
          const key = mountPath.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          volumes.push({
            id: `volume-${entry.name}`,
            label: entry.name,
            path: mountPath,
            kind: 'volume',
          })
        }
      } catch {
        /* unreadable mount root */
      }
    }
    return volumes
  }

  return []
}

function listCloudStorageFolders(home: string): Array<{
  id: string
  label: string
  path: string
  kind: SuggestedLocationKind
}> {
  const cloudStorage = path.join(home, 'Library', 'CloudStorage')
  if (!existsSync(cloudStorage)) return []
  try {
    return readdirSync(cloudStorage, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({
        id: `cloudstorage-${entry.name}`,
        label: cloudFolderLabel(entry.name),
        path: path.join(cloudStorage, entry.name),
        kind: 'cloud_folder' as const,
      }))
  } catch {
    return []
  }
}

/** User-facing folders this computer can learn from. Never /, System, Library, or Windows. */
export function getSuggestedLocations(): SuggestedLocation[] {
  const home = os.homedir()
  const candidates: Array<{
    id: string
    label: string
    path: string
    kind: SuggestedLocationKind
  }> = []

  const push = (
    id: string,
    label: string,
    folderPath: string | null,
    kind: SuggestedLocationKind = 'user_folder',
  ) => {
    if (!folderPath) return
    candidates.push({ id, label, path: folderPath, kind })
  }

  if (process.platform === 'linux') {
    push('home', 'Home', home)
  }
  push('desktop', 'Desktop', safeAppPath('desktop'))
  push('documents', 'Documents', safeAppPath('documents'))
  push('downloads', 'Downloads', safeAppPath('downloads'))
  push('pictures', 'Pictures', safeAppPath('pictures'))
  push('music', 'Music', safeAppPath('music'))
  push(process.platform === 'darwin' ? 'movies' : 'videos', process.platform === 'darwin' ? 'Movies' : 'Videos', safeAppPath('videos'))
  push('public', 'Shared', path.join(home, 'Public'))
  push('shared', 'Shared', path.join(home, 'Shared'))
  push('developer', 'Developer', path.join(home, 'Developer'))
  const userApplications = path.join(home, process.platform === 'win32' ? 'Apps' : 'Applications')
  if (existsSync(userApplications)) {
    push('applications', 'Applications', userApplications)
  } else if (process.platform === 'darwin') {
    push('applications', 'Applications', '/Applications')
  }
  push('dropbox', 'Dropbox', path.join(home, 'Dropbox'), 'cloud_folder')
  push('onedrive', 'OneDrive', path.join(home, 'OneDrive'), 'cloud_folder')
  push('google-drive', 'Google Drive', path.join(home, 'Google Drive'), 'cloud_folder')
  push(
    'icloud',
    'iCloud Drive',
    path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs'),
    'cloud_folder',
  )
  candidates.push(...listCloudStorageFolders(home))
  candidates.push(...listExistingVolumes())

  const seen = new Set<string>()
  return candidates
    .map((candidate) => ({
      ...candidate,
      exists: existsSync(candidate.path),
    }))
    .filter((candidate) => {
      const key = `${candidate.label.toLowerCase()}::${path.normalize(candidate.path).toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function cancelIndexScan(): void {
  cancelRequested = true
}

export function startIndexScan(windows: Array<BrowserWindow | null>): Promise<AppSettings> {
  if (activeScan) {
    return activeScan
  }

  cancelRequested = false
  scanState = withScanEstimate({
    status: 'scanning',
    foldersScanned: 0,
    filesSeen: 0,
    currentPath: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  })
  broadcastProgress(windows)

  activeScan = (async () => {
    const settings = loadSettings()

    if (settings.indexedLocations.length === 0) {
      clearIndex()
      updateIndexMetadata(0, null, 0)
      scanState = withScanEstimate({
        ...scanState,
        status: 'ready',
        foldersScanned: 0,
        filesSeen: 0,
        currentPath: '',
        finishedAt: new Date().toISOString(),
      })
      broadcastProgress(windows)
      return loadSettings()
    }

    try {
      const index = await buildFolderIndex(settings.indexedLocations, {
        cancelled: () => cancelRequested,
        onProgress: (partial) => {
          scanState = withScanEstimate({
            ...scanState,
            ...partial,
            status: 'scanning',
          })
          broadcastProgress(windows)
        },
      })

      if (cancelRequested) {
        scanState = {
          ...scanState,
          status: 'cancelled',
          finishedAt: new Date().toISOString(),
        }
        broadcastProgress(windows)
        return loadSettings()
      }

      saveIndex(index)
      const fileCount = index.folders.reduce((total, folder) => total + folder.fileCount, 0)
      updateIndexMetadata(index.folders.length, index.indexedAt, fileCount)
      scanState = withScanEstimate({
        status: 'ready',
        foldersScanned: index.folders.length,
        filesSeen: scanState.filesSeen,
        currentPath: '',
        startedAt: scanState.startedAt,
        finishedAt: new Date().toISOString(),
      })
      broadcastProgress(windows)
      return loadSettings()
    } catch (error) {
      scanState = {
        ...scanState,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date().toISOString(),
      }
      broadcastProgress(windows)
      return loadSettings()
    } finally {
      activeScan = null
    }
  })()

  return activeScan
}

export function getIndexedFolders() {
  return loadIndex().folders.filter((folder) => folder.kind === 'folder')
}

function normalizeLocationPath(location: string): string {
  return path.normalize(location.trim())
}

function isExternalLocation(location: string): boolean {
  const normalized = normalizeLocationPath(location).replace(/\\/g, '/')
  if (normalized.startsWith('/Volumes/')) return true
  if (normalized.startsWith('/media/') || normalized.startsWith('/mnt/')) return true
  if (normalized.startsWith('//')) return true
  if (process.platform === 'win32') {
    const drive = normalized.match(/^([A-Za-z]):/)?.[1]?.toUpperCase()
    const homeDrive = os.homedir().match(/^([A-Za-z]):/)?.[1]?.toUpperCase()
    return Boolean(drive && homeDrive && drive !== homeDrive)
  }
  return false
}

function inspectLocation(location: string): Extract<
  IndexedLocationStatus,
  'unavailable' | 'permission_denied' | 'external_drive_disconnected'
> | null {
  try {
    const stat = statSync(location)
    if (!stat.isDirectory()) return 'unavailable'
    accessSync(location, constants.R_OK)
    return null
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code === 'EACCES' || code === 'EPERM') return 'permission_denied'
    if (isExternalLocation(location)) return 'external_drive_disconnected'
    return 'unavailable'
  }
}

function locationName(location: string): string {
  return path.basename(normalizeLocationPath(location)) || location
}

function isIndexStale(iso: string | null): boolean {
  if (!iso) return true
  const ageDays = (Date.now() - new Date(iso).getTime()) / 86_400_000
  return ageDays > STALE_INDEX_DAYS
}

function usefulnessFor(fileCount: number, totalFiles: number): LocationUsefulness {
  if (fileCount <= 0) return 'unknown'
  const share = totalFiles > 0 ? fileCount / totalFiles : 0
  if (share >= 0.2 || fileCount >= 1_000) return 'very_useful'
  if (fileCount < 25 && share < 0.02) return 'rarely_used'
  return 'useful'
}

function detectLanguages(names: string[]): string[] {
  const haystack = names.join(' ').toLowerCase()
  const languages: string[] = []
  if (ENGLISH_HINTS.some((hint) => haystack.includes(hint))) languages.push('English')
  if (SPANISH_HINTS.some((hint) => haystack.includes(hint))) languages.push('Spanish')
  if (CATALAN_HINTS.some((hint) => haystack.includes(hint))) languages.push('Catalan')
  return languages
}

function qualityFor(options: {
  locationCount: number
  folderCount: number
  fileCount: number
  uniqueNames: number
  recognisedCount: number
}): FoldersKnowledgeQuality {
  if (options.locationCount === 0 || options.folderCount === 0) return 'needs_more'
  if (
    options.locationCount >= 2 &&
    options.fileCount >= 200 &&
    options.uniqueNames >= 80 &&
    options.recognisedCount >= 2
  ) {
    return 'excellent'
  }
  if (options.folderCount >= 10 && options.fileCount >= 40) return 'good'
  return 'learning'
}

export function getFoldersKnowledgeSummary(): FoldersKnowledgeSummary {
  const settings = loadSettings()
  const index = loadIndex()
  const names = index.folders.flatMap((folder) => [
    folder.folderName,
    folder.name,
    ...folder.fileNames,
  ])
  const extensions = index.folders.flatMap((folder) => folder.extensions)
  const languages = detectLanguages(names)
  const recognised = recognisedFromNames(names, extensions)
  const uniqueNames = uniqueNameCount(names)

  const topFolders = [...index.folders]
    .filter((folder) => folder.fileCount > 0)
    .sort((left, right) => right.fileCount - left.fileCount)
    .map((folder) => folder.folderName || folder.name)
    .filter((name, index, list) => name && list.indexOf(name) === index)
    .slice(0, 5)

  const extensionCounts = new Map<string, number>()
  for (const folder of index.folders) {
    for (const extension of folder.extensions) {
      extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + folder.fileCount)
    }
  }

  const documentTypes = [...extensionCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([extension]) => DOCUMENT_TYPE_LABELS[extension] ?? extension.toUpperCase())
    .filter((label, index, list) => list.indexOf(label) === index)
    .slice(0, 8)

  const oldestSeen = index.folders
    .map((folder) => (folder.lastModified ? new Date(folder.lastModified).getTime() : 0))
    .filter((time) => time > 0)
  const historyYears =
    oldestSeen.length === 0
      ? null
      : Math.floor((Date.now() - Math.min(...oldestSeen)) / (365.25 * 24 * 60 * 60 * 1000))

  return {
    topFolders,
    languages,
    documentTypes,
    recognised,
    uniqueNames,
    lastLearnedNewFiles: settings.lastLearnedNewFiles,
    lastLearnedUpdatedFolders: settings.lastLearnedUpdatedFolders,
    historyYears: historyYears && historyYears >= 1 ? historyYears : null,
    quality: qualityFor({
      locationCount: settings.indexedLocations.length,
      folderCount: settings.indexedFolderCount,
      fileCount: settings.indexedFileCount,
      uniqueNames,
      recognisedCount: recognised.length,
    }),
  }
}

export function getIndexedLocationSummaries(): IndexedLocationSummary[] {
  const settings = loadSettings()
  const index = loadIndex()
  const scan = getScanProgress()

  const totalFiles = settings.indexedFileCount

  return settings.indexedLocations.map((location) => {
    const normalized = normalizeLocationPath(location)
    const source = index.sources.find(
      (item) => normalizeLocationPath(item.rootLocator) === normalized,
    )
    const folders = index.folders.filter((folder) => {
      if (source && folder.sourceId === source.id) return true
      const folderPath = normalizeLocationPath(folder.absolutePath)
      return folderPath === normalized || folderPath.startsWith(`${normalized}${path.sep}`)
    })
    const liveIssue = inspectLocation(normalized)
    const lastIndexed = source?.lastIndexed ?? (folders.length > 0 ? settings.lastIndexed : null)
    const fileCount = folders.reduce((total, folder) => total + (folder.fileCount ?? 0), 0)

    let status: IndexedLocationStatus = 'ready'
    if (liveIssue) {
      status = liveIssue
    } else if (scan.status === 'scanning') {
      status = 'indexing'
    } else if (source?.status === 'error') {
      status = isExternalLocation(normalized) ? 'external_drive_disconnected' : 'unavailable'
    } else if (!lastIndexed && folders.length === 0) {
      status = 'not_indexed'
    } else if (isIndexStale(lastIndexed)) {
      status = 'needs_refresh'
    }

    return {
      path: location,
      name: source?.displayName || locationName(location),
      lastIndexed,
      folderCount: folders.length,
      fileCount,
      status,
      usefulness: usefulnessFor(fileCount, totalFiles),
      exists: liveIssue === null || liveIssue === 'permission_denied',
    }
  })
}

export function getKnowledgeIndexHealth(): KnowledgeIndexHealth {
  const settings = loadSettings()
  const index = loadIndex()
  const scan = getScanProgress()
  const hasIndex = settings.indexedFolderCount > 0 || index.folders.length > 0

  let status: KnowledgeIndexHealth['status'] = scan.status
  if (scan.status === 'idle' && !hasIndex) {
    status = 'not-indexed'
  } else if (scan.status === 'idle' && hasIndex) {
    status = 'ready'
  }

  return {
    status,
    locationCount: settings.indexedLocations.length,
    sourceCount: index.sources.length || settings.indexedLocations.length,
    folderCount: settings.indexedFolderCount,
    fileCount: settings.indexedFileCount,
    indexVersion: index.indexVersion || index.version,
    lastIndexed: settings.lastIndexed,
    searchReady: hasIndex && scan.status !== 'scanning',
  }
}

export function getIndexBrowse(): IndexBrowse {
  const index = loadIndex()
  const folders = index.folders
    .slice(0, 80)
    .map((folder) => ({
      path: folder.absolutePath,
      name: folder.folderName || folder.name,
      fileCount: folder.fileCount ?? 0,
    }))

  const filesFromIndex = index.files.slice(0, 40).map((file) => ({
    path: file.absolutePath ?? file.locator,
    name: file.name,
    extension: file.extension,
  }))

  if (filesFromIndex.length > 0) {
    return { folders, files: filesFromIndex }
  }

  const files: IndexBrowse['files'] = []
  for (const folder of index.folders) {
    for (const name of folder.fileNames.slice(0, 3)) {
      files.push({
        path: path.join(folder.absolutePath, name),
        name,
        extension: path.extname(name).replace(/^\./, ''),
      })
      if (files.length >= 40) break
    }
    if (files.length >= 40) break
  }

  return { folders, files }
}

function fileStatMeta(filePath: string): { size: number | null; lastModified: string | null } {
  try {
    const stat = statSync(filePath)
    return {
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    }
  } catch {
    return { size: null, lastModified: null }
  }
}

function allowedBrowseRoots(): string[] {
  const settings = loadSettings()
  return [...settings.indexedLocations, ...getSuggestedLocations().map((place) => place.path)].filter(Boolean)
}

function canBrowsePath(requested: string): boolean {
  const target = normalizeBrowsePath(requested)
  if (!target) return false
  return allowedBrowseRoots().some((root) => isBrowsePathUnder(root, target))
}

export function browseSource(rootPath: string): SourceBrowse {
  const requested = normalizeBrowsePath(rootPath)
  const name = path.basename(requested) || requested
  const empty: SourceBrowse = { path: requested, name, parentPath: browseParentPath(requested), entries: [] }
  if (!requested || !canBrowsePath(requested)) return empty

  const entriesByPath = new Map<string, SourceBrowseEntry>()

  if (existsSync(requested)) {
    try {
      for (const entry of readdirSync(requested, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const childPath = path.join(requested, entry.name)
        const meta = fileStatMeta(childPath)
        const isFolder = entry.isDirectory()
        entriesByPath.set(normalizeBrowsePath(childPath).toLowerCase(), {
          path: childPath,
          name: entry.name,
          kind: isFolder ? 'folder' : 'file',
          extension: isFolder ? undefined : path.extname(entry.name).replace(/^\./, ''),
          size: isFolder ? null : meta.size,
          lastModified: meta.lastModified,
        })
      }
    } catch {
      // Fall through to the index when the folder cannot be listed.
    }
  }

  if (entriesByPath.size === 0) {
    const index = loadIndex()
    for (const folder of index.folders) {
      if (!isDirectBrowseChild(requested, folder.absolutePath)) continue
      entriesByPath.set(normalizeBrowsePath(folder.absolutePath).toLowerCase(), {
        path: folder.absolutePath,
        name: folder.folderName || folder.name,
        kind: 'folder',
        size: null,
        lastModified: folder.lastModified,
      })
    }
    for (const file of index.files) {
      const filePath = file.absolutePath ?? file.locator
      if (!isDirectBrowseChild(requested, filePath)) continue
      const meta = fileStatMeta(filePath)
      entriesByPath.set(normalizeBrowsePath(filePath).toLowerCase(), {
        path: filePath,
        name: file.name,
        kind: 'file',
        extension: file.extension,
        size: meta.size,
        lastModified: file.lastModified ?? meta.lastModified,
      })
    }
    const rootFolder = index.folders.find(
      (folder) => normalizeBrowsePath(folder.absolutePath).toLowerCase() === requested.toLowerCase(),
    )
    if (rootFolder) {
      for (const fileName of rootFolder.fileNames) {
        const filePath = path.join(rootFolder.absolutePath, fileName)
        const key = normalizeBrowsePath(filePath).toLowerCase()
        if (entriesByPath.has(key)) continue
        const meta = fileStatMeta(filePath)
        entriesByPath.set(key, {
          path: filePath,
          name: fileName,
          kind: 'file',
          extension: path.extname(fileName).replace(/^\./, ''),
          size: meta.size,
          lastModified: rootFolder.lastModified ?? meta.lastModified,
        })
      }
    }
  }

  const entries = [...entriesByPath.values()].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })

  return {
    path: requested,
    name,
    parentPath: browseParentPath(requested),
    entries,
  }
}
