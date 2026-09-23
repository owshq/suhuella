import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { activityItemFromPlanItem, humanActivityReason } from '@suhuella/product/lib/activity-copy.ts'
import {
  buildSaveAsActivityRun,
  buildSourceActivityRun,
} from '@suhuella/product/lib/activity-general-events.ts'
import { summarizeActivity, summarizeActivityProgress } from '@suhuella/product/lib/activity-summary.ts'
import { estimateTimeSaved } from '@suhuella/product/lib/time-saved.ts'
import type {
  ActivityRun,
  ActivityTrigger,
  OrganisationExecutionResult,
  OrganisationPlanItem,
} from '@suhuella/product/types.ts'
import { buildInverseOrganisationPlan, planFromExecutedItems } from './organisation-plan.ts'
import {
  ACTIVITY_MAX_AGE_DAYS,
  ACTIVITY_MAX_RUNS,
  loadActivityRuns,
  nextActivityRunNumber,
  pruneActivityRuns,
  recordActivityRun,
} from './activity-store.ts'
import { attachMovedFileIdentity, UNDO_REASON, withUndoState } from './undo.ts'

export function activityRunFromExecution(
  result: OrganisationExecutionResult,
  options: {
    startedAt: string
    trigger?: ActivityTrigger
    workflowId?: string
    workflowName?: string
    workflowSummary?: string
  },
): ActivityRun {
  const plan = planFromExecutedItems(result.items, result.knowledgeSet)
  return {
    runId: result.runId,
    runNumber: result.runNumber,
    startedAt: options.startedAt,
    completedAt: result.completedAt,
    trigger: options.trigger ?? 'organise_documents',
    ...(options.workflowId ? { workflowId: options.workflowId } : {}),
    ...(options.workflowName ? { workflowName: options.workflowName } : {}),
    ...(options.workflowSummary ? { workflowSummary: options.workflowSummary } : {}),
    plan,
    inversePlan: buildInverseOrganisationPlan(plan),
    summary: {
      moved: result.appliedCount,
      skipped: result.skippedCount,
      failed: result.failedCount,
    },
    items: result.items.map((item) => {
      const recorded = activityItemFromPlanItem(item)
      if (options.trigger === 'undo' && recorded.status === 'moved') {
        recorded.reason =
          recorded.action === 'rename' ? 'Restored original name' : 'Restored to original location'
      }
      return withUndoState(attachMovedFileIdentity(recorded))
    }),
  }
}

export function organisationActivityTrigger(
  value: unknown,
): Exclude<ActivityTrigger, 'autopilot' | 'undo' | 'source_event'> {
  if (value === 'move_this_file' || value === 'workflow') return value
  return 'organise_documents'
}

export function persistOrganisationActivity(
  userDataDir: string,
  result: OrganisationExecutionResult,
  startedAt: string,
  extras: {
    trigger?: ActivityTrigger
    reversesRunId?: string
    workflowId?: string
    workflowName?: string
    workflowSummary?: string
  } = {},
): ActivityRun[] {
  const trigger =
    extras.trigger === 'autopilot' || extras.trigger === 'undo'
      ? 'organise_documents'
      : extras.trigger
  const run = activityRunFromExecution(result, {
    startedAt,
    trigger,
    workflowId: extras.workflowId,
    workflowName: extras.workflowName,
    workflowSummary: extras.workflowSummary,
  })
  if (extras.reversesRunId) {
    run.reversesRunId = extras.reversesRunId
  }
  return recordActivityRun(userDataDir, run)
}

export function persistAutopilotActivity(
  userDataDir: string,
  result: OrganisationExecutionResult,
  startedAt: string,
): ActivityRun[] {
  return recordActivityRun(
    userDataDir,
    activityRunFromExecution(result, { startedAt, trigger: 'autopilot' }),
  )
}

export function persistSourceConnectedActivity(userDataDir: string, sourceName: string): ActivityRun[] {
  const runs = loadActivityRuns(userDataDir)
  return recordActivityRun(
    userDataDir,
    buildSourceActivityRun({
      kind: 'connected',
      sourceName,
      toStatus: 'ready',
      runNumber: nextActivityRunNumber(runs),
    }),
  )
}

export function persistSourceRemovedActivity(userDataDir: string, sourceName: string): ActivityRun[] {
  const runs = loadActivityRuns(userDataDir)
  return recordActivityRun(
    userDataDir,
    buildSourceActivityRun({
      kind: 'removed',
      sourceName,
      runNumber: nextActivityRunNumber(runs),
    }),
  )
}

