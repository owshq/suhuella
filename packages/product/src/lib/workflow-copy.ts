import type { KnowledgeSetItem, OrganisationPlanAction, Workflow, WorkflowTrigger } from '../types.ts'

export const WORKFLOW_NAME_EXAMPLES = ['Weekly Downloads', 'Project Alpha documents'] as const
export const WORKFLOW_CATEGORIES = ['Personal', 'Finance', 'Clients', 'Downloads', 'Photos'] as const

export type WorkflowIconKind = 'downloads' | 'invoices' | 'contracts' | 'photos' | 'custom'

export type WorkflowIntentInput = {
  name: string
  description?: string | null
  category?: string | null
  plan?: { knowledgeSet: { items: KnowledgeSetItem[] } }
  approvedPlan?: { items: Array<{ action: OrganisationPlanAction }> } | null
}

export function recentWorkflows(workflows: Workflow[], limit = 4): Workflow[] {
  return [...workflows]
    .sort((left, right) => {
      const leftAt = Date.parse(left.lastRunAt ?? left.updatedAt)
      const rightAt = Date.parse(right.lastRunAt ?? right.updatedAt)
      return (Number.isFinite(rightAt) ? rightAt : 0) - (Number.isFinite(leftAt) ? leftAt : 0)
    })
    .slice(0, limit)
}

export function workflowLastRunLabel(iso: string | null): string {
  if (!iso) return 'Not run yet'
  const date = Date.parse(iso)
  if (!Number.isFinite(date)) return 'Not run yet'
  const minutes = Math.round((Date.now() - date) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(date).toLocaleDateString()
}

export function workflowTriggerLabel(trigger: WorkflowTrigger): string {
  if (trigger === 'folder_watch') return 'Folder watch'
  if (trigger === 'connector') return 'Connector'
  return 'Manual'
}

export function workflowTriggerHint(trigger: WorkflowTrigger): string {
  if (trigger === 'folder_watch') return 'Coming later. This plan never runs by itself.'
  if (trigger === 'connector') return 'Coming later. Connectors are not available yet.'
  return 'You review the plan and confirm. Nothing moves on its own.'
}

export function workflowAutopilotLabel(_workflow: Workflow): string | null {
  return null
}

export function workflowSourceLabel(item: KnowledgeSetItem): string {
  const parts = item.path.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) || item.path
}

