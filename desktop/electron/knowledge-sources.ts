import path from 'node:path'
import type {
  IndexedFolderEntry,
  KnowledgeSource,
  KnowledgeSourcesEnabled,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
} from '../src/types.ts'

export const DEFAULT_KNOWLEDGE_SOURCES_ENABLED: KnowledgeSourcesEnabled = {
  local_folder: true,
  google_drive: false,
  dropbox: false,
  onedrive: false,
  gmail: false,
  outlook: false,
  manual_import: false,
}

export function localSourceId(rootLocator: string): string {
  const normalized = path.normalize(rootLocator.trim())
  return `src_local_${Buffer.from(normalized, 'utf8').toString('base64url')}`
}

export function createLocalKnowledgeSource(
  rootLocator: string,
  options?: {
    status?: KnowledgeSourceStatus
    lastIndexed?: string | null
    itemCount?: number
    errorMessage?: string
  },
): KnowledgeSource {
  const locator = path.normalize(rootLocator.trim())
  return {
    id: localSourceId(locator),
    type: 'local_folder',
    displayName: path.basename(locator) || locator,
    rootLocator: locator,
    status: options?.status ?? 'ready',
    lastIndexed: options?.lastIndexed ?? null,
    itemCount: options?.itemCount ?? 0,
    errorMessage: options?.errorMessage,
  }
}

export function sourcesFromLocalLocations(
  locations: string[],
  options?: { lastIndexed?: string | null; status?: KnowledgeSourceStatus },
): KnowledgeSource[] {
  return [...new Set(locations.map((location) => path.normalize(location.trim())))]
    .filter(Boolean)
    .map((location) =>
      createLocalKnowledgeSource(location, {
        lastIndexed: options?.lastIndexed ?? null,
        status: options?.status ?? 'ready',
      }),
    )
}

export function findSourceForPath(
  absolutePath: string,
  sources: KnowledgeSource[],
): KnowledgeSource | undefined {
  const normalized = path.normalize(absolutePath)
  return sources
    .filter((source) => source.type === 'local_folder')
    .sort((left, right) => right.rootLocator.length - left.rootLocator.length)
    .find(
      (source) =>
        normalized === source.rootLocator ||
        normalized.startsWith(`${source.rootLocator}${path.sep}`),
    )
}

export function attachLocalSource(
  folder: IndexedFolderEntry,
  sources: KnowledgeSource[],
): IndexedFolderEntry {
  const source = findSourceForPath(folder.absolutePath, sources) ?? sources[0]
  const sourceId = source?.id ?? localSourceId(folder.absolutePath)
  const sourceType: KnowledgeSourceType = source?.type ?? 'local_folder'

  return {
    ...folder,
    sourceId,
    sourceType,
    kind: folder.kind ?? 'folder',
    name: folder.name || folder.folderName,
    locator: folder.locator || folder.absolutePath,
  }
}

export function normalizeKnowledgeSourcesEnabled(
  value: unknown,
): KnowledgeSourcesEnabled {
  const parsed = value && typeof value === 'object' ? (value as Partial<KnowledgeSourcesEnabled>) : {}
  return {
    local_folder: parsed.local_folder !== false,
    google_drive: false,
    dropbox: false,
    onedrive: false,
    gmail: false,
    outlook: false,
    manual_import: false,
  }
}
