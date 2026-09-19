import { movedActivityItems } from './activity-copy'
import { undoExpiresInDays } from './activity-recovery'
import type { ActivityRun } from '../types'

export type ActivityRunGroup =
  | { kind: 'organisation'; run: ActivityRun; undos: ActivityRun[] }
  | { kind: 'undo'; run: ActivityRun }

export type LastOrganisationAction = {
  runId: string
  runNumber: number
  movedCount: number
  undoAvailable: boolean
  undoableCount: number
  completedAt: string
  expiresInDays: number
  workflowName?: string
}

function runSort(left: ActivityRun, right: ActivityRun): number {
  return (
    Date.parse(right.completedAt) - Date.parse(left.completedAt) ||
    right.runNumber - left.runNumber
  )
}

export function groupActivityRuns(runs: ActivityRun[]): ActivityRunGroup[] {
  const undoBySource = new Map<string, ActivityRun[]>()

  for (const run of runs) {
    if (run.trigger === 'undo' && run.reversesRunId) {
      const list = undoBySource.get(run.reversesRunId) ?? []
      list.push(run)
      undoBySource.set(run.reversesRunId, list)
    }
  }

  const consumedUndoIds = new Set<string>()
  const groups: ActivityRunGroup[] = []

  for (const run of [...runs].sort(runSort)) {
    if (run.trigger === 'undo') {
      if (consumedUndoIds.has(run.runId)) continue
      if (!run.reversesRunId || !runs.some((item) => item.runId === run.reversesRunId)) {
        groups.push({ kind: 'undo', run })
      }
      continue
    }

    const undos = (undoBySource.get(run.runId) ?? [])
      .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt) || left.runNumber - right.runNumber)
    for (const undo of undos) consumedUndoIds.add(undo.runId)
    groups.push({ kind: 'organisation', run, undos })
  }

  return groups
}

export function lastOrganisationAction(runs: ActivityRun[]): LastOrganisationAction | null {
  const latest = [...runs]
    .filter((run) => run.trigger !== 'undo' && run.summary.moved > 0)
    .sort(runSort)[0]
  if (!latest) return null

  const undoableCount = movedActivityItems(latest).filter((item) => item.undoAvailable).length
  const expiresInDays = undoExpiresInDays(latest.completedAt)
  return {
    runId: latest.runId,
    runNumber: latest.runNumber,
    movedCount: latest.summary.moved,
    undoAvailable: undoableCount > 0,
    undoableCount,
    completedAt: latest.completedAt,
    expiresInDays,
    workflowName: latest.workflowName,
  }
}

export function undoableItems(run: ActivityRun) {
  return movedActivityItems(run).filter((item) => item.undoAvailable)
}

export function canUndoSelected(run: ActivityRun, sourcePaths: string[]): boolean {
  if (sourcePaths.length === 0) return false
  const undoable = undoableItems(run)
  return sourcePaths.every((path) =>
    undoable.some((item) => item.sourcePath.toLowerCase() === path.toLowerCase()),
  )
}
