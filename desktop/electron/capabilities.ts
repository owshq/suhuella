import { isIntentImplemented } from './intents.ts'
import type {
  ActionDefinition,
  ActionId,
  CapabilityDefinition,
  CapabilityId,
  Intent,
  IntentId,
} from '../src/types.ts'

/**
 * Capability Kernel — proposes never execute.
 *
 * Intent Resolver selects an intent. This registry maps intent → capability.
 * The recommendation engine never selects capabilities.
 *
 * Local Intelligence may enrich descriptors before ranking.
 * Connectors may add Knowledge Index items.
 * BYOK is an optional assistant after recommendation — it never ranks.
 * None of them execute actions or skip this registry.
 */

const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'recommend_folder',
    intent: 'store_file',
    safety: 'SAFE_NOW',
    implemented: true,
    executes: null,
  },
  {
    id: 'explain_recommendation',
    intent: 'inspect_recommendation',
    safety: 'SAFE_NOW',
    implemented: true,
    executes: null,
  },
  {
    id: 'navigate_save_dialog',
    intent: 'store_file',
    safety: 'SAFE_NOW',
    implemented: true,
    executes: 'navigate_save_dialog',
  },
  {
    id: 'copy_path',
    intent: 'browse_folder',
    safety: 'SAFE_NOW',
    implemented: true,
    executes: 'copy_path',
  },
  {
    id: 'open_folder',
    intent: 'browse_folder',
    safety: 'SAFE_NOW',
    implemented: true,
    executes: 'open_folder',
  },
  {
    id: 'refresh_index',
    intent: 'refresh_knowledge',
    safety: 'SAFE_NOW',
    implemented: true,
    executes: 'refresh_index',
  },
  {
    id: 'create_folder',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'rename_file',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'move_file',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'save_attachment',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'download_file',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'upload_to_cloud',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'apply_bulk_organisation',
    intent: 'store_file',
    safety: 'CONFIRM_REQUIRED',
    implemented: false,
    executes: null,
  },
  {
    id: 'delete_file',
    intent: 'store_file',
    safety: 'FORBIDDEN',
    implemented: false,
    executes: null,
  },
  {
    id: 'overwrite_file',
    intent: 'store_file',
    safety: 'FORBIDDEN',
    implemented: false,
    executes: null,
  },
  {
    id: 'send_email',
    intent: 'store_file',
    safety: 'FORBIDDEN',
    implemented: false,
    executes: null,
  },
  {
    id: 'modify_document_content',
    intent: 'store_file',
    safety: 'FORBIDDEN',
    implemented: false,
    executes: null,
  },
  {
    id: 'auto_save_without_user',
    intent: 'store_file',
    safety: 'FORBIDDEN',
    implemented: false,
    executes: null,
  },
  {
    id: 'background_cloud_sync',
    intent: 'refresh_knowledge',
    safety: 'FORBIDDEN',
    implemented: false,
    executes: null,
  },
]

const ACTIONS: ActionDefinition[] = [
  { id: 'copy_path', capability: 'copy_path', safety: 'SAFE_NOW', implemented: true },
  { id: 'open_folder', capability: 'open_folder', safety: 'SAFE_NOW', implemented: true },
  {
    id: 'navigate_save_dialog',
    capability: 'navigate_save_dialog',
    safety: 'SAFE_NOW',
    implemented: true,
  },
  { id: 'refresh_index', capability: 'refresh_index', safety: 'SAFE_NOW', implemented: true },
]

function capabilityById(id: CapabilityId): CapabilityDefinition | undefined {
  return CAPABILITIES.find((item) => item.id === id)
}

function actionById(id: ActionId): ActionDefinition | undefined {
  return ACTIONS.find((item) => item.id === id)
}

export function listCapabilities(): CapabilityDefinition[] {
  return CAPABILITIES.map((item) => ({ ...item }))
}

function intentKind(intent: Intent | IntentId): IntentId {
  return typeof intent === 'string' ? intent : intent.kind
}

export function resolveCapabilities(intent: Intent | IntentId): CapabilityDefinition[] {
  const kind = intentKind(intent)
  if (!isIntentImplemented(kind)) return []

  return CAPABILITIES.filter(
    (item) => item.intent === kind && item.implemented && item.safety === 'SAFE_NOW',
  ).map((item) => ({ ...item }))
}

export function intentAllowsCapability(intent: Intent | IntentId, id: CapabilityId): boolean {
  return resolveCapabilities(intent).some((item) => item.id === id)
}

export function isCapabilityAvailable(id: CapabilityId): boolean {
  const capability = capabilityById(id)
  return Boolean(capability && capability.safety === 'SAFE_NOW' && capability.implemented)
}

export function canExecuteAction(id: ActionId): boolean {
  const action = actionById(id)
  const capability = action ? capabilityById(action.capability) : undefined
  return Boolean(
    action &&
      capability &&
      action.safety === 'SAFE_NOW' &&
      action.implemented &&
      capability.safety === 'SAFE_NOW' &&
      capability.implemented,
  )
}

export function assertCanExecute(id: ActionId): void {
  if (!canExecuteAction(id)) {
    throw new Error(`Capability kernel blocked action: ${id}`)
  }
}

export function assertCapabilityKernelFrozen(): void {
  for (const item of CAPABILITIES) {
    if (item.safety !== 'SAFE_NOW' && (item.implemented || item.executes)) {
      throw new Error(`Capability ${item.id} is ${item.safety} but marked executable`)
    }
  }

  for (const item of ACTIONS) {
    if (item.safety !== 'SAFE_NOW' || !item.implemented) {
      throw new Error(`Action ${item.id} must stay SAFE_NOW and implemented`)
    }
    if (!canExecuteAction(item.id)) {
      throw new Error(`Action ${item.id} is not executable through the kernel`)
    }
  }

  if (!isCapabilityAvailable('recommend_folder')) {
    throw new Error('recommend_folder must stay SAFE_NOW and implemented')
  }
}
