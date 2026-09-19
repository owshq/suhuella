import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { FolderIndex, IndexedFolderEntry, IndexScanProgress, KnowledgeSource } from '@suhuella/product/types.ts'
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
  currentPath: string
  cancelled: () => boolean
  onProgress: (progress: Partial<IndexScanProgress>) => void
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
      currentPath: context.currentPath,
    })
    await yieldToEventLoop()
  }
}

export async function buildFolderIndex(
  locations: string[],
  options: {
    cancelled: () => boolean
    onProgress: (progress: Partial<IndexScanProgress>) => void
  },
): Promise<FolderIndex> {
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
    currentPath: '',
    cancelled: options.cancelled,
    onProgress: options.onProgress,
  }

  for (const location of normalizedLocations) {
    if (options.cancelled()) break

    let stat
    try {
      stat = statSync(location)
    } catch {
      continue
    }

    if (!stat.isDirectory()) continue

    context.currentPath = location
    options.onProgress({
      currentPath: location,
      foldersScanned: context.foldersScanned,
      filesSeen: context.filesSeen,
    })

    await scanDirectory(location, location, context)
  }

  const indexedAt = options.cancelled() ? null : new Date().toISOString()
  const withCounts = sources.map((source) => ({
    ...source,
    itemCount: context.folders.filter((folder) => folder.sourceId === source.id).length,
    lastIndexed: source.status === 'error' ? source.lastIndexed : indexedAt,
  }))

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
