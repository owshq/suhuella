import type { OrganisationPlanItem, PlanAssistantUsing } from '../types.ts'
import { groundedPlanAssistantReply } from './plan-presentation.ts'

/** Frozen: the assistant may combine these hints only — never invent new capabilities. */
export const PLAN_ASSISTANT_ALLOWED_HINTS = [
  'rename',
  'move',
  'archive',
  'create_folder',
  'ignore',
  'workflow',
] as const

export function planAssistantBecause(reason: string): string {
  const trimmed = reason.trim()
  if (!trimmed) return ''
  if (/^because\b/i.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  }
  return `Because ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
}

export const ON_DEVICE_PLAN_ASSISTANT_USING: PlanAssistantUsing = {
  backend: 'on_device',
  label: 'Built-in rules',
}

export const DEFAULT_PLAN_ASSISTANT_USING = ON_DEVICE_PLAN_ASSISTANT_USING

export const PLAN_ASSISTANT_PROMPTS = [
  'Why this folder?',
  'Keep these documents where they are',
  'Ignore screenshots.',
] as const

export function planAssistantUsingLine(using: PlanAssistantUsing): string {
  if (using.backend === 'on_device') return 'Analysed on this device'
  return `Using ${using.label}`
}

export function isPlanAssistantQuestion(note: string): boolean {
  const text = note.trim()
  if (!text) return false
  if (/\?$/.test(text)) return true
  return /^(why|what|which|how|when|where|who)\b/i.test(text)
}

export function isSimplePlanAssistantTask(note: string): boolean {
  const text = note.trim()
  if (!text) return true
  if (text.length > 140) return false
  if (
    /summar(y|ise|ize)|according to|unless|then by|tax return|accounting|300|multi-step|conversation/i.test(
      text,
    )
  ) {
    return false
  }
  const clauses = text.split(/[.!?]+/).filter((part) => part.trim())
  if (clauses.length > 2) return false
  return (
    /ignor|renam|archiv|move|folder|year|pdf|screenshot|invoice|explain|why|which workflow|what changed/i.test(
      text,
    ) || text.split(/\s+/).length <= 8
  )
}

export const PLAN_ASSISTANT_CONFIRM_HINT =
  'Review every action. Nothing changes until you Confirm Plan.'

export function workflowAvailabilityReply(workflowNames: string[] = []): string {
  const names = workflowNames.filter(Boolean)
  if (names.length === 0) {
    return 'There are no saved workflows yet. Choose documents in Plan Mode to build a Plan.'
  }
  return `${names.join(', ')}. Use workflow still builds a Plan you review.`
}

export function answerOnDevicePlanQuestion(
  question: string,
  items: OrganisationPlanItem[],
  extras?: { workflowNames?: string[] },
): string | null {
  const grounded = groundedPlanAssistantReply(question, items)
  if (grounded) return grounded

  const text = question.trim().toLowerCase()
  if (!text) return null

  const mentioned =
    items.find((item) => {
      const name = item.fileName.toLowerCase()
      return name.length > 2 && text.includes(name.replace(/\.[a-z0-9]+$/, ''))
    }) ?? items[0]

  if (/why.*(?:here|folder|destinat|recommend)/i.test(question) && mentioned) {
    return mentioned.explanation
      ? `${mentioned.fileName}: ${mentioned.explanation} This is a suggestion. Nothing moves until you confirm.`
      : `${mentioned.fileName} has no confident destination yet. Choose one, or ignore it.`
  }

  if (/why.*(?:not|n't).*(?:move|moved|organis|organiz)/i.test(question) && mentioned) {
    const reason = mentioned.skipReason || mentioned.warnings[0] || mentioned.explanation
    return reason
      ? `${mentioned.fileName} stayed put: ${reason}`
      : `${mentioned.fileName} is still in the plan. Confirm an action to move it.`
  }

  if (/what changed|since yesterday|what happened/i.test(question)) {
    return 'Asking a question never changes documents. Open Activity to see what happened.'
  }

  if (/which workflow|what workflow|should i use/i.test(question)) {
    return workflowAvailabilityReply(extras?.workflowNames ?? [])
  }

  if (/why/i.test(question) && mentioned?.explanation) {
    return `${mentioned.fileName}: ${mentioned.explanation}`
  }

  return null
}

export function runPlanAssistantCopyChecks(): void {
  const empty = workflowAvailabilityReply([])
  const named = workflowAvailabilityReply(['Invoices', 'Downloads'])
  const haystack = `${empty} ${named} ${PLAN_ASSISTANT_CONFIRM_HINT}`
  if (/Save a plan|Saved plans|Apply accepted changes|Run workflow/i.test(haystack)) {
    throw new Error('assistant copy must not promise saved plans or Apply/Run')
  }
  if (!empty.includes('no saved workflows')) {
    throw new Error('empty workflow reply must be honest')
  }
  if (/Save a plan|you reuse/i.test(empty)) {
    throw new Error('empty workflow reply must not invite creation')
  }
  if (!named.includes('Use workflow') || !named.includes('Invoices')) {
    throw new Error('named workflows keep Use workflow')
  }
  if (!PLAN_ASSISTANT_CONFIRM_HINT.includes('Confirm Plan')) {
    throw new Error('assistant review hint must say Confirm Plan')
  }
}
