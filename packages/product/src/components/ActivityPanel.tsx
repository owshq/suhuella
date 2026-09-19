import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAppLocale } from '../lib/app-locale'
import {
  activityRunOutcome,
  activityRunTitle,
  activityStatusLabel,
  activityWorkflowSummary,
  activityTriggerLabel,
  canUndoActivityRun,
  folderFromFile,
  humanFolderPath,
  movedActivityItems,
} from '../lib/activity-copy'
import { groupActivityRuns, undoableItems, type ActivityRunGroup } from '../lib/activity-groups'
import {
  humanItemRecoveryNote,
  runRecoveryDetail,
  runRecoveryHeadline,
  runRecoveryState,
  type RunRecoveryState,
} from '../lib/activity-recovery'
import { summarizeActivityProgress, type ActivityProgress } from '../lib/activity-summary'
import { FeaturePromoCard } from './FeaturePromoCard'
import { WorkflowGlyph } from './WorkflowGlyph'
import type { ActivityItem, ActivityItemStatus, ActivityRun } from '../types'

type PendingUndo =
  | { kind: 'run'; runId: string }
  | { kind: 'item'; runId: string; sourcePath: string }
  | { kind: 'selected'; runId: string; sourcePaths: string[] }

type UndoRequest = { runId: string; sourcePaths?: string[] }

type DayGroup = 'Today' | 'Yesterday' | 'Earlier'

const DAY_ORDER: DayGroup[] = ['Today', 'Yesterday', 'Earlier']

function dayGroup(iso: string): DayGroup {
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date >= today) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date >= yesterday) return 'Yesterday'
  return 'Earlier'
}

function destinationFolder(item: ActivityItem): string | null {
  return item.targetPath ? humanFolderPath(item.targetPath, true) : null
}

function statusClass(status: ActivityItemStatus): string {
  if (status === 'moved') return 'text-emerald-700'
  if (status === 'failed') return 'text-rose-700'
  return 'text-slate-500'
}

function groupByDay(groups: ActivityRunGroup[]): Array<{ day: DayGroup; groups: ActivityRunGroup[] }> {
  const bucket = new Map<DayGroup, ActivityRunGroup[]>()

  for (const group of groups) {
    const run = group.kind === 'organisation' ? group.run : group.run
    const key = dayGroup(run.completedAt)
    const list = bucket.get(key) ?? []
    list.push(group)
    bucket.set(key, list)
  }

  return DAY_ORDER.flatMap((day) => {
    const dayGroups = bucket.get(day)
    return dayGroups ? [{ day, groups: dayGroups }] : []
  })
}

function undoItemsForPending(run: ActivityRun, pending: PendingUndo | null): ActivityItem[] {
  if (!pending || pending.runId !== run.runId) return []
  if (pending.kind === 'run') {
    return movedActivityItems(run).filter((item) => item.undoAvailable)
  }
  if (pending.kind === 'selected') {
    const selected = new Set(pending.sourcePaths.map((path) => path.toLowerCase()))
    return movedActivityItems(run).filter(
      (item) => item.undoAvailable && selected.has(item.sourcePath.toLowerCase()),
    )
  }
  return movedActivityItems(run).filter(
    (item) => item.undoAvailable && item.sourcePath === pending.sourcePath,
  )
}

function ActivityRow({
  item,
  busy,
  selectable,
  selected,
  pendingThisItem,
  recoveryState,
  onToggleSelected,
  onUndo,
}: {
  item: ActivityItem
  busy?: boolean
  selectable?: boolean
  selected?: boolean
  pendingThisItem?: boolean
  recoveryState: RunRecoveryState
  onToggleSelected?: () => void
  onUndo?: () => void
}) {
  const from =
    item.action === 'rename' ? item.fileName : folderFromFile(item.sourcePath)
  const to =
    item.action === 'rename'
      ? item.targetPath?.split(/[/\\]/).filter(Boolean).at(-1) || destinationFolder(item)
      : destinationFolder(item)

  return (
    <li className="rounded-2xl border border-white/80 bg-white/80 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {selectable ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              disabled={busy}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--brand-accent)] accent-[var(--brand-accent)]"
              aria-label={`Select ${item.fileName} for undo`}
            />
          ) : null}
          <p className="min-w-0 font-medium text-slate-900">{item.fileName}</p>
        </div>
        <p className={`shrink-0 text-xs font-semibold uppercase tracking-wide ${statusClass(item.status)}`}>
          {activityStatusLabel(item.status, item.action)}
        </p>
      </div>
      <dl className="mt-2 space-y-1 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="w-10 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">From</dt>
          <dd className="min-w-0">{from || '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-10 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">To</dt>
          <dd className="min-w-0">{to || '—'}</dd>
        </div>
      </dl>
      <p className={`mt-2 text-sm ${statusClass(item.status)}`}>{item.reason}</p>
      {item.status === 'moved' && item.undoAvailable && onUndo && !selectable ? (
        <button
          type="button"
          onClick={onUndo}
          disabled={busy || pendingThisItem}
          className="mt-3 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Undo this action
        </button>
      ) : null}
      {humanItemRecoveryNote(item, recoveryState) ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          {humanItemRecoveryNote(item, recoveryState)}
        </p>
      ) : null}
    </li>
  )
}

