import type {
  KnowledgeSet,
  KnowledgeSetItem,
  KnowledgeSetValidationError,
  OrganisationPlanItem,
  SavedPlan,
  SavedPlanDraft,
} from '../types.ts'

const TITLE_MAX = 120

export function savedPlanTitleFromNote(note: string): string {
  const line = note.trim().split('\n')[0]?.trim() ?? ''
  if (!line) return 'Plan'
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1)}…` : line
}

export function newSavedPlanId(now = Date.now()): string {
  return `plan_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function isKnowledgeItem(value: unknown): value is KnowledgeSetItem {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.path === 'string' &&
    record.path.trim().length > 0 &&
    (record.kind === 'file' || record.kind === 'folder')
  )
}

function isPlanItem(value: unknown): value is OrganisationPlanItem {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.currentPath === 'string' && record.currentPath.trim().length > 0 && typeof record.action === 'string'
}

export function parseSavedPlan(value: unknown): SavedPlan | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id.trim()) return null
  if (typeof record.title !== 'string' || !record.title.trim()) return null
  if (typeof record.revision !== 'number' || record.revision < 1) return null
  if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') return null
  const knowledgeSet = record.knowledgeSet
  if (!knowledgeSet || typeof knowledgeSet !== 'object' || !Array.isArray((knowledgeSet as KnowledgeSet).items)) return null
  const items = (knowledgeSet as KnowledgeSet).items.filter(isKnowledgeItem)
  if (items.length === 0) return null
  if (!Array.isArray(record.items) || record.items.length === 0 || !record.items.every(isPlanItem)) return null
  return {
    id: record.id,
    title: record.title.trim().slice(0, TITLE_MAX),
    revision: record.revision,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    knowledgeSet: { items },
    items: record.items,
  }
}

export function planFromDraft(draft: SavedPlanDraft, now: string, existing?: SavedPlan | null): SavedPlan | KnowledgeSetValidationError {
  const title = savedPlanTitleFromNote(draft.title)
  const items = draft.knowledgeSet?.items?.filter(isKnowledgeItem) ?? []
  if (items.length === 0 || !Array.isArray(draft.items) || draft.items.length === 0) {
    return { code: 'invalid_plan', message: 'A saved Plan needs documents and plan items.' }
  }
  if (existing && draft.id && existing.id !== draft.id) {
    return { code: 'invalid_plan', message: 'Saved Plan id does not match.' }
  }
  return {
    id: existing?.id ?? draft.id?.trim() ?? newSavedPlanId(),
    title,
    revision: existing ? existing.revision + 1 : 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    knowledgeSet: { items },
    items: draft.items,
  }
}

export function duplicateSavedPlan(plan: SavedPlan, now: string): SavedPlan {
  return {
    ...plan,
    id: newSavedPlanId(),
    title: savedPlanTitleFromNote(`${plan.title} copy`),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    knowledgeSet: { items: plan.knowledgeSet.items.map((item) => ({ ...item })) },
    items: plan.items.map((item) => ({ ...item })),
  }
}

export function runSavedPlanRecordChecks(): void {
  const now = '2026-09-23T00:00:00.000Z'
  const draft: SavedPlanDraft = {
    title: 'Move invoices',
    knowledgeSet: { items: [{ path: 'src/invoices/a.pdf', kind: 'file' }] },
    items: [
      {
        action: 'move',
        currentPath: 'src/invoices/a.pdf',
        proposedPath: 'src/clients/a.pdf',
        explanation: 'Invoice',
        status: 'preview',
        warnings: [],
        reviewGroup: 'ready',
        selected: true,
        fileName: 'a.pdf',
        score: null,
        confidenceLabel: null,
        alternatives: [],
        skipReason: null,
      },
    ],
  }
  const created = planFromDraft(draft, now)
  if ('code' in created) throw new Error('draft should save')
  const updated = planFromDraft({ ...draft, id: created.id, title: 'Move invoices again' }, now, created)
  if ('code' in updated) throw new Error('draft should update')
  if (updated.revision !== 2 || updated.createdAt !== now) throw new Error('revision increments and createdAt stays')
  const copy = duplicateSavedPlan(updated, now)
  if (copy.id === updated.id || !copy.title.endsWith('copy')) throw new Error('duplicate is a new record')
  if (parseSavedPlan({ ...copy, items: [] }) !== null) throw new Error('empty items are not a saved plan')
}
