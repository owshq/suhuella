import type { KnowledgeSetItem, SearchHit } from '../types.ts'
import { PLAN_COMPOSER_PLACEHOLDER as PLAN_PROMPT_PLACEHOLDER } from './organise-copy.ts'
import { knowledgePathFromHitPath, sourceNameFromHit } from './plan-source.ts'

export { PLAN_PROMPT_PLACEHOLDER }

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'from',
  'into',
  'in',
  'on',
  'for',
  'and',
  'or',
  'of',
  'my',
  'this',
  'these',
  'those',
  'folder',
  'folders',
  'file',
  'files',
  'document',
  'documents',
  'move',
  'rename',
  'create',
  'delete',
  'organise',
  'organize',
  'plan',
  'please',
  'with',
  'your',
  'que',
  'los',
  'las',
  'una',
  'unos',
  'para',
  'desde',
  'mueve',
  'mover',
  'renombra',
  'crea',
  'crear',
  'carpeta',
  'carpetas',
  'archivos',
  'documentos',
])

export const PLAN_SCOPE_UNRESOLVED =
  'Nothing matched in the sources SuHuella can see. Open Sources to choose scope.'

export const PLAN_VOICE_LABEL = 'Record voice'
export const PLAN_VOICE_STOP_LABEL = 'Stop voice'
export const PLAN_VOICE_UNAVAILABLE = 'Voice is not available here.'

export const PLAN_SCREEN_LABEL = 'Record screen'
export const PLAN_SCREEN_STOP_LABEL = 'Stop screen'
export const PLAN_SCREEN_UNAVAILABLE = 'Screen recording is not available here.'
export const PLAN_SCREEN_KEPT =
  'Screen recording is ready on this device. Describe what should happen, then Prepare Plan.'

export const PLAN_MODEL_BUILTIN = 'Built-in rules'
/** @deprecated Use PLAN_MODEL_BUILTIN */
export const PLAN_MODEL_ON_DEVICE = PLAN_MODEL_BUILTIN
export const PLAN_MODEL_CONNECT = 'Local model…'
export const PLAN_MODEL_DETECTED_SUFFIX = ' — detected'
export const PLAN_MODEL_LOCAL_REQUIRED = 'Connect a local model in Settings → AI first.'
export const PLAN_MODEL_DESKTOP_ONLY = 'Local models connect in the desktop app (Settings → AI).'
export const PLAN_MODEL_SETTINGS_HINT = 'Add or scan local models in Settings → AI.'
export const PLAN_MODEL_MANUAL_TOGGLE = 'Connect manually'
export const PLAN_MODEL_HELP_LABEL = 'Local model help'

export type PlanAssistantPreference = 'on_device' | 'local'

export const PLAN_LIBRARY_LABEL = 'Saved plans'
export const PLAN_SAVE_LABEL = 'Save plan'
export const PLAN_DUPLICATE_LABEL = 'Duplicate'
export const PLAN_DELETE_RECORD_LABEL = 'Delete plan'
export const PLAN_RUN_LABEL = 'Run'
export const PLAN_PREPARE_LABEL = 'Prepare Plan'

function quotedScopeParts(note: string): string[] {
  return [...note.matchAll(/"([^"]+)"|'([^']+)'/g)]
    .map((match) => match[1] || match[2])
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Significant scope tokens from a prompt. Does not touch the filesystem or the executor. */
export function planScopeSearchTokens(note: string): string[] {
  const quoted = quotedScopeParts(note)
  if (quoted.length > 0) return quoted
  return note
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 6)
}

/** Search text for a prompt. Does not touch the filesystem or the executor. */
export function planScopeSearchText(note: string): string {
  const quoted = quotedScopeParts(note)
  if (quoted.length > 0) return quoted.join(' ')
  return planScopeSearchTokens(note).join(' ')
}

