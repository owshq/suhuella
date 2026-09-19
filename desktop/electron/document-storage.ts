import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type {
  AppStorageBreakdown,
  DocumentStorageSummary,
  FolderIndex,
  StorageOverview,
  StorageOverviewWarning,
  StorageSource,
  StorageSourceStatus,
} from '@suhuella/product/types.ts'
import { emptyAppStorage, storageSourceWarning } from '@suhuella/product/lib/storage-overview.ts'
import { loadIndex } from './index-store.ts'
import { loadSettings } from './settings-store.ts'
import { getAppStorageBreakdown } from './storage-manager.ts'
import { storageLayout } from './storage-paths.ts'

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

const FORBIDDEN_ROOTS = new Set(['/', '/system', '/library', '/private', '/windows', 'c:\\', 'c:\\windows'])

type MeasureResult = {
  bytes: number
  files: number
  error?: 'permission' | 'unavailable' | 'failed'
  errorCode?: string
}

function shouldSkipDirName(name: string): boolean {
  return SKIP_DIR_NAMES.has(name) || name.startsWith('.')
}

function locationLabel(location: string, displayName?: string): string {
  if (displayName?.trim()) return displayName.trim()
  const parts = location.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? location
}

function isUnsafeToMeasure(location: string): boolean {
  let resolved: string
  try {
    resolved = path.resolve(location)
  } catch {
    return true
  }
  const normalized = resolved.replace(/\\/g, '/').toLowerCase()
  if (FORBIDDEN_ROOTS.has(normalized)) return true
  if (normalized === '/system' || normalized.startsWith('/system/')) return true
  if (normalized === '/private' || normalized.startsWith('/private/')) return true
  if (/^[a-z]:\/?$/.test(normalized)) return true
  if (normalized.startsWith('c:/windows')) return true
  return false
}

function errorCodeOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return undefined
}

function measureDirectoryBytes(rootLocation: string, absoluteDir: string): MeasureResult {
  if (!existsSync(absoluteDir)) return { bytes: 0, files: 0, error: 'unavailable', errorCode: 'missing' }

  let bytes = 0
  let files = 0
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>
  try {
    entries = readdirSync(absoluteDir, { withFileTypes: true })
  } catch (error) {
    const code = errorCodeOf(error)
    if (code === 'EACCES' || code === 'EPERM') {
      return { bytes: 0, files: 0, error: 'permission', errorCode: code }
    }
    return { bytes: 0, files: 0, error: 'failed', errorCode: code ?? 'readdir' }
  }

  for (const entry of entries) {
    const entryPath = path.join(absoluteDir, entry.name)
    if (entry.isFile()) {
      try {
        bytes += statSync(entryPath).size
        files += 1
      } catch {
        // Ignore unreadable files; keep the rest of the source.
      }
      continue
    }

    if (entry.isDirectory() && !shouldSkipDirName(entry.name)) {
      const nested = measureDirectoryBytes(rootLocation, entryPath)
      if (nested.error === 'permission' && bytes === 0 && files === 0) {
        return nested
      }
      bytes += nested.bytes
      files += nested.files
    }
  }

  return { bytes, files }
}

export function measureIndexedLocations(
  locations: string[],
  index: Pick<FolderIndex, 'sources' | 'folders'>,
  now = new Date().toISOString(),
): StorageSource[] {
  return locations.map((location) => {
    const normalized = path.normalize(location)
    const source = index.sources.find((item) => path.normalize(item.rootLocator) === normalized)
    const folderCount = index.folders.filter(
      (folder) => path.normalize(folder.absolutePath).startsWith(normalized),
    ).length
    const name = locationLabel(normalized, source?.displayName)

    if (isUnsafeToMeasure(normalized)) {
      return {
        id: source?.id ?? normalized,
        name,
        kind: 'local_folder' as const,
        locator: normalized,
        folderCount,
        status: 'skipped' as const,
        errorCode: 'unsafe_root',
        lastMeasuredAt: now,
      }
    }

    const measured = measureDirectoryBytes(normalized, normalized)
    let status: StorageSourceStatus = 'measured'
    if (measured.error === 'permission') status = 'permission_required'
    else if (measured.error === 'unavailable') status = 'unavailable'
    else if (measured.error === 'failed') status = 'failed'

    return {
      id: source?.id ?? normalized,
      name,
      kind: 'local_folder' as const,
      locator: normalized,
      bytes: status === 'measured' ? measured.bytes : undefined,
      documentCount: status === 'measured' ? measured.files : source?.itemCount,
      folderCount,
      status,
      errorCode: measured.errorCode,
      lastMeasuredAt: now,
    }
  })
}

export function assembleStorageOverview(
  sources: StorageSource[],
  appStorage: AppStorageBreakdown,
  extras?: { documentCount?: number; measuredAt?: string | null },
): StorageOverview {
  const measured = sources.filter((source) => source.status === 'measured')
  const localBytes = measured.reduce((sum, source) => sum + (source.bytes ?? 0), 0)
  const measuredDocuments = measured.reduce((sum, source) => sum + (source.documentCount ?? 0), 0)
  const hasProblem = sources.some(
    (source) =>
      source.status === 'failed' ||
      source.status === 'permission_required' ||
      source.status === 'unavailable' ||
      source.status === 'skipped',
  )
  const warnings: StorageOverviewWarning[] = []
  const warning = storageSourceWarning(sources)
  if (warning) warnings.push(warning)

  let status: StorageOverview['status'] = 'measured'
  if (sources.length === 0) status = 'empty'
  else if (measured.length === 0 && hasProblem) status = 'unavailable'
  else if (hasProblem) status = 'partial'

  return {
    knowledgeTotalBytes: measured.length > 0 ? localBytes : null,
    knowledgeDocumentCount: measuredDocuments || extras?.documentCount || 0,
    sourceCount: sources.length,
    localBytes: measured.length > 0 ? localBytes : null,
    cloudBytes: null,
    appStorageTotalBytes:
      appStorage.indexBytes +
      appStorage.activityBytes +
      appStorage.cacheBytes +
      appStorage.logsBytes +
      appStorage.workflowsBytes +
      appStorage.settingsBytes +
      appStorage.licenseBytes,
    sources,
    appStorage,
    measuredAt: extras?.measuredAt ?? (sources[0]?.lastMeasuredAt ?? null),
    status,
    warnings,
  }
}

