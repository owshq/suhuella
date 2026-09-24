import { productCopy } from './product-copy.ts'
import type { KnowledgeSetItem, OrganisationPlanItem } from '../types.ts'
import { UNDO_WINDOW_DAYS } from './activity-recovery.ts'
import {
  ORGANISE_ADD_SOURCE,
  ORGANISE_CONNECT_SOURCE,
  ORGANISE_DOCUMENTS_TITLE,
  ORGANISE_OPEN_SOURCES,
  ORGANISE_SELECT_FROM_SOURCES,
} from './browser-organise-selection.ts'
import type { HostAccessCapabilities } from './platform-capabilities.ts'
import {
  createdStructureLabel,
  destinationPathLabel,
  isConfirmablePlanItem,
  isFolderCreateAction,
  planRowDisplay,
  proposedName,
} from './plan-editor-copy.ts'
import { planAssistantBecause } from './plan-assistant-copy.ts'
import { planExplanationWithoutConfidence, planHumanReason } from './plan-presentation.ts'

export const ORGANISE_SIDEBAR_LABEL = 'Plan Mode'
export const ORGANISE_SCREEN_TITLE = 'Plan Mode'
export const ORGANISE_EMPTY_LEAD =
  'Describe the action. Prepare a Plan. Nothing moves until you confirm.'
export const ORGANISE_EMPTY_LEAD_BROWSER =
  'Choose a source. Create a Plan. Nothing moves until you confirm.'
export const ORGANISE_EMPTY_PLAN_PROMISE = productCopy(
  'SuHuella will prepare a Plan first. Nothing moves until you confirm it.',
)
export const PLAN_COMPOSER_PLACEHOLDER = productCopy(
  'What should happen? SuHuella prepares a Plan first — nothing moves until you confirm.',
)

export type PlanPromptAction = {
  id: string
  label: string
  prompt: string
}

/** One-click starters for Prepare Plan — analyse granted sources, then review before Confirm. */
export const PLAN_PROMPT_ACTIONS: PlanPromptAction[] = [
  {
    id: 'review-naming',
    label: 'Review naming',
    prompt:
      'Review file names in dev-data — flag inconsistent names and suggest clearer ones',
  },
  {
    id: 'group-by-type',
    label: 'Group by file type',
    prompt: 'Group files in dev-data by file type into folders',
  },
  {
    id: 'group-by-category',
    label: 'Group by category',
    prompt: 'Move invoices in dev-data into category folders',
  },
  {
    id: 'group-category-and-type',
    label: 'Category and type',
    prompt: 'Organise dev-data by document category, then by file type within each folder',
  },
]

/** @deprecated Use PLAN_PROMPT_ACTIONS */
export const PLAN_PROMPT_EXAMPLES = PLAN_PROMPT_ACTIONS.map((action) => action.prompt)
export const ORGANISE_TRUST_LINE = 'Nothing moves until you confirm.'
export { ORGANISE_ADD_SOURCE, ORGANISE_OPEN_SOURCES } from './browser-organise-selection.ts'
/** @deprecated Use ORGANISE_ADD_SOURCE */
export const ORGANISE_ADD_FOLDER = ORGANISE_ADD_SOURCE
export const ORGANISE_SELECT_DOCUMENTS = ORGANISE_SELECT_FROM_SOURCES
export const ORGANISE_USE_WORKFLOW = 'Use workflow'
export const ORGANISE_SAVED_WORKFLOWS = 'Saved workflows'
export const ORGANISE_WORKFLOW_PROMISE = 'A workflow always produces a Plan.'

export type OrganiseEmptyCopy = {
  title: string
  description: string
  primaryLabel: string
  primaryKind: 'add_source' | 'select_from_sources' | 'open_sources'
}

export function organiseEmptyCopy(
  access: Pick<HostAccessCapabilities, 'connectGrant' | 'organiseFromIndexedSources'>,
  options: { hasSources: boolean },
): OrganiseEmptyCopy {
  const title = access.organiseFromIndexedSources ? ORGANISE_DOCUMENTS_TITLE : ORGANISE_SCREEN_TITLE
  if (!options.hasSources) {
    return {
      title,
      description: access.connectGrant
        ? 'Connect a source. Create a Plan.'
        : 'Add a source. Create a Plan.',
      primaryLabel: access.connectGrant ? ORGANISE_CONNECT_SOURCE : ORGANISE_ADD_SOURCE,
      primaryKind: 'add_source',
    }
  }
  if (access.organiseFromIndexedSources) {
    return {
      title,
      description: ORGANISE_EMPTY_LEAD_BROWSER,
      primaryLabel: ORGANISE_SELECT_FROM_SOURCES,
      primaryKind: 'select_from_sources',
    }
  }
  return {
    title,
    description: ORGANISE_EMPTY_LEAD,
    primaryLabel: ORGANISE_OPEN_SOURCES,
    primaryKind: 'open_sources',
  }
}

