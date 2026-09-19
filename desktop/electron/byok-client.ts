import {
  BYOK_SYSTEM_PROMPT,
  buildByokUserPrompt,
  byokAssistSuccess,
  conversationUserText,
  parseByokAssistRequest,
} from './byok.ts'
import { addByokPreference, preferencesForPrompt } from './byok-preferences-store.ts'
import {
  appendByokConversation,
  listByokConversation,
} from './byok-conversation.ts'
import { loadByokCredentials } from './byok-store.ts'
import type { ByokAssistResult, ByokProviderId } from '../src/types.ts'

const REQUEST_TIMEOUT_MS = 20_000
const MAX_TOKENS = 500

type ProviderCall = {
  provider: ByokProviderId
  model: string
  apiKey: string
  baseUrl: string | null
  prompt: string
}

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS)
}

function providerError(status: number): string {
  if (status === 401 || status === 403) return 'The provider rejected this API key.'
  if (status === 429) return 'The provider is rate-limiting this key. Try again in a moment.'
  if (status >= 500) return 'The provider is unavailable. Try again later.'
  return 'The provider could not complete that request.'
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function openAiText(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const message = (first as { message?: { content?: unknown } }).message
  return typeof message?.content === 'string' ? message.content : ''
}

function anthropicText(payload: Record<string, unknown>): string {
  const content = Array.isArray(payload.content) ? payload.content : []
  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const text = (item as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('\n')
}

async function callOpenAiCompatible(call: ProviderCall, endpoint: string): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${call.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: call.model,
      temperature: 0.3,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: BYOK_SYSTEM_PROMPT },
        { role: 'user', content: call.prompt },
      ],
    }),
    signal: timeoutSignal(),
  })

  const payload = await readJson(response)
  if (!response.ok) throw new Error(providerError(response.status))
  return openAiText(payload)
}

async function callAnthropic(call: ProviderCall): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': call.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: call.model,
      max_tokens: MAX_TOKENS,
      system: BYOK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: call.prompt }],
    }),
    signal: timeoutSignal(),
  })

  const payload = await readJson(response)
  if (!response.ok) throw new Error(providerError(response.status))
  return anthropicText(payload)
}

async function completeByokPrompt(call: ProviderCall): Promise<string> {
  if (call.provider === 'anthropic') {
    return callAnthropic(call)
  }
  if (call.provider === 'openai_compatible') {
    const base = call.baseUrl || ''
    return callOpenAiCompatible(call, `${base}/chat/completions`)
  }
  return callOpenAiCompatible(call, 'https://api.openai.com/v1/chat/completions')
}

export async function assistWithByok(
  userDataDir: string,
  input: unknown,
): Promise<ByokAssistResult> {
  const parsed = parseByokAssistRequest(input)
  if (!parsed.ok) return parsed

  const credentials = loadByokCredentials(userDataDir)
  if (!credentials.ok) return credentials

  if (parsed.request.task === 'teach_preference' && parsed.request.question) {
    addByokPreference(userDataDir, parsed.request.question)
  }

  try {
    const text = await completeByokPrompt({
      provider: credentials.provider,
      model: credentials.model,
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
      prompt: buildByokUserPrompt(
        parsed.request,
        preferencesForPrompt(userDataDir),
        listByokConversation(),
      ),
    })
    const result = byokAssistSuccess(parsed.request.task, text)
    if (!result.ok) return result
    const conversation = appendByokConversation(conversationUserText(parsed.request), result.text)
    return { ...result, conversation }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return { ok: false, error: 'The provider took too long. Try again.' }
    }
    if (error instanceof Error && error.message) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: 'The assistant could not complete that request.' }
  }
}
