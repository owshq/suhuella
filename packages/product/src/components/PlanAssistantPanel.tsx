import { Sparkles } from 'lucide-react'
import { isPlanAssistantQuestion, planAssistantUsingLine } from '../lib/plan-assistant-copy'
import { ORGANISE_ASSISTANT_LABEL } from '../lib/organise-copy'
import { groundedAssistantChips } from '../lib/plan-presentation'
import type { ByokConversationMessage, OrganisationPlanItem, PlanAssistantUsing, PlanWorkflowIdea } from '../types'

export function PlanAssistantComposer({
  note,
  using,
  busy,
  disabled,
  items = [],
  conversation = [],
  onNoteChange,
  onPropose,
  onClearConversation,
}: {
  note: string
  using: PlanAssistantUsing
  busy: boolean
  disabled: boolean
  items?: OrganisationPlanItem[]
  conversation?: ByokConversationMessage[]
  onNoteChange: (note: string) => void
  onPropose: () => void
  onClearConversation?: () => void
}) {
  const showConversation = using.backend === 'byok'
  const chips = groundedAssistantChips(items)

  return (
    <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{ORGANISE_ASSISTANT_LABEL}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{planAssistantUsingLine(using)}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Ask about this Plan. Suggestions do not move documents.
          </p>
        </div>
        {showConversation && conversation.length > 0 && onClearConversation ? (
          <button
            type="button"
            onClick={onClearConversation}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Clear
          </button>
        ) : null}
      </div>
      {showConversation ? (
        conversation.length > 0 ? (
          <ol className="space-y-2">
            {conversation.map((item, index) => (
              <li key={`${item.role}-${index}`}>
                <p className="text-xs font-medium text-slate-500">
                  {item.role === 'user' ? 'You' : 'Assistant'}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{item.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            This chat stays in this session. It does not approve the Plan.
          </p>
        )
      ) : null}
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy || disabled}
              onClick={() => onNoteChange(prompt)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
      <label className="block">
        <span className="sr-only">{ORGANISE_ASSISTANT_LABEL}</span>
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={busy}
          rows={2}
          placeholder="Why this folder? Keep these documents where they are."
          className="mt-0.5 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </label>
      <button
        type="button"
        onClick={onPropose}
        disabled={busy || disabled}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4 text-[var(--brand-accent)]" />
        {busy ? 'Working…' : isPlanAssistantQuestion(note) ? 'Ask' : 'Suggest'}
      </button>
    </aside>
  )
}

export function PlanAssistantAnswer({
  using,
  text,
}: {
  using: PlanAssistantUsing
  text: string
}) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
      <p className="text-sm font-semibold text-slate-900">{ORGANISE_ASSISTANT_LABEL}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{planAssistantUsingLine(using)}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>
      <p className="mt-2 text-xs text-slate-500">This answer does not change the Plan.</p>
    </div>
  )
}

export function PlanAssistantBanner({
  using,
  workflows,
  onReanalyse,
  busy,
}: {
  using: PlanAssistantUsing
  workflows: PlanWorkflowIdea[]
  onReanalyse: () => void
  busy: boolean
}) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Suggested updates to this Plan</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{planAssistantUsingLine(using)}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Review every action. Nothing changes until you apply accepted changes.
          </p>
        </div>
        <button
          type="button"
          onClick={onReanalyse}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-accent)]" />
          Reanalyse
        </button>
      </div>
      {workflows.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {workflows.map((workflow) => (
            <li key={workflow.id} className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2.5">
              <p className="text-sm font-medium text-slate-900">{workflow.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{workflow.explanation}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
