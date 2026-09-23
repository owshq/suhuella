import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  activityDayLabel,
  activityFilterForRun,
  activityIconLabel,
  activityItemIconKind,
  activityRunIconKind,
  activityRunTitle,
  activityRunOutcome,
  activityRunSummaryLine,
  activityWhenLabel,
  isGeneralActivityRun,
  isPlanActivityRun,
} from './activity-copy.ts'
import {
  activityFiltersPresent,
  groupActivityRuns,
  groupActivityRunsByDay,
  groupMatchesActivityFilter,
} from './activity-groups.ts'
import { activitySourceHistoryNote, activityUndoAvailabilityDetail, expiresInLabel } from './activity-recovery.ts'
import { summarizeActivityProgress } from './activity-summary.ts'
import type { ActivityRun } from '../types.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function sampleRun(partial: Partial<ActivityRun> & Pick<ActivityRun, 'runId' | 'runNumber' | 'completedAt'>): ActivityRun {
  return {
    startedAt: partial.completedAt,
    trigger: 'organise_documents',
    summary: { moved: 2, skipped: 0, failed: 0 },
    items: [
      {
        sourcePath: '/Users/sam/Downloads/A.pdf',
        targetPath: '/Users/sam/Documents/A.pdf',
        fileName: 'A.pdf',
        action: 'move',
        status: 'moved',
        reason: 'Moved to Documents',
        confidence: 90,
        undoAvailable: true,
      },
      {
        sourcePath: '/Users/sam/Downloads/B.pdf',
        targetPath: '/Users/sam/Documents/B.pdf',
        fileName: 'B.pdf',
        action: 'move',
        status: 'moved',
        reason: 'Moved to Documents',
        confidence: 80,
        undoAvailable: true,
      },
    ],
    ...partial,
  }
}

