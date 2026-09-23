import {
  activityDayLabel,
  activityFilterForRun,
  isPlanActivityRun,
  movedActivityItems,
  startOfLocalDay,
  type ActivityFilter,
} from './activity-copy.ts'
import { undoExpiresInDays } from './activity-recovery.ts'
import type { ActivityRun } from '../types.ts'

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

export type ActivityDayGroup = {
  key: string
  day: string
  groups: ActivityRunGroup[]
}

export function groupActivityRunsByDay(
  groups: ActivityRunGroup[],
  now = Date.now(),
): ActivityDayGroup[] {
  const bucket = new Map<string, { label: string; start: number; groups: ActivityRunGroup[] }>()

  for (const group of groups) {
    const completed = Date.parse(group.run.completedAt)
    const start = Number.isFinite(completed) ? startOfLocalDay(completed) : 0
    const key = Number.isFinite(completed) ? String(start) : 'unknown'
    const entry = bucket.get(key) ?? {
      label: activityDayLabel(group.run.completedAt, now),
      start,
      groups: [],
    }
    entry.groups.push(group)
    bucket.set(key, entry)
  }

  return [...bucket.values()]
    .sort((left, right) => right.start - left.start)
    .map(({ label, start, groups: dayGroups }) => ({
      key: String(start),
      day: label,
      groups: dayGroups,
    }))
}

export function groupMatchesActivityFilter(group: ActivityRunGroup, filter: ActivityFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'undo') {
    return group.kind === 'undo' || (group.kind === 'organisation' && group.undos.length > 0)
  }
  if (filter === 'sources') return activityFilterForRun(group.run) === 'sources'
  if (filter === 'save_as') return activityFilterForRun(group.run) === 'save_as'
  return (
    group.kind === 'organisation' &&
    isPlanActivityRun(group.run) &&
    group.run.trigger !== 'undo'
  )
}

export function activityFiltersPresent(groups: ActivityRunGroup[]): ActivityFilter[] {
  const order: ActivityFilter[] = ['plans', 'undo']
  return order.filter((filter) => groups.some((group) => groupMatchesActivityFilter(group, filter)))
}

export function generalActivityFiltersPresent(groups: ActivityRunGroup[]): ActivityFilter[] {
  const order: ActivityFilter[] = ['sources', 'save_as']
  return order.filter((filter) => groups.some((group) => groupMatchesActivityFilter(group, filter)))
}

export function groupActivityRuns(runs: ActivityRun[]): ActivityRunGroup[] {
  const unique = new Map<string, ActivityRun>()
  for (const run of runs) {
    const existing = unique.get(run.runId)
    if (!existing || Date.parse(run.completedAt) >= Date.parse(existing.completedAt)) {
      unique.set(run.runId, run)
    }
  }
  const list = [...unique.values()]
  const undoBySource = new Map<string, ActivityRun[]>()

  for (const run of list) {
    if (run.trigger === 'undo' && run.reversesRunId) {
      const linked = undoBySource.get(run.reversesRunId) ?? []
      linked.push(run)
      undoBySource.set(run.reversesRunId, linked)
    }
  }

  const consumedUndoIds = new Set<string>()
  const groups: ActivityRunGroup[] = []

  for (const run of [...list].sort(runSort)) {
    if (run.trigger === 'undo') {
      if (consumedUndoIds.has(run.runId)) continue
      if (!run.reversesRunId || !list.some((item) => item.runId === run.reversesRunId)) {
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
    .filter((run) => run.trigger !== 'undo' && run.trigger !== 'source_event' && run.summary.moved > 0)
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
