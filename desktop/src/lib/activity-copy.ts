import type {
  ActivityItem,
  ActivityItemStatus,
  ActivityRun,
  ActivityTrigger,
  OrganisationPlanItem,
} from '../types.ts'
import { workflowIntentSummary } from './workflow-copy.ts'

const TRIGGER_LABELS: Record<ActivityTrigger, string> = {
  organise_documents: 'Organise documents',
  move_this_file: 'Move this file',
  workflow: 'Workflow',
  autopilot: 'Autopilot',
  undo: 'Undo',
}

export function activityTriggerLabel(trigger: ActivityTrigger): string {
  return TRIGGER_LABELS[trigger]
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
    ...(item.createdFolders && item.createdFolders.length > 0
      ? { createdFolders: item.createdFolders }
      : {}),
    undoAvailable: false,
  }
}

export function activityRunTitle(run: ActivityRun): string {
  if (run.trigger === 'undo') return `Undo #${run.runNumber}`
  if (run.trigger === 'workflow' || run.trigger === 'autopilot') {
    return run.workflowName ?? 'Workflow'
  }
  return `Plan #${run.runNumber}`
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

export function activityRunOutcome(run: ActivityRun): string {
  if (run.trigger === 'undo') {
    return `${run.summary.moved} restored`
  }
  if (run.trigger === 'workflow' || run.trigger === 'autopilot') {
    const count = activityRunActionCount(run)
    return `${count} action${count === 1 ? '' : 's'} · ${activityRunStatusLabel(run)}`
  }
  return `${run.summary.moved} moved`
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
