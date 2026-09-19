import { FileText } from 'lucide-react'
import type { OrganisationDestinationOption, OrganisationPlanItem } from '../types'
import {
  ORGANISE_METHOD_LINE,
  ORGANISE_PRIMARY_CTA,
  ORGANISE_UNDO_WINDOW,
  planConfirmCounts,
  planConfirmSummary,
  planDestinationLine,
  planItemWhy,
  planRenameLine,
} from '../lib/organise-copy'
import { destinationPathLabel, isConfirmablePlanItem } from '../lib/plan-editor-copy'
import {
  planPresentationCounts,
  planPresentationLabel,
  planPresentationState,
  planPrimaryAction,
  planSummaryLead,
  planSummaryLines,
  REANALYSE_WARNING,
  type PlanPresentationState,
} from '../lib/plan-presentation'

function stateDetail(item: OrganisationPlanItem, state: PlanPresentationState): string {
  const raw = item.skipReason || item.warnings.at(-1) || item.explanation || ''
  if (state === 'no_change') {
    if (/already in/i.test(raw)) return 'This document already looks fine'
    return 'No useful change proposed'
  }
  if (state === 'blocked') {
    if (/unavailable|permission|no longer available/i.test(raw)) return 'Destination unavailable'
    if (/already exists|name taken/i.test(raw)) return 'This change cannot run yet'
    return raw || 'This change cannot run yet'
  }
  if (state === 'skipped') return 'Skipped by you'
  return planItemWhy(item)
}

