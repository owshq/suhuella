import type { KnowledgeSetItem, OrganisationPlanItem, OrganisationPlanPreview } from '../types.ts'
import { isConfirmablePlanItem } from './plan-editor-copy.ts'

export type PlanPresentationState =
  | 'suggested'
  | 'accepted'
  | 'needs_review'
  | 'no_change'
  | 'blocked'
  | 'skipped'
  | 'applied'
  | 'failed'

export type PlanPresentationCounts = {
  selected: number
  suggested: number
  noChange: number
  blocked: number
  accepted: number
  needsReview: number
  skipped: number
}

const USER_SKIP = 'Skipped by you'

const BLOCKED_REASONS = [
  'Destination unavailable',
  'Target already exists',
  'A file with that name already exists',
  'This folder is no longer available.',
  'This folder needs permission.',
  'Name taken',
]

const NO_CHANGE_REASONS = [
  'Already in the recommended folder',
  'No confident destination found',
  'Unsupported item',
]

const INVOICE_HINT = /\b(invoice|invoices|factura|facturas|factures|facturacion|facturación)\b/i
const SCREENSHOT_HINT = /(screenshot|screen[ _-]?shot|captura)/i

export function looksLikeInvoice(fileName: string): boolean {
  return INVOICE_HINT.test(fileName.replace(/[_-]+/g, ' '))
}

export function looksLikeScreenshot(fileName: string): boolean {
  return SCREENSHOT_HINT.test(fileName)
}

export function invoicesInPlan(items: OrganisationPlanItem[]): OrganisationPlanItem[] {
  return items.filter((item) => looksLikeInvoice(item.fileName))
}

export function screenshotsInPlan(items: OrganisationPlanItem[]): OrganisationPlanItem[] {
  return items.filter((item) => looksLikeScreenshot(item.fileName))
}

function reasonText(item: OrganisationPlanItem): string {
  return item.skipReason || item.warnings.at(-1) || ''
}

export function isUserSkip(item: OrganisationPlanItem): boolean {
  return item.skipReason === USER_SKIP
}

export function isBlockedReason(reason: string): boolean {
  return BLOCKED_REASONS.some((entry) => reason.includes(entry))
}

export function isNoChangeReason(reason: string): boolean {
  return NO_CHANGE_REASONS.some((entry) => reason.includes(entry))
}

export function planPresentationState(item: OrganisationPlanItem): PlanPresentationState {
  if (item.status === 'applied') return 'applied'
  if (item.status === 'failed') return 'failed'
  if (isUserSkip(item)) return 'skipped'
  if (isBlockedReason(reasonText(item))) return 'blocked'
  if (isConfirmablePlanItem(item) && item.selected) return 'accepted'
  if (isConfirmablePlanItem(item) && !item.selected) return 'suggested'
  if (isNoChangeReason(reasonText(item))) return 'no_change'
  if (item.action === 'none' || item.action === 'ignore') return 'no_change'
  return 'needs_review'
}

export function planPresentationLabel(state: PlanPresentationState): string {
  switch (state) {
    case 'suggested':
      return 'Suggested'
    case 'accepted':
      return 'Accepted'
    case 'needs_review':
      return 'Needs review'
    case 'no_change':
      return 'No change'
    case 'blocked':
      return 'Blocked'
    case 'skipped':
      return 'Skipped'
    case 'applied':
      return 'Applied'
    case 'failed':
      return 'Failed'
  }
}

export function planPresentationCounts(items: OrganisationPlanItem[]): PlanPresentationCounts {
  const counts: PlanPresentationCounts = {
    selected: items.length,
    suggested: 0,
    noChange: 0,
    blocked: 0,
    accepted: 0,
    needsReview: 0,
    skipped: 0,
  }
  for (const item of items) {
    const state = planPresentationState(item)
    if (state === 'suggested') counts.suggested += 1
    else if (state === 'no_change') counts.noChange += 1
    else if (state === 'blocked') counts.blocked += 1
    else if (state === 'accepted') counts.accepted += 1
    else if (state === 'needs_review') counts.needsReview += 1
    else if (state === 'skipped') counts.skipped += 1
  }
  return counts
}

export function selectionOriginLabel(items: KnowledgeSetItem[] | OrganisationPlanItem[]): string | null {
  const paths = items.map((item) => ('path' in item ? item.path : item.currentPath))
  if (paths.length === 0) return null
  const parents = paths.map((value) => {
    const parts = value.split(/[/\\]/).filter(Boolean)
    return parts.at(-2) ?? null
  })
  const first = parents[0]
  if (!first || parents.some((parent) => parent !== first)) return null
  return first
}

export function planSummaryLead(fileCount: number, origin: string | null): string {
  if (origin) {
    return `${fileCount} document${fileCount === 1 ? '' : 's'} from ${origin}`
  }
  return `${fileCount} document${fileCount === 1 ? '' : 's'}`
}

