import type { OrganisationPlanAction, OrganisationPlanItem } from '../types.ts'

export type PlanRowDisplay = {
  verb: string
  subject: string
  target: string | null
  confirmable: boolean
  tone: 'ready' | 'review' | 'ignored' | 'done' | 'failed'
}

export function isFolderCreateAction(
  action: OrganisationPlanAction,
): action is 'create_folder' | 'create_structure' {
  return action === 'create_folder' || action === 'create_structure'
}

export function isConfirmablePlanItem(item: OrganisationPlanItem): boolean {
  return (
    item.status === 'preview' &&
    Boolean(item.proposedPath) &&
    (item.action === 'move' || isFolderCreateAction(item.action) || item.action === 'rename')
  )
}

export function planActionVerb(action: OrganisationPlanAction): string {
  switch (action) {
    case 'move':
      return 'Move'
    case 'rename':
      return 'Rename'
    case 'create_folder':
      return 'Create folder'
    case 'create_structure':
      return 'Create structure'
    case 'archive':
      return 'Archive'
    case 'ignore':
      return 'Ignore'
    default:
      return 'Ignore'
  }
}

export function parentLabel(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean)
  return parts.at(-2) || filePath
}

export function parentPath(filePath: string): string {
  return filePath.replace(/[/\\][^/\\]+$/, '') || filePath
}

export function sameFolder(left: string, right: string): boolean {
  return left.replace(/[/\\]+$/, '').toLowerCase() === right.replace(/[/\\]+$/, '').toLowerCase()
}

export function destinationDir(item: OrganisationPlanItem): string {
  if (item.proposedPath) return parentPath(item.proposedPath)
  return ''
}

export function destinationPathLabel(fileOrFolderPath: string): string {
  const parts = fileOrFolderPath.split(/[/\\]/).filter(Boolean)
  if (parts.length === 0) return fileOrFolderPath
  const last = parts[parts.length - 1] ?? ''
  const folderParts = /\.[a-z0-9]{1,12}$/i.test(last) ? parts.slice(0, -1) : parts
  return folderParts.slice(-4).join(' / ') || last
}

export function destinationLabel(item: OrganisationPlanItem): string {
  const destDir = destinationDir(item)
  const chosen = item.alternatives.find((option) => sameFolder(option.folder, destDir))
  if (chosen?.label) return chosen.label
  if (item.proposedPath) return destinationPathLabel(item.proposedPath)
  return parentLabel(item.currentPath)
}

export function proposedName(item: OrganisationPlanItem): string | null {
  if (!item.proposedPath) return null
  const parts = item.proposedPath.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? null
}

export function createdStructureLabel(item: OrganisationPlanItem): string {
  if (item.createdFolders && item.createdFolders.length > 0) {
    return item.createdFolders
      .map((folder) => folder.split(/[/\\]/).filter(Boolean).at(-1) ?? folder)
      .join(' / ')
  }
  return destinationLabel(item)
}

export function planRowDisplay(item: OrganisationPlanItem): PlanRowDisplay {
  if (item.status === 'applied') {
    return {
      verb: planActionVerb(item.action === 'none' ? 'move' : item.action),
      subject: item.fileName,
      target:
        item.action === 'rename'
          ? proposedName(item)
          : item.proposedPath
            ? destinationLabel(item)
            : null,
      confirmable: false,
      tone: 'done',
    }
  }

  if (item.status === 'failed') {
    return {
      verb: planActionVerb(item.action === 'none' ? 'move' : item.action),
      subject: item.fileName,
      target: item.proposedPath ? destinationLabel(item) : null,
      confirmable: false,
      tone: 'failed',
    }
  }

  if (item.action === 'rename') {
    return {
      verb: 'Rename',
      subject: item.fileName,
      target: proposedName(item),
      confirmable: isConfirmablePlanItem(item),
      tone:
        item.reviewGroup === 'skipped'
          ? 'ignored'
          : item.reviewGroup === 'ready'
            ? 'ready'
            : 'review',
    }
  }

  if (item.reviewGroup === 'skipped' || item.action === 'none' || item.action === 'ignore') {
    return {
      verb: 'Ignore',
      subject: item.fileName,
      target: null,
      confirmable: false,
      tone: 'ignored',
    }
  }

  if (item.action === 'create_structure') {
    return {
      verb: 'Create structure',
      subject: createdStructureLabel(item),
      target: item.fileName,
      confirmable: isConfirmablePlanItem(item),
      tone: item.reviewGroup === 'ready' ? 'ready' : 'review',
    }
  }

  if (item.action === 'archive') {
    return {
      verb: 'Archive',
      subject: item.fileName,
      target: item.proposedPath ? destinationLabel(item) : null,
      confirmable: false,
      tone: 'review',
    }
  }

  if (item.action === 'create_folder') {
    return {
      verb: 'Create folder',
      subject: createdStructureLabel(item),
      target: item.fileName,
      confirmable: isConfirmablePlanItem(item),
      tone: item.reviewGroup === 'ready' ? 'ready' : 'review',
    }
  }

  if (item.action === 'move') {
    return {
      verb: 'Move',
      subject: item.fileName,
      target: item.proposedPath ? destinationLabel(item) : null,
      confirmable: isConfirmablePlanItem(item),
      tone: item.reviewGroup === 'ready' ? 'ready' : 'review',
    }
  }

  return {
    verb: 'Move',
    subject: item.fileName,
    target: item.proposedPath ? destinationLabel(item) : null,
    confirmable: false,
    tone: 'review',
  }
}

export function sortPlanItems(items: OrganisationPlanItem[]): OrganisationPlanItem[] {
  const rank = (item: OrganisationPlanItem): number => {
    if (item.status === 'applied') return 4
    if (item.status === 'failed') return 5
    if (item.reviewGroup === 'ready') return 0
    if (item.reviewGroup === 'review') return 1
    return 3
  }
  return [...items].sort((left, right) => rank(left) - rank(right))
}

export function confirmableActionCount(items: OrganisationPlanItem[]): number {
  return items.filter((item) => item.selected && isConfirmablePlanItem(item)).length
}

export function confirmPlanLabel(): string {
  return 'Confirm Plan'
}

export function confirmActionsLabel(_count?: number): string {
  return confirmPlanLabel()
}

export function pendingActionCopy(item: OrganisationPlanItem): string {
  if (item.action === 'rename') {
    const nextName = proposedName(item)
    return nextName
      ? `${item.fileName} will be renamed to ${nextName}. Other actions stay in the plan.`
      : `${item.fileName} will be renamed. Other actions stay in the plan.`
  }
  if (item.action === 'create_structure') {
    return `Create ${createdStructureLabel(item)} and move ${item.fileName} there. Other actions stay in the plan.`
  }
  if (item.action === 'create_folder') {
    return `Create ${createdStructureLabel(item)} and move ${item.fileName} there. Other actions stay in the plan.`
  }
  return `${item.fileName} will move to ${destinationLabel(item)}. Other actions stay in the plan.`
}
