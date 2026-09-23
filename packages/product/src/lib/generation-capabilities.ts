import type { LicenseEdition } from '../types.ts'

/** Mirrors site/lib/license-context.ts — edition baseline, not generation-gated. */
const FREE_CAPABILITIES = [
  'recommend_folder',
  'explain_recommendation',
  'navigate_save_dialog',
  'copy_path',
  'open_folder',
  'refresh_index',
] as const

const PERSONAL_CAPABILITIES = [
  ...FREE_CAPABILITIES,
  'create_folder',
  'rename_file',
  'move_file',
  'apply_bulk_organisation',
] as const

const LIVE_COLLAB_CAPABILITIES = [...PERSONAL_CAPABILITIES, 'save_attachment'] as const

export function editionCapabilities(edition: LicenseEdition): readonly string[] {
  if (edition === 'free') return FREE_CAPABILITIES
  if (edition === 'personal_lifetime') return PERSONAL_CAPABILITIES
  if (edition === 'business' || edition === 'enterprise') {
    return [...LIVE_COLLAB_CAPABILITIES, 'business_branding']
  }
  return LIVE_COLLAB_CAPABILITIES
}

/** Capabilities that mutate user files and require executor enforcement. */
export const EXECUTOR_GATED_CAPABILITIES = [
  'apply_bulk_organisation',
  'create_folder',
  'rename_file',
  'move_file',
  'save_attachment',
] as const

export type ExecutorGatedCapability = (typeof EXECUTOR_GATED_CAPABILITIES)[number]

export function organisationPlanCapability(): ExecutorGatedCapability {
  return 'apply_bulk_organisation'
}
