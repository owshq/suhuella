import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { proposeSafeRename } from './rename-proposal.ts'
import {
  previewOrganisationPlanForFolders,
  validateKnowledgeSet,
  type KnowledgeSetOperationResult,
} from './knowledge-set.ts'
import type { IndexedFolderEntry } from '@suhuella/product/types.ts'
import type {
  KnowledgeSet,
  KnowledgeSetValidationError,
  OrganisationDestinationOption,
  OrganisationPlanItem,
  OrganisationPlanPreview,
  PlanAssistantHint,
  PlanAssistantProposal,
  PlanWorkflowIdea,
} from '@suhuella/product/types.ts'
import {
  answerOnDevicePlanQuestion,
  isPlanAssistantQuestion,
  isSimplePlanAssistantTask,
  ON_DEVICE_PLAN_ASSISTANT_USING,
  planAssistantBecause,
  PLAN_ASSISTANT_ALLOWED_HINTS,
} from '@suhuella/product/lib/plan-assistant-copy.ts'

/**
 * PLAN-ASSISTANT-001 — Plan Assistant (CLOSED · PASS)
 *
 * THE RECOMMENDATION ENGINE DECIDES. THE PLAN ASSISTANT ADVISES.
 * THE USER APPROVES. THE EXECUTOR ACTS.
 *
 * Frozen principles:
 * 1. THE PLAN ASSISTANT NEVER DEFINES THE TRUTH — it only helps build a Plan.
 *    Truth: Recommendation Engine · Knowledge Index · user confirmation.
 * 2. THE PLAN ASSISTANT NEVER PRETENDS TO UNDERSTAND — if it cannot help
 *    confidently, it says so.
 * 3. Every suggestion must be traceable — each proposal carries a because.
 * 4. THE PLAN ASSISTANT MAY COMBINE CAPABILITIES — it may never invent new ones.
 *
 * Never executes. Never changes the index, ranking, or execution.
 */

export const PLAN_ASSISTANT_MESSAGE =
  'AI proposed this plan. Review it, then confirm the actions you want. Nothing changes until you confirm.'

export const ON_DEVICE_ASSISTANT_USING = ON_DEVICE_PLAN_ASSISTANT_USING

export function extractPlanHintsFromAssistantText(text: string): string {
  return text
    .split(/[\n.;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 160)
    .filter((line) => /ignor|renam|archiv|move|folder|workflow|skip|leave|keep|year/i.test(line))
    .slice(0, 8)
    .join(' ')
    .slice(0, 400)
}

const READY_SCORE = 50
const IGNORE_NAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
  '.localized',
  'icon\r',
])
const STOP_TOKENS = new Set([
  'the',
  'and',
  'for',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'img',
  'dsc',
  'copy',
  'final',
  'new',
  'old',
  'tmp',
  'temp',
  'file',
  'document',
  'untitled',
  'image',
  'photo',
  'scan',
  'screenshot',
])
const ARCHIVE_NAME = /(screenshot|screen[ _-]?shot|captura|img_\d+|dsc\d+|\bcopy\b|\bbackup\b|\bold\b|\btmp\b|\btemp\b|\bscan\b)/i
const ARCHIVE_FOLDER = /(archiv|old|backup|done|completed)/i
function validationError(
  code: KnowledgeSetValidationError['code'],
  message: string,
): KnowledgeSetOperationResult<never> {
  return { ok: false, error: { code, message } }
}

function samePath(left: string, right: string): boolean {
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase()
}

function destinationExists(folder: string): boolean {
  try {
    return existsSync(folder) && statSync(folder).isDirectory()
  } catch {
    return false
  }
}

function fileTokens(fileName: string): string[] {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .split(/[\s_\-.()]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token) && !/^\d+$/.test(token))
}

function noteText(note: unknown): string {
  return typeof note === 'string' ? note.trim() : ''
}

