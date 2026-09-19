import { applyBrandPresentation } from '@suhuella/brand'
import type {
  ByokActivityContext,
  ByokAlternativeContext,
  ByokAssistRequest,
  ByokAssistResult,
  ByokAssistantId,
  ByokConversationMessage,
  ByokDescriptorContext,
  ByokFolderFileContext,
  ByokPlanContextItem,
  ByokProviderId,
  ByokRecommendationContext,
  ByokTask,
} from '../src/types.ts'

/**
 * INTELLIGENCE-MODEL-001 — BYOK
 *
 * Optional productivity assistant after recommendation.
 *
 * AI MAY EXPLAIN. AI MAY SUGGEST. AI MAY NEVER DECIDE.
 * The user always approves the Plan.
 *
 * Context contract — BYOK receives only:
 *   KnowledgeDescriptor (summary) · Recommendation · Current Plan · Activity Summary · User Question
 *
 * Conversation is assistant session memory — ephemeral, never a product object.
 * Preferences are notes for future AI conversations — not engine rules, not teaching.
 *
 * Never: Knowledge Index · weights · scoring · embeddings · engine internals.
 *
 * Must never: rank folders · change the Recommendation Engine · execute actions · modify confidence
 * · build or auto-apply a Plan · participate in Autopilot.
 */

export const BYOK_PRINCIPLE = [
  'AI MAY EXPLAIN.',
  'AI MAY SUGGEST.',
  'AI MAY NEVER DECIDE.',
  'The user always approves the Plan.',
].join(' ')

export const BYOK_ALLOWED_TASKS: readonly ByokTask[] = [
  'explain_recommendation',
  'explain_not_recommended',
  'suggest_plan',
  'organise_folder',
  'generate_workflow_ideas',
  'summarise_activity',
  'teach_preference',
  'answer_question',
]

export const BYOK_FORBIDDEN_TASKS = [
  'rank_folders',
  'change_recommendation_engine',
  'execute_actions',
  'modify_confidence',
] as const

export const BYOK_ASSISTANT_LABELS: Record<ByokAssistantId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  compatible_api: 'Compatible API',
  local_server: 'Local AI server',
}

const ASSISTANT_PROVIDER: Record<ByokAssistantId, ByokProviderId> = {
  openai: 'openai',
  anthropic: 'anthropic',
  compatible_api: 'openai_compatible',
  local_server: 'openai_compatible',
}

const ASSISTANT_DEFAULT_MODEL: Record<ByokAssistantId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  compatible_api: '',
  local_server: 'llama3',
}

const ASSISTANT_DEFAULT_BASE_URL: Partial<Record<ByokAssistantId, string>> = {
  local_server: 'http://localhost:11434/v1',
}

/** @deprecated Internal wire format only — UI uses assistant labels. */
export const BYOK_PROVIDER_LABELS: Record<ByokProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openai_compatible: 'Compatible API',
}

export const BYOK_SYSTEM_PROMPT = [
  applyBrandPresentation('You are a productivity assistant for SuHuella.'),
  BYOK_PRINCIPLE,
  'AI CONVERSATIONS ARE EPHEMERAL. KNOWLEDGE IS EXPLICIT.',
  'A folder recommendation already exists when one is shown. It is final.',
  'You may explain recommendations, explain why other folders were not chosen, suggest how to review a plan,',
  'suggest how to organise a folder (rename, create, archive, move ideas only), generate workflow ideas,',
  'summarise activity, save a preference for future AI conversations when asked, or answer questions.',
  applyBrandPresentation('A saved preference is a note for later AI conversations only. It does not teach SuHuella,'),
  'change the Recommendation Engine, the index, ranking, or Local Intelligence.',
  'Use the current AI conversation for follow-ups. Clearing it forgets this chat.',
  'You must never rank or re-rank folders, change scores or confidence, execute actions, auto-build a plan,',
  'or tell the user to skip review.',
  'Do not invent a different destination as if it were the engine result.',
  'Write short, plain language. Do not return JSON, scores, or commands.',
].join(' ')