export function persistSaveAsActivity(
  userDataDir: string,
  input: { fileName: string; folder: string },
): ActivityRun[] {
  const runs = loadActivityRuns(userDataDir)
  return recordActivityRun(
    userDataDir,
    buildSaveAsActivityRun({
      fileName: input.fileName,
      folder: input.folder,
      runNumber: nextActivityRunNumber(runs),
    }),
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function samplePlanItem(partial: Partial<OrganisationPlanItem> & Pick<OrganisationPlanItem, 'status'>): OrganisationPlanItem {
  return {
    action: 'move',
    currentPath: '/Users/sam/Downloads/Invoice_ACME.pdf',
    proposedPath: '/Users/sam/Documents/Clients/ACME/Invoices/Invoice_ACME.pdf',
    explanation: '',
    warnings: [],
    reviewGroup: 'ready',
    selected: true,
    fileName: 'Invoice_ACME.pdf',
    score: 92,
    confidenceLabel: 'Strong match',
    alternatives: [],
    skipReason: null,
    ...partial,
  }
}

export function runActivityChecks(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'suhuella-activity-'))
  try {
    assert(loadActivityRuns(root).length === 0, 'empty userData has no activity')

    const movedReason = humanActivityReason(samplePlanItem({ status: 'applied' }))
    assert(movedReason === 'Moved to Clients / ACME / Invoices', `moved copy: ${movedReason}`)

    const renamedReason = humanActivityReason(
      samplePlanItem({
        status: 'applied',
        action: 'rename',
        currentPath: '/Users/sam/Documents/Clients/ACME/Invoices/Invoice ACME.pdf',
        proposedPath: '/Users/sam/Documents/Clients/ACME/Invoices/Invoice_ACME.pdf',
        fileName: 'Invoice ACME.pdf',
      }),
    )
    assert(renamedReason === 'Renamed to Invoice_ACME.pdf', `renamed copy: ${renamedReason}`)

    const skippedReason = humanActivityReason(
      samplePlanItem({
        status: 'skipped',
        skipReason: 'Target already exists',
        reviewGroup: 'skipped',
        selected: false,
      }),
    )
    assert(
      skippedReason === 'Skipped because a file with that name already exists',
      `skipped copy: ${skippedReason}`,
    )

    const failedReason = humanActivityReason(
      samplePlanItem({
        status: 'failed',
        warnings: ['Could not move this file.'],
      }),
    )
    assert(
      failedReason === 'Could not move because the destination was unavailable',
      `failed copy: ${failedReason}`,
    )

    const completedAt = new Date().toISOString()
    const startedAt = new Date(Date.parse(completedAt) - 1_000).toISOString()
    const recorded = persistOrganisationActivity(
      root,
      {
        simulated: false,
        runId: '2026-09-18-001',
        runNumber: 1,
        completedAt,
        message: 'Files moved successfully',
        knowledgeSet: {
          items: [
            { path: '/Users/sam/Downloads/Invoice_ACME.pdf', kind: 'file' },
            { path: '/Users/sam/Desktop/Report.pdf', kind: 'file' },
            { path: '/Users/sam/Downloads/Notes.txt', kind: 'file' },
          ],
        },
        appliedCount: 1,
        skippedCount: 1,
        failedCount: 1,
        items: [
          samplePlanItem({ status: 'applied' }),
          samplePlanItem({
            status: 'skipped',
            fileName: 'Report.pdf',
            currentPath: '/Users/sam/Desktop/Report.pdf',
            skipReason: 'Skipped to avoid overwrite.',
          }),
          samplePlanItem({
            status: 'failed',
            fileName: 'Notes.txt',
            currentPath: '/Users/sam/Downloads/Notes.txt',
            proposedPath: '/Users/sam/Documents/Clients/ACME/Invoices/Notes.txt',
            warnings: ['Could not move this file.'],
          }),
        ],
      },
      startedAt,
    )

    assert(recorded.length === 1, 'one run is stored')
    assert(recorded[0]?.trigger === 'organise_documents', 'organise trigger is stored')
    assert(recorded[0]?.plan?.items.length === 3, 'activity stores the executed plan')
    assert(
      recorded[0]?.inversePlan?.items[0]?.currentPath ===
        '/Users/sam/Documents/Clients/ACME/Invoices/Invoice_ACME.pdf',
      'activity stores the inverse plan',
    )
    assert(
      recorded[0]?.inversePlan?.items[0]?.proposedPath === '/Users/sam/Downloads/Invoice_ACME.pdf',
      'inverse plan restores the original path',
    )
    assert(recorded[0]?.items.every((item) => item.undoAvailable === false), 'no fake undo flag')
    assert(
      recorded[0]?.items.find((item) => item.status === 'moved')?.undoReason === UNDO_REASON.unsafe,
      'moves without a captured file identity cannot be undone',
    )
    assert(nextActivityRunNumber(recorded) === 2, 'run numbers continue after persist')
    assert(loadActivityRuns(root).length === 1, 'activity survives reload')
    assert(loadActivityRuns(root)[0]?.plan?.items.length === 3, 'stored plan survives reload')
    assert(loadActivityRuns(root)[0]?.inversePlan?.items.length === 1, 'stored inverse plan survives reload')
    const digest = summarizeActivity(recorded)
    assert(digest?.moved === 1 && digest.skipped === 1 && digest.failed === 1, 'local summary aggregates without AI')
    assert(digest?.mostActiveFolder === 'Clients / ACME / Invoices', 'summary names the active folder')
    assert(estimateTimeSaved(7) === null, 'time saved stays hidden below 8 documents')
    assert(estimateTimeSaved(8) === '≈ 3 minutes', '8 documents estimate locally')
    const progress = summarizeActivityProgress(recorded)
    assert(progress?.todayMoved === 1, 'today counts real moves')
    assert(progress.todayUndoExpiresInDays === null, 'moves without undo stay without an expiry')
    assert(progress.estimatedTimeSaved === null, 'one move is not enough for an estimate')

    const stale = persistOrganisationActivity(
      root,
      {
        simulated: false,
        runId: '2010-01-01-001',
        runNumber: 99,
        completedAt: new Date(Date.now() - (ACTIVITY_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString(),
        message: 'No files were changed',
        knowledgeSet: { items: [] },
        appliedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        items: [],
      },
      startedAt,
    )
    assert(
      stale.every((run) => run.runId !== '2010-01-01-001'),
      'runs older than 90 days are dropped',
    )

    const many: ActivityRun[] = Array.from({ length: ACTIVITY_MAX_RUNS + 5 }, (_, index) => ({
      runId: `bulk-${index}`,
      runNumber: index + 1,
      startedAt: completedAt,
      completedAt,
      trigger: 'organise_documents',
      summary: { moved: 0, skipped: 0, failed: 0 },
      items: [],
    }))
    assert(pruneActivityRuns(many).length === ACTIVITY_MAX_RUNS, 'history caps at 500 runs')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