export function planAssistantHints(note: string): Set<PlanAssistantHint> {
  const text = note.toLowerCase()
  if (!text) {
    return new Set(['rename', 'move', 'archive', 'create_folder', 'ignore', 'workflow'])
  }

  const hints = new Set<PlanAssistantHint>()
  if (/renam/.test(text)) hints.add('rename')
  if (/move|put|sort|organis|organiz/.test(text)) hints.add('move')
  if (/archiv|old|backup/.test(text)) hints.add('archive')
  if (/folder|mkdir|create structure|create a/.test(text)) hints.add('create_folder')
  if (/ignor|skip|leave|keep/.test(text)) hints.add('ignore')
  if (/workflow|habit|automat|every|monthly|weekly/.test(text)) hints.add('workflow')

  if (hints.size === 0) {
    return new Set(['rename', 'move', 'archive', 'create_folder', 'ignore', 'workflow'])
  }
  if (!hints.has('ignore') || hints.size > 1) hints.add('move')
  return hints
}

function noteMentions(item: OrganisationPlanItem, note: string): boolean {
  if (!note) return true
  const tokens = note
    .toLowerCase()
    .split(/[\s,.;:/\\]+/)
    .filter((token) => token.length > 2 && !STOP_TOKENS.has(token))
  if (tokens.length === 0) return true
  const haystack = `${item.fileName} ${item.currentPath}`.toLowerCase()
  return tokens.some((token) => haystack.includes(token))
}

function shouldIgnoreName(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return IGNORE_NAMES.has(lower) || lower.startsWith('~$')
}

function looksArchivable(item: OrganisationPlanItem): boolean {
  const haystack = `${item.fileName} ${item.currentPath}`
  if (ARCHIVE_NAME.test(item.fileName)) return true
  return /[/\\]downloads[/\\]/i.test(haystack) && ARCHIVE_NAME.test(haystack)
}

function archiveFolderFrom(item: OrganisationPlanItem, folders: IndexedFolderEntry[]): string | null {
  const fromAlternatives = item.alternatives.find((option) => ARCHIVE_FOLDER.test(option.label) || ARCHIVE_FOLDER.test(option.folder))
  if (fromAlternatives) return fromAlternatives.folder

  const fromIndex = folders.find((folder) => ARCHIVE_FOLDER.test(folder.folderName) || ARCHIVE_FOLDER.test(folder.absolutePath))
  return fromIndex?.absolutePath ?? null
}

function planningRename(fileName: string, siblingNames: string[]): { name: string; explanation: string } | null {
  return proposeSafeRename(fileName, siblingNames)
}

function withRecommendedDestination(
  item: OrganisationPlanItem,
  option: OrganisationDestinationOption,
): OrganisationPlanItem {
  const fileName = item.fileName || path.basename(item.currentPath)
  const proposedPath = path.join(option.folder, fileName)
  if (samePath(path.dirname(item.currentPath), option.folder)) {
    return {
      ...item,
      action: 'none',
      selected: false,
      proposedPath: null,
      reviewGroup: 'skipped',
      skipReason: 'Already in the recommended folder',
      explanation: planAssistantBecause(`SuHuella already recommends ${option.label} and this file is already there.`),
      warnings: [],
    }
  }

  const ready = option.score >= READY_SCORE
  const missing = !destinationExists(option.folder)
  return {
    ...item,
    action: missing ? 'create_folder' : 'move',
    selected: ready,
    proposedPath,
    explanation: planAssistantBecause(
      option.reasons.length > 0
        ? `SuHuella recommends ${option.label}: ${option.reasons.join(' · ')}`
        : `SuHuella recommends ${option.label}.`,
    ),
    score: option.score,
    confidenceLabel: option.confidenceLabel,
    reviewGroup: ready ? 'ready' : 'review',
    skipReason: null,
    warnings: missing ? ['Creates the destination folder, then moves the file.'] : [],
  }
}

