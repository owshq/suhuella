import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type {
  KnowledgeSet,
  KnowledgeSetValidationError,
  OrganisationPlan,
  Workflow,
  WorkflowDraft,
  WorkflowTrigger,
} from '../src/types.ts'
import { validateKnowledgeSet, validateOrganisationPlan, type KnowledgeSetOperationResult } from './knowledge-set.ts'
import { replayableApprovedPlan } from './organisation-plan.ts'
import { workflowActionSummary, workflowIconKind, workflowIntentSummary } from '../src/lib/workflow-copy.ts'

export const WORKFLOWS_FILE = 'workflows.json'
export const WORKFLOWS_LOG_VERSION = 1
export const WORKFLOW_FORMAT_VERSION = 1
export const WORKFLOW_NAME_EXAMPLES = ['Downloads', 'Invoices', 'Receipts', 'Contracts'] as const
export const WORKFLOW_CATEGORIES = ['Personal', 'Finance', 'Clients', 'Downloads', 'Photos'] as const
const DESCRIPTION_MAX = 160
const CATEGORY_MAX = 40

const TRIGGERS: WorkflowTrigger[] = ['manual', 'folder_watch', 'connector']
const RUNNABLE_TRIGGERS: WorkflowTrigger[] = ['manual']

type WorkflowLog = {
  version: number
  updatedAt: string
  workflows: Workflow[]
}

const EMPTY_LOG: WorkflowLog = {
  version: WORKFLOWS_LOG_VERSION,
  updatedAt: '',
  workflows: [],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function validationError(
  code: KnowledgeSetValidationError['code'],
  message: string,
): KnowledgeSetOperationResult<never> {
  return { ok: false, error: { code, message } }
}

export function getWorkflowsFilePath(userDataDir: string): string {
  return path.join(userDataDir, WORKFLOWS_FILE)
}

export function isRunnableWorkflowTrigger(trigger: WorkflowTrigger): boolean {
  return RUNNABLE_TRIGGERS.includes(trigger)
}

export function organisationTriggerFromWorkflow(_workflow: Workflow): 'workflow' {
  return 'workflow'
}

function normalizeName(value: unknown): string | null {
  const name = asString(value)
  if (!name || name.length > 60) return null
  return name
}

function normalizeTrigger(value: unknown): WorkflowTrigger {
  return TRIGGERS.find((item) => item === value) ?? 'manual'
}

function normalizeDescription(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, DESCRIPTION_MAX)
}

function normalizeCategory(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const category = value.trim().slice(0, CATEGORY_MAX)
  return category || null
}

function normalizeWorkflowVersion(value: unknown): number {
  const version =
    typeof value === 'number' ? Math.trunc(value) : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(version) && version >= 1 ? version : WORKFLOW_FORMAT_VERSION
}

