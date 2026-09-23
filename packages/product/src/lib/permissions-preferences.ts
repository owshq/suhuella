import type { AppPermissionPreferences } from '../types.ts'

export const DEFAULT_PERMISSION_PREFERENCES: AppPermissionPreferences = {
  allowFolderChanges: true,
  trashEnabled: false,
}

export function normalizePermissionPreferences(value: unknown): AppPermissionPreferences {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PERMISSION_PREFERENCES }
  }
  const record = value as Partial<AppPermissionPreferences>
  return {
    allowFolderChanges:
      typeof record.allowFolderChanges === 'boolean' ? record.allowFolderChanges : true,
    trashEnabled: typeof record.trashEnabled === 'boolean' ? record.trashEnabled : false,
  }
}
