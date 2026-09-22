import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
  canPersistSourceAppearanceColor,
  isCorporateColor,
  isCustomizableIconId,
  normalizeSourceAppearanceStore,
  normalizeSourceKey,
  resolveSourceIdentity,
  sourceLabelFromPath,
} from '@suhuella/product/lib/source-appearance.ts'
import type { AppSettings, SourceIconId, SuggestedLocationKind } from '@suhuella/product/types.ts'
import { DEFAULT_KNOWLEDGE_SOURCES_ENABLED, normalizeKnowledgeSourcesEnabled } from './knowledge-sources.ts'

const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  indexedLocations: [],
  indexedFolderCount: 0,
  indexedFileCount: 0,
  lastIndexed: null,
  lastLearnedNewFiles: null,
  lastLearnedUpdatedFolders: null,
  firstRunCompleted: false,
  launchAtLogin: false,
  welcomeNotificationShown: false,
  knowledgeSourcesEnabled: { ...DEFAULT_KNOWLEDGE_SOURCES_ENABLED },
  recentFolders: [],
  sourceAppearance: {},
}

function normalizeLocation(location: string): string {
  return path.normalize(location.trim())
}

function settingsPlatform(): 'darwin' | 'win32' | 'linux' {
  if (process.platform === 'win32') return 'win32'
  if (process.platform === 'linux') return 'linux'
  return 'darwin'
}

function appearanceHintsForPath(
  path: string,
  indexedLocations: string[],
): { name?: string; kind?: SuggestedLocationKind } | undefined {
  const key = normalizeSourceKey(path)
  const indexed = indexedLocations.find((location) => normalizeSourceKey(location) === key)
  if (indexed) return { name: sourceLabelFromPath(indexed) }
  return resolveSourceIdentity(path, settingsPlatform())
}

export function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