export function applyChangesLabel(_acceptedCount: number): string {
  return 'Confirm Plan'
}

export function reviewSuggestionsLabel(suggestedCount: number): string {
  return `Review ${suggestedCount} suggestion${suggestedCount === 1 ? '' : 's'}`
}

export function asReviewPreview(preview: OrganisationPlanPreview): OrganisationPlanPreview {
  return {
    ...preview,
    items: preview.items.map((item) =>
      item.status === 'preview' && isConfirmablePlanItem(item)
        ? { ...item, selected: false }
        : item,
    ),
  }
}

export function groundedAssistantChips(items: OrganisationPlanItem[]): string[] {
  const chips: string[] = []
  const suggested = items.some((item) => planPresentationState(item) === 'suggested' || planPresentationState(item) === 'accepted')
  if (items.some((item) => isConfirmablePlanItem(item) && item.action !== 'rename')) {
    chips.push('Why this folder?')
  }
  if (suggested) {
    chips.push('Keep these documents where they are')
  }
  if (items.some((item) => item.action === 'rename' && item.proposedPath)) {
    chips.push('Use shorter filenames')
  }
  if (screenshotsInPlan(items).length > 0) {
    chips.push('Ignore screenshots.')
  }
  return chips
}

export function groundedPlanAssistantReply(
  note: string,
  items: OrganisationPlanItem[],
): string | null {
  const text = note.trim()
  if (!text) return null
  const wantsInvoiceYear = /group\s+invoices?\s+by\s+year/i.test(text)
  if (!wantsInvoiceYear) return null
  const invoices = invoicesInPlan(items)
  if (invoices.length === 0) {
    return `I haven't detected any invoices in these ${items.length} documents.`
  }
  return `I can see ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} in this selection, but I cannot group them by year yet. Review the current suggestions instead.`
}

export function canGroupInvoicesByYear(): boolean {
  return false
}

export function reanalyseWouldReplaceReview(items: OrganisationPlanItem[]): boolean {
  return items.some((item) => {
    const state = planPresentationState(item)
    return state === 'suggested' || state === 'accepted' || state === 'needs_review'
  })
}

export function planSummaryLines(counts: PlanPresentationCounts): string[] {
  const lines: string[] = []
  if (counts.suggested > 0) {
    lines.push(`${counts.suggested} suggested change${counts.suggested === 1 ? '' : 's'}`)
  }
  if (counts.accepted > 0) {
    lines.push(`${counts.accepted} accepted`)
  }
  if (counts.needsReview > 0) {
    lines.push(`${counts.needsReview} still need review`)
  }
  if (counts.noChange > 0) {
    lines.push(`${counts.noChange} need no change`)
  }
  if (counts.blocked > 0) {
    lines.push(`${counts.blocked} blocked`)
  }
  if (counts.skipped > 0) {
    lines.push(`${counts.skipped} skipped`)
  }
  return lines
}

export function planPrimaryAction(counts: PlanPresentationCounts): {
  kind: 'review' | 'apply' | 'none'
  label: string
} {
  if (counts.accepted > 0 && counts.suggested === 0) {
    return { kind: 'apply', label: 'Confirm Plan' }
  }
  if (counts.accepted > 0) {
    return { kind: 'apply', label: applyChangesLabel(counts.accepted) }
  }
  if (counts.suggested > 0) {
    return { kind: 'review', label: reviewSuggestionsLabel(counts.suggested) }
  }
  return { kind: 'none', label: 'Nothing to confirm' }
}

export const REANALYSE_WARNING =
  'Reanalysing will replace the current suggestions. Your documents will not be changed.'

