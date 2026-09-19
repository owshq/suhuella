import path from 'node:path'

export const CACHE_DIR = 'cache'
export const LOGS_DIR = 'logs'
export const DIAGNOSTICS_DIR = 'diagnostics'

export type StorageLayout = {
  root: string
  settings: string
  license: string
  device: string
  index: string
  activity: string
  byok: string
  workflows: string
  cacheDir: string
  logsDir: string
  diagnosticsDir: string
}

export function storageLayout(userDataDir: string): StorageLayout {
  return {
    root: userDataDir,
    settings: path.join(userDataDir, 'settings.json'),
    license: path.join(userDataDir, 'license.json'),
    device: path.join(userDataDir, 'device.json'),
    index: path.join(userDataDir, 'index.json'),
    activity: path.join(userDataDir, 'activity.json'),
    byok: path.join(userDataDir, 'byok.json'),
    workflows: path.join(userDataDir, 'workflows.json'),
    cacheDir: path.join(userDataDir, CACHE_DIR),
    logsDir: path.join(userDataDir, LOGS_DIR),
    diagnosticsDir: path.join(userDataDir, DIAGNOSTICS_DIR),
  }
}