function PlanCard({
  item,
  changing,
  showRenameEditor,
  renameDraft,
  busy,
  firstSuggested,
  onAccept,
  onKeepOriginal,
  onChangeDestination,
  onChoose,
  onRename,
  onRenameDraftChange,
  onApplyRenameEdit,
  onCancelRenameEdit,
  viewMode,
}: {
  item: OrganisationPlanItem
  changing: boolean
  showRenameEditor: boolean
  renameDraft: string
  busy: boolean
  firstSuggested: boolean
  onAccept: (item: OrganisationPlanItem) => void
  onKeepOriginal: (item: OrganisationPlanItem) => void
  onChangeDestination: (item: OrganisationPlanItem) => void
  onChoose: (item: OrganisationPlanItem, option: OrganisationDestinationOption) => void
  onRename: (item: OrganisationPlanItem) => void
  onRenameDraftChange: (value: string) => void
  onApplyRenameEdit: (item: OrganisationPlanItem) => void
  onCancelRenameEdit: () => void
  viewMode?: 'list' | 'grid'
}) {
  const state = planPresentationState(item)
  const accepted = state === 'accepted'
  const suggested = state === 'suggested'
  const noChange = state === 'no_change'
  const blocked = state === 'blocked'
  const skipped = state === 'skipped'
  const applied = state === 'applied'
  const failed = state === 'failed'
  const needsReview = state === 'needs_review'
  const destination = planDestinationLine(item)
  const rename = planRenameLine(item)
  const why = stateDetail(item, state)
  const destinationVerb = item.action === 'archive' ? 'Archive to' : 'Move to'
  const canDecide = suggested || accepted || needsReview
  const statusClass =
    accepted || applied
      ? 'text-emerald-600'
      : failed || blocked
        ? 'text-rose-600'
        : suggested || needsReview
          ? 'text-amber-600'
          : 'text-[var(--app-fg)] opacity-50'

  if (viewMode === 'list') {
    return (
      <article
        id={firstSuggested ? 'plan-first-suggested' : undefined}
        className={`flex w-full items-center border-b border-[var(--overlay-row)] px-4 py-1.5 text-[13px] hover:bg-[var(--overlay-row)] ${
          accepted ? 'bg-[var(--overlay-row)]' : ''
        } ${skipped || noChange ? 'opacity-60' : ''}`}
      >
        <div className="flex w-[30%] items-center gap-2 truncate pr-2">
          <FileText className="h-4 w-4 shrink-0 text-[var(--app-fg)] opacity-70" />
          <span className="truncate text-[13px] text-[var(--app-fg)]" title={item.fileName}>
            {item.fileName}
          </span>
        </div>

        <div className="flex w-[30%] items-center gap-1.5 truncate pr-2">
          {showRenameEditor ? (
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => onRenameDraftChange(e.target.value)}
                className="flex-1 rounded-md border border-[var(--sidebar-line)] bg-[var(--app-bg)] px-2 py-0.5 text-[12px] text-[var(--app-fg)] focus:border-blue-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onApplyRenameEdit(item)
                  if (e.key === 'Escape') onCancelRenameEdit()
                }}
              />
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => onApplyRenameEdit(item)} className="text-xs font-medium text-blue-500">
                  Save
                </button>
                <button type="button" onClick={onCancelRenameEdit} className="text-xs text-[var(--app-fg)] opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : suggested || accepted ? (
            <span className="truncate text-[13px] text-[var(--app-fg)] opacity-80" title={rename || item.fileName}>{rename || item.fileName}</span>
          ) : (
            <span className="truncate text-[13px] text-[var(--app-fg)] opacity-60" title={why}>{why}</span>
          )}
        </div>

        <div className="relative flex w-[25%] min-w-0 flex-col gap-1 pr-2">
          {suggested || accepted || needsReview ? (
            <button
              type="button"
              onClick={() => onChangeDestination(item)}
              disabled={applied || failed || skipped}
              className="flex w-full items-center gap-1.5 truncate rounded px-1 -ml-1 text-left text-[13px] transition hover:bg-[var(--overlay-row)]"
            >
              <span className="truncate text-[13px] text-[var(--app-fg)] opacity-80">
                {destination ? destination : 'Choose...'}
              </span>
            </button>
          ) : null}

          {changing && (
            <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-bg)] p-1 shadow-lg backdrop-blur-3xl">
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--app-fg)] opacity-50">
                {item.alternatives?.length ? 'Recommended' : 'Available folders'}
              </p>
              <ul className="space-y-0.5">
                {item.alternatives?.map((opt: OrganisationDestinationOption) => (
                  <li key={opt.folder}>
                    <button
                      type="button"
                      onClick={() => onChoose(item, opt)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-[var(--overlay-row)]"
                    >
                      <span className="truncate text-[12px] font-medium text-[var(--app-fg)]">
                        {destinationPathLabel(opt.folder)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex w-[15%] shrink-0 items-center justify-between gap-2">
          <span className={`truncate text-[12px] ${statusClass}`}>{planPresentationLabel(state)}</span>
          {canDecide ? (
            <div className="flex gap-1">
              {isConfirmablePlanItem(item) ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAccept(item)}
                  className="rounded-full bg-[var(--overlay-row)] px-2 py-1 text-[11px] font-semibold text-[var(--app-fg)] hover:opacity-80 disabled:opacity-50"
                >
                  {accepted ? 'Accepted' : 'Accept'}
                </button>
              ) : null}
              {accepted || suggested ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onKeepOriginal(item)}
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--app-fg)] opacity-50 hover:opacity-100 disabled:opacity-50"
                >
                  Keep original
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    )
  }

  return (
    <article
      id={firstSuggested ? 'plan-first-suggested' : undefined}
      className={`rounded-2xl border bg-[var(--app-bg)] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
        applied
          ? 'border-emerald-200/50'
          : failed || blocked
            ? 'border-rose-200/50'
            : skipped || noChange
              ? 'border-[var(--sidebar-line)] opacity-60'
              : accepted
                ? 'border-blue-500/30 ring-1 ring-blue-500/15'
                : suggested || needsReview
                  ? 'border-amber-200/50'
                  : 'border-[var(--sidebar-line)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--overlay-row)] text-[var(--app-fg)] opacity-80">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-[var(--app-fg)]" title={item.fileName}>
              {item.fileName}
            </h3>
            <p className={`mt-1 text-[13px] font-semibold ${statusClass}`}>{planPresentationLabel(state)}</p>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-3">
        {suggested || accepted ? (
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Suggested</dt>
            <dd className="mt-0.5 text-[15px] font-medium text-slate-900">
              {rename ? `Rename to ${rename}` : destination ? `${destinationVerb} ${destination}` : item.fileName}
            </dd>
          </div>
        ) : null}
        {destination && (suggested || accepted || needsReview) ? (
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{destinationVerb}</dt>
            <dd className="mt-0.5 text-[15px] font-medium text-slate-900">{destination}</dd>
          </div>
        ) : null}
        {showRenameEditor ? (
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Rename</dt>
            <dd className="mt-1 space-y-2">
              <input
                type="text"
                value={renameDraft}
                onChange={(event) => onRenameDraftChange(event.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onApplyRenameEdit(item)}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white"
                >
                  Save name
                </button>
                <button
                  type="button"
                  onClick={onCancelRenameEdit}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </dd>
          </div>
        ) : null}
        {why ? (
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Why</dt>
            <dd className="mt-0.5 text-[14px] leading-relaxed text-slate-600">{why}</dd>
          </div>
        ) : null}
      </dl>

      {changing && item.alternatives.length > 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Choose destination
          </p>
          {item.alternatives.map((option) => (
            <button
              key={option.folder}
              type="button"
              onClick={() => onChoose(item, option)}
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-white"
            >
              <span className="block truncate text-[13px] font-semibold text-slate-900">
                {destinationPathLabel(option.folder)}
              </span>
              {option.reasons[0] ? (
                <span className="mt-0.5 block truncate text-[12px] text-slate-500">{option.reasons[0]}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {canDecide && !showRenameEditor ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isConfirmablePlanItem(item) ? (
            <button
              type="button"
              onClick={() => onAccept(item)}
              disabled={busy}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
            >
              {accepted ? 'Accepted' : 'Accept'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onRename(item)}
            disabled={busy || !item.proposedPath}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onChangeDestination(item)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
          >
            Change destination
          </button>
          <button
            type="button"
            onClick={() => onKeepOriginal(item)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
          >
            Keep original
          </button>
        </div>
      ) : null}
    </article>
  )
}

export function PlanEditor({
  items,
  originLabel,
  busy,
  changingPath,
  editingRenamePath,
  renameDraft,
  pendingConfirm,
  reanalysePending,
  onAddFiles,
  onAddFolder,
  onReanalyse,
  onConfirmReanalyse,
  onCancelReanalyse,
  onAccept,
  onKeepOriginal,
  onChangeDestination,
  onChoose,
  onEditRename,
  onRenameDraftChange,
  onApplyRenameEdit,
  onCancelRenameEdit,
  onRequestConfirm,
  onConfirmPending,
  onCancelPending,
  onReviewSuggestions,
  viewMode,
}: {
  items: OrganisationPlanItem[]
  originLabel: string | null
  busy: boolean
  changingPath: string | null
  editingRenamePath: string | null
  renameDraft: string
  pendingConfirm: { kind: 'bulk' } | { kind: 'item'; currentPath: string } | null
  reanalysePending: boolean
  onAddFiles?: () => void
  onAddFolder?: () => void
  onReanalyse: () => void
  onConfirmReanalyse: () => void
  onCancelReanalyse: () => void
  onAccept: (item: OrganisationPlanItem) => void
  onKeepOriginal: (item: OrganisationPlanItem) => void
  onChangeDestination: (item: OrganisationPlanItem) => void
  onChoose: (item: OrganisationPlanItem, option: OrganisationDestinationOption) => void
  onEditRename: (item: OrganisationPlanItem) => void
  onRenameDraftChange: (value: string) => void
  onApplyRenameEdit: (item: OrganisationPlanItem) => void
  onCancelRenameEdit: () => void
  onRequestConfirm: () => void
  onConfirmPending: () => void
  onCancelPending: () => void
  onReviewSuggestions: () => void
  viewMode?: 'list' | 'grid'
}) {
  const presentation = planPresentationCounts(items)
  const confirmCounts = planConfirmCounts(items)
  const summary = planConfirmSummary(confirmCounts)
  const lines = planSummaryLines(presentation)
  const primary = planPrimaryAction(presentation)
  const firstSuggestedPath = items.find((item) => planPresentationState(item) === 'suggested')?.currentPath

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-[var(--app-fg)]">Plan</h2>
          <p className="mt-1 text-[15px] font-medium text-[var(--app-fg)] opacity-70">
            {planSummaryLead(presentation.selected, originLabel)}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-[var(--app-fg)] opacity-80">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
          <p className="mt-1 text-[12px] text-[var(--app-fg)] opacity-50">{ORGANISE_METHOD_LINE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddFiles ? (
            <button
              type="button"
              onClick={onAddFiles}
              disabled={busy}
              className="rounded-full bg-[var(--overlay-row)] px-3 py-1.5 text-[13px] font-semibold text-[var(--app-fg)] hover:opacity-80 disabled:opacity-50 transition"
            >
              Select documents
            </button>
          ) : null}
          {onAddFolder ? (
            <button
              type="button"
              onClick={onAddFolder}
              disabled={busy}
              className="rounded-full bg-[var(--overlay-row)] px-3 py-1.5 text-[13px] font-semibold text-[var(--app-fg)] hover:opacity-80 disabled:opacity-50 transition"
            >
              Select folder
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReanalyse}
            disabled={busy}
            className="rounded-full bg-[var(--overlay-row)] px-3 py-1.5 text-[13px] font-semibold text-[var(--app-fg)] hover:opacity-80 disabled:opacity-50 transition"
          >
            Reanalyse
          </button>
        </div>
      </header>

      {reanalysePending ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p>{REANALYSE_WARNING}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onConfirmReanalyse}
              disabled={busy}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              Reanalyse
            </button>
            <button
              type="button"
              onClick={onCancelReanalyse}
              disabled={busy}
              className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-950 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col">
        {viewMode === 'list' && items.length > 0 && (
          <div className="mb-2 mt-4 flex w-full border-b border-[var(--overlay-line)] px-4 pb-1 text-[11px] font-medium text-[var(--app-fg)] opacity-60">
            <div className="w-[30%] pr-2">Current Name</div>
            <div className="w-[30%] pr-2">Suggested Rename</div>
            <div className="w-[25%] pr-2">Destination</div>
            <div className="w-[15%] text-right">Status</div>
          </div>
        )}
        <div className={viewMode === 'list' ? 'flex flex-col' : 'space-y-3'}>
          {items.map((item) => (
            <PlanCard
              key={item.currentPath}
              item={item}
              viewMode={viewMode}
              firstSuggested={item.currentPath === firstSuggestedPath}
              changing={changingPath === item.currentPath}
              showRenameEditor={editingRenamePath === item.currentPath}
              renameDraft={renameDraft}
              busy={busy}
              onAccept={onAccept}
              onKeepOriginal={onKeepOriginal}
              onChangeDestination={onChangeDestination}
              onChoose={onChoose}
              onRename={onEditRename}
              onRenameDraftChange={onRenameDraftChange}
              onApplyRenameEdit={onApplyRenameEdit}
              onCancelRenameEdit={onCancelRenameEdit}
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-slate-200/80 bg-[#f8fafc]/95 py-4 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[15px] font-bold text-slate-900">
              {presentation.accepted > 0
                ? `${presentation.accepted} accepted change${presentation.accepted === 1 ? '' : 's'}`
                : `${presentation.suggested} suggestion${presentation.suggested === 1 ? '' : 's'} to review`}
            </p>
            {summary ? <p className="mt-1 text-[13px] font-medium text-slate-600">{summary}</p> : null}
            <p className="mt-1 text-[13px] text-slate-500">{ORGANISE_UNDO_WINDOW}</p>
          </div>
          {pendingConfirm ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirmPending}
                disabled={busy || presentation.accepted === 0}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Confirming Plan…' : ORGANISE_PRIMARY_CTA}
              </button>
              <button
                type="button"
                onClick={onCancelPending}
                disabled={busy}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[14px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={primary.kind === 'apply' ? onRequestConfirm : onReviewSuggestions}
              disabled={busy || primary.kind === 'none'}
              className="rounded-full bg-blue-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {primary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