function runActivityWhenCopyChecks(): void {
  const now = new Date(2026, 8, 20, 15, 0, 0).getTime()
  const todayIso = new Date(2026, 8, 20, 10, 30, 0).toISOString()
  const yesterdayIso = new Date(2026, 8, 19, 18, 5, 0).toISOString()
  const earlierDate = new Date(2026, 8, 12, 9, 14, 0)
  const earlierIso = earlierDate.toISOString()
  const afternoonIso = new Date(2026, 8, 20, 14, 0, 0).toISOString()
  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  assert(activityDayLabel(todayIso, now) === 'Today', 'today stays Today')
  assert(activityDayLabel(yesterdayIso, now) === 'Yesterday', 'yesterday stays Yesterday')
  assert(
    activityDayLabel(earlierIso, now) ===
      earlierDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
    'older days keep a real date',
  )
  assert(activityWhenLabel(todayIso) === clock(todayIso), 'runs show a clock time')
  assert(activityWhenLabel('not-a-date') === '', 'invalid times stay blank')
  assert(activityRunSummaryLine({ moved: 3, skipped: 0, failed: 0 }) === '3 moved', 'clean runs stay concise')
  assert(
    activityRunSummaryLine({ moved: 2, skipped: 1, failed: 1 }) === '2 moved · 1 skipped · 1 failed',
    'mixed runs show every outcome',
  )
  assert(activityRunSummaryLine({ moved: 0, skipped: 0, failed: 0 }) === 'Nothing changed', 'empty runs stay honest')
  assert(
    activityRunOutcome(sampleRun({ runId: 'mix', runNumber: 5, completedAt: todayIso, summary: { moved: 2, skipped: 1, failed: 0 } })) ===
      '2 moved · 1 skipped',
    'timeline outcome matches the run summary',
  )
  assert(expiresInLabel(0) === 'Undo period expired', 'expired undo is explicit')
  assert(expiresInLabel(1) === 'Can undo for 1 more day', 'one-day undo is singular')
  assert(expiresInLabel(28) === 'Can undo for 28 more days', 'undo window stays countable')
  assert(!/^Expires in \d+ days?$/.test(expiresInLabel(28)), 'undo copy must not sound like documents expire')

  const undoableRun = sampleRun({ runId: 'when-1', runNumber: 3, completedAt: todayIso })
  assert(
    activityUndoAvailabilityDetail(undoableRun, now) === '2 documents · Can undo for 30 more days',
    'undo available names the documents and the window',
  )

  const olderRun = sampleRun({
    runId: 'when-older',
    runNumber: 1,
    completedAt: earlierIso,
    items: undoableRun.items.map((item) => ({ ...item, undoAvailable: false })),
  })
  const yesterdayRun = sampleRun({ runId: 'when-yesterday', runNumber: 2, completedAt: yesterdayIso })
  const morningRun = sampleRun({ runId: 'when-morning', runNumber: 3, completedAt: todayIso })
  const afternoonRun = sampleRun({ runId: 'when-later', runNumber: 4, completedAt: afternoonIso })
  const days = groupActivityRunsByDay(
    groupActivityRuns([olderRun, yesterdayRun, morningRun, afternoonRun]),
    now,
  )
  assert(
    days.map((group) => group.day).join('|') === `Today|Yesterday|${activityDayLabel(earlierIso, now)}`,
    'activity groups by real dates instead of Earlier',
  )
  assert(
    days[0]?.groups.map((group) => group.run.runId).join('|') === 'when-later|when-morning',
    'same-day runs stay newest first',
  )

  const todayProgress = summarizeActivityProgress([afternoonRun], now)
  assert(todayProgress?.todayUndoAvailable === true, 'today undo is visible in the digest')
  assert(todayProgress.todayUndoExpiresInDays === 30, 'today digest keeps the undo window')

  const removed = sampleRun({
    runId: 'src-removed',
    runNumber: 9,
    completedAt: todayIso,
    trigger: 'source_event',
    workflowName: 'Source removed',
    workflowSummary: 'Removed source: dev-data',
    summary: { moved: 0, skipped: 0, failed: 0 },
    items: [],
    sourceEvent: {
      kind: 'removed',
      sourceName: 'dev-data',
      message: 'Removed source: dev-data',
      transition: 'source_removed',
    },
  })
  assert(activityRunTitle(removed) === 'Source removed', 'removed sources keep their own title')
  assert(activityFilterForRun(removed) === 'sources', 'source events filter as sources')
  assert(activityRunOutcome(removed) === 'Removed source: dev-data', 'source detail is the stored message')
  assert(activityRunIconKind(removed) === 'source_removed', 'removed sources use the remove action icon')
  assert(activityIconLabel('source_removed') === 'Removed', 'remove label stays short')
  assert(activityItemIconKind({ action: 'move' }) === 'move', 'move items map to move')
  assert(activityItemIconKind({ action: 'rename' }) === 'rename', 'rename items map to rename')
  assert(
    activityRunIconKind(
      sampleRun({
        runId: 'rename-run',
        runNumber: 11,
        completedAt: todayIso,
        items: [
          {
            sourcePath: '/Users/sam/Downloads/A.pdf',
            targetPath: '/Users/sam/Downloads/A-renamed.pdf',
            fileName: 'A.pdf',
            action: 'rename',
            status: 'moved',
            reason: 'Renamed',
            confidence: 90,
            undoAvailable: true,
          },
        ],
        summary: { moved: 1, skipped: 0, failed: 0 },
      }),
    ) === 'rename',
    'rename-only plans show rename',
  )
  assert(
    activitySourceHistoryNote() === 'Kept in history · Cannot be undone',
    'source events explain why undo is absent',
  )

  const undo = sampleRun({
    runId: 'undo-1',
    runNumber: 8,
    completedAt: afternoonIso,
    trigger: 'undo',
    reversesRunId: afternoonRun.runId,
  })
  groupActivityRuns([afternoonRun, undo, removed])
  const planOnly = groupActivityRuns([afternoonRun, undo, removed].filter(isPlanActivityRun))
  assert(
    activityFiltersPresent(planOnly).join('|') === 'plans|undo',
    'activity filters are plans and undo only',
  )
  assert(
    planOnly.every(
      (group) =>
        groupMatchesActivityFilter(group, 'plans') === (group.run.trigger === 'organise_documents'),
    ),
    'plans filter hides undo runs',
  )
  assert(isPlanActivityRun(removed) === false, 'source events are not plan activity')
  assert(isGeneralActivityRun(removed) === true, 'source events stay in general activity')
  assert(isPlanActivityRun(afternoonRun) === true, 'confirmed plans stay in plan activity')
  assert(isGeneralActivityRun(afternoonRun) === false, 'confirmed plans are not general activity')
  const duplicated = groupActivityRuns([removed, { ...removed }])
  assert(duplicated.length === 1, 'the same activity run is shown once')
}

