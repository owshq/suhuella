import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { FolderIndex, IndexedFolderEntry, KnowledgeSource } from '@suhuella/product/types.ts'
import {
  attachLocalSource,
  sourcesFromLocalLocations,
} from './knowledge-sources.ts'

const INDEX_FILE = 'index.json'
const INDEX_VERSION = 2

const EMPTY_INDEX: FolderIndex = {
  version: INDEX_VERSION,
  indexVersion: INDEX_VERSION,
  generatedAt: null,
  indexedAt: null,
  locations: [],
  sources: [],
  folders: [],
  files: [],
}

export function getIndexFilePath(): string {
  return path.join(app.getPath('userData'), INDEX_FILE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function migrateIndex(parsed: Record<string, unknown>): FolderIndex {
  const indexedAt =
    typeof parsed.indexedAt === 'string'
      ? parsed.indexedAt
      : typeof parsed.generatedAt === 'string'
        ? parsed.generatedAt
        : null
  const locations = Array.isArray(parsed.locations)
    ? parsed.locations.filter((item): item is string => typeof item === 'string')
    : []
  const rawFolders = Array.isArray(parsed.folders) ? parsed.folders : []
  const declaredSources = Array.isArray(parsed.sources)
    ? parsed.sources.filter((item): item is KnowledgeSource => {
        return (
          isRecord(item) &&
          typeof item.id === 'string' &&
          typeof item.type === 'string' &&
          typeof item.rootLocator === 'string'
        )
      })
    : []

  const sources =
    declaredSources.length > 0
      ? declaredSources.map((source) => ({
          ...source,
          displayName: source.displayName || path.basename(source.rootLocator),
          status: source.status ?? 'ready',
          lastIndexed: source.lastIndexed ?? indexedAt,
          itemCount: typeof source.itemCount === 'number' ? source.itemCount : 0,
        }))
      : sourcesFromLocalLocations(locations, { lastIndexed: indexedAt })

  const folders = rawFolders
    .filter((item): item is IndexedFolderEntry => isRecord(item) && typeof item.absolutePath === 'string')
    .map((folder) => attachLocalSource(folder, sources))

  const withCounts = sources.map((source) => ({
    ...source,
    itemCount: folders.filter((folder) => folder.sourceId === source.id).length,
    lastIndexed: source.lastIndexed ?? indexedAt,
  }))

  return {
    version: INDEX_VERSION,
    indexVersion: INDEX_VERSION,
    generatedAt: indexedAt,
    indexedAt,
    locations: withCounts
      .filter((source) => source.type === 'local_folder')
      .map((source) => source.rootLocator),
    sources: withCounts,
    folders,
    files: Array.isArray(parsed.files) ? (parsed.files as FolderIndex['files']) : [],
  }
}

export function loadIndex(): FolderIndex {
  const filePath = getIndexFilePath()
  if (!existsSync(filePath)) {
    return { ...EMPTY_INDEX }
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed.folders)) {
      return { ...EMPTY_INDEX }
    }
    return migrateIndex(parsed)
  } catch {
    return { ...EMPTY_INDEX }
  }
}

export function saveIndex(index: FolderIndex): FolderIndex {
  const filePath = getIndexFilePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  const next = migrateIndex({
    ...index,
    version: INDEX_VERSION,
    indexVersion: INDEX_VERSION,
    generatedAt: index.generatedAt ?? index.indexedAt,
    indexedAt: index.indexedAt,
  })
  writeFileSync(filePath, JSON.stringify(next), 'utf8')
  return next
}

export function clearIndex(): FolderIndex {
  return saveIndex({ ...EMPTY_INDEX })
}