export function workflowSourcesSummary(workflow: Workflow): string {
  const items = workflow.plan.knowledgeSet.items
  if (items.length === 0) return 'No files selected'
  if (items.length === 1) {
    const item = items[0]
    return item.kind === 'folder' ? `Folder · ${workflowSourceLabel(item)}` : workflowSourceLabel(item)
  }
  const folders = items.filter((item) => item.kind === 'folder').length
  const files = items.length - folders
  const parts: string[] = []
  if (folders > 0) parts.push(`${folders} folder${folders === 1 ? '' : 's'}`)
  if (files > 0) parts.push(`${files} file${files === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

export function workflowIconKind(workflow: Pick<WorkflowIntentInput, 'name' | 'category'>): WorkflowIconKind {
  const haystack = `${workflow.category ?? ''} ${workflow.name}`.toLowerCase()
  if (/\b(download|downloads)\b/.test(haystack)) return 'downloads'
  if (/\b(invoice|invoices|receipt|receipts|finance)\b/.test(haystack)) return 'invoices'
  if (/\b(contract|contracts|client|clients)\b/.test(haystack)) return 'contracts'
  if (/\b(photo|photos|image|images|camera)\b/.test(haystack)) return 'photos'
  return 'custom'
}

function primarySourceLabel(workflow: WorkflowIntentInput): string | null {
  const item = workflow.plan?.knowledgeSet.items[0]
  if (!item) return null
  return workflowSourceLabel(item)
}

export function workflowIntentSummary(workflow: WorkflowIntentInput): string {
  const description = workflow.description?.trim()
  if (description) return description

  const source = primarySourceLabel(workflow)
  const name = workflow.name.trim().toLowerCase()
  if (/\binvoice/.test(name)) {
    return source ? `Moves invoices from ${source} into client folders` : 'Moves invoices into client folders'
  }
  if (/\breceipt/.test(name)) {
    return source ? `Moves receipts from ${source}` : 'Moves receipts into folders'
  }
  if (/\bcontract/.test(name)) {
    return source ? `Moves contracts from ${source}` : 'Moves contracts into client folders'
  }
  if (/\bphoto|image/.test(name)) {
    return source ? `Sorts photos from ${source}` : 'Sorts photos'
  }
  if (/\bdownload/.test(name)) {
    return source ? `Cleans up ${source}` : 'Cleans up Downloads'
  }
  return source ? `Analyses ${source} and builds a plan` : 'Analyses the source and builds a plan'
}

export function workflowActionLabels(workflow: WorkflowIntentInput): string[] {
  const items = workflow.approvedPlan?.items ?? []
  const labels: string[] = []
  if (items.some((item) => item.action === 'move')) labels.push('Moves')
  if (items.some((item) => item.action === 'rename')) labels.push('Renames')
  if (items.some((item) => item.action === 'create_folder' || item.action === 'create_structure')) {
    labels.push('Creates folders')
  }
  if (labels.length > 0) return labels
  return ['Moves', 'Renames', 'Creates folders']
}

export function workflowActionSummary(workflow: WorkflowIntentInput): string {
  return workflowActionLabels(workflow).join(' · ')
}

export function workflowUsingLabel(name: string): string {
  const trimmed = name.trim()
  return trimmed ? `Using ${trimmed}` : 'Using workflow'
}

export function workflowCompletedTitle(name: string | null | undefined, undone = false): string {
  const trimmed = name?.trim() ?? ''
  const outcome = undone ? 'Plan undone' : 'Plan completed'
  return trimmed ? `${trimmed} · ${outcome}` : outcome
}

function workflowCopyFixture(overrides: Partial<Workflow> & Pick<Workflow, 'name'>): Workflow {
  return {
    id: 'wf_copy_check',
    description: '',
    category: null,
    workflowVersion: 1,
    trigger: 'manual',
    plan: { knowledgeSet: { items: [] } },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastRunAt: null,
    approvedPlan: null,
    approvedAt: null,
    autopilotEnabled: false,
    ...overrides,
  }
}

export function runWorkflowCopyChecks(): void {
  if (workflowUsingLabel('Invoices') !== 'Using Invoices') {
    throw new Error('review must name the active workflow')
  }
  if (workflowUsingLabel('  ') !== 'Using workflow') {
    throw new Error('blank workflow names still have a using label')
  }
  if (workflowCompletedTitle('Invoices') !== 'Invoices · Plan completed') {
    throw new Error('completion must name the workflow')
  }
  if (workflowCompletedTitle('Invoices', true) !== 'Invoices · Plan undone') {
    throw new Error('undo completion must name the workflow')
  }
  if (workflowCompletedTitle(null) !== 'Plan completed') {
    throw new Error('ad-hoc organise keeps the generic completion title')
  }
  if (workflowCompletedTitle('   ') !== 'Plan completed') {
    throw new Error('blank workflow names fall back to Plan completed')
  }
  if (workflowAutopilotLabel(workflowCopyFixture({ name: 'Weekly Downloads', autopilotEnabled: true })) !== null) {
    throw new Error('autopilot must not surface in product copy')
  }
  if (WORKFLOW_NAME_EXAMPLES.some((example) => /\b(invoices|clients|finance)\b/i.test(example))) {
    throw new Error('workflow name examples must not push vertical categories')
  }
  if (/\bRun\b/.test(`${workflowUsingLabel('Invoices')} ${workflowCompletedTitle('Invoices')}`)) {
    throw new Error('workflow copy must not say Run')
  }
  if (
    workflowIntentSummary({
      name: 'Invoices',
      description: 'Organise downloaded invoices into client folders.',
    }) !== 'Organise downloaded invoices into client folders.'
  ) {
    throw new Error('picker intent must prefer the saved description')
  }
  if (workflowLastRunLabel(null) !== 'Not run yet') {
    throw new Error('unused workflows must say they have not run yet')
  }
  const ordered = recentWorkflows(
    [
      workflowCopyFixture({
        name: 'Receipts',
        lastRunAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      workflowCopyFixture({
        name: 'Weekly Downloads',
        lastRunAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      }),
    ],
    2,
  )
  if (ordered[0]?.name !== 'Weekly Downloads' || ordered[1]?.name !== 'Receipts') {
    throw new Error('saved workflows must surface the last used intent first')
  }
}
