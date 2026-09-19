import { assistWithByok } from './byok-client.ts'
import { getByokStatus } from './byok-store.ts'
import { type KnowledgeSetOperationResult } from './knowledge-set.ts'
import {
  extractPlanHintsFromAssistantText,
  proposeOrganisationPlan,
} from './plan-assistant.ts'
import {
  answerOnDevicePlanQuestion,
  isPlanAssistantQuestion,
  isSimplePlanAssistantTask,
  ON_DEVICE_PLAN_ASSISTANT_USING,
} from '@suhuella/product/lib/plan-assistant-copy.ts'
import { groundedPlanAssistantReply } from '@suhuella/product/lib/plan-presentation.ts'
import type { IndexedFolderEntry } from '@suhuella/product/types.ts'
import type {
  KnowledgeSetValidationError,
  PlanAssistantStatus,
  PlanAssistantTurn,
  PlanAssistantUsing,
} from '@suhuella/product/types.ts'

/**
 * One Plan Assistant — no selector.
 * Today: On-device intelligence (rules). Later: Local AI (ONNX). Optional: BYOK.
 * SuHuella never pays for AI and never ranks folders here.
 * Simple tasks may fall back on-device; complex BYOK failures fail honestly.
 */

const COMPLEX_BYOK_FAILURE: KnowledgeSetValidationError = {
  code: 'assistant_unavailable',
  message: 'Couldn’t complete this request. Try again or continue without AI.',
}

export function planAssistantUsingFromByok(userDataDir: string): PlanAssistantUsing {
  const status = getByokStatus(userDataDir)
  if (status.connected && status.assistantLabel) {
    return {
      backend: 'byok',
      label: `${status.assistantLabel} (your account)`,
    }
  }
  return ON_DEVICE_PLAN_ASSISTANT_USING
}

export function getPlanAssistantStatus(userDataDir: string): PlanAssistantStatus {
  return { using: planAssistantUsingFromByok(userDataDir) }
}

function failed(error: KnowledgeSetValidationError): PlanAssistantTurn {
  return { ok: false, error }
}

function fromLocalResult(
  result: KnowledgeSetOperationResult<import('@suhuella/product/types.ts').PlanAssistantProposal>,
): PlanAssistantTurn {
  if (!result.ok) return failed(result.error)
  return { ok: true, kind: 'proposal', proposal: { ...result.data, using: ON_DEVICE_PLAN_ASSISTANT_USING } }
}

export async function runPlanAssistant(
  userDataDir: string,
  input: unknown,
  folders: IndexedFolderEntry[],
): Promise<PlanAssistantTurn> {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : null
  const note = typeof record?.note === 'string' ? record.note.trim() : ''
  const workflowNames = Array.isArray(record?.workflowNames)
    ? record.workflowNames.filter((item): item is string => typeof item === 'string')
    : []
  const preferred = planAssistantUsingFromByok(userDataDir)
  const simple = isSimplePlanAssistantTask(note)
  const question = isPlanAssistantQuestion(note)

  const local = proposeOrganisationPlan(input, folders)
  if (!local.ok) return failed(local.error)

  const grounded = groundedPlanAssistantReply(note, local.data.preview.items)
  if (grounded) {
    return { ok: true, kind: 'answer', text: grounded, using: ON_DEVICE_PLAN_ASSISTANT_USING }
  }

  if (preferred.backend !== 'byok') {
    if (question) {
      const text = answerOnDevicePlanQuestion(note, local.data.preview.items, { workflowNames })
      if (text) {
        return { ok: true, kind: 'answer', text, using: ON_DEVICE_PLAN_ASSISTANT_USING }
      }
      return failed({
        code: 'assistant_unavailable',
        message: 'On-device intelligence can answer simple questions. Connect your own AI for more.',
      })
    }
    return fromLocalResult(local)
  }

  const byok = await assistWithByok(userDataDir, {
    task: question ? 'answer_question' : 'suggest_plan',
    question: note || undefined,
    planItems: local.data.preview.items.map((item) => ({
      fileName: item.fileName,
      action: item.action,
      destinationLabel: item.proposedPath,
      confidenceLabel: item.confidenceLabel,
      explanation: item.explanation,
    })),
  })

  if (!byok.ok) {
    if (!simple) return failed(COMPLEX_BYOK_FAILURE)
    if (question) {
      const text = answerOnDevicePlanQuestion(note, local.data.preview.items, { workflowNames })
      if (text) {
        return { ok: true, kind: 'answer', text, using: ON_DEVICE_PLAN_ASSISTANT_USING }
      }
      return failed(COMPLEX_BYOK_FAILURE)
    }
    return fromLocalResult(local)
  }

  if (question) {
    return { ok: true, kind: 'answer', text: byok.text, using: preferred }
  }

  const extracted = extractPlanHintsFromAssistantText(byok.text)
  const refinedNote = [note, extracted].filter(Boolean).join(' ').trim()
  const refined =
    refinedNote && refinedNote !== note
      ? proposeOrganisationPlan({ knowledgeSet: local.data.knowledgeSet, note: refinedNote }, folders)
      : local
  const proposal = refined.ok ? refined.data : local.data
  const workflows = [...proposal.workflows]
  if (byok.text.trim()) {
    workflows.unshift({
      id: 'byok-idea',
      title: 'From your AI',
      explanation: byok.text.replace(/\s+/g, ' ').trim().slice(0, 400),
      relatedPaths: [],
    })
  }

  return {
    ok: true,
    kind: 'proposal',
    proposal: { ...proposal, workflows: workflows.slice(0, 4), using: preferred },
  }
}