function preferNotedDestination(item: OrganisationPlanItem, note: string): OrganisationPlanItem {
  if (!note || item.alternatives.length === 0) return item
  const text = note.toLowerCase()
  const match = item.alternatives.find((option) => {
    const label = option.label.toLowerCase()
    const folderName = path.basename(option.folder).toLowerCase()
    return (label.length > 2 && text.includes(label)) || (folderName.length > 2 && text.includes(folderName))
  })
  return match ? withRecommendedDestination(item, match) : item
}

function asIgnored(item: OrganisationPlanItem, reason: string): OrganisationPlanItem {
  return {
    ...item,
    action: 'ignore',
    selected: false,
    proposedPath: null,
    reviewGroup: 'skipped',
    skipReason: reason,
    explanation: reason,
    warnings: [],
  }
}

function asArchived(item: OrganisationPlanItem, folders: IndexedFolderEntry[]): OrganisationPlanItem {
  const archiveFolder = archiveFolderFrom(item, folders)
  const proposedPath = archiveFolder ? path.join(archiveFolder, item.fileName || path.basename(item.currentPath)) : null
  return {
    ...item,
    action: 'archive',
    selected: false,
    proposedPath,
    reviewGroup: 'review',
    skipReason: null,
    explanation: archiveFolder
      ? planAssistantBecause(
          'this file looks finished and an archive folder is available — review before anything moves.',
        )
      : planAssistantBecause(
          'this file looks finished. Archive is a suggestion only until archive actions run.',
        ),
    warnings: ['Archive is a plan suggestion. It does not run yet.'],
  }
}

function asRenamed(
  item: OrganisationPlanItem,
  proposal: { name: string; explanation: string; strategy?: OrganisationPlanItem['renameStrategy']; reasons?: string[] },
): OrganisationPlanItem {
  return {
    ...item,
    action: 'rename',
    selected: false,
    proposedPath: path.join(path.dirname(item.currentPath), proposal.name),
    reviewGroup: 'review',
    skipReason: null,
    explanation: planAssistantBecause(
      proposal.reasons?.[0]?.replace(/^Invalid characters removed because /i, 'the filename contains unsupported Windows characters.') ??
        proposal.explanation,
    ),
    renameStrategy: proposal.strategy ?? 'normalize',
    renameReasons: proposal.reasons,
    warnings: ['Review this name before you confirm.'],
  }
}

function asCreateStructure(item: OrganisationPlanItem, folderLabel: string): OrganisationPlanItem {
  return {
    ...item,
    action: 'create_structure',
    selected: false,
    proposedPath: null,
    reviewGroup: 'review',
    skipReason: null,
    explanation: planAssistantBecause(
      `these files share a theme and a ${folderLabel} folder would keep them together.`,
    ),
    warnings: ['This folder idea is a suggestion. It does not run yet.'],
  }
}

function isConfirmableAction(action: OrganisationPlanItem['action']): boolean {
  return action === 'move' || action === 'create_folder' || action === 'create_structure'
}

function applyAssistantItem(
  item: OrganisationPlanItem,
  note: string,
  hints: Set<PlanAssistantHint>,
  folders: IndexedFolderEntry[],
): OrganisationPlanItem {
  const mentioned = noteMentions(item, note)

  if (shouldIgnoreName(item.fileName) && hints.has('ignore')) {
    return asIgnored(item, planAssistantBecause('system files should stay where they are.'))
  }

  if (hints.has('ignore') && note && mentioned && /ignor|skip|leave|keep/.test(note.toLowerCase())) {
    return asIgnored(item, planAssistantBecause('you asked to ignore it.'))
  }

  if (isConfirmableAction(item.action) && hints.has('move')) {
    return preferNotedDestination(item, note)
  }

  if (item.action === 'rename') return item

  if (hints.has('archive') && looksArchivable(item) && mentioned) {
    return asArchived(item, folders)
  }

  if (hints.has('rename') && !isConfirmableAction(item.action)) {
    const proposal = planningRename(item.fileName, [])
    if (proposal) return asRenamed(item, proposal)
  }

  if (hints.has('ignore') && item.action === 'none' && item.reviewGroup === 'skipped') {
    return {
      ...item,
      action: item.action === 'none' ? 'ignore' : item.action,
    }
  }

  return item
}