function recordMeasurementDiagnostics(sources: StorageSource[]) {
  const failed = sources.filter((source) => source.status !== 'measured' && source.status !== 'not_connected')
  if (failed.length === 0) return
  try {
    const { app } = require('electron') as typeof import('electron')
    const layout = storageLayout(app.getPath('userData'))
    mkdirSync(layout.diagnosticsDir, { recursive: true })
    writeFileSync(
      path.join(layout.diagnosticsDir, 'storage-measurement.json'),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          platform: process.platform,
          sources: failed.map((source) => ({
            id: source.id,
            kind: source.kind,
            status: source.status,
            errorCode: source.errorCode ?? null,
          })),
        },
        null,
        2,
      ),
      'utf8',
    )
  } catch {
    // Diagnostics must never break the overview.
  }
}

export function getStorageOverview(): StorageOverview {
  try {
    const settings = loadSettings()
    const index = loadIndex()
    const { app } = require('electron') as typeof import('electron')
    const appStorage = getAppStorageBreakdown(app.getPath('userData'))
    const now = new Date().toISOString()
    const sources = measureIndexedLocations(settings.indexedLocations, index, now)
    recordMeasurementDiagnostics(sources)
    return assembleStorageOverview(sources, appStorage, {
      documentCount: settings.indexedFileCount,
      measuredAt: now,
    })
  } catch {
    return assembleStorageOverview([], emptyAppStorage(), {
      measuredAt: new Date().toISOString(),
    })
  }
}

/** Measures indexed local folders only. Cloud sources appear when connectors ship. */
export function getDocumentStorageSummary(): DocumentStorageSummary {
  const overview = getStorageOverview()
  return {
    measuredAt: overview.measuredAt ?? new Date().toISOString(),
    totalBytes: overview.localBytes ?? 0,
    sources: overview.sources.map((source) => ({
      id: source.id,
      kind: 'local_folder',
      label: source.name,
      bytes: source.bytes ?? 0,
      fileCount: source.documentCount ?? 0,
      status:
        source.status === 'measured'
          ? 'ready'
          : source.status === 'not_connected'
            ? 'not_connected'
            : 'unavailable',
    })),
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function runDocumentStorageChecks(): void {
  const missing = measureDirectoryBytes(
    path.join(path.sep, 'suhuella-missing-folder'),
    path.join(path.sep, 'suhuella-missing-folder'),
  )
  assert(missing.error === 'unavailable', 'missing folders are unavailable, not fatal')
  assert(missing.bytes === 0 && missing.files === 0, 'missing folders must measure as empty')

  const now = '2026-09-18T18:20:00.000Z'
  const downloads = path.join(path.sep, 'Users', 'demo', 'Downloads')
  const documents = path.join(path.sep, 'Users', 'demo', 'Documents')
  const sources = measureIndexedLocations(
    [downloads, documents],
    {
      sources: [
        {
          id: 'downloads',
          type: 'local_folder',
          displayName: 'Downloads',
          rootLocator: downloads,
          status: 'ready',
          lastIndexed: now,
          itemCount: 12,
        },
        {
          id: 'documents',
          type: 'local_folder',
          displayName: 'Documents',
          rootLocator: documents,
          status: 'error',
          lastIndexed: now,
          itemCount: 40,
        },
      ],
      folders: [],
    },
  )
  assert(sources.length === 2, 'each source is measured on its own')
  assert(
    sources.every((source) => source.status === 'unavailable' || source.status === 'measured'),
    'a missing source does not fail the overview',
  )

  const partial = assembleStorageOverview(
    [
      {
        id: 'downloads',
        name: 'Downloads',
        kind: 'local_folder',
        locator: downloads,
        bytes: 80 * 1024 ** 3,
        documentCount: 1200,
        status: 'measured',
        lastMeasuredAt: now,
      },
      {
        id: 'documents',
        name: 'Documents',
        kind: 'local_folder',
        locator: documents,
        status: 'permission_required',
        errorCode: 'EACCES',
        lastMeasuredAt: now,
      },
    ],
    emptyAppStorage(),
    { measuredAt: now },
  )
  assert(partial.status === 'partial', 'one failed source keeps partial totals')
  assert(partial.localBytes === 80 * 1024 ** 3, 'measured sources still contribute to Local')
  assert(partial.cloudBytes === null, 'cloud stays unconnected, never 0 GB')
  assert(partial.warnings[0]?.code === 'permission_required', 'permission needs a soft warning')
  assert(
    !partial.warnings.some((item) => item.message.includes('EACCES')),
    'filesystem codes stay out of the warning copy',
  )

  const empty = assembleStorageOverview([], emptyAppStorage())
  assert(empty.status === 'empty', 'no sources is an empty state')
  assert(empty.knowledgeTotalBytes === null, 'empty knowledge has no invented total')
}