function StatusGroup({
  status,
  items,
  busy,
  selectable,
  selectedPaths,
  pendingSourcePath,
  recoveryState,
  onToggleSelected,
  onUndoItem,
}: {
  status: ActivityItemStatus
  items: ActivityItem[]
  busy?: boolean
  selectable?: boolean
  selectedPaths?: Set<string>
  pendingSourcePath?: string | null
  recoveryState: RunRecoveryState
  onToggleSelected?: (sourcePath: string) => void
  onUndoItem?: (item: ActivityItem) => void
}) {
  if (items.length === 0) return null

  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-[0.12em] ${statusClass(status)}`}>
        {activityStatusLabel(status)}
      </h4>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <ActivityRow
            key={`${item.sourcePath}:${item.targetPath ?? item.fileName}`}
            item={item}
            busy={busy}
            selectable={selectable && item.undoAvailable}
            selected={selectedPaths?.has(item.sourcePath.toLowerCase())}
            pendingThisItem={pendingSourcePath === item.sourcePath}
            recoveryState={recoveryState}
            onToggleSelected={
              onToggleSelected ? () => onToggleSelected(item.sourcePath) : undefined
            }
            onUndo={onUndoItem ? () => onUndoItem(item) : undefined}
          />
        ))}
      </ul>
    </div>
  )
}

function UndoConfirm({
  items,
  busy,
  error,
  onConfirm,
  onBack,
}: {
  items: ActivityItem[]
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onBack: () => void
}) {
  const fromFolders = [...new Set(items.map((item) => folderFromFile(item.targetPath || item.sourcePath)))]
  const toFolders = [...new Set(items.map((item) => folderFromFile(item.sourcePath)))]

  return (
    <div className="border-t border-white/70 pt-3">
      <p className="text-sm font-semibold text-slate-900">Undo these documents?</p>
      <p className="mt-2 text-sm font-medium text-slate-800">
        {items.length} document{items.length === 1 ? '' : 's'}
      </p>
      <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">{fromFolders.join(' · ') || '—'}</p>
        <p className="my-2 text-center text-lg leading-none text-slate-400">↓</p>
        <p className="font-medium text-slate-900">{toFolders.join(' · ') || '—'}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">Nothing will be overwritten.</p>
      {items.length > 1 ? (
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {items.map((item) => (
            <li key={`${item.sourcePath}:${item.targetPath ?? item.fileName}`}>
              {item.fileName}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || items.length === 0}
          className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Undoing…' : 'Undo'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="w-full rounded-full border border-white/80 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Back
        </button>
      </div>
    </div>
  )
}

function TimelineArrow() {
  return <p className="py-1 text-center text-lg leading-none text-slate-300">↓</p>
}

function TimelineNode({
  title,
  detail,
  subdetail,
  icon,
  tone = 'default',
}: {
  title: string
  detail: string
  subdetail?: string
  icon?: ReactNode
  tone?: 'default' | 'success' | 'undo' | 'history'
}) {
  const dotClass =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'undo'
        ? 'bg-sky-500'
        : tone === 'history'
          ? 'bg-slate-300'
          : 'bg-slate-400'
  const cardClass =
    tone === 'undo'
      ? 'border-sky-200/80 bg-sky-50/70'
      : tone === 'history'
        ? 'border-slate-200/80 bg-slate-50/80'
        : 'border-white/80 bg-white/90'

  return (
    <div className={`relative rounded-2xl border px-3 py-3 ${cardClass}`}>
      <span
        className={`absolute -left-[1.34rem] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-white/80 ${dotClass}`}
      />
      <div className="flex items-start gap-2.5">
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-700">{detail}</p>
          {subdetail ? <p className="mt-0.5 text-xs text-slate-500">{subdetail}</p> : null}
        </div>
      </div>
    </div>
  )
}

function ConfidenceTimeline({
  run,
  undos,
  recovery,
  showRunUndo,
  runPending,
  pendingItems,
  busy,
  undoError,
  selectedCount,
  undoable,
  selectedPaths,
  onRequestUndo,
  onCancelUndo,
  onConfirmUndo,
}: {
  run: ActivityRun
  undos: ActivityRun[]
  recovery: RunRecoveryState
  showRunUndo: boolean
  runPending: boolean
  pendingItems: ActivityItem[]
  busy?: boolean
  undoError?: string | null
  selectedCount: number
  undoable: ActivityItem[]
  selectedPaths: Set<string>
  onRequestUndo: (pending: PendingUndo) => void
  onCancelUndo: () => void
  onConfirmUndo: () => void
}) {
  return (
    <div className="relative ml-3 border-l-2 border-slate-200/90 pl-5">
      <TimelineNode
        title={activityRunTitle(run)}
        detail={
          run.workflowName
            ? (activityWorkflowSummary(run) ?? activityRunOutcome(run))
            : `${run.summary.moved} moved`
        }
        subdetail={
          run.trigger === 'workflow' || run.trigger === 'autopilot'
            ? activityRunOutcome(run)
            : activityTriggerLabel(run.trigger)
        }
        icon={
          run.workflowName ? (
            <WorkflowGlyph name={run.workflowName} className="h-4 w-4 text-slate-500" />
          ) : undefined
        }
        tone="success"
      />

      {undos.map((undo) => (
        <div key={undo.runId}>
          <TimelineArrow />
          <TimelineNode
            title={activityRunTitle(undo)}
            detail={activityRunOutcome(undo)}
            subdetail={activityTriggerLabel(undo.trigger)}
            tone="undo"
          />
        </div>
      ))}

      {recovery === 'undo_available' && !runPending ? (
        <>
          <TimelineArrow />
          <TimelineNode title="Undo available" detail="You can undo these documents." tone="default" />
        </>
      ) : null}

      {recovery === 'history_expired' ||
      recovery === 'history_complete' ||
      recovery === 'partially_restored' ? (
        <>
          <TimelineArrow />
          <TimelineNode
            title={runRecoveryHeadline(recovery)}
            detail={runRecoveryDetail(recovery)}
            tone="history"
          />
        </>
      ) : null}

      {runPending ? (
        <div className="mt-3">
          <UndoConfirm
            items={pendingItems}
            busy={busy}
            error={undoError}
            onConfirm={onConfirmUndo}
            onBack={onCancelUndo}
          />
        </div>
      ) : recovery === 'undo_available' ? (
        <div className="mt-3 space-y-2">
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                onRequestUndo({
                  kind: 'selected',
                  runId: run.runId,
                  sourcePaths: undoable
                    .filter((item) => selectedPaths.has(item.sourcePath.toLowerCase()))
                    .map((item) => item.sourcePath),
                })
              }
              disabled={busy}
              className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              Undo selected ({selectedCount})
            </button>
          ) : null}
          {showRunUndo ? (
            <button
              type="button"
              onClick={() => onRequestUndo({ kind: 'run', runId: run.runId })}
              disabled={busy}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function OrganisationRun({
  run,
  undos,
  busy,
  pending,
  undoError,
  selectedPaths,
  highlighted,
  onToggleSelected,
  onRequestUndo,
  onCancelUndo,
  onConfirmUndo,
}: {
  run: ActivityRun
  undos: ActivityRun[]
  busy?: boolean
  pending: PendingUndo | null
  undoError?: string | null
  selectedPaths: Set<string>
  highlighted?: boolean
  onToggleSelected: (sourcePath: string) => void
  onRequestUndo: (pending: PendingUndo) => void
  onCancelUndo: () => void
  onConfirmUndo: () => void
}) {
  const moved = run.items.filter((item) => item.status === 'moved')
  const skipped = run.items.filter((item) => item.status === 'skipped')
  const failed = run.items.filter((item) => item.status === 'failed')
  const runPending = pending?.runId === run.runId
  const pendingItems = undoItemsForPending(run, pending)
  const undoable = undoableItems(run)
  const showRunUndo = canUndoActivityRun(run)
  const selectedCount = undoable.filter((item) => selectedPaths.has(item.sourcePath.toLowerCase())).length
  const allowSelection = undoable.length > 1
  const recovery = runRecoveryState(run, undos)

  return (
    <article
      id={`activity-run-${run.runId}`}
      className={`space-y-4 ${highlighted ? 'rounded-2xl bg-blue-50/50 p-3 ring-2 ring-[color-mix(in_srgb,var(--brand-accent)_30%,transparent)]' : ''}`}
    >
      <ConfidenceTimeline
        run={run}
        undos={undos}
        recovery={recovery}
        showRunUndo={showRunUndo}
        runPending={runPending}
        pendingItems={pendingItems}
        busy={busy}
        undoError={undoError}
        selectedCount={selectedCount}
        undoable={undoable}
        selectedPaths={selectedPaths}
        onRequestUndo={onRequestUndo}
        onCancelUndo={onCancelUndo}
        onConfirmUndo={onConfirmUndo}
      />

      {run.items.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing changed here.</p>
      ) : (
        <details className="rounded-2xl border border-white/70 bg-white/50 px-3 py-2">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
            Documents · {run.summary.moved} moved · {run.summary.skipped} skipped ·{' '}
            {run.summary.failed} failed
          </summary>
          <div className="mt-3 space-y-4 border-t border-white/70 pt-3">
            <StatusGroup
              status="moved"
              items={moved}
              busy={busy || runPending}
              selectable={allowSelection && !runPending && recovery === 'undo_available'}
              selectedPaths={selectedPaths}
              recoveryState={recovery}
              pendingSourcePath={
                pending?.kind === 'item' && pending.runId === run.runId ? pending.sourcePath : null
              }
              onToggleSelected={onToggleSelected}
              onUndoItem={
                allowSelection
                  ? undefined
                  : (item) =>
                      onRequestUndo({ kind: 'item', runId: run.runId, sourcePath: item.sourcePath })
              }
            />
            <StatusGroup status="skipped" items={skipped} recoveryState={recovery} />
            <StatusGroup status="failed" items={failed} recoveryState={recovery} />
          </div>
        </details>
      )}
    </article>
  )
}

function UndoRunSummary({ run }: { run: ActivityRun }) {
  return (
    <article className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">{activityRunTitle(run)}</p>
      <p className="mt-1 text-sm text-slate-600">
        {run.summary.moved} document{run.summary.moved === 1 ? '' : 's'} moved back
      </p>
    </article>
  )
}

function organisedLine(count: number): string {
  return `${count.toLocaleString()} organised`
}

function ActivityProgressCard({ progress }: { progress: ActivityProgress }) {
  const periods = [
    progress.todayMoved > 0 || progress.todayUndoAvailable
      ? { label: 'Today', count: progress.todayMoved, undo: progress.todayUndoAvailable }
      : null,
    progress.yesterdayMoved > 0 ? { label: 'Yesterday', count: progress.yesterdayMoved, undo: false } : null,
    progress.lastWeekMoved > 0 ? { label: 'Last week', count: progress.lastWeekMoved, undo: false } : null,
    progress.lastMonthMoved > progress.lastWeekMoved
      ? { label: 'Last month', count: progress.lastMonthMoved, undo: false }
      : null,
  ].filter((item): item is { label: string; count: number; undo: boolean } => item !== null)

  return (
    <section className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
      {periods.length > 0 ? (
        <dl className="space-y-3">
          {periods.map((period) => (
            <div key={period.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-slate-500">{period.label}</dt>
              <dd className="text-right">
                <p className="text-sm font-semibold text-[var(--app-fg)]">{organisedLine(period.count)}</p>
                {period.undo ? <p className="mt-0.5 text-xs font-medium text-emerald-700">Undo available</p> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Documents were reviewed. Nothing was moved yet.</p>
      )}
    </section>
  )
}

export function ActivityPanel({
  runs,
  loading,
  error,
  busy,
  initialUndoRunId,
  onInitialUndoConsumed,
  focusRunId,
  onFocusConsumed,
  onOrganise,
  onRetry,
  onUndo,
}: {
  runs: ActivityRun[]
  loading?: boolean
  error?: string | null
  busy?: boolean
  initialUndoRunId?: string | null
  onInitialUndoConsumed?: () => void
  focusRunId?: string | null
  onFocusConsumed?: () => void
  onOrganise: () => void
  onRetry?: () => void
  onUndo?: (request: UndoRequest) => Promise<{ ok: true } | { ok: false; message: string }>
}) {
  const { t } = useAppLocale()
  const grouped = useMemo(() => groupActivityRuns(runs), [runs])
  const dayGroups = useMemo(() => groupByDay(grouped), [grouped])
  const progress = useMemo(() => summarizeActivityProgress(runs), [runs])
  const [pending, setPending] = useState<PendingUndo | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [selectedByRun, setSelectedByRun] = useState<Record<string, string[]>>({})
  const [highlightRunId, setHighlightRunId] = useState<string | null>(null)

  useEffect(() => {
    if (!initialUndoRunId) return
    setPending({ kind: 'run', runId: initialUndoRunId })
    setUndoError(null)
    onInitialUndoConsumed?.()
  }, [initialUndoRunId, onInitialUndoConsumed])

  useEffect(() => {
    if (!focusRunId || loading) return
    setHighlightRunId(focusRunId)
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`activity-run-${focusRunId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
    onFocusConsumed?.()
    return () => window.cancelAnimationFrame(frame)
  }, [focusRunId, loading, onFocusConsumed])

  function selectedPathsForRun(runId: string): Set<string> {
    return new Set((selectedByRun[runId] ?? []).map((path) => path.toLowerCase()))
  }

  function toggleSelected(runId: string, sourcePath: string) {
    setSelectedByRun((current) => {
      const run = runs.find((item) => item.runId === runId)
      if (!run) return current
      const next = new Set((current[runId] ?? []).map((path) => path.toLowerCase()))
      const key = sourcePath.toLowerCase()
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return {
        ...current,
        [runId]: undoableItems(run)
          .filter((item) => next.has(item.sourcePath.toLowerCase()))
          .map((item) => item.sourcePath),
      }
    })
  }

  async function confirmUndo() {
    if (!pending || !onUndo) return
    const run = runs.find((item) => item.runId === pending.runId)
    const items = run ? undoItemsForPending(run, pending) : []
    const sourcePaths =
      pending.kind === 'run'
        ? undefined
        : pending.kind === 'selected'
          ? pending.sourcePaths
          : items.map((item) => item.sourcePath)
    const result = await onUndo({
      runId: pending.runId,
      sourcePaths,
    })
    if (result.ok) {
      setPending(null)
      setUndoError(null)
      setSelectedByRun((current) => {
        const next = { ...current }
        delete next[pending.runId]
        return next
      })
      return
    }
    setUndoError(result.message)
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">{t.activity}</h1>
        <p className="mt-2 text-[15px] text-[var(--app-fg)] opacity-70">What happened.</p>
      </header>

      {loading && runs.length === 0 && !error ? (
        <div className="space-y-3">
          <div className="skeleton h-28 w-full rounded-[1.6rem]" />
          <div className="skeleton h-28 w-full rounded-[1.6rem]" />
        </div>
      ) : error && runs.length === 0 ? (
        <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50/90 p-5 shadow-xl shadow-rose-900/5">
          <p className="text-sm font-semibold text-rose-900">Could not load activity</p>
          <p className="mt-1.5 text-sm leading-relaxed text-rose-800">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : runs.length === 0 ? (
        <FeaturePromoCard
          title="Activity"
          description="Nothing has happened yet. Confirm a Plan in Organise to see it here."
          primary={{ label: 'Organise', onClick: onOrganise }}
        />
      ) : (
        <>
          {progress ? <ActivityProgressCard progress={progress} /> : null}
          {dayGroups.map((group) => (
            <section
              key={group.day}
              className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl"
            >
              <h2 className="text-sm font-semibold text-slate-900">{group.day}</h2>
              <div className="mt-4 space-y-6">
                {group.groups.map((entry) =>
                  entry.kind === 'organisation' ? (
                    <OrganisationRun
                      key={entry.run.runId}
                      run={entry.run}
                      undos={entry.undos}
                      busy={busy}
                      pending={pending}
                      undoError={pending?.runId === entry.run.runId ? undoError : null}
                      selectedPaths={selectedPathsForRun(entry.run.runId)}
                      highlighted={highlightRunId === entry.run.runId}
                      onToggleSelected={(sourcePath) => toggleSelected(entry.run.runId, sourcePath)}
                      onRequestUndo={(next) => {
                        setPending(next)
                        setUndoError(null)
                      }}
                      onCancelUndo={() => {
                        setPending(null)
                        setUndoError(null)
                      }}
                      onConfirmUndo={() => {
                        void confirmUndo()
                      }}
                    />
                  ) : (
                    <UndoRunSummary key={entry.run.runId} run={entry.run} />
                  ),
                )}
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  )
}