function sharedTheme(items: OrganisationPlanItem[]): { token: string; items: OrganisationPlanItem[] } | null {
  const counts = new Map<string, OrganisationPlanItem[]>()
  for (const item of items) {
    for (const token of fileTokens(item.fileName)) {
      const current = counts.get(token) ?? []
      current.push(item)
      counts.set(token, current)
    }
  }

  let best: { token: string; items: OrganisationPlanItem[] } | null = null
  for (const [token, group] of counts) {
    if (group.length < 2) continue
    if (!best || group.length > best.items.length) best = { token, items: group }
  }
  return best
}

function buildWorkflows(items: OrganisationPlanItem[], hints: Set<PlanAssistantHint>): PlanWorkflowIdea[] {
  if (!hints.has('workflow') && !hints.has('create_folder')) return []

  const workflows: PlanWorkflowIdea[] = []
  const moves = items.filter((item) => item.action === 'move' || item.action === 'create_folder')
  const archives = items.filter((item) => item.action === 'archive')
  const renames = items.filter((item) => item.action === 'rename')
  const skipped = items.filter(
    (item) =>
      (item.action === 'none' || item.action === 'ignore') &&
      item.reviewGroup === 'skipped' &&
      item.skipReason === 'No confident destination found',
  )

  if (moves.length >= 2) {
    const destination = moves[0]?.proposedPath ? path.basename(path.dirname(moves[0].proposedPath)) : 'the suggested folder'
    workflows.push({
      id: 'workflow-move',
      title: `File ${moves.length} documents together`,
      explanation: `A simple habit: when files like these appear, review a move to ${destination}.`,
      relatedPaths: moves.map((item) => item.currentPath),
    })
  }

  if (archives.length >= 2) {
    workflows.push({
      id: 'workflow-archive',
      title: `Archive ${archives.length} finished files`,
      explanation: 'Later, you could sweep screenshots and downloads after you have used them.',
      relatedPaths: archives.map((item) => item.currentPath),
    })
  }

  if (renames.length >= 2) {
    workflows.push({
      id: 'workflow-rename',
      title: `Clean up ${renames.length} file names`,
      explanation: 'A naming habit would make these easier to find the next time you search.',
      relatedPaths: renames.map((item) => item.currentPath),
    })
  }

  const theme = sharedTheme(skipped)
  if (theme && hints.has('create_folder')) {
    const label = theme.token.charAt(0).toUpperCase() + theme.token.slice(1)
    workflows.push({
      id: 'workflow-folder',
      title: `Create a ${label} folder`,
      explanation: `${theme.items.length} files share this theme, but there is no confident destination yet.`,
      relatedPaths: theme.items.map((item) => item.currentPath),
    })
  }

  if (workflows.length === 0) {
    const suggested = items.filter((item) => item.action !== 'none' && item.action !== 'ignore')
    if (suggested.length > 0) {
      workflows.push({
        id: 'workflow-review',
        title: 'Review this Plan before anything changes',
        explanation: 'Suggested actions are grouped. Confirm only the ones you want.',
        relatedPaths: suggested.map((item) => item.currentPath),
      })
    }
  }

  return workflows.slice(0, 3)
}

function applyCreateStructureIdeas(
  items: OrganisationPlanItem[],
  workflows: PlanWorkflowIdea[],
  hints: Set<PlanAssistantHint>,
): OrganisationPlanItem[] {
  if (!hints.has('create_folder')) return items
  const folderIdea = workflows.find((workflow) => workflow.id === 'workflow-folder')
  if (!folderIdea) return items

  const related = new Set(folderIdea.relatedPaths)
  const label = folderIdea.title.replace(/^Create a /, '').replace(/ folder$/, '')
  return items.map((item) => {
    if (!related.has(item.currentPath)) return item
    if (isConfirmableAction(item.action) || item.action === 'rename') return item
    return asCreateStructure(item, label)
  })
}

