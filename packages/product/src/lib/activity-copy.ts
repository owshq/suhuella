import type {
  ActivityItem,
  ActivityItemStatus,
  ActivityRun,
  ActivityRunSummary,
  ActivityTrigger,
  OrganisationPlanItem,
} from '../types.ts'
import { workflowIntentSummary } from './workflow-copy.ts'
import { type SourceStatus } from './source-lifecycle.ts'
import {
  sourceRemovedActivityTitle,
  sourceTransitionTitle,
} from './source-presentation.ts'

const TRIGGER_LABELS: Record<ActivityTrigger, string> = {
  organise_documents: 'Plan documents',
  move_this_file: 'Move this file',
  workflow: 'Workflow',
  autopilot: 'Autopilot',
  undo: 'Undo',
  source_event: 'Source',
  save_as: 'Save As',
}

const PLAN_ACTIVITY_TRIGGERS: ActivityTrigger[] = [
  'organise_documents',
  'workflow',
  'undo',
  'autopilot',
]

/** Plan Mode Activity — confirmed Plans and their undo runs. */
export function isPlanActivityRun(run: ActivityRun): boolean {
  return PLAN_ACTIVITY_TRIGGERS.includes(run.trigger)
}

/** Sidebar Activity — Save As, source lifecycle, and other device events. */
export function isGeneralActivityRun(run: ActivityRun): boolean {
  return !isPlanActivityRun(run)
}

export function activityTriggerLabel(trigger: ActivityTrigger): string {
  return TRIGGER_LABELS[trigger]
}

export type ActivityFilter = 'all' | 'plans' | 'undo' | 'sources' | 'save_as'

/** Visual kinds derived from the Activity model — not invented actions. */
export type ActivityIconKind =
  | 'move'
  | 'rename'
  | 'create_folder'
  | 'archive'
  | 'plan'
  | 'workflow'
  | 'undo'
  | 'source_connected'
  | 'source_removed'
  | 'source_restored'
  | 'source_unavailable'
  | 'source'

export function activityFilterForRun(run: ActivityRun): Exclude<ActivityFilter, 'all'> {
  if (run.trigger === 'undo') return 'undo'
  if (run.trigger === 'source_event') return 'sources'
  if (run.trigger === 'save_as' || run.trigger === 'move_this_file') return 'save_as'
  return 'plans'
}

export function activityItemIconKind(item: Pick<ActivityItem, 'action'>): ActivityIconKind {
  if (item.action === 'rename') return 'rename'
  if (item.action === 'create_folder' || item.action === 'create_structure') return 'create_folder'
  if (item.action === 'archive') return 'archive'
  if (item.action === 'move') return 'move'
  return 'plan'
}

function dominantItemIconKind(run: ActivityRun): ActivityIconKind {
  const applied = run.items.filter((item) => item.status === 'moved')
  const pool = applied.length > 0 ? applied : run.items
  if (pool.length === 0) return 'plan'
  const kinds = pool.map((item) => activityItemIconKind(item))
  if (kinds.every((kind) => kind === 'rename')) return 'rename'
  if (kinds.some((kind) => kind === 'create_folder')) return 'create_folder'
  if (kinds.some((kind) => kind === 'archive')) return 'archive'
  if (kinds.some((kind) => kind === 'move')) return 'move'
  if (kinds.every((kind) => kind === kinds[0])) return kinds[0] ?? 'plan'
  return 'plan'
}

function sourceEventIconKind(event: NonNullable<ActivityRun['sourceEvent']>): ActivityIconKind {
  if (event.kind === 'removed' || event.transition === 'source_removed') return 'source_removed'
  if (event.kind === 'connected' || event.transition === 'source_connected') return 'source_connected'
  if (event.kind === 'restored' || event.transition === 'source_reconnected' || event.transition === 'permission_restored') {
    return 'source_restored'
  }
  if (
    event.kind === 'unavailable' ||
    event.transition === 'source_unavailable' ||
    event.transition === 'permission_lost' ||
    event.transition === 'permission_required'
  ) {
    return 'source_unavailable'
  }
  return 'source'
}

export function activityRunIconKind(run: ActivityRun): ActivityIconKind {
  if (run.trigger === 'undo') return 'undo'
  if (run.trigger === 'save_as' || run.trigger === 'move_this_file') return 'move'
  if (run.trigger === 'source_event') {
    return run.sourceEvent ? sourceEventIconKind(run.sourceEvent) : 'source'
  }
  if (run.trigger === 'workflow' || run.trigger === 'autopilot') {
    if (run.workflowName) return 'workflow'
  }
  return dominantItemIconKind(run)
}

export function activityIconLabel(kind: ActivityIconKind): string {
  switch (kind) {
    case 'move':
      return 'Moved'
    case 'rename':
      return 'Renamed'
    case 'create_folder':
      return 'Created'
    case 'archive':
      return 'Archived'
    case 'undo':
      return 'Undo'
    case 'source_connected':
      return 'Connected'
    case 'source_removed':
      return 'Removed'
    case 'source_restored':
      return 'Restored'
    case 'source_unavailable':
      return 'Unavailable'
    case 'source':
      return 'Source'
    case 'workflow':
      return 'Workflow'
    default:
      return 'Plan'
  }
}

