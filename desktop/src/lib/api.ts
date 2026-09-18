import type { SuhuellaAPI } from '../vite-env'

export function getSuhuellaApi(): SuhuellaAPI {
  if (!window.suhuella) {
    throw new Error('SuHuella desktop API is not available. Open the app from Electron, not the browser.')
  }
  return window.suhuella
}