const PLAN_ASSISTANT_ALLOWED_ACTIONS = new Set<OrganisationPlanItem['action']>([
  'move',
  'rename',
  'create_folder',
  'create_structure',
  'archive',
  'ignore',
  'none',
])

function assertProposalIsSafe(
  proposal: PlanAssistantProposal,
  baseline: OrganisationPlanPreview,
): void {
  if (proposal.simulated !== true || proposal.source !== 'assistant') {
    throw new Error('Plan assistant must return a simulated proposal.')
  }
  if (proposal.preview.simulated !== true || proposal.preview.proposedBy !== 'assistant') {
    throw new Error('Plan assistant preview must stay simulated.')
  }

  const baselineByPath = new Map(baseline.items.map((item) => [item.currentPath.toLowerCase(), item]))
  for (const item of proposal.preview.items) {
    if (!PLAN_ASSISTANT_ALLOWED_ACTIONS.has(item.action)) {
      throw new Error(`Plan assistant cannot propose unsupported action: ${item.action}`)
    }
    if (item.explanation.trim().length === 0) {
      throw new Error('Plan assistant proposals must be traceable.')
    }
    if (!isConfirmableAction(item.action) || !item.proposedPath) continue
    const destination = path.normalize(path.dirname(item.proposedPath))
    const allowed = item.alternatives.some((option) => samePath(option.folder, destination))
    if (!allowed) {
      throw new Error('Plan assistant cannot invent move destinations.')
    }

    const baselineItem = baselineByPath.get(item.currentPath.toLowerCase())
    if (baselineItem && path.basename(item.proposedPath).toLowerCase() !== path.basename(item.currentPath).toLowerCase()) {
      throw new Error('Plan assistant cannot rename a file that is ready to move.')
    }
  }
}

export function proposeOrganisationPlan(
  input: unknown,
  folders: IndexedFolderEntry[],
): KnowledgeSetOperationResult<PlanAssistantProposal> {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : null
  const knowledgeSetInput = record?.knowledgeSet ?? input
  const validated = validateKnowledgeSet(knowledgeSetInput)
  if (!validated.ok) return validated

  const baseline = previewOrganisationPlanForFolders(validated.data, folders)
  if (!baseline.ok) return baseline

  const note = noteText(record?.note)
  const hints = planAssistantHints(note)
  let items = baseline.data.items.map((item) => applyAssistantItem(item, note, hints, folders))
  const workflows = buildWorkflows(items, hints)
  items = applyCreateStructureIdeas(items, workflows, hints)

  const preview: OrganisationPlanPreview = {
    simulated: true,
    message: PLAN_ASSISTANT_MESSAGE,
    knowledgeSet: validated.data,
    items,
    proposedBy: 'assistant',
  }

  const proposal: PlanAssistantProposal = {
    simulated: true,
    source: 'assistant',
    message: PLAN_ASSISTANT_MESSAGE,
    knowledgeSet: validated.data,
    preview,
    workflows,
    note: note || null,
    using: ON_DEVICE_PLAN_ASSISTANT_USING,
  }

  try {
    assertProposalIsSafe(proposal, baseline.data)
  } catch (error) {
    return validationError(
      'invalid_plan',
      error instanceof Error ? error.message : 'Plan assistant produced an unsafe plan.',
    )
  }

  return { ok: true, data: proposal }
}

function fixtureFolder(relativePath: string, fileNames: string[]): IndexedFolderEntry {
  const absolutePath = path.join('/suhuella-plan-assistant-check', relativePath)
  const segments = relativePath.split('/').filter(Boolean)
  const folderName = segments.at(-1) ?? relativePath

  return {
    id: relativePath,
    sourceId: 'src_plan_assistant_check',
    sourceType: 'local_folder',
    kind: 'folder',
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath,
    folderName,
    parentTokens: [],
    depth: segments.length,
    extensions: [],
    fileCount: fileNames.length,
    fileNames,
    lastModified: null,
  }
}