function fixtureItem(
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

export function runPlanPresentationChecks(): void {
  const move = fixtureItem({
    fileName: 'Invoice_ACME_2026.pdf',
    currentPath: '/Users/demo/Downloads/Invoice_ACME_2026.pdf',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Invoices/Invoice_ACME_2026.pdf',
    reviewGroup: 'ready',
    selected: true,
    score: 80,
    skipReason: null,
  })
  const alreadyFine = fixtureItem({
    fileName: 'notes.txt',
    currentPath: '/Users/demo/Downloads/notes.txt',
    skipReason: 'No confident destination found',
  })
  const blocked = fixtureItem({
    fileName: 'taken.pdf',
    currentPath: '/Users/demo/Downloads/taken.pdf',
    proposedPath: '/Users/demo/Documents/taken.pdf',
    skipReason: 'Target already exists',
  })
  const userSkip = fixtureItem({
    fileName: 'keep.pdf',
    currentPath: '/Users/demo/Downloads/keep.pdf',
    skipReason: USER_SKIP,
  })
  const photo = fixtureItem({
    fileName: 'photo.png',
    currentPath: '/Users/demo/Downloads/photo.png',
    skipReason: 'No confident destination found',
  })

  const unselectedMove = { ...move, selected: false }
  if (planPresentationState(unselectedMove) !== 'suggested') {
    throw new Error('high score without user accept is suggested, not accepted')
  }
  if (planPresentationState(move) !== 'accepted') {
    throw new Error('selected confirmable item is accepted')
  }
  if (planPresentationState(alreadyFine) !== 'no_change') {
    throw new Error('no destination is no_change, not skipped')
  }
  if (planPresentationState(blocked) !== 'blocked') {
    throw new Error('target exists is blocked')
  }
  if (planPresentationState(userSkip) !== 'skipped') {
    throw new Error('only explicit Skip is skipped')
  }

  const fixture = [
    ...Array.from({ length: 23 }, (_, index) => ({
      ...unselectedMove,
      fileName: `file-${index}.pdf`,
      currentPath: `/Users/demo/Downloads/file-${index}.pdf`,
      proposedPath: `/Users/demo/Documents/file-${index}.pdf`,
    })),
    ...Array.from({ length: 16 }, (_, index) => ({
      ...alreadyFine,
      fileName: `ok-${index}.txt`,
      currentPath: `/Users/demo/Downloads/ok-${index}.txt`,
    })),
  ]
  const counts = planPresentationCounts(fixture)
  if (counts.selected !== 39 || counts.suggested !== 23 || counts.noChange !== 16) {
    throw new Error(`expected 23 suggested / 16 no change, got ${JSON.stringify(counts)}`)
  }
  if (counts.skipped !== 0) {
    throw new Error('untouched files must not count as skipped')
  }

  const preview = asReviewPreview({
    simulated: true,
    message: '',
    knowledgeSet: { items: [] },
    items: [move],
  })
  if (preview.items[0]?.selected !== false || planPresentationState(preview.items[0]!) !== 'suggested') {
    throw new Error('review preview must clear engine auto-select')
  }

  const noInvoiceChips = groundedAssistantChips([photo, alreadyFine])
  if (noInvoiceChips.some((chip) => /invoice/i.test(chip))) {
    throw new Error('no invoice chip without invoices')
  }
  if (noInvoiceChips.some((chip) => /screenshot/i.test(chip))) {
    throw new Error('no screenshot chip without screenshots')
  }

  const invoiceReply = groundedPlanAssistantReply('Group invoices by year', [photo, alreadyFine])
  if (invoiceReply !== "I haven't detected any invoices in these 2 documents.") {
    throw new Error(`expected honest empty invoice reply, got ${invoiceReply}`)
  }
  const invoicePresent = groundedPlanAssistantReply('Group invoices by year', [unselectedMove])
  if (!invoicePresent?.includes('cannot group them by year')) {
    throw new Error('must not pretend group-by-year changed the Plan')
  }
  if (canGroupInvoicesByYear()) {
    throw new Error('group invoices by year is not a current planner operation')
  }

  const origin = selectionOriginLabel([
    { path: '/Users/demo/Downloads/a.pdf', kind: 'file' as const },
    { path: '/Users/demo/Downloads/b.pdf', kind: 'file' as const },
  ])
  if (origin !== 'Downloads') throw new Error('shared parent should label Downloads')
  if (applyChangesLabel(18) !== 'Confirm Plan') {
    throw new Error('confirm label is wrong')
  }
  if (reviewSuggestionsLabel(23) !== 'Review 23 suggestions') {
    throw new Error('review label is wrong')
  }

  const summary = planSummaryLines(counts)
  if (!summary.includes('23 suggested changes') || !summary.includes('16 need no change')) {
    throw new Error(`product summary is wrong: ${summary.join(' / ')}`)
  }
  if (summary.some((line) => /ready/i.test(line) || /skipped/i.test(line))) {
    throw new Error('summary must not expose engine ready or implicit skipped')
  }
  if (reanalyseWouldReplaceReview(fixture) !== true) {
    throw new Error('reanalyse must warn when suggestions exist')
  }
  if (reanalyseWouldReplaceReview([alreadyFine, blocked]) !== false) {
    throw new Error('reanalyse must not warn when nothing reviewable would be lost')
  }

  const primary = planPrimaryAction(counts)
  if (primary.kind !== 'review' || primary.label !== 'Review 23 suggestions') {
    throw new Error(`expected review CTA, got ${JSON.stringify(primary)}`)
  }
  const acceptedPrimary = planPrimaryAction({ ...counts, suggested: 5, accepted: 18 })
  if (acceptedPrimary.label !== 'Confirm Plan') {
    throw new Error(`expected Confirm Plan CTA, got ${acceptedPrimary.label}`)
  }
  const allAccepted = planPrimaryAction({ ...counts, suggested: 0, accepted: 23, noChange: 16 })
  if (allAccepted.label !== 'Confirm Plan') {
    throw new Error(`expected Confirm Plan CTA, got ${allAccepted.label}`)
  }

}
