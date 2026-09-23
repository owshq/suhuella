import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  FolderInput,
  FolderPlus,
  HardDrive,
  Pencil,
  PlugZap,
  RotateCcw,
  Trash2,
  Unplug,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useAppLocale } from '../lib/app-locale'
import {
  activityIconLabel,
  activityItemIconKind,
  activityRunIconKind,
  activityRunOutcome,
  activityRunSummaryLine,
  activityRunTitle,
  activityStatusLabel,
  activityWhenLabel,
  activityWorkflowSummary,
  activityTriggerLabel,
  canUndoActivityRun,
  isGeneralActivityRun,
  isPlanActivityRun,
  folderFromFile,
  humanFolderPath,
  movedActivityItems,
  type ActivityFilter,
  type ActivityIconKind,
} from '../lib/activity-copy'
import {
  groupActivityRuns,
  groupActivityRunsByDay,
  activityFiltersPresent,
  generalActivityFiltersPresent,
  groupMatchesActivityFilter,
  undoableItems,
} from '../lib/activity-groups'
import {
  activitySourceHistoryNote,
  activityUndoAvailabilityDetail,
  expiresInLabel,
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

const PLAN_ACTIVITY_FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'plans', label: 'Plans' },
  { id: 'undo', label: 'Undo' },
]

const GENERAL_ACTIVITY_FILTERS: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sources', label: 'Sources' },
  { id: 'save_as', label: 'Save As' },
]

export type ActivityPanelScope = 'plans' | 'general'

const HEADER_GLASS_BUTTON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[var(--overlay-bg)]/35 text-[var(--app-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-white/10 backdrop-blur-2xl transition hover:bg-[var(--overlay-bg)]/50 active:scale-[0.96]'

const ACTION_ICONS: Record<Exclude<ActivityIconKind, 'workflow'>, LucideIcon> = {
  move: ArrowRightLeft,
  rename: Pencil,
  create_folder: FolderPlus,
  archive: Archive,
  plan: FolderInput,
  undo: Undo2,
  source_connected: PlugZap,
  source_removed: Trash2,
  source_restored: RotateCcw,
  source_unavailable: Unplug,
  source: HardDrive,
}

const ACTION_BADGE: Record<ActivityIconKind, string> = {
  move: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  rename: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  create_folder: 'bg-violet-50 text-violet-700 ring-violet-200/80',
  archive: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  plan: 'bg-[var(--brand-accent-muted)] text-[var(--brand-accent)] ring-[color-mix(in_srgb,var(--brand-accent)_18%,transparent)]',
  workflow: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
  undo: 'bg-sky-100 text-sky-700 ring-sky-200/80',
  source_connected: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  source_removed: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  source_restored: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  source_unavailable: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  source: 'bg-slate-100 text-slate-600 ring-slate-200/80',
}

function ActivityActionBadge({
  kind,
  workflowName,
  size = 'md',
}: {
  kind: ActivityIconKind
  workflowName?: string
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'h-6 w-6 rounded-lg' : 'h-9 w-9 rounded-[0.85rem]'
  const glyph = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  if (kind === 'workflow' && workflowName) {
    return (
      <span className={`flex shrink-0 items-center justify-center ring-1 ${box} ${ACTION_BADGE.workflow}`}>
        <WorkflowGlyph name={workflowName} className={glyph} />
      </span>
    )
  }
  const Icon = ACTION_ICONS[kind === 'workflow' ? 'plan' : kind]
  return (
    <span
      className={`flex shrink-0 items-center justify-center ring-1 ${box} ${ACTION_BADGE[kind]}`}
      title={activityIconLabel(kind)}
      aria-label={activityIconLabel(kind)}
    >
      <Icon className={glyph} aria-hidden />
    </span>
  )
}

function timelineMeta(parts: Array<string | undefined | null>): string | undefined {
  const visible = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part))
  return visible.length > 0 ? visible.join(' · ') : undefined
}

function destinationFolder(item: ActivityItem): string | null {
  return item.targetPath ? humanFolderPath(item.targetPath, true) : null
}

function statusClass(status: ActivityItemStatus): string {
  if (status === 'moved') return 'text-emerald-700'
  if (status === 'failed') return 'text-rose-700'
  return 'text-slate-500'
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
  const actionKind = activityItemIconKind(item)

  return (
    <li className="rounded-2xl border border-white/80 bg-white/90 px-3 py-3 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {selectable ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              disabled={busy}
              className="mt-1.5 h-4 w-4 rounded border-slate-300 text-[var(--brand-accent)] accent-[var(--brand-accent)]"
              aria-label={`Select ${item.fileName} for undo`}
            />
          ) : null}
          <ActivityActionBadge kind={actionKind} size="sm" />
          <div className="min-w-0">
            <p className="min-w-0 font-medium text-slate-900">{item.fileName}</p>
            {item.sourceName ? (
              <p className="mt-0.5 text-[12px] font-medium text-slate-500">{item.sourceName}</p>
            ) : null}
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {activityIconLabel(actionKind)}
            </p>
          </div>
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
  return (
    <div className="relative py-2" aria-hidden>
      <span className="mx-auto block h-4 w-px bg-gradient-to-b from-slate-300/80 to-slate-200/40" />
    </div>
  )
}

