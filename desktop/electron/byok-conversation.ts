import type { ByokConversationMessage } from '@suhuella/product/types.ts'

/**
 * INTELLIGENCE-MODEL-001 — BYOK conversation
 *
 * Local · temporal · discardable. Never Activity. Never Knowledge. Never a Workflow.
 * AI CONVERSATIONS ARE EPHEMERAL. KNOWLEDGE IS EXPLICIT.
 *
 * Memory of the assistant, not of the product. Never written to disk.
 */

const MAX_MESSAGES = 20

let messages: ByokConversationMessage[] = []

export function listByokConversation(): ByokConversationMessage[] {
  return messages.map((item) => ({ ...item }))
}

export function appendByokConversation(
  userText: string,
  assistantText: string,
): ByokConversationMessage[] {
  const user = userText.trim().slice(0, 500)
  const assistant = assistantText.trim().slice(0, 4000)
  if (!user || !assistant) return listByokConversation()

  const next: ByokConversationMessage[] = [
    ...messages,
    { role: 'user', text: user },
    { role: 'assistant', text: assistant },
  ]
  messages = next.slice(-MAX_MESSAGES)
  return listByokConversation()
}

export function clearByokConversation(): ByokConversationMessage[] {
  messages = []
  return []
}
