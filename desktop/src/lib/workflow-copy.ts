import type { KnowledgeSetItem, OrganisationPlanAction, Workflow, WorkflowTrigger } from '../types.ts'

export const WORKFLOW_NAME_EXAMPLES = ['Downloads', 'Invoices', 'Receipts', 'Contracts'] as const
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

export function workflowAutopilotLabel(workflow: Workflow): string {
  if (workflow.autopilotEnabled) return 'Autopilot on'
  if (workflow.approvedPlan) return 'Autopilot off'
  return 'Confirm this plan once to unlock Autopilot'
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
    return source ? `Organises photos from ${source}` : 'Organises photos'
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