export function startOfLocalDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function activityDayLabel(iso: string, now = Date.now()): string {
  const completed = Date.parse(iso)
  if (!Number.isFinite(completed)) return ''
  const today = startOfLocalDay(now)
  const day = startOfLocalDay(completed)
  if (day === today) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === yesterday.getTime()) return 'Yesterday'
  return new Date(completed).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function activityWhenLabel(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function humanFolderPath(fileOrFolderPath: string, isFile = false): string {
  const parts = fileOrFolderPath.split(/[/\\]/).filter((part) => part && !/^[A-Za-z]:$/.test(part))
  const folders = isFile ? parts.slice(0, -1) : parts
  const skip = new Set(['users', 'home', 'volumes', 'private'])
  const meaningful = folders.filter((part, index) => {
    if (skip.has(part.toLowerCase())) return false
    const previous = folders[index - 1]?.toLowerCase()
    return previous !== 'users' && previous !== 'home'
  })
  const visible = (meaningful.length > 0 ? meaningful : folders).slice(-3)
  return visible.join(' / ') || fileOrFolderPath
}

export function folderFromFile(filePath: string): string {
  return humanFolderPath(filePath, true)
}

export function destinationFolderFromPlanItem(item: Pick<
  OrganisationPlanItem,
  'proposedPath' | 'alternatives'
>): string | null {
  const alternatives = item.alternatives ?? []
  if (item.proposedPath) {
    const destDir = item.proposedPath.replace(/[/\\][^/\\]+$/, '')
    const chosen = alternatives.find(
      (option: { folder: string; label?: string }) =>
        option.folder.replace(/[/\\]+$/, '') === destDir.replace(/[/\\]+$/, ''),
    )
    if (chosen?.label) {
      const trail = humanFolderPath(destDir)
      return trail.split(' / ').length >= chosen.label.split(' / ').length ? trail : chosen.label
    }
    return destDir ? humanFolderPath(destDir) : null
  }

  return alternatives[0]?.label ?? null
}

export function activityStatusFromPlanItem(item: Pick<OrganisationPlanItem, 'status'>): ActivityItemStatus {
  if (item.status === 'applied') return 'moved'
  if (item.status === 'failed') return 'failed'
  return 'skipped'
}

export function humanActivityReason(item: OrganisationPlanItem): string {
  if (item.status === 'source_unavailable') {
    return item.sourceName?.trim() ? `Waiting for ${item.sourceName.trim()}` : 'Waiting for source'
  }
  const destination = destinationFolderFromPlanItem(item)
  if (item.status === 'applied') {
    if (item.action === 'rename') {
      const nextName = item.proposedPath?.split(/[/\\]/).filter(Boolean).at(-1)
      return nextName ? `Renamed to ${nextName}` : 'Renamed'
    }
    if (item.action === 'create_folder') {
      return destination
        ? `Created folder and moved to ${destination}`
        : 'Created folder and moved to the recommended folder'
    }
    if (item.action === 'create_structure') {
      return destination
        ? `Created folders and moved to ${destination}`
        : 'Created folders and moved to the recommended folder'
    }
    return destination ? `Moved to ${destination}` : 'Moved to the recommended folder'
  }

  const raw = (item.skipReason || item.warnings?.at(-1) || '').trim().toLowerCase()

  if (item.status === 'failed') {
    if (item.action === 'rename') {
      return 'Could not rename this file'
    }
    if (raw.includes('did not complete') || raw.includes('left in place')) {
      return 'Could not move because the file stayed in its original folder'
    }
    return 'Could not move because the destination was unavailable'
  }

  if (raw.includes('already exists') || raw.includes('overwrite') || raw === 'target already exists') {
    return 'Skipped because a file with that name already exists'
  }
  if (raw.includes('already in')) {
    return 'Skipped because it is already in that folder'
  }
  if (raw.includes('no confident')) {
    return 'Skipped because no confident destination was found'
  }
  if (raw.includes('not selected') || raw.includes('removed from this plan')) {
    return 'Skipped because it was not selected'
  }
  if (raw.includes('folders are not organised')) {
    return 'Skipped because folders are not organised yet'
  }
  if (raw.includes('learning locations') || raw.includes('knowledge index')) {
    return 'Skipped because no folders have been added yet'
  }
  if (raw.includes('source file is missing') || raw.includes('not found')) {
    return 'Skipped because the original file was not found'
  }
  if (raw.includes('only files')) {
    return 'Skipped because only files can be moved'
  }
  if (raw.includes('already using that name')) {
    return 'Skipped because it already has that name'
  }
  if (raw.includes('not a safe rename') || raw.includes('stay in the same folder')) {
    return 'Skipped because that rename is not safe'
  }
  if (raw.includes('only files can be renamed')) {
    return 'Skipped because only files can be renamed'
  }
  if (raw.includes('could not rename') || raw.includes('rename did not complete')) {
    return 'Could not rename this file'
  }
  if (raw.includes('cross-volume')) {
    return 'Skipped because the destination is on a different drive'
  }
  if (
    raw.includes('does not exist') ||
    raw.includes('not in the knowledge') ||
    raw.includes('not an available') ||
    raw.includes('local absolute') ||
    raw.includes('destination')
  ) {
    return 'Skipped because the destination was unavailable'
  }
  if (raw.includes('not supported') || raw.includes('folder creation')) {
    return 'Skipped because this action is not available yet'
  }
  if (raw.includes('create the destination folder')) {
    return 'Skipped because the destination folder could not be created'
  }
  return 'Skipped'
}

export function activityItemFromPlanItem(item: OrganisationPlanItem): ActivityItem {
  const status = activityStatusFromPlanItem(item)
  return {
    sourcePath: item.currentPath,
    targetPath: item.proposedPath,
    fileName: item.fileName,
    action: item.action,
    status,
    reason: humanActivityReason(item),
    confidence: item.score,
    ...(item.sourceId ? { sourceId: item.sourceId } : {}),
    ...(item.sourceName ? { sourceName: item.sourceName } : {}),
    ...(item.createdFolders && item.createdFolders.length > 0
      ? { createdFolders: item.createdFolders }
      : {}),
    undoAvailable: false,
  }
}

export function activityRunTitle(run: ActivityRun): string {
  if (run.trigger === 'save_as' || run.trigger === 'move_this_file') {
    return run.workflowName ?? 'Document saved'
  }
  if (run.trigger === 'source_event') {
    return run.sourceEvent ? sourceEventTitle(run.sourceEvent) : (run.workflowName ?? 'Source')
  }
  if (run.trigger === 'undo') return `Undo #${run.runNumber}`
  if (run.trigger === 'workflow' || run.trigger === 'autopilot') {
    return run.workflowName ?? 'Workflow'
  }
  return `Plan #${run.runNumber}`
}

function sourceEventTitle(event: NonNullable<ActivityRun['sourceEvent']>): string {
  if (event.kind === 'removed' || event.transition === 'source_removed') {
    return sourceRemovedActivityTitle()
  }
  if (event.kind === 'connected' || event.transition === 'source_connected') {
    return sourceTransitionTitle({ from: null, to: 'indexed', sourceName: event.sourceName })
  }
  if (event.kind === 'restored') {
    return sourceTransitionTitle({ from: 'unavailable', to: 'indexed', sourceName: event.sourceName })
  }
  if (event.kind === 'transition' && event.toStatus) {
    return sourceTransitionTitle({
      from: (event.fromStatus as SourceStatus | null | undefined) ?? null,
      to: event.toStatus as SourceStatus,
      sourceName: event.sourceName,
    })
  }
  return sourceTransitionTitle({ from: 'indexed', to: 'unavailable', sourceName: event.sourceName })
}

export function activityWorkflowSummary(run: ActivityRun): string | null {
  if (run.workflowSummary?.trim()) return run.workflowSummary.trim()
  if (run.workflowName) return workflowIntentSummary({ name: run.workflowName })
  return null
}

export function activityRunActionCount(run: ActivityRun): number {
  return run.items.length
}

export function activityRunStatusLabel(run: ActivityRun): string {
  if (run.summary.failed > 0) return 'Completed with issues'
  return 'Completed'
}

export function activityRunSummaryLine(summary: ActivityRunSummary): string {
  const parts: string[] = []
  if (summary.moved > 0) parts.push(`${summary.moved} moved`)
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`)
  if (summary.failed > 0) parts.push(`${summary.failed} failed`)
  return parts.length > 0 ? parts.join(' · ') : 'Nothing changed'
}

export function activityRunOutcome(run: ActivityRun): string {
  if (run.trigger === 'save_as' || run.trigger === 'move_this_file') {
    return run.workflowSummary ?? run.sourceEvent?.message ?? 'Document saved'
  }
  if (run.trigger === 'source_event') {
    return run.sourceEvent?.message ?? run.workflowSummary ?? 'Source updated'
  }
  if (run.trigger === 'undo') {
    return `${run.summary.moved} restored`
  }
  if (run.trigger === 'workflow' || run.trigger === 'autopilot') {
    const count = activityRunActionCount(run)
    return `${count} action${count === 1 ? '' : 's'} · ${activityRunStatusLabel(run)}`
  }
  return activityRunSummaryLine(run.summary)
}

export function movedActivityItems(run: ActivityRun): ActivityItem[] {
  return run.items.filter((item) => item.status === 'moved')
}

export function canUndoActivityRun(run: ActivityRun): boolean {
  const moved = movedActivityItems(run)
  return moved.length > 0 && moved.every((item) => item.undoAvailable)
}

export function activityStatusLabel(
  status: ActivityItemStatus,
  action?: ActivityItem['action'],
): string {
  if (status === 'moved' && action === 'rename') return 'Renamed'
  if (status === 'moved' && (action === 'create_folder' || action === 'create_structure')) return 'Created'
  if (status === 'moved') return 'Moved'
  if (status === 'failed') return 'Failed'
  return 'Skipped'
}