function activityPanelSource(): string {
  const candidates: string[] = []
  if (typeof import.meta.url === 'string' && import.meta.url.length > 0) {
    candidates.push(join(dirname(fileURLToPath(import.meta.url)), '../components/ActivityPanel.tsx'))
  }
  candidates.push(
    join(process.cwd(), 'packages/product/src/components/ActivityPanel.tsx'),
    join(process.cwd(), '../packages/product/src/components/ActivityPanel.tsx'),
    join(process.cwd(), 'src/components/ActivityPanel.tsx'),
  )
  for (const candidate of candidates) {
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
  }
  throw new Error('missing ActivityPanel.tsx')
}

function runActivityWhenSourceChecks(): void {
  const panel = activityPanelSource()
  if (/You can undo these documents/.test(panel)) {
    throw new Error('Activity must say how long undo remains')
  }
  if (/type DayGroup = 'Today' \| 'Yesterday' \| 'Earlier'/.test(panel)) {
    throw new Error('Activity must not lump older runs into Earlier')
  }
  if (!/activityWhenLabel/.test(panel) || !/activityUndoAvailabilityDetail/.test(panel)) {
    throw new Error('Activity must show when a run happened and how long undo remains')
  }
  if (/Expires in \d+ days?/.test(panel)) {
    throw new Error('Activity must not say only "Expires in X days" without undo context')
  }
  if (/\$\{run\.summary\.moved\} moved/.test(panel)) {
    throw new Error('Activity timeline must use activityRunOutcome for full run summary')
  }
  if (!/activityRunSummaryLine/.test(panel)) {
    throw new Error('Activity documents summary must use activityRunSummaryLine')
  }
  if (/run\.workflowName \? \(\s*<WorkflowGlyph/.test(panel) && !/trigger === 'workflow'/.test(panel)) {
    throw new Error('Activity must not use the workflow star for every named run')
  }
  if (!/ActivityActionBadge/.test(panel) || !/activityRunIconKind/.test(panel)) {
    throw new Error('Activity must choose icons by activity type, not by workflow name alone')
  }
  if (!/ArrowRightLeft/.test(panel) || !/Pencil/.test(panel) || !/Trash2/.test(panel) || !/Undo2/.test(panel)) {
    throw new Error('Activity must show move, rename, remove, and undo action icons')
  }
  if (!/label: 'Plans'/.test(panel) || !/label: 'Undo'/.test(panel)) {
    throw new Error('Plan Activity must filter by plans and undo')
  }
  if (!/label: 'Sources'/.test(panel) || !/label: 'Save As'/.test(panel)) {
    throw new Error('General Activity must filter by sources and Save As')
  }
  if (!/isPlanActivityRun/.test(panel) || !/isGeneralActivityRun/.test(panel)) {
    throw new Error('Activity must split plan history from general history')
  }
  if (!/scope === 'plans'/.test(panel) || !/isGeneralActivityRun/.test(panel)) {
    throw new Error('Activity must support plan and general scopes')
  }
  if (!/onBack/.test(panel) || !/Back to/.test(panel)) {
    throw new Error('Plan Activity must offer back navigation to Plan Mode')
  }
}

export function runActivityWhenChecks(): void {
  runActivityWhenCopyChecks()
  runActivityWhenSourceChecks()
}

const selfUrl = typeof import.meta.url === 'string' ? import.meta.url : ''
if (selfUrl && process.argv[1] && fileURLToPath(selfUrl) === process.argv[1]) {
  runActivityWhenChecks()
  console.log('activity when checks passed')
}
