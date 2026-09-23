import { Copy, Pencil, Trash2 } from 'lucide-react'
import { ORGANISE_USE_WORKFLOW } from '../lib/organise-copy'
import {
  WORKFLOW_NAME_EXAMPLES,
  workflowIntentSummary,
  workflowLastRunLabel,
} from '../lib/workflow-copy'
import type { Workflow } from '../types'
import { WorkflowGlyphBadge } from './WorkflowGlyph'

export function WorkflowsList({
  workflows,
  busy,
  activeId,
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  workflows: Workflow[]
  busy: boolean
  activeId?: string | null
  onRun: (workflow: Workflow) => void
  onEdit?: (workflow: Workflow) => void
  onDuplicate?: (workflow: Workflow) => void
  onDelete?: (workflow: Workflow) => void
}) {
  if (workflows.length === 0) return null

  return (
    <ul className="space-y-2">
      {workflows.map((workflow) => {
        const active = activeId === workflow.id
        return (
          <li
            key={workflow.id}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${
              active ? 'border-blue-300 bg-white shadow-sm' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <WorkflowGlyphBadge name={workflow.name} category={workflow.category} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-slate-900">{workflow.name}</p>
                <p className="truncate text-[12px] text-slate-500">{workflowIntentSummary(workflow)}</p>
                <p className="truncate text-[11px] text-slate-400">{workflowLastRunLabel(workflow.lastRunAt)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(workflow)}
                  disabled={busy}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-blue-500"
                  title="Edit workflow"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {onDuplicate ? (
                <button
                  type="button"
                  onClick={() => onDuplicate(workflow)}
                  disabled={busy}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-blue-500"
                  title="Duplicate workflow"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(workflow)}
                  disabled={busy}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  title="Remove workflow"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onRun(workflow)}
                disabled={busy}
                className="rounded-full bg-[var(--brand-accent)] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[var(--brand-accent-hover)] disabled:opacity-50"
              >
                {ORGANISE_USE_WORKFLOW}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function SaveWorkflowForm({
  title,
  name,
  description,
  busy,
  error,
  onNameChange,
  onDescriptionChange,
  onSave,
  onCancel,
}: {
  title: string
  name: string
  description: string
  busy: boolean
  error: string | null
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        This saves a workflow. The next Use workflow builds a new Plan you review.
      </p>
      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Name</span>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={60}
          placeholder="Weekly Downloads"
          className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--brand-accent)]"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Description
        </span>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          maxLength={160}
          rows={2}
          placeholder="Plan these documents again and review a new Plan."
          className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--brand-accent)]"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WORKFLOW_NAME_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onNameChange(example)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {example}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || name.trim().length === 0}
          className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save workflow'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
