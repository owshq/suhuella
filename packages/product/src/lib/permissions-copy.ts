import type { AppHost, ByokStatus, PlanAssistantStatus } from '../types.ts'
import { productCopy } from './product-copy.ts'
import { byokConnectAvailable } from './byok-storage-copy.ts'

export const PERMISSIONS_SECTION_LEAD = productCopy(
  'What SuHuella is allowed to do on this device. Revoke any permission here.',
)

export const PERMISSION_VIEW_FOLDERS_TITLE = 'View folders'
export const PERMISSION_VIEW_FOLDERS_DETAIL = productCopy(
  'Same state as Sources — SuHuella can read indexed folders you added there.',
)

export const PERMISSION_CHANGE_FOLDERS_TITLE = 'Change folders / Confirm Plan'
export const PERMISSION_CHANGE_FOLDERS_DETAIL = productCopy(
  'Implicit when you grant folder access. Confirm Plan applies moves only while this stays on.',
)

export const PERMISSION_TRASH_TITLE = 'Trash'
export const PERMISSION_TRASH_DETAIL = productCopy(
  'Send files to the system Trash. Not active in this version.',
)

export const PERMISSION_MODEL_TITLE = 'Send to a model'
export const PERMISSION_MODEL_LINK = 'Open Settings → AI'

export const PERMISSION_SCREEN_TITLE = 'Record screen'
export const PERMISSION_SCREEN_DETAIL = 'Próximamente'

export const PERMISSION_KEY_STORAGE_UNAVAILABLE = productCopy(
  'This computer cannot store encrypted keys right now. Connect a local model in Settings → AI instead.',
)

export function permissionViewFoldersStatus(indexedCount: number): string {
  if (indexedCount === 0) return 'Not connected'
  return indexedCount === 1 ? '1 folder indexed' : `${indexedCount} folders indexed`
}

export function permissionChangeFoldersStatus(
  indexedCount: number,
  allowed: boolean,
  canOrganise: boolean,
): string {
  if (!canOrganise) return 'Not available in this browser'
  if (indexedCount === 0) return 'Add a folder in Sources first'
  if (!allowed) return 'Off — Confirm Plan is blocked'
  return 'On — moves apply when you Confirm Plan'
}

export function permissionModelStatus(
  host: AppHost,
  byok: ByokStatus | null,
  assistant: PlanAssistantStatus | null,
): { label: string; tone: 'active' | 'muted' | 'error' } {
  if (host !== 'browser' && byok?.keyStorageAvailable === false && !byok.connected) {
    return { label: PERMISSION_KEY_STORAGE_UNAVAILABLE, tone: 'error' }
  }
  if (byok?.connected && byok.assistant === 'local_server') {
    return { label: `Local (${byok.model ?? 'Ollama/LM Studio'})`, tone: 'active' }
  }
  if (byok?.connected && byok.assistant && byok.assistant !== 'local_server') {
    const cloud =
      byok.assistant === 'openai'
        ? 'OpenAI'
        : byok.assistant === 'anthropic'
          ? 'Anthropic'
          : 'Compatible API'
    return { label: `Cloud (${cloud})`, tone: 'active' }
  }
  if (host === 'browser' && !byokConnectAvailable(host)) {
    return { label: 'Cloud assistants need the desktop app', tone: 'muted' }
  }
  const using = assistant?.using
  if (using?.backend === 'on_device') {
    return { label: 'Built-in rules (no model)', tone: 'muted' }
  }
  return { label: 'Not connected', tone: 'muted' }
}
