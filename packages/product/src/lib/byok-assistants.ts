import type { ByokAssistantId, ByokProviderId } from '../types'

export type ByokAssistantDefinition = {
  id: ByokAssistantId
  label: string
  description: string
  provider: ByokProviderId
  defaultModel: string
  defaultBaseUrl?: string
  needsBaseUrl: boolean
  localhostOnly?: boolean
}

export const BYOK_ASSISTANTS: ByokAssistantDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'ChatGPT API',
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    needsBaseUrl: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude API',
    provider: 'anthropic',
    defaultModel: 'claude-haiku-4-5',
    needsBaseUrl: false,
  },
  {
    id: 'compatible_api',
    label: 'Compatible API',
    description: 'OpenRouter · Azure · LiteLLM · any OpenAI-style endpoint',
    provider: 'openai_compatible',
    defaultModel: '',
    needsBaseUrl: true,
  },
  {
    id: 'local_server',
    label: 'Local AI server',
    description: 'Ollama · LM Studio · vLLM on this computer',
    provider: 'openai_compatible',
    defaultModel: 'llama3',
    defaultBaseUrl: 'http://localhost:11434/v1',
    needsBaseUrl: true,
    localhostOnly: true,
  },
]

export function assistantById(id: ByokAssistantId): ByokAssistantDefinition {
  const found = BYOK_ASSISTANTS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown assistant: ${id}`)
  return found
}

export function assistantLabel(id: ByokAssistantId | null): string | null {
  return id ? assistantById(id).label : null
}
