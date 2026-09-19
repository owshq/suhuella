export type FolderStart =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'

export type FolderEntry = {
  name: string
  kind: 'file' | 'folder'
  relativePath: string
}

export type FileSystemAdapter = {
  listFolderEntries: (sourceId: string, relativePath?: string) => Promise<FolderEntry[]>
  readMetadata: (sourceId: string, relativePath: string) => Promise<{ name: string; size: number; lastModified: string | null } | null>
  createFolder: (sourceId: string, relativePath: string) => Promise<void>
  renameFile: (sourceId: string, fromRelative: string, toRelative: string) => Promise<void>
  moveFile: (sourceId: string, fromRelative: string, toRelative: string) => Promise<void>
  exists: (sourceId: string, relativePath: string) => Promise<boolean>
  openOrReveal?: (target: string) => Promise<{ ok: boolean }>
  requestFolderAccess: (startIn?: FolderStart) => Promise<unknown>
  persistPermission?: (sourceId: string, handle: unknown) => Promise<void>
}

export type ActivityStoreAdapter<TRun> = {
  list: () => Promise<TRun[]>
  record: (run: TRun) => Promise<void>
  clear: () => Promise<void>
}

export type LicenseAdapter<TContext, TResult> = {
  load: () => Promise<TContext | null>
  activate: (email: string) => Promise<TResult>
  check: () => Promise<TResult>
  deactivate: () => Promise<TResult>
}

export type PlatformCapabilitiesAdapter = {
  saveAs: boolean
  tray: boolean
  openFolder: boolean
  reveal: boolean
  filesystem: boolean
  notifications: boolean
  nativeDialogs: boolean
  organise: boolean
  search: boolean
  activity: boolean
  workflows: boolean
  license: boolean
}

export type StorageAdapter<TValue> = {
  get: (key: string) => Promise<TValue | null>
  set: (key: string, value: TValue) => Promise<void>
  delete: (key: string) => Promise<void>
}
