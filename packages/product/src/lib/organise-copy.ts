import { productCopy } from './product-copy.ts'
import type { KnowledgeSetItem, OrganisationPlanItem } from '../types.ts'
import { UNDO_WINDOW_DAYS } from './activity-recovery.ts'
import {
  createdStructureLabel,
  destinationPathLabel,
  isConfirmablePlanItem,
  isFolderCreateAction,
  proposedName,
} from './plan-editor-copy.ts'
import { planAssistantBecause } from './plan-assistant-copy.ts'

export const ORGANISE_SIDEBAR_LABEL = 'Organise'
export const ORGANISE_SCREEN_TITLE = 'Organise'
export const ORGANISE_EMPTY_LEAD = 'Drop or select documents.'
export const ORGANISE_EMPTY_LEAD_BROWSER =
  'Select documents from a connected source or choose files from this device. SuHuella will create a Plan before anything changes.'
export const ORGANISE_EMPTY_PLAN_PROMISE = productCopy('SuHuella will create a Plan before anything changes.')
export const ORGANISE_PRIMARY_CTA = 'Confirm Plan'
export const ORGANISE_ASSISTANT_LABEL = 'Ask about this Plan'
export const ORGANISE_UNDO_WINDOW = `Undo available for ${UNDO_WINDOW_DAYS} days`
export const ORGANISE_METHOD_LINE = 'Analysed on this device'

export function analysingCopy(items: KnowledgeSetItem[]): {
  title: string
  body: string
  reassurance: string
} {
  const files = items.filter((item) => item.kind === 'file').length
  const folders = items.filter((item) => item.kind === 'folder').length
  const title =
    folders > 0 && files === 0
      ? `Analysing ${folders} folder${folders === 1 ? '' : 's'}…`
      : folders > 0
        ? `Analysing ${items.length} item${items.length === 1 ? '' : 's'}…`
        : `Analysing ${Math.max(files, items.length)} document${Math.max(files, items.length) === 1 ? '' : 's'}…`
  return {
    title,
    body: productCopy('SuHuella is preparing a Plan.'),
    reassurance: 'Nothing has changed yet.',
  }
}

export function planItemWhy(item: OrganisationPlanItem): string {
  if (item.explanation) return planAssistantBecause(item.explanation)
  if (item.renameReasons && item.renameReasons.length > 0) {
    return planAssistantBecause(item.renameReasons.join(', '))
  }
  return ''
}

export function planDestinationLine(item: OrganisationPlanItem): string | null {
  if (item.proposedPath) return destinationPathLabel(item.proposedPath)
  if (item.createdFolders && item.createdFolders.length > 0) return createdStructureLabel(item)
  return null
}

export function planRenameLine(item: OrganisationPlanItem): string | null {
  return proposedName(item)
}

export type PlanConfirmCounts = {
  actions: number
  moves: number
  renames: number
  folders: number
  archives: number
}

export function planConfirmCounts(items: OrganisationPlanItem[]): PlanConfirmCounts {
  const selected = items.filter((item) => item.selected && isConfirmablePlanItem(item))
  let moves = 0
  let renames = 0
  let folders = 0
  let archives = 0

  for (const item of selected) {
    if (item.action === 'rename') {
      renames += 1
      continue
    }
    if (item.action === 'archive') {
      archives += 1
      if (item.createdFolders?.length) folders += item.createdFolders.length
      continue
    }
    if (item.action === 'move' || isFolderCreateAction(item.action)) {
      moves += 1
      if (item.createdFolders?.length) {
        folders += item.createdFolders.length
      } else if (item.action === 'create_folder') {
        folders += 1
      }
    }
  }

  return { actions: selected.length, moves, renames, folders, archives }
}

export function planConfirmSummary(counts: PlanConfirmCounts): string {
  const parts: string[] = []
  if (counts.moves > 0) {
    parts.push(`Move ${counts.moves} document${counts.moves === 1 ? '' : 's'}`)
  }
  if (counts.renames > 0) {
    parts.push(`Rename ${counts.renames} document${counts.renames === 1 ? '' : 's'}`)
  }
  if (counts.folders > 0) {
    parts.push(`Create ${counts.folders} folder${counts.folders === 1 ? '' : 's'}`)
  }
  if (counts.archives > 0) {
    parts.push(`Archive ${counts.archives} document${counts.archives === 1 ? '' : 's'}`)
  }
  return parts.join(' · ')
}

export function actionsReadyLabel(count: number): string {
  return `${count} accepted change${count === 1 ? '' : 's'}`
}

export function completedCounts(items: OrganisationPlanItem[]): {
  moved: number
  renamed: number
  folders: number
} {
  const applied = items.filter((item) => item.status === 'applied')
  const folders = new Set(
    applied.flatMap((item) => item.createdFolders ?? []),
  )
  return {
    moved: applied.filter((item) => item.action !== 'rename').length,
    renamed: applied.filter((item) => item.action === 'rename').length,
    folders: folders.size,
  }
}

export function completedSummary(counts: { moved: number; renamed: number; folders: number }): string {
  const parts: string[] = []
  if (counts.moved > 0) parts.push(`${counts.moved} document${counts.moved === 1 ? '' : 's'} moved`)
  if (counts.renamed > 0) parts.push(`${counts.renamed} document${counts.renamed === 1 ? '' : 's'} renamed`)
  if (counts.folders > 0) parts.push(`${counts.folders} folder${counts.folders === 1 ? '' : 's'} created`)
  return parts.join('\n')
}

export function joinFolderFile(folder: string, fileName: string): string {
  const separator = folder.includes('\\') ? '\\' : '/'
  return `${folder.replace(/[/\\]+$/, '')}${separator}${fileName}`
}

export function knowledgeItemsFromDroppedFiles(
  files: File[],
  pathForFile: (file: File) => string | null,
): KnowledgeSetItem[] {
  const items: KnowledgeSetItem[] = []
  const seen = new Set<string>()
  for (const file of files) {
    const raw = pathForFile(file)
    if (!raw) continue
    const key = raw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const name = raw.split(/[/\\]/).pop() ?? file.name
    const looksLikeFile = Boolean(file.size) && /\.[a-z0-9]{1,12}$/i.test(name)
    items.push({ path: raw, kind: looksLikeFile ? 'file' : 'folder' })
  }
  return items
}