const ALLOWED_TASK_SET = new Set<string>(BYOK_ALLOWED_TASKS)
const FORBIDDEN_TASK_SET = new Set<string>(BYOK_FORBIDDEN_TASKS)

export function isByokTask(value: unknown): value is ByokTask {
  return typeof value === 'string' && ALLOWED_TASK_SET.has(value)
}

export function isByokAssistantId(value: unknown): value is ByokAssistantId {
  return (
    value === 'openai' ||
    value === 'anthropic' ||
    value === 'compatible_api' ||
    value === 'local_server'
  )
}

export function isByokProviderId(value: unknown): value is ByokProviderId {
  return value === 'openai' || value === 'anthropic' || value === 'openai_compatible'
}

export function assistantLabel(assistant: ByokAssistantId | null): string | null {
  return assistant ? BYOK_ASSISTANT_LABELS[assistant] : null
}

/** @deprecated Use assistantLabel in UI. */
export function providerLabel(provider: ByokProviderId | null): string | null {
  return provider ? BYOK_PROVIDER_LABELS[provider] : null
}

export function providerForAssistant(assistant: ByokAssistantId): ByokProviderId {
  return ASSISTANT_PROVIDER[assistant]
}

export function defaultModelForAssistant(assistant: ByokAssistantId): string {
  return ASSISTANT_DEFAULT_MODEL[assistant]
}

export function isAllowedByokBaseUrl(value: string, localhostOnly = false): boolean {
  try {
    const parsed = new URL(value)
    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    if (localhostOnly) {
      return parsed.protocol === 'http:' && isLocal
    }
    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && isLocal
  } catch {
    return false
  }
}

export function normalizeByokApiKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length >= 1 ? trimmed : null
}

export function validateByokConnectInput(input: unknown):
  | {
      ok: true
      assistant: ByokAssistantId
      provider: ByokProviderId
      apiKey: string
      model: string
      baseUrl: string | null
    }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Choose an assistant and paste your API key.' }
  }

  const record = input as Record<string, unknown>
  const assistant =
    isByokAssistantId(record.assistant) ? record.assistant
    : isByokProviderId(record.provider) && record.provider === 'openai_compatible'
      ? ('compatible_api' as ByokAssistantId)
    : isByokProviderId(record.provider)
      ? (record.provider as ByokAssistantId)
      : null

  if (!assistant) {
    return { ok: false, error: 'Choose an AI assistant to connect.' }
  }

  const provider = providerForAssistant(assistant)
  const apiKey = normalizeByokApiKey(record.apiKey)
  if (!apiKey) {
    return { ok: false, error: 'Paste your API key.' }
  }

  const model =
    typeof record.model === 'string' && record.model.trim()
      ? record.model.trim()
      : defaultModelForAssistant(assistant)

  if ((assistant === 'compatible_api' || assistant === 'local_server') && !model) {
    return { ok: false, error: 'Enter the model name your server expects.' }
  }

  let baseUrl: string | null = null
  if (assistant === 'compatible_api' || assistant === 'local_server') {
    const raw =
      typeof record.baseUrl === 'string' && record.baseUrl.trim()
        ? record.baseUrl.trim()
        : ASSISTANT_DEFAULT_BASE_URL[assistant] ?? ''
    if (!raw || !isAllowedByokBaseUrl(raw, assistant === 'local_server')) {
      return {
        ok: false,
        error:
          assistant === 'local_server'
            ? 'Local AI server needs http://localhost with a port (for example Ollama).'
            : 'Compatible API needs an https URL, or http://localhost for a local model.',
      }
    }
    baseUrl = raw.replace(/\/+$/, '')
  }

  return { ok: true, assistant, provider, apiKey, model, baseUrl }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function normalizeDescriptor(value: unknown): ByokDescriptorContext | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.displayName !== 'string') return undefined
  return {
    displayName: value.displayName.trim(),
    entities: Array.isArray(value.entities)
      ? value.entities.filter((item): item is string => typeof item === 'string')
      : [],
    topics: Array.isArray(value.topics)
      ? value.topics.filter((item): item is string => typeof item === 'string')
      : [],
    hints: Array.isArray(value.hints)
      ? value.hints.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function normalizeAlternatives(value: unknown): ByokAlternativeContext[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.folderLabel !== 'string') return []
    if (typeof item.confidenceLabel !== 'string') return []
    return [
      {
        folderLabel: item.folderLabel,
        confidenceLabel: item.confidenceLabel as ByokAlternativeContext['confidenceLabel'],
        reasons: Array.isArray(item.reasons)
          ? item.reasons.filter((reason): reason is string => typeof reason === 'string')
          : [],
      },
    ]
  })
  return items.length > 0 ? items : undefined
}