function mergeSearchHits(existing: SearchHit[], incoming: SearchHit[], limit: number): SearchHit[] {
  const seen = new Set(existing.map((hit) => (hit.path ?? hit.id).toLowerCase()))
  const merged = [...existing]
  for (const hit of incoming) {
    const key = (hit.path ?? hit.id).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(hit)
    if (merged.length >= limit) break
  }
  return merged
}

/** Resolve scope from search hits with progressive token relaxation. */
export function resolvePlanScopeHits(
  note: string,
  search: (query: string) => SearchHit[],
  limit = 40,
): KnowledgeSetItem[] {
  const query = planScopeSearchText(note)
  if (!query) return []

  const fullHits = search(query)
  if (fullHits.length > 0) return knowledgeItemsFromSearchHits(fullHits, limit)

  const tokens = planScopeSearchTokens(note)
  if (tokens.length <= 1) return []

  let merged: SearchHit[] = []
  for (const token of tokens) {
    merged = mergeSearchHits(merged, search(token), limit)
    if (merged.length >= limit) break
  }
  return knowledgeItemsFromSearchHits(merged, limit)
}

/** Resolve scope via search with progressive token relaxation. */
export async function resolvePlanScopeFromSearch(
  note: string,
  search: (query: string) => Promise<SearchHit[]>,
  limit = 40,
): Promise<KnowledgeSetItem[]> {
  const query = planScopeSearchText(note)
  if (!query) return []

  const fullHits = await search(query)
  if (fullHits.length > 0) return knowledgeItemsFromSearchHits(fullHits, limit)

  const tokens = planScopeSearchTokens(note)
  if (tokens.length <= 1) return []

  let merged: SearchHit[] = []
  for (const token of tokens) {
    merged = mergeSearchHits(merged, await search(token), limit)
    if (merged.length >= limit) break
  }
  return knowledgeItemsFromSearchHits(merged, limit)
}

export function knowledgeItemsFromSearchHits(hits: SearchHit[], limit = 40): KnowledgeSetItem[] {
  const items: KnowledgeSetItem[] = []
  const seen = new Set<string>()
  for (const hit of hits) {
    if (hit.kind !== 'file' && hit.kind !== 'folder') continue
    const path = knowledgePathFromHitPath(hit.path)?.trim()
    if (!path) continue
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ path, kind: hit.kind })
    if (items.length >= limit) break
  }
  return items
}

export function planScopeFromSearchHits(hits: SearchHit[], limit = 40) {
  return hits
    .filter((hit) => hit.kind === 'file' || hit.kind === 'folder')
    .map((hit) => ({
      path: knowledgePathFromHitPath(hit.path),
      kind: hit.kind as 'file' | 'folder',
      sourceName: sourceNameFromHit(hit),
      sourceAvailable: hit.sourceAvailable !== false,
    }))
    .filter(
      (
        entry,
      ): entry is {
        path: string
        kind: 'file' | 'folder'
        sourceName: string | undefined
        sourceAvailable: boolean
      } => Boolean(entry.path?.trim()),
    )
    .slice(0, limit)
}

