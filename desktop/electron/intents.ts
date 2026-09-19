import type { Intent, IntentContext, IntentId, KnowledgeDescriptor } from '@suhuella/product/types.ts'

/**
 * Intent Resolver — runtime only.
 *
 * Descriptor + immediate context → Intent.
 * Never reads origin. Never persists. Never classifies free text.
 * Connectors emit descriptors; they do not create capabilities or intents.
 */

type IntentDeclaration = {
  id: IntentId
  implemented: boolean
}

const INTENTS: IntentDeclaration[] = [
  { id: 'store_file', implemented: true },
  { id: 'inspect_recommendation', implemented: false },
  { id: 'browse_folder', implemented: false },
  { id: 'refresh_knowledge', implemented: false },
  { id: 'store_attachment', implemented: false },
  { id: 'store_document', implemented: false },
  { id: 'organize_download', implemented: false },
  { id: 'move_existing_file', implemented: false },
  { id: 'rename_file', implemented: false },
  { id: 'organize_project', implemented: false },
  { id: 'summarize_folder', implemented: false },
  { id: 'classify_document', implemented: false },
  { id: 'extract_information', implemented: false },
  { id: 'archive_document', implemented: false },
]

function declaration(id: IntentId): IntentDeclaration | undefined {
  return INTENTS.find((item) => item.id === id)
}

export function listDeclaredIntents(): IntentDeclaration[] {
  return INTENTS.map((item) => ({ ...item }))
}

export function isIntentImplemented(id: IntentId): boolean {
  return declaration(id)?.implemented === true
}

export function resolveIntent(
  _descriptor: KnowledgeDescriptor,
  context: IntentContext = {},
): Intent {
  const kind: IntentId = 'store_file'
  return {
    id: kind,
    kind,
    confidence: 1,
    context: { ...context },
    metadata: {},
  }
}

export function assertIntentKernelFrozen(): void {
  const implemented = INTENTS.filter((item) => item.implemented)
  if (implemented.length !== 1 || implemented[0]?.id !== 'store_file') {
    throw new Error('Intent kernel may only implement store_file')
  }
}
