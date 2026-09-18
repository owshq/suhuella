/// <reference types="vite/client" />

import type { AppInfo, AppSettings, SuggestionPayload } from './types'

export type SuhuellaAPI = {
  getSettings: () => Promise<AppSettings>
  addFavouriteFolder: () => Promise<AppSettings>
  removeFavouriteFolder: (folder: string) => Promise<AppSettings>
  setLaunchAtLogin: (enabled: boolean) => Promise<AppSettings>
  getSettingsPath: () => Promise<string>
  revealSettingsFile: () => Promise<void>
  getAppInfo: () => Promise<AppInfo>
  finishOnboarding: () => Promise<AppSettings>
  testSuggestion: () => Promise<void>
  getSuggestion: () => Promise<SuggestionPayload | null>
  onSuggestionUpdated: (listener: (payload: SuggestionPayload) => void) => () => void
  chooseRecommendedFolder: (folder: string) => Promise<void>
  chooseAnotherFolder: () => Promise<void>
  closeSuggestion: () => Promise<void>
}

declare global {
  interface Window {
    suhuella: SuhuellaAPI
  }
}

export {}
