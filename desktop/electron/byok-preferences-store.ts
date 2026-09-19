import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/** Notes for future AI conversations only. Not engine rules. Not teaching. */
const PREFERENCES_FILE = 'byok-preferences.json'
const MAX_PREFERENCES = 50

export type ByokUserPreference = {
  id: string
  text: string
  createdAt: string
}

type PreferenceLog = {
  version: number
  updatedAt: string
  preferences: ByokUserPreference[]
}

const EMPTY_LOG: PreferenceLog = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  preferences: [],
}

function filePath(userDataDir: string): string {
  return path.join(userDataDir, PREFERENCES_FILE)
}

function readLog(userDataDir: string): PreferenceLog {
  const fp = filePath(userDataDir)
  if (!existsSync(fp)) return { ...EMPTY_LOG, preferences: [] }
  try {
    const parsed = JSON.parse(readFileSync(fp, 'utf8')) as Partial<PreferenceLog>
    const preferences = Array.isArray(parsed.preferences)
      ? parsed.preferences.filter(
          (item): item is ByokUserPreference =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as ByokUserPreference).id === 'string' &&
            typeof (item as ByokUserPreference).text === 'string',
        )
      : []
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      preferences,
    }
  } catch {
    return { ...EMPTY_LOG, preferences: [] }
  }
}

function writeLog(userDataDir: string, log: PreferenceLog): void {
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(filePath(userDataDir), `${JSON.stringify(log, null, 2)}\n`, 'utf8')
}

export function listByokPreferences(userDataDir: string): ByokUserPreference[] {
  return readLog(userDataDir).preferences
}

export function addByokPreference(userDataDir: string, text: string): ByokUserPreference[] {
  const trimmed = text.trim()
  if (!trimmed) return readLog(userDataDir).preferences

  const current = readLog(userDataDir)
  const next: ByokUserPreference = {
    id: `pref_${Date.now()}`,
    text: trimmed.slice(0, 500),
    createdAt: new Date().toISOString(),
  }
  const preferences = [next, ...current.preferences.filter((item) => item.text !== next.text)].slice(
    0,
    MAX_PREFERENCES,
  )
  writeLog(userDataDir, {
    version: 1,
    updatedAt: new Date().toISOString(),
    preferences,
  })
  return preferences
}

export function preferencesForPrompt(userDataDir: string): string[] {
  return listByokPreferences(userDataDir).map((item) => item.text)
}
