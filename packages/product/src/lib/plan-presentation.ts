import type { ConfidenceLabel, KnowledgeSetItem, OrganisationPlanItem, OrganisationPlanPreview } from '../types.ts'
import { fileNameMatchesDocumentHint } from './document-hints.ts'
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

export type PlanConfidenceCounts = {
  strong: number
  good: number
  possible: number
  weak: number
}

const CONFIDENCE_EXPLANATION = /^(Strong|Good|Possible|Weak) match \(\d+%\) — /i
const REVIEWABLE_STATES = new Set<PlanPresentationState>(['suggested', 'accepted', 'needs_review'])

const USER_SKIP = 'Skipped by you'

const BLOCKED_REASONS = [
  'Destination unavailable',
  'Target already exists',
  'A file with that name already exists',
  'This folder is no longer available.',
  'This folder needs permission.',
  'Name taken',
  'Source unavailable',
  'Connect ',
  'Reconnect ',
  'Grant access to ',
]

const NO_CHANGE_REASONS = [
  'Already in the recommended folder',
  'No confident destination found',
  'Unsupported item',
]

const SCREENSHOT_HINT = /(screenshot|screen[ _-]?shot|captura)/i

export function looksLikeInvoice(fileName: string): boolean {
  return fileNameMatchesDocumentHint(fileName, 'invoice')
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
  if (item.status === 'source_unavailable' || item.status === 'source_needs_access') return 'blocked'
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

export function planRecommendationConfidence(item: OrganisationPlanItem): ConfidenceLabel | null {
  if (!REVIEWABLE_STATES.has(planPresentationState(item))) return null
  return item.confidenceLabel
}

export function planNeedsCloserLook(item: OrganisationPlanItem): boolean {
  const label = planRecommendationConfidence(item)
  return label === 'Possible match' || label === 'Weak match'
}

export function planConfidenceCounts(items: OrganisationPlanItem[]): PlanConfidenceCounts {
  const counts: PlanConfidenceCounts = { strong: 0, good: 0, possible: 0, weak: 0 }
  for (const item of items) {
    if (planPresentationState(item) !== 'suggested' && planPresentationState(item) !== 'needs_review') {
      continue
    }
    const label = planRecommendationConfidence(item)
    if (label === 'Strong match') counts.strong += 1
    else if (label === 'Good match') counts.good += 1
    else if (label === 'Possible match') counts.possible += 1
    else if (label === 'Weak match') counts.weak += 1
  }
  return counts
}

export function planConfidenceLines(counts: PlanConfidenceCounts): string[] {
  const lines: string[] = []
  if (counts.strong > 0) {
    lines.push(`${counts.strong} strong match${counts.strong === 1 ? '' : 'es'}`)
  }
  if (counts.good > 0) {
    lines.push(`${counts.good} good match${counts.good === 1 ? '' : 'es'}`)
  }
  if (counts.possible > 0) {
    lines.push(`${counts.possible} possible match${counts.possible === 1 ? '' : 'es'}`)
  }
  if (counts.weak > 0) {
    lines.push(`${counts.weak} weak match${counts.weak === 1 ? '' : 'es'}`)
  }
  return lines
}

export function planCloserLookCount(items: OrganisationPlanItem[]): number {
  return items.filter(
    (item) =>
      (planPresentationState(item) === 'suggested' || planPresentationState(item) === 'needs_review') &&
      planNeedsCloserLook(item),
  ).length
}

export function planDecisionLead(items: OrganisationPlanItem[]): string | null {
  const closer = planCloserLookCount(items)
  if (closer === 0) return null
  return closer === 1
    ? '1 recommendation needs a closer look.'
    : `${closer} recommendations need a closer look.`
}

export function planExplanationWithoutConfidence(explanation: string): string {
  return explanation.replace(CONFIDENCE_EXPLANATION, '').trim()
}

/** Presentation only. The engine may still speak tokens; the Plan must not. */
export function planHumanReason(reason: string): string {
  const trimmed = reason.trim()
  if (!trimmed) return ''
  const tokensMatch = trimmed.match(/^(.+?)\s+tokens match (.+?)\.?$/i)
  if (tokensMatch) {
    return `Matches your existing ${tokensMatch[2].trim()} folder.`
  }
  if (/recognised destination hint/i.test(trimmed)) {
    return trimmed.replace(/recognised destination hint/gi, 'existing folder')
  }
  if (/^folder path match\.?$/i.test(trimmed)) {
    return 'Matches the folder name.'
  }
  return trimmed
}

function reviewRank(item: OrganisationPlanItem): number {
  const state = planPresentationState(item)
  if (state === 'needs_review') return 0
  if (state === 'suggested' && planNeedsCloserLook(item)) return 1
  if (state === 'suggested') return 2
  if (state === 'accepted') return 3
  if (state === 'blocked') return 4
  if (state === 'failed') return 5
  if (state === 'no_change') return 6
  if (state === 'skipped') return 7
  return 8
}

export function sortPlanItemsForReview(items: OrganisationPlanItem[]): OrganisationPlanItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const delta = reviewRank(left.item) - reviewRank(right.item)
      return delta !== 0 ? delta : left.index - right.index
    })
    .map((entry) => entry.item)
}

