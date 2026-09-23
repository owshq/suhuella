import type { ActivityRun, SourceLifecycleEventKind } from '../types.ts'
import {
  sourceRemovedActivityMessage,
  sourceRemovedActivityTitle,
  sourceTransitionMessage,
  sourceTransitionTitle,
} from './source-presentation.ts'
import { sourceTransitionKind, type SourceStatus } from './source-lifecycle.ts'

export function nextActivityRunNumber(runs: ActivityRun[]): number {
  return runs.reduce((max, run) => Math.max(max, run.runNumber), 0) + 1
}

function webStatusToSourceStatus(status: string): SourceStatus {
  if (status === 'ready') return 'indexed'
  if (status === 'indexing') return 'indexing'
  if (status === 'missing') return 'missing'
  if (status === 'blocked') return 'unavailable'
  if (status === 'error') return 'error'
  return 'unavailable'
}

export function buildSourceActivityRun(input: {
  kind: SourceLifecycleEventKind
  sourceName: string
  message?: string
  fromStatus?: string | null
  toStatus?: string
  transition?: string
  runNumber: number
}): ActivityRun {
  const now = new Date().toISOString()
  const transition =
    input.transition ??
    (input.fromStatus || input.toStatus
      ? sourceTransitionKind({
          from: input.fromStatus ? webStatusToSourceStatus(input.fromStatus) : null,
          to: input.toStatus ? webStatusToSourceStatus(input.toStatus) : 'unavailable',
          sourceName: input.sourceName,
        })
      : input.kind === 'connected'
        ? 'source_connected'
        : input.kind === 'removed'
          ? 'source_removed'
          : undefined)
  const message =
    input.message ??
    (input.kind === 'removed'
      ? sourceRemovedActivityMessage(input.sourceName)
      : sourceTransitionMessage({
          from: input.fromStatus ? webStatusToSourceStatus(input.fromStatus) : null,
          to: input.toStatus ? webStatusToSourceStatus(input.toStatus) : 'indexed',
          sourceName: input.sourceName,
        }))
  const title =
    input.kind === 'removed'
      ? sourceRemovedActivityTitle()
      : sourceTransitionTitle({
          from: input.fromStatus ? webStatusToSourceStatus(input.fromStatus) : null,
          to: input.toStatus ? webStatusToSourceStatus(input.toStatus) : 'indexed',
          sourceName: input.sourceName,
        })

  return {
    runId: `source_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    runNumber: input.runNumber,
    startedAt: now,
    completedAt: now,
    trigger: 'source_event',
    summary: { moved: 0, skipped: 0, failed: 0 },
    items: [],
    workflowName: title,
    workflowSummary: message,
    sourceEvent: {
      kind: input.kind,
      sourceName: input.sourceName,
      message,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      transition,
    },
  }
}

export function buildSaveAsActivityRun(input: {
  fileName: string
  folder: string
  runNumber: number
}): ActivityRun {
  const now = new Date().toISOString()
  const message = `Saved ${input.fileName} to ${input.folder}`
  return {
    runId: `saveas_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    runNumber: input.runNumber,
    startedAt: now,
    completedAt: now,
    trigger: 'save_as',
    summary: { moved: 1, skipped: 0, failed: 0 },
    items: [],
    workflowName: 'Document saved',
    workflowSummary: message,
  }
}