const STALE_ORGANISE_EMPTY = /Save a plan|Saved plans|Apply accepted changes|Run workflow|Execute workflow|connected source/i

export function runOrganiseEmptyChecks(): void {
  const desktop = { connectGrant: false, organiseFromIndexedSources: false }
  const web = { connectGrant: true, organiseFromIndexedSources: true }

  const desktopNone = organiseEmptyCopy(desktop, { hasSources: false })
  if (!desktopNone.description.includes('Add a source. Create a Plan.')) {
    throw new Error('Desktop empty Organise must direct to Add a source')
  }
  if (/connect/i.test(`${desktopNone.description} ${desktopNone.primaryLabel}`)) {
    throw new Error('Desktop empty Organise must not use Connect')
  }
  if (desktopNone.primaryLabel !== ORGANISE_ADD_SOURCE || desktopNone.primaryKind !== 'add_source') {
    throw new Error('Desktop with no sources points to Add source')
  }

  const desktopReady = organiseEmptyCopy(desktop, { hasSources: true })
  if (!desktopReady.description.includes('Describe the action')) {
    throw new Error('Desktop with sources must explain scope before the Plan')
  }
  if (!/Plan|confirm/i.test(desktopReady.description)) {
    throw new Error('Desktop with sources must promise Plan before confirm')
  }
  if (/connect|add a folder first/i.test(desktopReady.description)) {
    throw new Error('Desktop with sources must not send the user back to Add/Connect')
  }
  if (desktopReady.primaryKind !== 'open_sources' || desktopReady.primaryLabel !== ORGANISE_OPEN_SOURCES) {
    throw new Error('Desktop with sources starts from Sources')
  }

  const webNone = organiseEmptyCopy(web, { hasSources: false })
  if (!/Connect a source\. Create a Plan\./.test(webNone.description) || !/Connect/.test(webNone.primaryLabel)) {
    throw new Error('Web empty Organise must use Connect vocabulary')
  }
  if (/\bAdd\b/.test(`${webNone.description} ${webNone.primaryLabel}`)) {
    throw new Error('Web empty Organise must not use Add')
  }
  if (webNone.primaryKind !== 'add_source') {
    throw new Error('Web with no sources points to Connect folder')
  }

  const webReady = organiseEmptyCopy(web, { hasSources: true })
  if (!webReady.description.includes('Choose a source')) {
    throw new Error('Web with sources must ask the user to choose a source')
  }
  if (!/Plan|confirm/i.test(webReady.description)) {
    throw new Error('Web with sources must promise Plan before confirm')
  }
  if (webReady.primaryKind !== 'select_from_sources') {
    throw new Error('Web with sources starts from available documents')
  }

  const haystack = [
    desktopNone.description,
    desktopReady.description,
    webNone.description,
    webReady.description,
    ORGANISE_EMPTY_LEAD,
    ORGANISE_EMPTY_LEAD_BROWSER,
    ORGANISE_EMPTY_PLAN_PROMISE,
  ].join(' ')
  if (STALE_ORGANISE_EMPTY.test(haystack)) {
    throw new Error('Organise empty copy must not use stale Save a plan / Apply / connected language')
  }
  if (/Use workflow|workflow/.test(haystack)) {
    throw new Error('Organise empty copy must not mention workflows')
  }
  if (ORGANISE_USE_WORKFLOW !== 'Use workflow' || /Run workflow|Execute workflow/.test(ORGANISE_USE_WORKFLOW)) {
    throw new Error('public workflow verb must stay Use workflow')
  }
  if (ORGANISE_SAVED_WORKFLOWS !== 'Saved workflows') {
    throw new Error('saved intents must be labelled Saved workflows')
  }
  if (!ORGANISE_EMPTY_PLAN_PROMISE.includes('Plan') || !/confirm/i.test(ORGANISE_EMPTY_PLAN_PROMISE)) {
    throw new Error('empty Organise must say a Plan comes first and nothing moves until confirm')
  }
  if (!PLAN_COMPOSER_PLACEHOLDER.includes('What should happen') || !/confirm/i.test(PLAN_COMPOSER_PLACEHOLDER)) {
    throw new Error('composer placeholder must combine the prompt and confirm promise')
  }
  if (PLAN_PROMPT_ACTIONS.length < 3 || !PLAN_PROMPT_ACTIONS.some((action) => /naming|name/i.test(action.prompt))) {
    throw new Error('Prepare Plan actions must include naming review')
  }
  if (!PLAN_PROMPT_ACTIONS.some((action) => /file type|category/i.test(action.prompt))) {
    throw new Error('Prepare Plan actions must include grouping by type or category')
  }
}
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
      ? `Preparing a Plan for ${folders} folder${folders === 1 ? '' : 's'}…`
      : folders > 0
        ? `Preparing a Plan for ${items.length} item${items.length === 1 ? '' : 's'}…`
        : `Preparing a Plan for ${Math.max(files, items.length)} document${Math.max(files, items.length) === 1 ? '' : 's'}…`
  return {
    title,
    body: productCopy('Preparing your Plan…'),
    reassurance: ORGANISE_TRUST_LINE,
  }
}

