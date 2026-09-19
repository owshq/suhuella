import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { persistAutopilotActivity } from './activity.ts'
import { loadActivityRuns, nextActivityRunNumber } from './activity-store.ts'
import { executeOrganisationPlan, previewOrganisationPlanForFolders, type KnowledgeSetOperationResult } from './knowledge-set.ts'
import { replayableApprovedPlan } from './organisation-plan.ts'
import { executeUndo } from './undo.ts'
import {
  approveWorkflowPlan,
  loadWorkflowForAutopilot,
  markWorkflowRan,
  saveWorkflow,
  setWorkflowAutopilot,
} from './workflow-store.ts'
import type {
  IndexedFolderEntry,
  OrganisationExecutionResult,
  OrganisationPlanItem,
} from '../src/types.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function samePath(left: string, right: string): boolean {
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase()
}

function validationError(
  code: 'invalid_request' | 'workflow_not_found' | 'workflow_not_approved' | 'autopilot_disabled' | 'invalid_plan',
  message: string,
): KnowledgeSetOperationResult<never> {
  return { ok: false, error: { code, message } }
}

/**
 * Autopilot is only another execution mode.
 * It loads a previously approved Workflow plan and calls executeOrganisationPlan.
 * It never ranks, never previews, and never invents destinations.
 */
export function executeAutopilotWorkflow(
  input: unknown,
  userDataDir: string,
  folders: IndexedFolderEntry[],
): KnowledgeSetOperationResult<OrganisationExecutionResult> {
  const workflowId = isRecord(input) ? asString(input.workflowId) : asString(input)
  if (!workflowId) {
    return validationError('invalid_request', 'Choose a workflow to run with Autopilot.')
  }

  const loaded = loadWorkflowForAutopilot(userDataDir, workflowId)
  if (!loaded.ok) return loaded

  const approved = replayableApprovedPlan(loaded.data.plan)
  if (approved.items.length === 0) {
    return validationError('workflow_not_approved', 'This approved plan has no actions Autopilot can run.')
  }

  const startedAt = new Date().toISOString()
  const runNumber = nextActivityRunNumber(loadActivityRuns(userDataDir))
  const executed = executeOrganisationPlan(
    {
      plan: approved,
      confirmed: true,
      runNumber,
    },
    folders,
  )
  if (!executed.ok) return executed

  persistAutopilotActivity(userDataDir, executed.data, startedAt)
  markWorkflowRan(userDataDir, workflowId)
  return executed
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function samplePlanItem(
  currentPath: string,
  proposedPath: string,
  fileName: string,
): OrganisationPlanItem {
  return {
    action: 'move',
    currentPath,
    proposedPath,
    explanation: 'Approved destination',
    status: 'preview',
    warnings: [],
    reviewGroup: 'ready',
    selected: true,
    fileName,
    score: 92,
    confidenceLabel: 'Strong match',
    alternatives: [],
    skipReason: null,
  }
}

function realFolder(absolutePath: string, fileNames: string[]): IndexedFolderEntry {
  const folderName = path.basename(absolutePath)
  return {
    id: absolutePath,
    sourceId: 'src_autopilot_check',
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

export function runAutopilotChecks(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'suhuella-autopilot-'))
  try {
    const sourceDir = path.join(root, 'Downloads')
    const destDir = path.join(root, 'Clients', 'ACME', 'Invoices')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(destDir, { recursive: true })
    const sourceFile = path.join(sourceDir, 'Invoice_ACME.pdf')
    const destFile = path.join(destDir, 'Invoice_ACME.pdf')
    writeFileSync(sourceFile, 'invoice')

    const saved = saveWorkflow(root, {
      name: 'Invoices',
      trigger: 'manual',
      knowledgeSet: { items: [{ path: sourceFile, kind: 'file' }] },
    })
    assert(saved.ok, 'workflow should save')

    const withoutApproval = setWorkflowAutopilot(root, saved.data.id, true)
    assert(!withoutApproval.ok && withoutApproval.error.code === 'workflow_not_approved', 'Autopilot needs an approved plan')

    const blocked = executeAutopilotWorkflow({ workflowId: saved.data.id }, root, [realFolder(destDir, [])])
    assert(!blocked.ok && blocked.error.code === 'autopilot_disabled', 'disabled Autopilot cannot run')
    assert(existsSync(sourceFile), 'disabled Autopilot must not move files')

    const approved = approveWorkflowPlan(root, saved.data.id, {
      knowledgeSet: { items: [{ path: sourceFile, kind: 'file' }] },
      items: [samplePlanItem(sourceFile, destFile, 'Invoice_ACME.pdf')],
    })
    assert(approved.ok && approved.data.approvedPlan?.items[0]?.proposedPath, 'approved plan is stored')

    const enabled = setWorkflowAutopilot(root, saved.data.id, true)
    assert(enabled.ok && enabled.data.autopilotEnabled, 'Autopilot can be enabled after approval')

    const folders = [realFolder(destDir, [])]
    const freshPlan = previewOrganisationPlanForFolders(
      { items: [{ path: sourceFile, kind: 'file' }] },
      folders,
    )
    assert(freshPlan.ok, 'fresh preview still works for manual runs')

    const ran = executeAutopilotWorkflow({ workflowId: saved.data.id }, root, folders)
    assert(ran.ok && ran.data.appliedCount === 1, 'Autopilot executes the approved plan')
    assert(!existsSync(sourceFile) && existsSync(destFile), 'Autopilot uses the confirmed executor')
    assert(
      samePath(approved.data.approvedPlan!.items[0]!.proposedPath!, destFile),
      'Autopilot keeps the approved destination',
    )

    const runs = loadActivityRuns(root)
    assert(runs[0]?.trigger === 'autopilot', 'Autopilot records an Autopilot run')
    assert(runs[0]?.plan, 'Autopilot history stores the executed plan')
    assert(runs[0]?.inversePlan?.items.length === 1, 'Autopilot history stores the inverse plan')

    writeFileSync(sourceFile, 'should-not-use-fresh-source')
    const second = executeAutopilotWorkflow({ workflowId: saved.data.id }, root, folders)
    assert(second.ok, 're-running Autopilot is safe')
    assert(second.data.appliedCount === 0, 'already-moved approved items are skipped, not re-ranked')
    assert(existsSync(sourceFile), 'Autopilot does not invent a new destination for a leftover file')

    renameSync(sourceFile, path.join(sourceDir, 'leftover.pdf'))
    const undone = executeUndo({ runId: runs[0]!.runId, confirmed: true }, root)
    assert(undone.ok && undone.data.run.trigger === 'undo', 'Autopilot runs undo like manual runs')
    assert(existsSync(sourceFile) && !existsSync(destFile), 'undo restores the Autopilot move')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
