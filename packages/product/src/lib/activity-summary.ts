import { humanFolderPath } from './activity-copy.ts'
import { estimateTimeSaved } from './time-saved.ts'
import type { ActivityPeriodSummary, ActivityRun } from '../types.ts'

const TOP_DESTINATION_LIMIT = 3

function startOfToday(now: number): number {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return today.getTime()
}

function countMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function topEntry(counts: Map<string, number>): string | null {
  let winner: string | null = null
  let highest = 0
  for (const [label, count] of counts) {
    if (count > highest) {
      winner = label
      highest = count
    }
  }
  return winner
}

function destinationLabel(targetPath: string | null): string | null {
  if (!targetPath) return null
  const folder = humanFolderPath(targetPath, true)
  const last = folder.split(' / ').at(-1)
  return last || folder || null
}

export function summarizeActivity(runs: ActivityRun[], now = Date.now()): ActivityPeriodSummary | null {
  if (runs.length === 0) return null

  const todayStart = startOfToday(now)
  const todayRuns = runs.filter((run) => Date.parse(run.completedAt) >= todayStart)
  const scoped = todayRuns.length > 0 ? todayRuns : runs

  const items = scoped.flatMap((run) => run.items)
  const moved = items.filter((item) => item.status === 'moved')
  const skipped = items.filter((item) => item.status === 'skipped')
  const failed = items.filter((item) => item.status === 'failed')

  const destinationNames = moved
    .map((item) => destinationLabel(item.targetPath))
    .filter((item): item is string => Boolean(item))
  const destinationFolders = moved
    .map((item) => (item.targetPath ? humanFolderPath(item.targetPath, true) : ''))
    .filter(Boolean)
  const skipReasons = skipped.map((item) => item.reason).filter(Boolean)

  const topDestinations = rankDestinations(destinationNames)

  return {
    label: todayRuns.length > 0 ? 'Today' : 'This history',
    organised: items.length,
    moved: moved.length,
    skipped: skipped.length,
    failed: failed.length,
    topDestinations,
    mostActiveFolder: topEntry(countMap(destinationFolders)),
    mostCommonSkipReason: topEntry(countMap(skipReasons)),
  }
}

function rankDestinations(names: string[]): Array<{ label: string; count: number }> {
  return [...countMap(names).entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, TOP_DESTINATION_LIMIT)
    .map(([label, count]) => ({ label, count }))
}

function movedInRange(runs: ActivityRun[], start: number, end = Number.POSITIVE_INFINITY): number {
  return runs.reduce((sum, run) => {
    if (run.trigger === 'undo') return sum
    const completed = Date.parse(run.completedAt)
    if (!Number.isFinite(completed) || completed < start || completed >= end) return sum
    return sum + run.summary.moved
  }, 0)
}

export type ActivityProgress = {
  todayMoved: number
  yesterdayMoved: number
  lastWeekMoved: number
  lastMonthMoved: number
  todayUndoAvailable: boolean
  estimatedTimeSaved: string | null
  topDestinations: Array<{ label: string; count: number }>
}

export function summarizeActivityProgress(runs: ActivityRun[], now = Date.now()): ActivityProgress | null {
  const organisationRuns = runs.filter((run) => run.trigger !== 'undo')
  if (organisationRuns.length === 0) return null

  const todayStart = startOfToday(now)
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 6 * 86_400_000
  const monthStart = todayStart - 29 * 86_400_000

  const todayMoved = movedInRange(organisationRuns, todayStart)
  const yesterdayMoved = movedInRange(organisationRuns, yesterdayStart, todayStart)
  const lastWeekMoved = movedInRange(organisationRuns, weekStart)
  const lastMonthMoved = movedInRange(organisationRuns, monthStart)

  const todayUndoAvailable = organisationRuns.some(
    (run) => Date.parse(run.completedAt) >= todayStart && run.items.some((item) => item.undoAvailable),
  )

  const destinationSource = organisationRuns.filter((run) => Date.parse(run.completedAt) >= monthStart)
  const destinationNames = (destinationSource.length > 0 ? destinationSource : organisationRuns)
    .flatMap((run) => run.items)
    .filter((item) => item.status === 'moved')
    .map((item) => destinationLabel(item.targetPath))
    .filter((item): item is string => Boolean(item))

  return {
    todayMoved,
    yesterdayMoved,
    lastWeekMoved,
    lastMonthMoved,
    todayUndoAvailable,
    estimatedTimeSaved: estimateTimeSaved(lastMonthMoved > 0 ? lastMonthMoved : lastWeekMoved),
    topDestinations: rankDestinations(destinationNames),
  }
}
