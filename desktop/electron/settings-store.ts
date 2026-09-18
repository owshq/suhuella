import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings, RecommendationModel } from '../src/types.ts'

const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  favouriteFolders: [],
  firstRunCompleted: false,
  launchAtLogin: true,
  welcomeNotificationShown: false,
  recommendationModel: 'rules',
}

function normalizeRecommendationModel(value: unknown): RecommendationModel {
  return value === 'onnx' ? 'onnx' : 'rules'
}

function normalizeFolder(folder: string): string {
  return path.normalize(folder.trim())
}

export function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

function normalizeSettings(parsed: Partial<AppSettings>): AppSettings {
  return {
    favouriteFolders: Array.isArray(parsed.favouriteFolders)
      ? parsed.favouriteFolders.filter((item): item is string => typeof item === 'string')
      : [],
    firstRunCompleted: Boolean(parsed.firstRunCompleted),
    launchAtLogin:
      typeof parsed.launchAtLogin === 'boolean' ? parsed.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    welcomeNotificationShown: Boolean(parsed.welcomeNotificationShown),
    recommendationModel: normalizeRecommendationModel(parsed.recommendationModel),
  }
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsFilePath()
  if (!existsSync(filePath)) {
    return saveSettings({ ...DEFAULT_SETTINGS })
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<AppSettings>
    const normalized = normalizeSettings(parsed)
    const needsWrite =
      typeof parsed.launchAtLogin !== 'boolean' ||
      typeof parsed.welcomeNotificationShown !== 'boolean' ||
      typeof parsed.recommendationModel !== 'string' ||
      !Array.isArray(parsed.favouriteFolders)
    return needsWrite ? saveSettings(normalized) : normalized
  } catch {
    return saveSettings({ ...DEFAULT_SETTINGS })
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const filePath = getSettingsFilePath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  const next: AppSettings = {
    favouriteFolders: [...new Set(settings.favouriteFolders.map(normalizeFolder))],
    firstRunCompleted: settings.firstRunCompleted,
    launchAtLogin: settings.launchAtLogin,
    welcomeNotificationShown: settings.welcomeNotificationShown,
    recommendationModel: settings.recommendationModel,
  }
  writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function addFavouriteFolder(folder: string): AppSettings {
  const settings = loadSettings()
  const normalized = normalizeFolder(folder)
  if (!normalized || settings.favouriteFolders.includes(normalized)) {
    return settings
  }
  return saveSettings({
    ...settings,
    favouriteFolders: [...settings.favouriteFolders, normalized],
  })
}

export function removeFavouriteFolder(folder: string): AppSettings {
  const settings = loadSettings()
  const normalized = normalizeFolder(folder)
  return saveSettings({
    ...settings,
    favouriteFolders: settings.favouriteFolders.filter((item) => item !== normalized),
  })
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