export function planItemWhy(item: OrganisationPlanItem): string {
  const source = item.explanation
    ? planExplanationWithoutConfidence(item.explanation)
    : item.renameReasons && item.renameReasons.length > 0
      ? item.renameReasons.join(', ')
      : ''
  if (!source) return ''
  const human = planHumanReason(source)
  if (/^matches your existing /i.test(human)) return human
  return planAssistantBecause(human)
}

export function planSuggestionLine(item: OrganisationPlanItem): string {
  const nextName = proposedName(item)
  if (item.action === 'rename' && nextName && nextName !== item.fileName) {
    return nextName
  }
  const why = planItemWhy(item)
  if (why) return why
  const display = planRowDisplay(item)
  if (display.verb === 'Ignore') return 'No change'
  if (display.verb === 'Rename' && display.target) return display.target
  return display.verb
}

function suggestionFixture(
  partial: Pick<OrganisationPlanItem, 'fileName' | 'currentPath'> & Partial<OrganisationPlanItem>,
): OrganisationPlanItem {
  return {
    action: 'none',
    proposedPath: null,
    explanation: '',
    status: 'preview',
    warnings: [],
    reviewGroup: 'skipped',
    selected: false,
    score: null,
    confidenceLabel: null,
    alternatives: [],
    skipReason: null,
    ...partial,
  }
}

export function runOrganiseSuggestionChecks(): void {
  const move = suggestionFixture({
    fileName: 'Invoice_ACME_2026.pdf',
    currentPath: '/Users/demo/Downloads/Invoice_ACME_2026.pdf',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Invoices/Invoice_ACME_2026.pdf',
    explanation: 'Invoice tokens match Invoices',
    reviewGroup: 'ready',
    skipReason: null,
  })
  if (planSuggestionLine(move) !== 'Matches your existing Invoices folder.') {
    throw new Error(`move suggestion must show a human reason, got ${planSuggestionLine(move)}`)
  }
  if (planSuggestionLine(move) === move.fileName) {
    throw new Error('move suggestion must not repeat the current filename')
  }

  const rename = suggestionFixture({
    fileName: 'IMG_001.JPG',
    currentPath: '/Users/demo/Downloads/IMG_001.JPG',
    action: 'rename',
    proposedPath: '/Users/demo/Downloads/IMG_001.jpg',
    explanation: 'Normalise the filename',
    reviewGroup: 'ready',
    skipReason: null,
  })
  if (planSuggestionLine(rename) !== 'IMG_001.jpg') {
    throw new Error(`rename suggestion must show the new name, got ${planSuggestionLine(rename)}`)
  }

  const quietMove = suggestionFixture({
    fileName: 'notes.txt',
    currentPath: '/Users/demo/Downloads/notes.txt',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Notes/notes.txt',
    reviewGroup: 'review',
    skipReason: null,
  })
  if (planSuggestionLine(quietMove) !== 'Move') {
    throw new Error(`move without a reason still says Move, got ${planSuggestionLine(quietMove)}`)
  }
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