export function runPlanScopeChecks(): void {
  const query = planScopeSearchText('Move the invoices from Downloads into Clients')
  if (!query.includes('invoices') || !query.includes('downloads') || !query.includes('clients')) {
    throw new Error('scope query keeps the folder words')
  }
  if (planScopeSearchText('move the files') !== '') {
    throw new Error('a prompt with only verbs does not invent a scope')
  }
  if (!PLAN_PROMPT_PLACEHOLDER.includes('What should happen') || !/confirm/i.test(PLAN_PROMPT_PLACEHOLDER)) {
    throw new Error('composer placeholder states Plan-before-confirm')
  }
  const quoted = planScopeSearchText('plan "Facturas 2024"')
  if (quoted !== 'Facturas 2024') throw new Error('quoted scope is used as written')
  const hits = knowledgeItemsFromSearchHits([
    {
      id: '1',
      kind: 'file',
      title: 'a.pdf',
      subtitle: '',
      path: '/Docs/a.pdf',
      folderPath: '/Docs',
      extension: 'pdf',
      documentFilter: 'pdf',
      lastSeenAt: null,
      matchedOn: ['filename'],
    },
    {
      id: '2',
      kind: 'workflow',
      title: 'Invoices',
      subtitle: '',
      path: null,
      folderPath: null,
      extension: null,
      documentFilter: null,
      lastSeenAt: null,
      matchedOn: ['workflow'],
    },
  ])
  if (hits.length !== 1 || hits[0]?.kind !== 'file') throw new Error('scope keeps files and folders only')
  if (appendVoiceTranscript('Move invoices', 'into Clients') !== 'Move invoices into Clients') {
    throw new Error('voice transcript appends to the prompt')
  }
  if (appendVoiceTranscript('', '  Create a Plan  ') !== 'Create a Plan') {
    throw new Error('voice transcript trims a blank prompt')
  }
  const scoped = planScopeFromSearchHits([
    {
      id: '1',
      kind: 'file',
      title: 'a.pdf',
      subtitle: 'informes',
      path: 'src_demo:invoices/a.pdf',
      folderPath: null,
      extension: 'pdf',
      documentFilter: 'pdf',
      lastSeenAt: null,
      matchedOn: ['filename'],
      sourceName: 'informes',
      sourceAvailable: true,
    },
  ])
  if (scoped[0]?.path !== 'src_demo/invoices/a.pdf' || scoped[0]?.sourceName !== 'informes') {
    throw new Error('scope keeps source metadata from search hits')
  }

  const demoHits: SearchHit[] = [
    {
      id: 'src_dev_demo:invoices/factura-enero.pdf',
      kind: 'file',
      title: 'factura-enero.pdf',
      subtitle: 'dev-data',
      path: 'src_dev_demo:invoices/factura-enero.pdf',
      folderPath: 'invoices',
      extension: 'pdf',
      documentFilter: 'pdf',
      lastSeenAt: null,
      matchedOn: ['filename'],
    },
  ]
  const andSearch = (query: string): SearchHit[] => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return demoHits.filter((hit) => {
      const hay = `${hit.title} ${hit.path ?? ''}`.toLowerCase()
      return tokens.every((token) => hay.includes(token))
    })
  }
  if (andSearch('invoices downloads clients').length !== 0) {
    throw new Error('demo AND search rejects unrelated folder words')
  }
  const relaxed = resolvePlanScopeHits('Move invoices from Downloads into Clients', andSearch)
  if (relaxed.length !== 1 || relaxed[0]?.path !== 'src_dev_demo/invoices/factura-enero.pdf') {
    throw new Error('progressive scope resolves invoices when full query misses')
  }
  const devData = resolvePlanScopeHits('Move invoices in dev-data', andSearch)
  if (devData.length !== 1) {
    throw new Error('dev-data prompt resolves invoice scope')
  }
}

export type PlanSpeechResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

export type PlanSpeechSession = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: PlanSpeechResult) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechCtor = new () => PlanSpeechSession

export function speechRecognitionCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null
  const host = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null
}

export function createPlanSpeechRecognition(lang: string): PlanSpeechSession | null {
  const Ctor = speechRecognitionCtor()
  if (!Ctor) return null
  const session = new Ctor()
  session.lang = lang
  session.continuous = false
  session.interimResults = true
  return session
}

export function transcriptFromSpeechEvent(event: PlanSpeechResult): string {
  const parts: string[] = []
  for (let index = 0; index < event.results.length; index += 1) {
    const piece = event.results[index]?.[0]?.transcript
    if (piece) parts.push(piece)
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function appendVoiceTranscript(current: string, transcript: string): string {
  const next = transcript.trim()
  if (!next) return current
  const base = current.trim()
  if (!base) return next
  return `${base} ${next}`
}
