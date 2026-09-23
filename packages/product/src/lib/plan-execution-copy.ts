import type { OrganisationPlanItem, PlanExecutionMode } from '../types.ts'

/** User visibility axis only — same executor for background and watch. See ADR-005. */
export type { PlanExecutionMode }

export const PLAN_EXECUTION_BACKGROUND_LABEL = 'Run in background'
export const PLAN_EXECUTION_WATCH_LABEL = 'Watch what happens'
export const PLAN_EXECUTION_BACKGROUND_HINT =
  'Default. SuHuella notifies you when the Plan finishes.'
export const PLAN_EXECUTION_WATCH_HINT =
  'Shows each file action as it happens — same Plan, same executor.'

export const PLAN_LIVE_LOG_TITLE = 'Live log'
export const PLAN_LIVE_LOG_DONE = 'Plan finished. This log closes when you leave this screen.'

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean)
  return parts.at(-1) ?? filePath
}

function destinationLabel(item: OrganisationPlanItem): string {
  if (item.proposedPath) return fileNameFromPath(item.proposedPath)
  if (item.destinationLabel) return item.destinationLabel
  return '—'
}

function resultLabel(item: OrganisationPlanItem): string {
  if (item.status === 'applied') return 'Applied'
  if (item.status === 'failed') return item.skipReason ?? 'Failed'
  if (item.status === 'skipped') return item.skipReason ?? 'Skipped'
  return 'Pending'
}

export type PlanLiveLogLine = {
  id: string
  origin: string
  destination: string
  result: string
  tone: 'applied' | 'failed' | 'skipped' | 'pending'
}

export function planLiveLogLine(item: OrganisationPlanItem, index: number): PlanLiveLogLine {
  const tone =
    item.status === 'applied'
      ? 'applied'
      : item.status === 'failed'
        ? 'failed'
        : item.status === 'skipped'
          ? 'skipped'
          : 'pending'
  return {
    id: `${item.currentPath}-${index}`,
    origin: fileNameFromPath(item.currentPath),
    destination: destinationLabel(item),
    result: resultLabel(item),
    tone,
  }
}