function normalizeRecommendation(value: unknown): ByokRecommendationContext | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.fileName !== 'string' || typeof value.folderLabel !== 'string') return undefined
  if (typeof value.confidenceLabel !== 'string') return undefined
  if (!Array.isArray(value.reasons)) return undefined
  return {
    fileName: value.fileName.trim(),
    folderLabel: value.folderLabel.trim(),
    confidenceLabel: value.confidenceLabel as ByokRecommendationContext['confidenceLabel'],
    reasons: value.reasons.filter((item): item is string => typeof item === 'string'),
    alternatives: normalizeAlternatives(value.alternatives),
    descriptor: normalizeDescriptor(value.descriptor),
    notRecommendedQuestion:
      typeof value.notRecommendedQuestion === 'string'
        ? value.notRecommendedQuestion.trim()
        : undefined,
  }
}

function normalizePlanItems(value: unknown): ByokPlanContextItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items: ByokPlanContextItem[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.fileName !== 'string' || typeof item.action !== 'string') {
      continue
    }
    items.push({
      fileName: item.fileName,
      action: item.action as ByokPlanContextItem['action'],
      destinationLabel: typeof item.destinationLabel === 'string' ? item.destinationLabel : null,
      confidenceLabel:
        typeof item.confidenceLabel === 'string'
          ? (item.confidenceLabel as ByokPlanContextItem['confidenceLabel'])
          : null,
      explanation: typeof item.explanation === 'string' ? item.explanation : '',
    })
  }
  return items
}

function normalizeFolderFiles(value: unknown): ByokFolderFileContext[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.fileName !== 'string') return []
    return [
      {
        fileName: item.fileName,
        action:
          typeof item.action === 'string'
            ? (item.action as ByokFolderFileContext['action'])
            : 'none',
        destinationLabel: typeof item.destinationLabel === 'string' ? item.destinationLabel : null,
        explanation: typeof item.explanation === 'string' ? item.explanation : '',
      },
    ]
  })
  return items.length > 0 ? items : undefined
}

function normalizeActivity(value: unknown): ByokActivityContext | undefined {
  if (!isRecord(value) || typeof value.label !== 'string') return undefined
  return {
    label: value.label,
    organised: typeof value.organised === 'number' ? value.organised : 0,
    moved: typeof value.moved === 'number' ? value.moved : 0,
    skipped: typeof value.skipped === 'number' ? value.skipped : 0,
    failed: typeof value.failed === 'number' ? value.failed : 0,
    topDestinations: Array.isArray(value.topDestinations)
      ? value.topDestinations.flatMap((item) => {
          if (!isRecord(item) || typeof item.label !== 'string' || typeof item.count !== 'number') {
            return []
          }
          return [{ label: item.label, count: item.count }]
        })
      : [],
  }
}