export function nextDuplicateWorkflowName(name: string, existingNames: string[]): string {
  const base = name.replace(/\s+\(copy(?:\s+\d+)?\)$/i, '').trim() || name
  const taken = new Set(existingNames.map((item) => item.toLowerCase()))
  let candidate = `${base} (copy)`
  let n = 2
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (copy ${n})`
    n += 1
  }
  return candidate
}

function createWorkflowId(): string {
  return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeWorkflow(value: unknown): Workflow | null {
  if (!isRecord(value)) return null
  const id = asString(value.id)
  const name = normalizeName(value.name)
  const createdAt = asString(value.createdAt)
  const updatedAt = asString(value.updatedAt)
  const planRecord = isRecord(value.plan) ? value.plan : value
  const knowledgeSetResult = validateKnowledgeSet(planRecord.knowledgeSet)
  if (!id || !name || !createdAt || !updatedAt || !knowledgeSetResult.ok) return null

  const approvedResult = value.approvedPlan ? validateOrganisationPlan(value.approvedPlan) : null
  const approvedPlan =
    approvedResult?.ok ? replayableApprovedPlan(approvedResult.data) : null

  return {
    id,
    name,
    description: normalizeDescription(value.description),
    category: normalizeCategory(value.category),
    workflowVersion: normalizeWorkflowVersion(value.workflowVersion),
    trigger: normalizeTrigger(value.trigger),
    plan: { knowledgeSet: knowledgeSetResult.data },
    createdAt,
    updatedAt,
    lastRunAt: asString(value.lastRunAt),
    approvedPlan: approvedPlan && approvedPlan.items.length > 0 ? approvedPlan : null,
    approvedAt: approvedPlan && approvedPlan.items.length > 0 ? asString(value.approvedAt) : null,
    autopilotEnabled: value.autopilotEnabled === true && Boolean(approvedPlan?.items.length),
  }
}

export function loadWorkflowLog(userDataDir: string): WorkflowLog {
  const filePath = getWorkflowsFilePath(userDataDir)
  if (!existsSync(filePath)) {
    return { ...EMPTY_LOG, workflows: [] }
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
    if (!isRecord(parsed)) return { ...EMPTY_LOG, workflows: [] }
    const workflows = Array.isArray(parsed.workflows)
      ? parsed.workflows.map(normalizeWorkflow).filter((item): item is Workflow => item !== null)
      : []
    return {
      version: WORKFLOWS_LOG_VERSION,
      updatedAt: asString(parsed.updatedAt) ?? '',
      workflows,
    }
  } catch {
    return { ...EMPTY_LOG, workflows: [] }
  }
}

export function loadWorkflows(userDataDir: string): Workflow[] {
  return loadWorkflowLog(userDataDir).workflows
}

function saveWorkflowLog(userDataDir: string, log: WorkflowLog): WorkflowLog {
  const next: WorkflowLog = {
    version: WORKFLOWS_LOG_VERSION,
    updatedAt: new Date().toISOString(),
    workflows: log.workflows,
  }
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(getWorkflowsFilePath(userDataDir), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function validateDraft(input: unknown): KnowledgeSetOperationResult<WorkflowDraft> {
  if (!isRecord(input)) {
    return validationError('invalid_workflow', 'A workflow is required.')
  }

  const name = normalizeName(input.name)
  if (!name) {
    return validationError('invalid_workflow', 'Give this plan a name.')
  }

  const trigger = normalizeTrigger(input.trigger)
  if (trigger !== 'manual') {
    return validationError(
      'invalid_workflow',
      'Only manual workflows can be saved today. Folder watch and connectors are not available yet.',
    )
  }

  const knowledgeSetResult = validateKnowledgeSet(input.knowledgeSet)
  if (!knowledgeSetResult.ok) return knowledgeSetResult

  return {
    ok: true,
    data: {
      name,
      description: normalizeDescription(input.description),
      category: normalizeCategory(input.category),
      trigger,
      knowledgeSet: knowledgeSetResult.data,
    },
  }
}

function sameKnowledgeSet(left: KnowledgeSet, right: KnowledgeSet): boolean {
  if (left.items.length !== right.items.length) return false
  const rightPaths = new Set(right.items.map((item) => path.normalize(item.path).toLowerCase()))
  return left.items.every((item) => rightPaths.has(path.normalize(item.path).toLowerCase()))
}

function readApprovedPlan(input: unknown): KnowledgeSetOperationResult<OrganisationPlan | null> {
  if (!isRecord(input) || !('approvedPlan' in input) || input.approvedPlan == null) {
    return { ok: true, data: null }
  }
  const planResult = validateOrganisationPlan(input.approvedPlan)
  if (!planResult.ok) return planResult
  const replayable = replayableApprovedPlan(planResult.data)
  if (replayable.items.length === 0) {
    return validationError('invalid_plan', 'This plan has no confirmed actions Autopilot can run.')
  }
  return { ok: true, data: replayable }
}

export function listWorkflows(userDataDir: string): Workflow[] {
  return loadWorkflows(userDataDir)
}

export function getWorkflow(userDataDir: string, workflowId: string): Workflow | null {
  return loadWorkflows(userDataDir).find((item) => item.id === workflowId) ?? null
}

export function saveWorkflow(
  userDataDir: string,
  input: unknown,
): KnowledgeSetOperationResult<Workflow> {
  const draft = validateDraft(input)
  if (!draft.ok) return draft

  const approved = readApprovedPlan(input)
  if (!approved.ok) return approved
  if (isRecord(input) && input.autopilotEnabled === true && !approved.data) {
    return validationError(
      'workflow_not_approved',
      'Confirm this plan once before Autopilot can run it.',
    )
  }

  const now = new Date().toISOString()
  const workflow: Workflow = {
    id: createWorkflowId(),
    name: draft.data.name,
    description: draft.data.description ?? '',
    category: draft.data.category ?? null,
    workflowVersion: WORKFLOW_FORMAT_VERSION,
    trigger: draft.data.trigger,
    plan: { knowledgeSet: draft.data.knowledgeSet },
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    approvedPlan: approved.data,
    approvedAt: approved.data ? now : null,
    autopilotEnabled: isRecord(input) && input.autopilotEnabled === true && Boolean(approved.data),
  }

  const current = loadWorkflowLog(userDataDir)
  saveWorkflowLog(userDataDir, {
    ...current,
    workflows: [workflow, ...current.workflows],
  })
  return { ok: true, data: workflow }
}

export function updateWorkflow(
  userDataDir: string,
  workflowId: unknown,
  input: unknown,
): KnowledgeSetOperationResult<Workflow> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const current = loadWorkflowLog(userDataDir)
  const existing = current.workflows.find((item) => item.id === id)
  if (!existing) return validationError('workflow_not_found', 'This workflow could not be found.')

  const nextKnowledgeSet =
    isRecord(input) && 'knowledgeSet' in input ? input.knowledgeSet : existing.plan.knowledgeSet
  const draft = validateDraft({
    name: isRecord(input) && 'name' in input ? input.name : existing.name,
    description: isRecord(input) && 'description' in input ? input.description : existing.description,
    category: isRecord(input) && 'category' in input ? input.category : existing.category,
    trigger: isRecord(input) && 'trigger' in input ? input.trigger : existing.trigger,
    knowledgeSet: nextKnowledgeSet,
  })
  if (!draft.ok) return draft

  const knowledgeSetChanged = !sameKnowledgeSet(existing.plan.knowledgeSet, draft.data.knowledgeSet)
  const incomingApproved =
    isRecord(input) && 'approvedPlan' in input ? readApprovedPlan(input) : { ok: true as const, data: existing.approvedPlan }
  if (!incomingApproved.ok) return incomingApproved

  const approvedPlan = knowledgeSetChanged && !(isRecord(input) && 'approvedPlan' in input)
    ? null
    : incomingApproved.data
  if (isRecord(input) && input.autopilotEnabled === true && !approvedPlan) {
    return validationError(
      'workflow_not_approved',
      'Confirm this plan once before Autopilot can run it.',
    )
  }

  const now = new Date().toISOString()
  const approvalChanged = isRecord(input) && 'approvedPlan' in input
  const updated: Workflow = {
    ...existing,
    name: draft.data.name,
    description: draft.data.description ?? '',
    category: draft.data.category ?? null,
    workflowVersion: existing.workflowVersion || WORKFLOW_FORMAT_VERSION,
    trigger: draft.data.trigger,
    plan: { knowledgeSet: draft.data.knowledgeSet },
    updatedAt: now,
    approvedPlan,
    approvedAt: approvedPlan ? (approvalChanged || !existing.approvedAt ? now : existing.approvedAt) : null,
    autopilotEnabled:
      Boolean(approvedPlan) &&
      (isRecord(input) && 'autopilotEnabled' in input
        ? input.autopilotEnabled === true
        : existing.autopilotEnabled),
  }

  saveWorkflowLog(userDataDir, {
    ...current,
    workflows: current.workflows.map((item) => (item.id === id ? updated : item)),
  })
  return { ok: true, data: updated }
}

export function duplicateWorkflow(
  userDataDir: string,
  workflowId: unknown,
): KnowledgeSetOperationResult<Workflow> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const existing = getWorkflow(userDataDir, id)
  if (!existing) return validationError('workflow_not_found', 'This workflow could not be found.')

  return saveWorkflow(userDataDir, {
    name: nextDuplicateWorkflowName(
      existing.name,
      loadWorkflows(userDataDir).map((item) => item.name),
    ),
    description: existing.description,
    category: existing.category,
    trigger: 'manual',
    knowledgeSet: existing.plan.knowledgeSet,
  })
}

export function deleteWorkflow(
  userDataDir: string,
  workflowId: unknown,
): KnowledgeSetOperationResult<Workflow[]> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const current = loadWorkflowLog(userDataDir)
  if (!current.workflows.some((item) => item.id === id)) {
    return validationError('workflow_not_found', 'This workflow could not be found.')
  }

  const next = saveWorkflowLog(userDataDir, {
    ...current,
    workflows: current.workflows.filter((item) => item.id !== id),
  })
  return { ok: true, data: next.workflows }
}

export function markWorkflowRan(
  userDataDir: string,
  workflowId: unknown,
): KnowledgeSetOperationResult<Workflow> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const current = loadWorkflowLog(userDataDir)
  const existing = current.workflows.find((item) => item.id === id)
  if (!existing) return validationError('workflow_not_found', 'This workflow could not be found.')

  const updated: Workflow = {
    ...existing,
    lastRunAt: new Date().toISOString(),
    updatedAt: existing.updatedAt,
  }
  saveWorkflowLog(userDataDir, {
    ...current,
    workflows: current.workflows.map((item) => (item.id === id ? updated : item)),
  })
  return { ok: true, data: updated }
}

export function approveWorkflowPlan(
  userDataDir: string,
  workflowId: unknown,
  plan: unknown,
): KnowledgeSetOperationResult<Workflow> {
  return updateWorkflow(userDataDir, workflowId, {
    approvedPlan: plan,
  })
}

export function setWorkflowAutopilot(
  userDataDir: string,
  workflowId: unknown,
  enabled: unknown,
): KnowledgeSetOperationResult<Workflow> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const existing = getWorkflow(userDataDir, id)
  if (!existing) return validationError('workflow_not_found', 'This workflow could not be found.')

  if (enabled === true && !existing.approvedPlan) {
    return validationError(
      'workflow_not_approved',
      'Confirm this plan once before Autopilot can run it.',
    )
  }

  return updateWorkflow(userDataDir, id, {
    name: existing.name,
    trigger: existing.trigger,
    knowledgeSet: existing.plan.knowledgeSet,
    autopilotEnabled: enabled === true,
  })
}

export function loadWorkflowForAutopilot(
  userDataDir: string,
  workflowId: unknown,
): KnowledgeSetOperationResult<{ workflow: Workflow; plan: OrganisationPlan }> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const workflow = getWorkflow(userDataDir, id)
  if (!workflow) return validationError('workflow_not_found', 'This workflow could not be found.')

  if (!workflow.autopilotEnabled) {
    return validationError('autopilot_disabled', 'Turn on Autopilot for this workflow first.')
  }

  if (!workflow.approvedPlan || !workflow.approvedAt) {
    return validationError(
      'workflow_not_approved',
      'Confirm this plan once before Autopilot can run it.',
    )
  }

  return {
    ok: true,
    data: {
      workflow,
      plan: replayableApprovedPlan(workflow.approvedPlan),
    },
  }
}

/** Load a saved plan for the Plan Editor. Never executes. Autopilot is a separate execution mode. */
export function loadWorkflowForManualRun(
  userDataDir: string,
  workflowId: unknown,
): KnowledgeSetOperationResult<{ workflow: Workflow; knowledgeSet: KnowledgeSet }> {
  const id = asString(workflowId)
  if (!id) return validationError('invalid_workflow', 'This workflow could not be found.')

  const workflow = getWorkflow(userDataDir, id)
  if (!workflow) return validationError('workflow_not_found', 'This workflow could not be found.')

  if (!isRunnableWorkflowTrigger(workflow.trigger)) {
    return validationError(
      'invalid_workflow',
      'This trigger is not available yet. You can still open the plan and confirm it yourself.',
    )
  }

  return {
    ok: true,
    data: {
      workflow,
      knowledgeSet: workflow.plan.knowledgeSet,
    },
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function runWorkflowChecks(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'suhuella-workflows-'))
  try {
    assert(loadWorkflows(root).length === 0, 'empty userData has no workflows')

    const invoice = path.join(root, 'Invoice_ACME.pdf')
    writeFileSync(invoice, 'invoice')

    const unnamed = saveWorkflow(root, {
      name: '  ',
      trigger: 'manual',
      knowledgeSet: { items: [{ path: invoice, kind: 'file' }] },
    })
    assert(!unnamed.ok, 'workflow name is required')

    const watched = saveWorkflow(root, {
      name: 'Downloads',
      trigger: 'folder_watch',
      knowledgeSet: { items: [{ path: invoice, kind: 'file' }] },
    })
    assert(!watched.ok, 'folder watch cannot be saved until it is implemented')

    const saved = saveWorkflow(root, {
      name: 'Invoices',
      description: 'Organise downloaded invoices into client folders.',
      category: 'Finance',
      trigger: 'manual',
      knowledgeSet: { items: [{ path: invoice, kind: 'file' }] },
    })
    assert(saved.ok, 'manual workflow should save')
    assert(saved.data.trigger === 'manual', 'saved trigger stays manual')
    assert(saved.data.workflowVersion === WORKFLOW_FORMAT_VERSION, 'new workflows store format version 1')
    assert(saved.data.description.startsWith('Organise downloaded invoices'), 'description is stored')
    assert(saved.data.category === 'Finance', 'category is stored for later grouping')
    assert(workflowIntentSummary(saved.data).startsWith('Organise downloaded invoices'), 'Home shows what the workflow does')
    assert(workflowIconKind(saved.data) === 'invoices', 'Finance invoices infer the invoices icon')
    assert(
      workflowIntentSummary({ name: 'Downloads cleanup' }) === 'Cleans up Downloads',
      'unnamed-description workflows still explain themselves',
    )
    assert(
      workflowActionSummary({ name: 'Downloads cleanup' }) === 'Moves · Renames · Creates folders',
      'workflow actions summarise the reusable intent',
    )
    assert(saved.data.plan.knowledgeSet.items[0]?.path === path.normalize(invoice), 'template keeps the source, not an execution')
    assert(saved.data.autopilotEnabled === false, 'new workflows do not enable Autopilot')
    assert(saved.data.approvedPlan === null, 'saving a source set does not approve a plan')

    const listed = listWorkflows(root)
    assert(listed.length === 1 && listed[0]?.name === 'Invoices', 'saved workflow is listed')

    const renamed = updateWorkflow(root, saved.data.id, {
      name: 'Receipts',
      trigger: 'manual',
      knowledgeSet: saved.data.plan.knowledgeSet,
    })
    assert(renamed.ok && renamed.data.name === 'Receipts', 'workflow name can be edited')

    const loaded = loadWorkflowForManualRun(root, saved.data.id)
    assert(loaded.ok, 'manual run loads the saved plan')
    assert(loaded.data.knowledgeSet.items.length === 1, 'manual run returns the template')
    assert(existsSync(invoice), 'loading a workflow must not move files')

    const duplicated = duplicateWorkflow(root, saved.data.id)
    assert(duplicated.ok && duplicated.data.name === 'Receipts (copy)', 'duplicate clones the template')
    assert(duplicated.data.id !== saved.data.id, 'duplicate is a new workflow')
    assert(duplicated.data.autopilotEnabled === false, 'duplicate does not copy Autopilot')
    assert(existsSync(invoice), 'duplicating a workflow must not move files')

    const marked = markWorkflowRan(root, saved.data.id)
    assert(marked.ok && marked.data.lastRunAt, 'confirmed runs can record lastRunAt')
    assert(existsSync(invoice), 'recording a run must not move files')

    const removed = deleteWorkflow(root, saved.data.id)
    assert(removed.ok && getWorkflow(root, saved.data.id) === null, 'workflow can be deleted')
    assert(loadWorkflowForManualRun(root, saved.data.id).ok === false, 'deleted workflow cannot run')
    assert(removed.data.length === 1, 'other saved workflows remain after delete')

    const connector = saveWorkflow(root, {
      name: 'Contracts',
      trigger: 'connector',
      knowledgeSet: { items: [{ path: invoice, kind: 'file' }] },
    })
    assert(!connector.ok, 'future connectors cannot be saved as runnable workflows')

    const legacyRoot = path.join(root, 'legacy')
    mkdirSync(legacyRoot)
    writeFileSync(
      getWorkflowsFilePath(legacyRoot),
      JSON.stringify({
        version: WORKFLOWS_LOG_VERSION,
        updatedAt: new Date().toISOString(),
        workflows: [
          {
            id: 'wf_legacy',
            name: 'Legacy invoices',
            trigger: 'manual',
            plan: { knowledgeSet: { items: [{ path: invoice, kind: 'file' }] } },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastRunAt: null,
            approvedPlan: null,
            approvedAt: null,
            autopilotEnabled: false,
          },
        ],
      }),
      'utf8',
    )
    const legacy = listWorkflows(legacyRoot)
    assert(legacy[0]?.workflowVersion === WORKFLOW_FORMAT_VERSION, 'old workflows load as version 1')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
