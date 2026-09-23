import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type {
  FolderIndex,
  IndexedFolderEntry,
  IndexRefreshMode,
  IndexScanProgress,
  KnowledgeSource,
} from '@suhuella/product/types.ts'
import { createLocalKnowledgeSource } from './knowledge-sources.ts'
import { tokenize } from './recommendations.ts'

const SKIP_DIR_NAMES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '__pycache__',
  '.Trash',
  '.Trashes',
  'Library',
  'Caches',
  'Cache',
  'Temp',
  'tmp',
  '.npm',
  '.yarn',
  'vendor',
])

const MAX_FILENAMES_PER_FOLDER = 50
const YIELD_EVERY_FOLDERS = 40
/** Yield inside one folder so a huge flat directory cannot freeze progress or cancel. */
export const INDEX_YIELD_EVERY_FILES = 80

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

function folderId(absolutePath: string): string {
  return Buffer.from(path.normalize(absolutePath), 'utf8').toString('base64url')
}

function parentTokensFor(relativePath: string): string[] {
  const segments = relativePath.split(/[/\\]+/).filter(Boolean)
  if (segments.length <= 1) return []
  return [...new Set(tokenize(segments.slice(0, -1).join('/')))]
}

function shouldSkipDirName(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || name.startsWith('.')
}

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
}

type ScanContext = {
  locations: string[]
  sources: KnowledgeSource[]
  folders: IndexedFolderEntry[]
  foldersScanned: number
  filesSeen: number
  foldersReused: number
  locationsDone: number
  currentPath: string
  currentRoot: string
  cancelled: () => boolean
  onProgress: (progress: Partial<IndexScanProgress>) => void
}

function normalizeRoot(location: string): string {
  return path.normalize(location.trim())
}

function sameRoot(left: string, right: string): boolean {
  return normalizeRoot(left).toLowerCase() === normalizeRoot(right).toLowerCase()
}

function isPathUnderRoot(root: string, target: string): boolean {
  const normalizedRoot = normalizeRoot(root)
  const normalizedTarget = normalizeRoot(target)
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
  )
}

function previousSourceFor(previous: FolderIndex | undefined, location: string): KnowledgeSource | undefined {
  return previous?.sources.find((source) => sameRoot(source.rootLocator, location))
}

function previousFoldersFor(previous: FolderIndex, location: string): IndexedFolderEntry[] {
  const source = previousSourceFor(previous, location)
  return previous.folders.filter((folder) => {
    if (source && folder.sourceId === source.id) return true
    return isPathUnderRoot(location, folder.absolutePath)
  })
}

/** A location is reused when the previous index already learned it successfully. */
export function locationNeedsScan(
  location: string,
  previous: FolderIndex | undefined,
  refresh: IndexRefreshMode = 'all',
): boolean {
  if (refresh === 'all' || !previous) return true
  const source = previousSourceFor(previous, location)
  if (!source || source.status === 'error' || !source.lastIndexed) return true
  return previousFoldersFor(previous, location).length === 0
}

async function scanDirectory(
  rootLocation: string,
  absoluteDir: string,
  context: ScanContext,
): Promise<void> {
  if (context.cancelled()) return

  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>
  try {
    entries = readdirSync(absoluteDir, { withFileTypes: true })
  } catch {
    return
  }

  const relativePath = path.relative(rootLocation, absoluteDir) || '.'
  const normalizedRelative = relativePath === '.' ? path.basename(rootLocation) : relativePath
  const extensions = new Set<string>()
  const fileNames: string[] = []
  let fileCount = 0
  let lastModifiedMs = 0

  for (const entry of entries) {
    if (context.cancelled()) return

    const entryPath = path.join(absoluteDir, entry.name)
    if (entry.isFile()) {
      fileCount += 1
      context.filesSeen += 1
      if (fileNames.length < MAX_FILENAMES_PER_FOLDER) {
        fileNames.push(entry.name)
      }
      const ext = extensionOf(entry.name)
      if (ext) extensions.add(ext)
      try {
        const mtime = statSync(entryPath).mtimeMs
        if (mtime > lastModifiedMs) lastModifiedMs = mtime
      } catch {
        // Ignore unreadable files.
      }
      if (context.filesSeen % INDEX_YIELD_EVERY_FILES === 0) {
        context.currentPath = entryPath
        emitLocationProgress(context)
        await yieldToEventLoop()
        if (context.cancelled()) return
      }
      continue
    }

    if (entry.isDirectory() && !shouldSkipDirName(entry.name)) {
      await scanDirectory(rootLocation, entryPath, context)
    }
  }

  const depth = normalizedRelative.split(/[/\\]+/).filter(Boolean).length
  const source = context.sources.find((item) => item.rootLocator === path.normalize(rootLocation))
  const absolutePath = path.normalize(absoluteDir)
  const folderName = path.basename(absoluteDir)
  context.folders.push({
    id: folderId(absoluteDir),
    sourceId: source?.id ?? createLocalKnowledgeSource(rootLocation).id,
    sourceType: 'local_folder',
    kind: 'folder',
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath: normalizedRelative.replace(/\\/g, '/'),
    folderName,
    parentTokens: parentTokensFor(normalizedRelative.replace(/\\/g, '/')),
    depth,
    extensions: [...extensions].sort(),
    fileCount,
    fileNames,
    lastModified: lastModifiedMs > 0 ? new Date(lastModifiedMs).toISOString() : null,
  })

  context.foldersScanned += 1
  context.currentPath = absoluteDir

  if (context.foldersScanned % YIELD_EVERY_FOLDERS === 0) {
    context.onProgress({
      foldersScanned: context.foldersScanned,
      filesSeen: context.filesSeen,
      foldersReused: context.foldersReused,
      locationsDone: context.locationsDone,
      currentPath: context.currentPath,
      currentRoot: context.currentRoot,
    })
    await yieldToEventLoop()
  }
}