export function parseByokAssistRequest(
  input: unknown,
): { ok: true; request: ByokAssistRequest } | { ok: false; error: string } {
  if (!isRecord(input)) {
    return { ok: false, error: 'Choose what you want help with.' }
  }

  const task = input.task
  if (typeof task === 'string' && FORBIDDEN_TASK_SET.has(task)) {
    return { ok: false, error: 'AI assistance cannot rank folders, change confidence, or run actions.' }
  }
  if (!isByokTask(task)) {
    return { ok: false, error: 'That kind of help is not available.' }
  }

  const question = typeof input.question === 'string' ? input.question.trim() : ''
  const request: ByokAssistRequest = {
    task,
    question: question || undefined,
    recommendation: normalizeRecommendation(input.recommendation),
    planItems: normalizePlanItems(input.planItems),
    activity: normalizeActivity(input.activity),
    folderLabel: typeof input.folderLabel === 'string' ? input.folderLabel.trim() : undefined,
    folderFiles: normalizeFolderFiles(input.folderFiles),
  }

  if (task === 'explain_recommendation' && !request.recommendation) {
    return { ok: false, error: 'There is no recommendation to explain yet.' }
  }
  if (task === 'explain_not_recommended' && !request.recommendation) {
    return { ok: false, error: 'There is no recommendation to compare yet.' }
  }
  if (task === 'suggest_plan' && (!request.planItems || request.planItems.length === 0)) {
    return { ok: false, error: 'Review a plan first, then ask for ideas.' }
  }
  if (task === 'organise_folder' && (!request.folderFiles || request.folderFiles.length === 0)) {
    return { ok: false, error: 'Select documents first, then ask how to organise them.' }
  }
  if (task === 'summarise_activity' && !request.activity) {
    return { ok: false, error: 'There is no activity to summarise yet.' }
  }
  if (task === 'teach_preference' && !request.question) {
    return { ok: false, error: 'Write a preference to save first.' }
  }
  if (task === 'answer_question' && !request.question) {
    return { ok: false, error: 'Type a question first.' }
  }
  if (
    task === 'generate_workflow_ideas' &&
    (!request.planItems || request.planItems.length === 0) &&
    !request.activity
  ) {
    return { ok: false, error: 'Review a plan or open Activity first.' }
  }

  return { ok: true, request }
}

function descriptorBlock(descriptor: ByokDescriptorContext): string {
  return [
    `Document: ${descriptor.displayName}`,
    descriptor.entities.length > 0 ? `Entities: ${descriptor.entities.join(', ')}` : null,
    descriptor.topics.length > 0 ? `Topics: ${descriptor.topics.join(', ')}` : null,
    descriptor.hints.length > 0 ? `Hints: ${descriptor.hints.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function recommendationBlock(item: ByokRecommendationContext): string {
  const lines = [
    `File: ${item.fileName}`,
    `Recommended folder: ${item.folderLabel}`,
    `Confidence (read-only): ${item.confidenceLabel}`,
    `Why this folder: ${item.reasons.join('; ') || 'The local engine chose this folder.'}`,
  ]
  if (item.descriptor) lines.push(descriptorBlock(item.descriptor))
  if (item.alternatives && item.alternatives.length > 0) {
    lines.push(
      applyBrandPresentation('Other folders SuHuella considered (read-only, not ranked by you):\n') +
        item.alternatives
          .slice(0, 4)
          .map(
            (alt) =>
              `- ${alt.folderLabel} (${alt.confidenceLabel}): ${alt.reasons.join('; ') || 'weaker match'}`,
          )
          .join('\n'),
    )
  }
  return lines.join('\n')
}

function planBlock(items: ByokPlanContextItem[]): string {
  return items
    .slice(0, 40)
    .map((item) => {
      const destination = item.destinationLabel ? ` → ${item.destinationLabel}` : ''
      const confidence = item.confidenceLabel ? ` (${item.confidenceLabel})` : ''
      return `- ${item.fileName}: ${item.action}${destination}${confidence}. ${item.explanation}`
    })
    .join('\n')
}

function folderBlock(label: string | undefined, files: ByokFolderFileContext[]): string {
  const header = label ? `Folder: ${label}` : 'Selected files'
  const body = files
    .slice(0, 40)
    .map((item) => {
      const destination = item.destinationLabel ? ` → ${item.destinationLabel}` : ''
      return `- ${item.fileName}: ${item.action}${destination}. ${item.explanation}`
    })
    .join('\n')
  return `${header}\n${body}`
}

function activityBlock(activity: ByokActivityContext): string {
  const destinations =
    activity.topDestinations.length > 0
      ? activity.topDestinations.map((item) => `${item.label} (${item.count})`).join(', ')
      : 'none'
  return [
    `${activity.label}: ${activity.organised} organised, ${activity.moved} moved, ${activity.skipped} skipped, ${activity.failed} failed.`,
    `Top destinations: ${destinations}`,
  ].join('\n')
}

export function conversationUserText(request: ByokAssistRequest): string {
  if (request.question) return request.question
  switch (request.task) {
    case 'explain_recommendation':
      return 'Explain this recommendation.'
    case 'explain_not_recommended':
      return 'Why not another folder?'
    case 'suggest_plan':
      return 'Suggest how to review this plan.'
    case 'organise_folder':
      return 'Suggest how to organise these files.'
    case 'generate_workflow_ideas':
      return 'Suggest workflow ideas.'
    case 'summarise_activity':
      return 'Summarise this activity.'
    case 'teach_preference':
    case 'answer_question':
      return ''
  }
}

function conversationBlock(conversation: ByokConversationMessage[]): string | null {
  if (conversation.length === 0) return null
  return [
    'AI conversation (this session only — not knowledge, not Activity, not a Workflow):',
    ...conversation.map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.text}`),
  ].join('\n')
}