function TimelineNode({
  title,
  detail,
  subdetail,
  footer,
  iconKind,
  workflowName,
  tone = 'default',
}: {
  title: string
  detail: string
  subdetail?: string
  footer?: string
  iconKind: ActivityIconKind
  workflowName?: string
  tone?: 'default' | 'success' | 'undo' | 'history' | 'source'
}) {
  const cardClass =
    tone === 'undo'
      ? 'border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white to-white shadow-[0_10px_28px_-18px_rgba(14,165,233,0.55)]'
      : tone === 'history'
        ? 'border-slate-200/70 bg-gradient-to-br from-slate-50/90 via-white to-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.28)]'
        : tone === 'source'
          ? 'border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/80 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)]'
          : 'border-white/70 bg-gradient-to-br from-white via-white to-[color-mix(in_srgb,var(--brand-accent)_4%,white)] shadow-[0_14px_32px_-20px_rgba(15,23,42,0.4)]'

  return (
    <div className="relative">
      <span className="absolute -left-[1.65rem] top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-[var(--app-bg)] ring-4 ring-[var(--app-bg)]">
        <ActivityActionBadge kind={iconKind} workflowName={workflowName} />
      </span>
      <div className={`relative rounded-[1.25rem] border px-3.5 py-3.5 backdrop-blur-sm ${cardClass}`}>
        <div className="min-w-0 pl-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ${ACTION_BADGE[iconKind]}`}
            >
              {activityIconLabel(iconKind)}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{detail}</p>
          {subdetail ? (
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
              {subdetail}
            </p>
          ) : null}
          {footer ? (
            <p className="mt-3 border-t border-slate-200/70 pt-2.5 text-xs font-medium text-slate-500">
              {footer}
            </p>
          ) : null}
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
  const iconKind = activityRunIconKind(run)
  return (
    <div className="relative ml-4 border-l border-slate-200/70 pl-7 before:absolute before:inset-y-0 before:-left-px before:w-px before:bg-gradient-to-b before:from-slate-300/90 before:via-slate-200/60 before:to-slate-100/20">
      <TimelineNode
        title={activityRunTitle(run)}
        detail={
          run.workflowName
            ? (activityWorkflowSummary(run) ?? activityRunOutcome(run))
            : activityRunOutcome(run)
        }
        subdetail={timelineMeta([
          run.trigger === 'workflow' || run.trigger === 'autopilot'
            ? activityRunOutcome(run)
            : activityTriggerLabel(run.trigger),
          activityWhenLabel(run.completedAt),
        ])}
        footer={run.trigger === 'source_event' ? activitySourceHistoryNote() : undefined}
        iconKind={iconKind}
        workflowName={run.workflowName}
        tone={run.trigger === 'source_event' ? 'source' : 'success'}
      />

      {undos.map((undo) => (
        <div key={undo.runId}>
          <TimelineArrow />
          <TimelineNode
            title={activityRunTitle(undo)}
            detail={activityRunOutcome(undo)}
            subdetail={timelineMeta([
              activityTriggerLabel(undo.trigger),
              activityWhenLabel(undo.completedAt),
            ])}
            iconKind={activityRunIconKind(undo)}
            tone="undo"
          />
        </div>
      ))}

      {recovery === 'undo_available' && !runPending ? (
        <>
          <TimelineArrow />
          <TimelineNode
            title="Undo available"
            detail={activityUndoAvailabilityDetail(run)}
            iconKind="undo"
            tone="default"
          />
        </>
      ) : null}

      {isPlanActivityRun(run) &&
      (recovery === 'history_expired' ||
        recovery === 'history_complete' ||
        recovery === 'partially_restored') ? (
        <>
          <TimelineArrow />
          <TimelineNode
            title={runRecoveryHeadline(recovery)}
            detail={runRecoveryDetail(recovery)}
            iconKind="plan"
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

      {isPlanActivityRun(run) && run.items.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing changed here.</p>
      ) : run.items.length > 0 ? (
        <details className="rounded-2xl border border-white/70 bg-white/50 px-3 py-2">
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
            Documents · {activityRunSummaryLine(run.summary)}
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
      ) : null}
    </article>
  )
}

function UndoRunSummary({ run }: { run: ActivityRun }) {
  const when = activityWhenLabel(run.completedAt)
  return (
    <article className="rounded-[1.25rem] border border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white to-white px-3.5 py-3.5 shadow-[0_10px_28px_-18px_rgba(14,165,233,0.55)]">
      <div className="flex items-start gap-3">
        <ActivityActionBadge kind="undo" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight text-slate-900">{activityRunTitle(run)}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {run.summary.moved} document{run.summary.moved === 1 ? '' : 's'} moved back
          </p>
          {when ? (
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
              {when}
            </p>
          ) : null}
        </div>
      </div>
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
    <section className="rounded-[1.6rem] border border-white/70 bg-gradient-to-br from-white/80 via-white/55 to-[color-mix(in_srgb,var(--brand-accent)_5%,transparent)] p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      {periods.length > 0 ? (
        <dl className="space-y-3">
          {periods.map((period) => (
            <div key={period.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-slate-500">{period.label}</dt>
              <dd className="text-right">
                <p className="text-sm font-semibold text-[var(--app-fg)]">{organisedLine(period.count)}</p>
                {period.undo ? (
                  <p className="mt-0.5 text-xs font-medium text-emerald-700">
                    {progress.todayUndoExpiresInDays != null && progress.todayUndoExpiresInDays > 0
                      ? expiresInLabel(progress.todayUndoExpiresInDays)
                      : 'Undo available'}
                  </p>
                ) : null}
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
  scope = 'general',
  loading,
  error,
  busy,
  initialUndoRunId,
  onInitialUndoConsumed,
  focusRunId,
  onFocusConsumed,
  onOrganise,
  onBack,
  onRetry,
  onUndo,
}: {
  runs: ActivityRun[]
  scope?: ActivityPanelScope
  loading?: boolean
  error?: string | null
  busy?: boolean
  initialUndoRunId?: string | null
  onInitialUndoConsumed?: () => void
  focusRunId?: string | null
  onFocusConsumed?: () => void
  onOrganise: () => void
  onBack?: () => void
  onRetry?: () => void
  onUndo?: (request: UndoRequest) => Promise<{ ok: true } | { ok: false; message: string }>
}) {
  const { t } = useAppLocale()
  const scopedRuns = useMemo(
    () => (scope === 'plans' ? runs.filter(isPlanActivityRun) : runs.filter(isGeneralActivityRun)),
    [runs, scope],
  )
  const grouped = useMemo(() => groupActivityRuns(scopedRuns), [scopedRuns])
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const visibleGroups = useMemo(
    () => grouped.filter((group) => groupMatchesActivityFilter(group, activityFilter)),
    [grouped, activityFilter],
  )
  const dayGroups = useMemo(() => groupActivityRunsByDay(visibleGroups), [visibleGroups])
  const filterOptions = useMemo(() => {
    const present = new Set(
      scope === 'plans' ? activityFiltersPresent(grouped) : generalActivityFiltersPresent(grouped),
    )
    const options = scope === 'plans' ? PLAN_ACTIVITY_FILTERS : GENERAL_ACTIVITY_FILTERS
    return options.filter((option) => option.id === 'all' || present.has(option.id))
  }, [grouped, scope])
  const progress = useMemo(
    () => (scope === 'plans' ? summarizeActivityProgress(scopedRuns) : null),
    [scopedRuns, scope],
  )
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
      const run = scopedRuns.find((item) => item.runId === runId)
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
    const run = scopedRuns.find((item) => item.runId === pending.runId)
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
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">{t.activity}</h1>
          <p className="mt-2 text-[15px] text-[var(--app-fg)] opacity-70">
            {scope === 'plans'
              ? 'Plans you confirmed.'
              : 'Save As, source changes, and other devices on this license.'}
          </p>
        </div>
        {scope === 'plans' && onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={`Back to ${t.organise}`}
            className={`${HEADER_GLASS_BUTTON} mt-0.5`}
          >
            <ArrowLeft className="h-4 w-4 opacity-90" strokeWidth={2.25} />
          </button>
        ) : null}
      </header>

      {loading && scopedRuns.length === 0 && !error ? (
        <div className="space-y-3">
          <div className="skeleton h-28 w-full rounded-[1.6rem]" />
          <div className="skeleton h-28 w-full rounded-[1.6rem]" />
        </div>
      ) : error && scopedRuns.length === 0 ? (
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
      ) : scopedRuns.length === 0 ? (
        <FeaturePromoCard
          title={t.activity}
          description={
            scope === 'plans'
              ? 'Nothing has happened yet. Confirm a Plan in Plan Mode to see it here.'
              : 'Nothing yet. Save As saves, source changes, and activity from other devices on this license will appear here.'
          }
          primary={
            scope === 'plans' ? { label: t.organise, onClick: onOrganise } : undefined
          }
        />
      ) : (
        <>
          {filterOptions.length > 2 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Activity type">
              {filterOptions.map((option) => {
                const selected = activityFilter === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActivityFilter(option.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                      selected
                        ? 'bg-slate-900 text-white'
                        : 'border border-white/80 bg-white/70 text-slate-700 hover:bg-white'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          ) : null}
          {progress ? <ActivityProgressCard progress={progress} /> : null}
          {dayGroups.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing in this view.</p>
          ) : (
            dayGroups.map((group) => (
            <section
              key={group.key}
              className="rounded-[1.6rem] border border-white/70 bg-gradient-to-br from-white/85 via-white/60 to-slate-50/40 p-5 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.42)] backdrop-blur-xl"
            >
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {group.day}
              </h2>
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
            ))
          )}
        </>
      )}
    </section>
  )
}
