import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo, AppSettings, SuggestionPayload } from '../src/types.ts'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  addFavouriteFolder: (): Promise<AppSettings> => ipcRenderer.invoke('settings:addFolder'),
  removeFavouriteFolder: (folder: string): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:removeFolder', folder),
  setLaunchAtLogin: (enabled: boolean): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:setLaunchAtLogin', enabled),
  getSettingsPath: (): Promise<string> => ipcRenderer.invoke('settings:getPath'),
  revealSettingsFile: (): Promise<void> => ipcRenderer.invoke('settings:revealFile'),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
  finishOnboarding: (): Promise<AppSettings> => ipcRenderer.invoke('onboarding:finish'),
  testSuggestion: (): Promise<void> => ipcRenderer.invoke('suggestion:test'),
  getSuggestion: (): Promise<SuggestionPayload | null> => ipcRenderer.invoke('suggestion:get'),
  onSuggestionUpdated: (listener: (payload: SuggestionPayload) => void): (() => void) => {
    const handler = (_event: unknown, payload: SuggestionPayload) => listener(payload)
    ipcRenderer.on('suggestion:updated', handler)
    return () => {
      ipcRenderer.removeListener('suggestion:updated', handler)
    }
  },
  chooseRecommendedFolder: (folder: string): Promise<void> =>
    ipcRenderer.invoke('suggestion:choose', folder),
  chooseAnotherFolder: (): Promise<void> => ipcRenderer.invoke('suggestion:chooseAnother'),
  closeSuggestion: (): Promise<void> => ipcRenderer.invoke('suggestion:close'),
}

try {
  contextBridge.exposeInMainWorld('suhuella', api)
} catch (error) {
  console.error('[suhuella] failed to expose preload API', error)
}