export function buildByokUserPrompt(
  request: ByokAssistRequest,
  userPreferences: string[] = [],
  conversation: ByokConversationMessage[] = [],
): string {
  const parts: string[] = []

  switch (request.task) {
    case 'explain_recommendation':
      parts.push('Explain this existing recommendation in plain language. Do not change it.')
      break
    case 'explain_not_recommended':
      parts.push(
        'Explain why another folder was not recommended, using only the context below. Do not change the recommendation or rank folders.',
      )
      break
    case 'suggest_plan':
      parts.push(
        'Help the user review this existing plan. If they wrote a request, turn it into short actions (ignore, rename, archive, move, create folder). Do not invent destinations or change confidence.',
      )
      break
    case 'organise_folder':
      parts.push(
        'Suggest how the user might organise these files (rename, create folder, archive, move ideas only). Do not execute anything. The user will build and confirm a plan.',
      )
      break
    case 'generate_workflow_ideas':
      parts.push('Generate workflow ideas only. They are ideas, not actions.')
      break
    case 'summarise_activity':
      parts.push('Summarise this activity. Do not suggest moving files.')
      break
    case 'teach_preference':
      parts.push(
        applyBrandPresentation('Acknowledge this preference in plain language. Confirm it will be used in future AI conversations only. It does not teach SuHuella or change the Recommendation Engine.'),
      )
      break
    case 'answer_question':
      parts.push('Answer the user question using only the context below.')
      break
  }

  if (request.question) {
    parts.push(`User: ${request.question}`)
  }
  if (request.recommendation?.notRecommendedQuestion) {
    parts.push(`Focus: ${request.recommendation.notRecommendedQuestion}`)
  }
  const prior = conversationBlock(conversation)
  if (prior) parts.push(prior)
  if (userPreferences.length > 0) {
    parts.push(
      `Saved AI preferences (notes for this assistant only — not engine rules, not teaching):\n${userPreferences
        .slice(0, 10)
        .map((item) => `- ${item}`)
        .join('\n')}`,
    )
  }
  if (request.recommendation) {
    parts.push(recommendationBlock(request.recommendation))
  }
  if (request.planItems && request.planItems.length > 0) {
    parts.push(applyBrandPresentation(`Current plan (already ranked by SuHuella):\n${planBlock(request.planItems)}`))
  }
  if (request.folderFiles && request.folderFiles.length > 0) {
    parts.push(folderBlock(request.folderLabel, request.folderFiles))
  }
  if (request.activity) {
    parts.push(activityBlock(request.activity))
  }

  return parts.join('\n\n')
}