function normalizeSettings(parsed: Partial<AppSettings> & { favouriteFolders?: string[] }): AppSettings {
  const indexedLocations = Array.isArray(parsed.indexedLocations)
    ? parsed.indexedLocations.filter((item): item is string => typeof item === 'string')
    : Array.isArray(parsed.favouriteFolders)
      ? parsed.favouriteFolders.filter((item): item is string => typeof item === 'string')
      : []

  return {
    indexedLocations,
    indexedFolderCount:
      typeof parsed.indexedFolderCount === 'number' && parsed.indexedFolderCount >= 0
        ? parsed.indexedFolderCount
        : 0,
    indexedFileCount:
      typeof parsed.indexedFileCount === 'number' && parsed.indexedFileCount >= 0
        ? parsed.indexedFileCount
        : 0,
    lastIndexed: typeof parsed.lastIndexed === 'string' ? parsed.lastIndexed : null,
    lastLearnedNewFiles:
      typeof parsed.lastLearnedNewFiles === 'number' && parsed.lastLearnedNewFiles >= 0
        ? parsed.lastLearnedNewFiles
        : null,
    lastLearnedUpdatedFolders:
      typeof parsed.lastLearnedUpdatedFolders === 'number' && parsed.lastLearnedUpdatedFolders >= 0
        ? parsed.lastLearnedUpdatedFolders
        : null,
    firstRunCompleted: Boolean(parsed.firstRunCompleted),
    launchAtLogin:
      typeof parsed.launchAtLogin === 'boolean' ? parsed.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    welcomeNotificationShown: Boolean(parsed.welcomeNotificationShown),
    knowledgeSourcesEnabled: normalizeKnowledgeSourcesEnabled(parsed.knowledgeSourcesEnabled),
    recentFolders: Array.isArray(parsed.recentFolders)
      ? parsed.recentFolders.filter((item): item is string => typeof item === 'string')
      : [],
    sourceAppearance: normalizeSourceAppearanceStore(parsed.sourceAppearance, settingsPlatform()),
  }
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsFilePath()
  if (!existsSync(filePath)) {
    return saveSettings({ ...DEFAULT_SETTINGS })
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AppSettings> & {
      favouriteFolders?: string[]
    }
    const normalized = normalizeSettings(parsed)
    const needsWrite =
      typeof parsed.launchAtLogin !== 'boolean' ||
      typeof parsed.welcomeNotificationShown !== 'boolean' ||
      'recommendationModel' in parsed ||
      (!Array.isArray(parsed.indexedLocations) && !Array.isArray(parsed.favouriteFolders)) ||
      typeof parsed.indexedFolderCount !== 'number' ||
      typeof parsed.indexedFileCount !== 'number' ||
      (parsed.lastIndexed !== null && typeof parsed.lastIndexed !== 'string') ||
      !parsed.knowledgeSourcesEnabled ||
      (parsed.knowledgeSourcesEnabled != null &&
        typeof parsed.knowledgeSourcesEnabled === 'object' &&
        'byok_ai' in parsed.knowledgeSourcesEnabled)
    return needsWrite ? saveSettings(normalized) : normalized
  } catch {
    return saveSettings({ ...DEFAULT_SETTINGS })
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const filePath = getSettingsFilePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  const next: AppSettings = {
    indexedLocations: [...new Set(settings.indexedLocations.map(normalizeLocation))],
    indexedFolderCount: Math.max(0, settings.indexedFolderCount),
    indexedFileCount: Math.max(0, settings.indexedFileCount),
    lastIndexed: settings.lastIndexed,
    lastLearnedNewFiles: settings.lastLearnedNewFiles,
    lastLearnedUpdatedFolders: settings.lastLearnedUpdatedFolders,
    firstRunCompleted: settings.firstRunCompleted,
    launchAtLogin: settings.launchAtLogin,
    welcomeNotificationShown: settings.welcomeNotificationShown,
    knowledgeSourcesEnabled: normalizeKnowledgeSourcesEnabled(settings.knowledgeSourcesEnabled),
    recentFolders: [...new Set(settings.recentFolders.map(normalizeLocation))].filter(Boolean).slice(0, 8),
    sourceAppearance: normalizeSourceAppearanceStore(settings.sourceAppearance, settingsPlatform()),
  }
  writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function recordRecentFolder(location: string): AppSettings {
  const normalized = normalizeLocation(location)
  if (!normalized) return loadSettings()
  const settings = loadSettings()
  const recentFolders = [
    normalized,
    ...settings.recentFolders.filter((item) => item !== normalized),
  ].slice(0, 8)
  return saveSettings({ ...settings, recentFolders })
}

export function addIndexedLocation(location: string): AppSettings {
  const settings = loadSettings()
  const normalized = normalizeLocation(location)
  if (!normalized || settings.indexedLocations.includes(normalized)) {
    return settings
  }
  const recentFolders = [
    normalized,
    ...settings.recentFolders.filter((item) => item !== normalized),
  ].slice(0, 8)
  return saveSettings({
    ...settings,
    indexedLocations: [...settings.indexedLocations, normalized],
    recentFolders,
  })
}

export function removeIndexedLocation(location: string): AppSettings {
  const settings = loadSettings()
  const normalized = normalizeLocation(location)
  const appearanceKey = normalizeSourceKey(normalized)
  const sourceAppearance = { ...settings.sourceAppearance }
  delete sourceAppearance[appearanceKey]
  return saveSettings({
    ...settings,
    indexedLocations: settings.indexedLocations.filter((item) => item !== normalized),
    sourceAppearance,
  })
}

export function setIndexedLocations(locations: string[]): AppSettings {
  const settings = loadSettings()
  const indexedLocations = [...new Set(locations.map(normalizeLocation))].filter(Boolean)
  const added = indexedLocations.filter((item) => !settings.indexedLocations.includes(item))
  const recentFolders = [
    ...added,
    ...settings.recentFolders.filter((item) => !added.includes(item)),
  ].slice(0, 8)
  return saveSettings({
    ...settings,
    indexedLocations,
    recentFolders,
  })
}

export function updateIndexMetadata(
  folderCount: number,
  indexedAt: string | null,
  fileCount = 0,
): AppSettings {
  const current = loadSettings()
  const previousFileCount = current.indexedFileCount
  const previousFolderCount = current.indexedFolderCount
  const nextFileCount = Math.max(0, fileCount)
  const nextFolderCount = Math.max(0, folderCount)
  const lastLearnedNewFiles =
    indexedAt && previousFileCount > 0
      ? Math.max(0, nextFileCount - previousFileCount)
      : indexedAt
        ? nextFileCount
        : null
  const lastLearnedUpdatedFolders =
    indexedAt && previousFolderCount > 0
      ? Math.max(0, nextFolderCount - previousFolderCount)
      : indexedAt
        ? nextFolderCount
        : null

  return saveSettings({
    ...current,
    indexedFolderCount: nextFolderCount,
    indexedFileCount: nextFileCount,
    lastIndexed: indexedAt,
    lastLearnedNewFiles,
    lastLearnedUpdatedFolders,
  })
}

export type SourceAppearanceUpdate = {
  color?: string | null
  iconId?: SourceIconId | null
}

export function setSourceAppearance(path: string, update: SourceAppearanceUpdate): AppSettings {
  const settings = loadSettings()
  const key = normalizeSourceKey(path)
  if (!key) return settings
  const hints = appearanceHintsForPath(path, settings.indexedLocations)
  if (!canPersistSourceAppearanceColor(path, settingsPlatform(), hints)) return settings

  const next = { ...settings.sourceAppearance }
  const current = { ...next[key] }

  if ('color' in update) {
    const color = update.color
    if (color && isCorporateColor(color)) current.color = color
    else delete current.color
  }
  if ('iconId' in update) {
    const iconId = update.iconId
    if (iconId && isCustomizableIconId(iconId)) current.iconId = iconId
    else delete current.iconId
  }

  if (Object.keys(current).length === 0) delete next[key]
  else next[key] = current

  return saveSettings({ ...settings, sourceAppearance: next })
}

export function setSourceAppearanceColor(path: string, color: string | null): AppSettings {
  if (color !== null && !isCorporateColor(color)) return loadSettings()
  return setSourceAppearance(path, { color })
}

export function setLaunchAtLogin(enabled: boolean): AppSettings {
  return saveSettings({
    ...loadSettings(),
    launchAtLogin: enabled,
  })
}

export function markWelcomeNotificationShown(): AppSettings {
  const settings = loadSettings()
  if (settings.welcomeNotificationShown) return settings
  return saveSettings({
    ...settings,
    welcomeNotificationShown: true,
  })
}

export function markFirstRunCompleted(): AppSettings {
  const settings = loadSettings()
  if (settings.firstRunCompleted) return settings
  return saveSettings({
    ...settings,
    firstRunCompleted: true,
  })
}

export function shouldShowOnboarding(settings: AppSettings = loadSettings()): boolean {
  return !settings.firstRunCompleted
}