function realFolder(absolutePath: string, fileNames: string[]): IndexedFolderEntry {
  const folderName = path.basename(absolutePath)
  return {
    id: absolutePath,
    sourceId: 'src_plan_assistant_check',
    sourceType: 'local_folder',
    kind: 'folder',
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath: folderName,
    folderName,
    parentTokens: [],
    depth: 1,
    extensions: [],
    fileCount: fileNames.length,
    fileNames,
    lastModified: null,
  }
}

function planAssistantSource(): string {
  const candidates = [
    path.join(process.cwd(), 'electron/plan-assistant.ts'),
    path.join(process.cwd(), 'desktop/electron/plan-assistant.ts'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
  }
  return ''
}

function sourceCalls(source: string, left: string, right: string): boolean {
  return new RegExp(`\\b${left}${right}\\s*\\(`).test(source)
}

export function runPlanAssistantChecks(): void {
  const source = planAssistantSource()
  if (sourceCalls(source, 'execute', 'OrganisationPlan') || sourceCalls(source, 'recommend', 'Folders')) {
    throw new Error('plan assistant must not execute or re-rank')
  }
  const engineCandidates = [
    path.join(process.cwd(), 'electron/recommendations.ts'),
    path.join(process.cwd(), 'desktop/electron/recommendations.ts'),
  ]
  for (const candidate of engineCandidates) {
    if (existsSync(candidate) && readFileSync(candidate, 'utf8').includes('plan-assistant')) {
      throw new Error('Recommendation Engine must never import the plan assistant')
    }
  }

  const hints = extractPlanHintsFromAssistantText(
    'Ignore screenshots. Rename invoices.\nThe recommended folder stays as-is.',
  )
  if (!/ignor/i.test(hints) || !/renam/i.test(hints)) {
    throw new Error('on-device assistant must read simple planning instructions')
  }
  if (ON_DEVICE_PLAN_ASSISTANT_USING.label !== 'Built-in rules') {
    throw new Error('on-device assistant must stay labelled Built-in rules')
  }
  if (PLAN_ASSISTANT_ALLOWED_HINTS.length !== 6) {
    throw new Error('plan assistant capability hints must stay frozen')
  }
  for (const forbidden of ['encrypt', 'upload', 'compress', 'email', 'ocr']) {
    if (new RegExp(`action:\\s*['"]${forbidden}['"]`, 'i').test(source)) {
      throw new Error(`plan assistant must not invent capability: ${forbidden}`)
    }
  }
  if (!source.includes('THE PLAN ASSISTANT NEVER DEFINES THE TRUTH')) {
    throw new Error('plan assistant frozen principles must stay documented in source')
  }

  if (!isPlanAssistantQuestion('Why is this file here?') || isPlanAssistantQuestion('Ignore screenshots')) {
    throw new Error('questions and plan notes must stay distinct')
  }
  if (
    !isSimplePlanAssistantTask('Ignore screenshots') ||
    isSimplePlanAssistantTask('Summarise these 300 invoices according to my accounting structure')
  ) {
    throw new Error('complex requests must not look simple')
  }
  const why = answerOnDevicePlanQuestion('Why is Invoice.pdf here?', [
    {
      action: 'move',
      currentPath: '/tmp/Invoice.pdf',
      proposedPath: '/tmp/Invoices/Invoice.pdf',
      explanation: 'Invoice matches Invoices.',
      status: 'preview',
      warnings: [],
      reviewGroup: 'ready',
      selected: true,
      fileName: 'Invoice.pdf',
      score: 80,
      confidenceLabel: 'Strong match',
      alternatives: [],
      skipReason: null,
    },
  ])
  if (!why || !why.includes('Invoice matches Invoices')) {
    throw new Error('on-device questions should explain an existing plan item')
  }

  const empty = proposeOrganisationPlan({ knowledgeSet: { items: [] } }, [])
  if (empty.ok) throw new Error('empty knowledge set should fail')

  const virtualInvoice = path.join(tmpdir(), 'Invoice_ACME_2026.pdf')
  const invoiceFolders = [
    fixtureFolder('Clients/ACME/Invoices', ['Invoice_ACME_2024.pdf', 'Factura_ACME_2025.pdf']),
  ]
  const invoiceProposal = proposeOrganisationPlan(
    { knowledgeSet: { items: [{ path: virtualInvoice, kind: 'file' }] } },
    invoiceFolders,
  )
  if (!invoiceProposal.ok || invoiceProposal.data.preview.items[0]?.action !== 'move') {
    throw new Error('assistant should keep the recommendation-backed move')
  }
  if (invoiceProposal.data.preview.items[0]?.selected !== true) {
    throw new Error('ready recommendation-backed moves should stay selected')
  }

  const root = mkdtempSync(path.join(tmpdir(), 'suhuella-plan-assistant-'))
  try {
    const downloads = path.join(root, 'Downloads')
    const invoices = path.join(root, 'Clients', 'ACME', 'Invoices')
    const archive = path.join(root, 'Archive')
    mkdirSync(downloads, { recursive: true })
    mkdirSync(invoices, { recursive: true })
    mkdirSync(archive, { recursive: true })

    const invoiceFile = path.join(downloads, 'Invoice_ACME_2026.pdf')
    const screenshot = path.join(downloads, 'Screenshot 2026-03-01.png')
    const messy = path.join(invoices, 'Invoice ACME draft.pdf')
    const systemFile = path.join(downloads, '.DS_Store')
    writeFileSync(invoiceFile, 'invoice')
    writeFileSync(screenshot, 'image')
    writeFileSync(messy, 'draft')
    writeFileSync(systemFile, 'sys')
    writeFileSync(path.join(invoices, 'Invoice_ACME_2024.pdf'), 'old')

    const folders = [realFolder(invoices, ['Invoice_ACME_2024.pdf']), realFolder(archive, [])]
    const knowledgeSet: KnowledgeSet = {
      items: [
        { path: invoiceFile, kind: 'file' },
        { path: screenshot, kind: 'file' },
        { path: messy, kind: 'file' },
        { path: systemFile, kind: 'file' },
      ],
    }

    const proposal = proposeOrganisationPlan({ knowledgeSet }, folders)
    if (!proposal.ok) throw new Error('live assistant proposal should pass')
    if (proposal.data.simulated !== true || proposal.data.preview.proposedBy !== 'assistant') {
      throw new Error('assistant proposal must stay simulated')
    }

    const byName = new Map(proposal.data.preview.items.map((item) => [item.fileName, item]))
    if (byName.get('Invoice_ACME_2026.pdf')?.action !== 'move') {
      throw new Error('invoice should stay a recommendation-backed move')
    }
    if (byName.get('Screenshot 2026-03-01.png')?.action !== 'archive') {
      throw new Error('screenshot should be suggested as archive')
    }
    if (byName.get('Screenshot 2026-03-01.png')?.selected) {
      throw new Error('archive suggestions must not be selected for execution')
    }
    if (byName.get('.DS_Store')?.action !== 'ignore') {
      throw new Error('system files should be ignored')
    }
    if (byName.get('Invoice ACME draft.pdf')?.action !== 'rename') {
      throw new Error('messy in-place name should be a rename suggestion')
    }
    if (proposal.data.workflows.length === 0) {
      throw new Error('assistant should offer at least one workflow idea')
    }
    if (!existsSync(invoiceFile) || !existsSync(screenshot) || !existsSync(messy)) {
      throw new Error('plan assistant must never move files')
    }

    const ignored = proposeOrganisationPlan(
      { knowledgeSet: { items: [{ path: invoiceFile, kind: 'file' }] }, note: 'ignore invoice' },
      folders,
    )
    if (!ignored.ok || ignored.data.preview.items[0]?.action !== 'ignore') {
      throw new Error('a note to ignore a file should mark it ignored')
    }
    if (!existsSync(invoiceFile)) {
      throw new Error('ignore notes must not move files')
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
