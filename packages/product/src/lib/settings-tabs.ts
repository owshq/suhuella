export const SETTINGS_TAB_IDS = ['general', 'permissions', 'ai', 'license', 'support'] as const

export type SettingsTab = (typeof SETTINGS_TAB_IDS)[number]

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'general'

export const LEGACY_SETTINGS_TABS: Record<string, SettingsTab> = {
  folders: 'general',
  connections: 'general',
  privacy: 'general',
  notifications: 'general',
  storage: 'support',
  diagnostics: 'support',
  about: 'support',
}

export function isSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TAB_IDS.includes(value as SettingsTab)
}

export function resolveSettingsTab(requested: string): SettingsTab {
  if (isSettingsTab(requested)) return requested
  return LEGACY_SETTINGS_TABS[requested] ?? DEFAULT_SETTINGS_TAB
}
