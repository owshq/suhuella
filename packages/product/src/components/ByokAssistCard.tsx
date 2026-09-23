import { useEffect, useState } from 'react'
import { getSuhuellaApi, invokeSuhuella } from '../lib/api'
import { productCopy } from '../lib/product-copy'
import type {
  ByokActivityContext,
  ByokAssistRequest,
  ByokConversationMessage,
  ByokFolderFileContext,
  ByokPlanContextItem,
  ByokRecommendationContext,
  ByokStatus,
  ByokTask,
} from '../types'

const TASK_LABEL: Partial<Record<ByokTask, string>> = {
  explain_recommendation: 'Explain',
  explain_not_recommended: 'Why not another folder?',
  suggest_plan: 'Suggest plan',
  organise_folder: 'Plan ideas',
  generate_workflow_ideas: 'Workflow ideas',
  summarise_activity: 'Summarise',
  teach_preference: 'Save preference',
}

type ByokAssistCardProps = {
  tasks: ByokTask[]
  recommendation?: ByokRecommendationContext
  planItems?: ByokPlanContextItem[]
  activity?: ByokActivityContext
  folderLabel?: string
  folderFiles?: ByokFolderFileContext[]
  questionPlaceholder?: string
  tone?: 'light' | 'dark'
}

export function ByokAssistCard({
  tasks,
  recommendation,
  planItems,
  activity,
  folderLabel,
  folderFiles,
  questionPlaceholder = 'Ask a question',
  tone = 'light',
}: ByokAssistCardProps) {
  const [status, setStatus] = useState<ByokStatus | null>(null)
  const [question, setQuestion] = useState('')
  const [busyTask, setBusyTask] = useState<ByokTask | null>(null)
  const [conversation, setConversation] = useState<ByokConversationMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void invokeSuhuella('getByokStatus')
      .then(setStatus)
      .catch(() => setStatus(null))
    void invokeSuhuella('getByokConversation')
      .then(setConversation)
      .catch(() => setConversation([]))
  }, [])

  if (!status?.connected) return null

  const buttonTasks = tasks.filter((task) => task !== 'answer_question' && task !== 'teach_preference')
  const canSavePreference = tasks.includes('teach_preference')
  const dark = tone === 'dark'
  const frame = dark
    ? 'rounded-xl border border-white/8 bg-white/4 px-3 py-2.5'
    : 'rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl'
  const titleClass = dark
    ? 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-400'
    : 'text-sm font-semibold text-slate-900'
  const bodyClass = dark
    ? 'text-xs leading-relaxed text-slate-300'
    : 'text-sm leading-relaxed text-slate-500'
  const buttonClass = dark
    ? 'rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/16 disabled:opacity-60'
    : 'rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-60'
  const inputClass = dark
    ? 'w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500'
    : 'w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400'
  const userClass = dark ? 'text-slate-400' : 'text-slate-500'
  const assistantClass = dark ? 'text-slate-200' : 'text-slate-700'
  const errorClass = dark ? 'mt-2 text-xs text-amber-100/90' : 'mt-3 text-sm text-rose-700'

  async function run(task: ByokTask, questionOverride?: string) {
    setBusyTask(task)
    setError(null)
    try {
      const request: ByokAssistRequest = {
        task,
        question:
          task === 'answer_question' || task === 'teach_preference'
            ? (questionOverride ?? question).trim()
            : undefined,
        recommendation,
        planItems,
        activity,
        folderLabel,
        folderFiles,
      }
      const result = await getSuhuellaApi().assistWithByok(request)
      if (result.ok) {
        setConversation(result.conversation)
        if (task === 'answer_question' || task === 'teach_preference') setQuestion('')
      } else {
        setError(result.error)
      }
    } catch {
      setError('The assistant could not complete that request.')
    } finally {
      setBusyTask(null)
    }
  }

  async function clearConversation() {
    setError(null)
    try {
      setConversation(await getSuhuellaApi().clearByokConversation())
    } catch {
      setConversation([])
    }
  }

  return (
    <div className={frame}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={titleClass}>AI Conversation</h2>
          <p className={`mt-1.5 ${bodyClass}`}>
            Optional · {status.assistantLabel ?? 'Ready assistant'}. It explains and suggests. It
            never decides for you.
          </p>
        </div>
        {conversation.length > 0 ? (
          <button
            type="button"
            disabled={Boolean(busyTask)}
            onClick={() => void clearConversation()}
            className={buttonClass}
          >
            Clear conversation
          </button>
        ) : null}
      </div>
      {buttonTasks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {buttonTasks.map((task) => (
            <button
              key={task}
              type="button"
              disabled={Boolean(busyTask)}
              onClick={() => void run(task)}
              className={buttonClass}
            >
              {busyTask === task ? 'Asking…' : TASK_LABEL[task]}
            </button>
          ))}
        </div>
      ) : null}
      {conversation.length > 0 ? (
        <ol className={`mt-3 space-y-2 ${dark ? 'text-xs' : 'text-sm'}`}>
          {conversation.map((item, index) => (
            <li key={`${item.role}-${index}`}>
              <p className={`font-medium ${userClass}`}>{item.role === 'user' ? 'You' : 'Assistant'}</p>
              <p className={`mt-0.5 leading-relaxed ${assistantClass}`}>{item.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={`mt-3 ${bodyClass}`}>
          This chat stays in this session. It is not Activity, Knowledge, or a Workflow.
        </p>
      )}
      <div className="mt-3 space-y-2">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && question.trim()) {
              void run('answer_question')
            }
          }}
          placeholder={questionPlaceholder}
          className={inputClass}
          disabled={Boolean(busyTask)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busyTask) || !question.trim()}
            onClick={() => void run('answer_question')}
            className={buttonClass}
          >
            {busyTask === 'answer_question' ? 'Asking…' : 'Ask'}
          </button>
          {canSavePreference ? (
            <button
              type="button"
              disabled={Boolean(busyTask) || !question.trim()}
              onClick={() => void run('teach_preference')}
              className={buttonClass}
            >
              {busyTask === 'teach_preference' ? 'Saving…' : 'Save preference'}
            </button>
          ) : null}
        </div>
      </div>
      {canSavePreference ? (
        <p className={`mt-2 ${bodyClass}`}>
          {productCopy('Save preference keeps a note for future AI conversations. It does not teach SuHuella.')}
        </p>
      ) : null}
      {error ? <p className={errorClass}>{error}</p> : null}
    </div>
  )
}