export function planConfidenceClass(label: ConfidenceLabel): string {
  if (label === 'Strong match') return 'text-emerald-700'
  if (label === 'Good match') return 'text-[var(--app-fg)] opacity-70'
  return 'text-amber-700'
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

  const strongSuggested = fixtureItem({
    fileName: 'Invoice_ACME_2026.pdf',
    currentPath: '/Users/demo/Downloads/Invoice_ACME_2026.pdf',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Invoices/Invoice_ACME_2026.pdf',
    reviewGroup: 'ready',
    selected: false,
    score: 80,
    confidenceLabel: 'Strong match',
    skipReason: null,
  })
  const possibleSuggested = fixtureItem({
    fileName: 'notes.txt',
    currentPath: '/Users/demo/Downloads/notes.txt',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Notes/notes.txt',
    reviewGroup: 'review',
    selected: false,
    score: 34,
    confidenceLabel: 'Possible match',
    skipReason: null,
  })
  const weakSuggested = fixtureItem({
    fileName: 'scan.png',
    currentPath: '/Users/demo/Downloads/scan.png',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Images/scan.png',
    reviewGroup: 'review',
    selected: false,
    score: 22,
    confidenceLabel: 'Weak match',
    skipReason: null,
  })
  const alreadyFineConfident = fixtureItem({
    fileName: 'kept.pdf',
    currentPath: '/Users/demo/Documents/Invoices/kept.pdf',
    skipReason: 'Already in the recommended folder',
    score: 88,
    confidenceLabel: 'Strong match',
  })

  if (planRecommendationConfidence(strongSuggested) !== 'Strong match') {
    throw new Error('suggested items must expose recommendation confidence')
  }
  if (planRecommendationConfidence(alreadyFineConfident) !== null) {
    throw new Error('no-change items must not show recommendation confidence')
  }
  if (planNeedsCloserLook(strongSuggested) !== false || planNeedsCloserLook(possibleSuggested) !== true) {
    throw new Error('possible matches need a closer look; strong matches do not')
  }
  if (planNeedsCloserLook(alreadyFineConfident)) {
    throw new Error('already-fine items are not closer-look recommendations')
  }

  const confidenceItems = [strongSuggested, possibleSuggested, weakSuggested, alreadyFineConfident, move]
  const confidence = planConfidenceCounts(confidenceItems)
  if (confidence.strong !== 1 || confidence.possible !== 1 || confidence.weak !== 1) {
    throw new Error(`expected 1 strong / 1 possible / 1 weak still to review, got ${JSON.stringify(confidence)}`)
  }
  const acceptedStrong = fixtureItem({
    fileName: 'Contract.pdf',
    currentPath: '/Users/demo/Downloads/Contract.pdf',
    action: 'move',
    proposedPath: '/Users/demo/Documents/Contracts/Contract.pdf',
    reviewGroup: 'ready',
    selected: true,
    score: 76,
    confidenceLabel: 'Strong match',
    skipReason: null,
  })
  if (planConfidenceCounts([acceptedStrong, possibleSuggested]).strong !== 0) {
    throw new Error('accepted items must leave the confidence summary')
  }

  const confidenceLines = planConfidenceLines(confidence)
  if (
    !confidenceLines.includes('1 strong match') ||
    !confidenceLines.includes('1 possible match') ||
    !confidenceLines.includes('1 weak match')
  ) {
    throw new Error(`confidence summary is wrong: ${confidenceLines.join(' / ')}`)
  }
  if (planConfidenceLines({ strong: 8, good: 2, possible: 0, weak: 0 }).join(' · ') !== '8 strong matches · 2 good matches') {
    throw new Error('plural confidence lines are wrong')
  }

  if (planCloserLookCount(confidenceItems) !== 2) {
    throw new Error('closer-look count must include possible and weak suggestions only')
  }
  if (planDecisionLead([strongSuggested, alreadyFineConfident]) !== null) {
    throw new Error('confident plans must not add a closer-look sentence')
  }
  if (planDecisionLead(confidenceItems) !== '2 recommendations need a closer look.') {
    throw new Error('mixed plans must say how many recommendations need a closer look')
  }

  if (
    planExplanationWithoutConfidence('Strong match (82%) — Invoice tokens match Invoices') !==
    'Invoice tokens match Invoices'
  ) {
    throw new Error('why text must drop the confidence prefix')
  }
  if (planExplanationWithoutConfidence('Already in Invoices.') !== 'Already in Invoices.') {
    throw new Error('why text without a confidence prefix must stay intact')
  }
  if (planHumanReason('Invoice tokens match Invoices') !== 'Matches your existing Invoices folder.') {
    throw new Error('token-match reasons must name the existing folder')
  }
  if (planHumanReason('Already in Invoices.') !== 'Already in Invoices.') {
    throw new Error('already-human reasons stay intact')
  }

  const ordered = sortPlanItemsForReview([
    alreadyFineConfident,
    strongSuggested,
    possibleSuggested,
    acceptedStrong,
  ])
  if (
    ordered[0]?.fileName !== possibleSuggested.fileName ||
    ordered[1]?.fileName !== strongSuggested.fileName ||
    ordered[2]?.fileName !== acceptedStrong.fileName ||
    ordered[3]?.fileName !== alreadyFineConfident.fileName
  ) {
    throw new Error(`review order must put closer-look first: ${ordered.map((item) => item.fileName).join(' / ')}`)
  }
}