export function normalizeByokAssistText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 4000)
}

export function byokAssistSuccess(
  task: ByokTask,
  text: string,
  conversation: ByokConversationMessage[] = [],
): ByokAssistResult {
  const normalized = normalizeByokAssistText(text)
  if (!normalized) {
    return { ok: false, error: 'The assistant returned nothing. Try again.' }
  }
  return { ok: true, task, text: normalized, conversation }
}

export function runByokContractChecks(): void {
  if (BYOK_ALLOWED_TASKS.length !== 8) {
    throw new Error('BYOK allowlist must stay at the eight assistant tasks')
  }
  for (const task of BYOK_FORBIDDEN_TASKS) {
    if (isByokTask(task)) throw new Error(`${task} must never be an allowed BYOK task`)
  }

  const rank = parseByokAssistRequest({ task: 'rank_folders' })
  if (rank.ok) throw new Error('rank_folders must be rejected')

  const explain = parseByokAssistRequest({
    task: 'explain_not_recommended',
    recommendation: {
      fileName: 'Invoice.pdf',
      folderLabel: 'Invoices',
      confidenceLabel: 'Strong match',
      reasons: ['Invoice matches this folder'],
      alternatives: [
        {
          folderLabel: 'Downloads',
          confidenceLabel: 'Weak match',
          reasons: ['Generic folder'],
        },
      ],
      notRecommendedQuestion: 'Why not ACME?',
    },
  })
  if (!explain.ok) throw new Error('explain_not_recommended should accept recommendation context')

  const organise = parseByokAssistRequest({
    task: 'organise_folder',
    folderFiles: [{ fileName: 'scan.pdf', action: 'move', destinationLabel: 'Scans', explanation: 'Ready' }],
  })
  if (!organise.ok) throw new Error('organise_folder should accept folder files')

  const teach = parseByokAssistRequest({
    task: 'teach_preference',
    question: 'Invoices from ACME usually belong in Clients/ACME/Invoices.',
  })
  if (!teach.ok) throw new Error('teach_preference should accept a preference note')

  const emptyTeach = parseByokAssistRequest({ task: 'teach_preference' })
  if (emptyTeach.ok || !emptyTeach.error.includes('preference')) {
    throw new Error('teach_preference without text must ask for a preference, not teaching')
  }

  const prompt = buildByokUserPrompt(
    explain.request,
    ['Invoices from ACME go to Clients/ACME/Invoices'],
    [
      { role: 'user', text: 'Ignore screenshots.' },
      { role: 'assistant', text: 'OK.' },
    ],
  )
  if (!prompt.includes('read-only') || !prompt.includes('Saved AI preferences')) {
    throw new Error('BYOK prompt must include read-only context and saved AI preferences only')
  }
  if (!prompt.includes('Ignore screenshots') || !prompt.includes('this session only')) {
    throw new Error('BYOK prompt must include ephemeral AI conversation, not product knowledge')
  }
  if (prompt.toLowerCase().includes('teach suhuella')) {
    throw new Error('BYOK must not promise teaching from a saved preference')
  }
  if (!BYOK_SYSTEM_PROMPT.includes('AI CONVERSATIONS ARE EPHEMERAL')) {
    throw new Error('BYOK must keep AI conversation ephemeral and knowledge explicit')
  }

  const local = validateByokConnectInput({
    assistant: 'local_server',
    apiKey: 'local-dev-key',
    baseUrl: 'http://localhost:11434/v1',
  })
  if (!local.ok) throw new Error('local_server assistant should be allowed on localhost')

  const remoteHttp = validateByokConnectInput({
    assistant: 'compatible_api',
    apiKey: 'remote-dev-key',
    model: 'llama3',
    baseUrl: 'http://example.com/v1',
  })
  if (remoteHttp.ok) throw new Error('compatible_api must reject plain http remote URLs')
}
