import type { AppHost } from '../types.ts'
import { productCopy } from './product-copy.ts'

/** Where BYOK API keys live today — copy must match implementation. */
export function byokKeyStorageNote(host: AppHost | null | undefined): string {
  if (host === 'browser') {
    return productCopy(
      'Cloud assistants connect in the desktop app. The browser cannot store provider keys securely on this device.',
    )
  }
  return productCopy(
    'Your API key is encrypted with your operating system (Keychain on Mac, Credential Manager on Windows) and never sent to SuHuella.',
  )
}

export function byokConnectAvailable(host: AppHost | null | undefined): boolean {
  return host !== 'browser'
}

export const BUILT_IN_RULES_TITLE = 'Built-in rules'
export const BUILT_IN_RULES_BADGE = 'No AI model'
export const BUILT_IN_RULES_BODY =
  'Deterministic organisation on this device — move, rename, and create folders using rules. No language model runs. Always available.'

export const LOCAL_AI_SECTION_TITLE = 'Local AI server'
export const LOCAL_AI_SECTION_LEAD =
  'Optional. Connects to Ollama, LM Studio, or another OpenAI-compatible server running on this computer — not a model inside SuHuella.'

export const CLOUD_AI_SECTION_TITLE = 'Cloud assistants'

export const BYOK_OPTIONAL_NOTE = productCopy(
  'Core organisation works without connecting an AI provider. Plans, moves, and renames use built-in rules on this device.',
)