function emitLocationProgress(context: ScanContext): void {
  context.onProgress({
    foldersScanned: context.foldersScanned,
    filesSeen: context.filesSeen,
    foldersReused: context.foldersReused,
    locationsDone: context.locationsDone,
    currentPath: context.currentPath,
    currentRoot: context.currentRoot,
  })
}

function adoptPreviousLocation(
  location: string,
  previous: FolderIndex,
  context: ScanContext,
): void {
  const source = previousSourceFor(previous, location)
  const folders = previousFoldersFor(previous, location)
  if (source) {
    const index = context.sources.findIndex((item) => sameRoot(item.rootLocator, location))
    if (index >= 0) context.sources[index] = { ...source }
  }
  context.folders.push(...folders)
  const reusedFiles = folders.reduce((total, folder) => total + (folder.fileCount ?? 0), 0)
  context.foldersScanned += folders.length
  context.filesSeen += reusedFiles
  context.foldersReused += folders.length
  context.currentPath = location
  context.currentRoot = location
  context.locationsDone += 1
  emitLocationProgress(context)
}

export async function buildFolderIndex(
  locations: string[],
  options: {
    cancelled: () => boolean
    onProgress: (progress: Partial<IndexScanProgress>) => void
    previous?: FolderIndex
    refresh?: IndexRefreshMode
  },
): Promise<FolderIndex> {
  const refresh = options.refresh ?? 'all'
  const normalizedLocations = [...new Set(locations.map((location) => path.normalize(location.trim())))]
    .filter(Boolean)

  const sources = normalizedLocations.map((location) => {
    try {
      const stat = statSync(location)
      return createLocalKnowledgeSource(location, {
        status: stat.isDirectory() ? 'ready' : 'error',
        errorMessage: stat.isDirectory() ? undefined : 'Not a folder',
      })
    } catch {
      return createLocalKnowledgeSource(location, {
        status: 'error',
        errorMessage: 'Folder is not available',
      })
    }
  })

  const context: ScanContext = {
    locations: normalizedLocations,
    sources,
    folders: [],
    foldersScanned: 0,
    filesSeen: 0,
    foldersReused: 0,
    locationsDone: 0,
    currentPath: '',
    currentRoot: '',
    cancelled: options.cancelled,
    onProgress: options.onProgress,
  }

  options.onProgress({
    foldersScanned: 0,
    filesSeen: 0,
    foldersReused: 0,
    locationsDone: 0,
    locationsTotal: normalizedLocations.length,
    currentPath: '',
    currentRoot: '',
  })

  for (const location of normalizedLocations) {
    if (options.cancelled()) break

    if (!locationNeedsScan(location, options.previous, refresh) && options.previous) {
      adoptPreviousLocation(location, options.previous, context)
      continue
    }

    let stat
    try {
      stat = statSync(location)
    } catch {
      context.locationsDone += 1
      continue
    }

    if (!stat.isDirectory()) {
      context.locationsDone += 1
      continue
    }

    context.currentPath = location
    context.currentRoot = location
    emitLocationProgress(context)

    await scanDirectory(location, location, context)
    if (options.cancelled()) break
    context.locationsDone += 1
    emitLocationProgress(context)
  }

  const scannedAt = options.cancelled() ? null : new Date().toISOString()
  const withCounts = sources.map((source) => {
    const reused = options.previous
      ? previousSourceFor(options.previous, source.rootLocator)
      : undefined
    const scanned = locationNeedsScan(source.rootLocator, options.previous, refresh)
    const lastIndexed = source.status === 'error'
      ? source.lastIndexed
      : scanned
        ? scannedAt
        : reused?.lastIndexed ?? scannedAt
    return {
      ...source,
      itemCount: context.folders.filter((folder) => folder.sourceId === source.id).length,
      lastIndexed,
    }
  })

  const indexedAt =
    withCounts
      .map((source) => source.lastIndexed)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? scannedAt

  return {
    version: 2,
    indexVersion: 2,
    generatedAt: indexedAt,
    indexedAt,
    locations: normalizedLocations,
    sources: withCounts,
    folders: context.folders,
    files: [],
  }
}
