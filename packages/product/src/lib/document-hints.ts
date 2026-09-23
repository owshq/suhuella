import type { SearchHit } from '../types.ts'
import { foldSearchText } from './search-text.ts'

export type DocumentHintId =
  | 'invoice'
  | 'contract'
  | 'tax'
  | 'client'
  | 'proposal'
  | 'grant'
  | 'receipt'
  | 'budget'
  | 'cv'

export type DocumentHintGroup = {
  id: DocumentHintId
  topic: string
  terms: string[]
}

/** Shared with recommendation engine — composer scope uses the same vocabulary. */
export const DOCUMENT_HINT_GROUPS: DocumentHintGroup[] = [
  {
    id: 'invoice',
    topic: 'finance',
    terms: ['invoice', 'invoices', 'factura', 'facturas', 'factures', 'facturacion', 'facturación'],
  },
  {
    id: 'contract',
    topic: 'legal',
    terms: ['contract', 'contracts', 'contrato', 'contratos', 'contracte', 'contractes'],
  },
  {
    id: 'tax',
    topic: 'finance',
    terms: ['tax', 'impuesto', 'impuestos', 'impost', 'impostos', 'iva'],
  },
  {
    id: 'client',
    topic: 'client',
    terms: ['client', 'clients', 'cliente', 'clientes'],
  },
  {
    id: 'proposal',
    topic: 'project',
    terms: ['proposal', 'proposals', 'propuesta', 'propuestas', 'proposta', 'propostes'],
  },
  {
    id: 'grant',
    topic: 'finance',
    terms: ['grant', 'grants', 'subvencion', 'subvención', 'subvencions', 'subvenció', 'subvencio'],
  },
  {
    id: 'receipt',
    topic: 'finance',
    terms: ['receipt', 'receipts', 'recibo', 'recibos', 'rebut', 'rebuts'],
  },
  {
    id: 'budget',
    topic: 'finance',
    terms: ['budget', 'budgets', 'presupuesto', 'presupuestos', 'pressupost', 'pressupostos'],
  },
  {
    id: 'cv',
    topic: 'personal',
    terms: ['cv', 'resume', 'curriculum'],
  },
]

const HINT_BY_ID = new Map(DOCUMENT_HINT_GROUPS.map((group) => [group.id, group]))

const PROMPT_HINT_ALIASES: Array<{ id: DocumentHintId; phrases: string[] }> = DOCUMENT_HINT_GROUPS.map(
  (group) => ({
    id: group.id,
    phrases: [...group.terms].sort((left, right) => right.length - left.length),
  }),
)

function foldMatchText(value: string): string {
  return foldSearchText(value.replace(/[_-]+/g, ' '))
}

function phraseInPrompt(note: string, phrase: string): boolean {
  const trimmed = phrase.trim()
  if (!trimmed) return false
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(note)
}

/** Document categories explicitly named in the prompt (longest phrase wins). */
export function documentHintIdsInPrompt(note: string): DocumentHintId[] {
  const matches: Array<{ id: DocumentHintId; length: number }> = []
  for (const entry of PROMPT_HINT_ALIASES) {
    for (const phrase of entry.phrases) {
      if (phraseInPrompt(note, phrase)) {
        matches.push({ id: entry.id, length: phrase.length })
      }
    }
  }
  matches.sort((left, right) => right.length - left.length)
  const seen = new Set<DocumentHintId>()
  const ordered: DocumentHintId[] = []
  for (const match of matches) {
    if (seen.has(match.id)) continue
    seen.add(match.id)
    ordered.push(match.id)
  }
  return ordered
}

/** Search terms for a hint, including singular stems so “invoices” also finds `Invoice.pdf`. */
export function documentHintSearchTerms(hintIds: DocumentHintId[]): string[] {
  const terms = new Set<string>()
  for (const id of hintIds) {
    const group = HINT_BY_ID.get(id)
    if (!group) continue
    for (const term of group.terms) {
      terms.add(term)
      if (term.length > 3 && term.endsWith('s')) {
        terms.add(term.slice(0, -1))
      }
    }
  }
  return [...terms]
}

export function textMatchesDocumentHint(text: string, hintId: DocumentHintId): boolean {
  const group = HINT_BY_ID.get(hintId)
  if (!group) return false
  const folded = foldMatchText(text)
  return group.terms.some((term) => {
    const needle = foldSearchText(term)
    if (folded.includes(needle)) return true
    if (term.length > 3 && term.endsWith('s')) {
      return folded.includes(needle.slice(0, -1))
    }
    return false
  })
}

export function fileNameMatchesDocumentHint(fileName: string, hintId: DocumentHintId): boolean {
  return textMatchesDocumentHint(fileName, hintId)
}

export function searchHitMatchesDocumentHints(hit: SearchHit, hintIds: DocumentHintId[]): boolean {
  if (hintIds.length === 0) return true
  const haystack = [hit.title, hit.path, hit.subtitle, hit.folderPath].filter(Boolean).join(' ')
  return hintIds.some((id) => textMatchesDocumentHint(haystack, id))
}

export function runDocumentHintChecks(): void {
  if (!documentHintIdsInPrompt('Organise OneDrive invoices').includes('invoice')) {
    throw new Error('prompt invoice vocabulary resolves invoice hint')
  }
  if (!fileNameMatchesDocumentHint('Invoice_ACME.pdf', 'invoice')) {
    throw new Error('invoice hint matches singular invoice filenames')
  }
  if (!fileNameMatchesDocumentHint('Receipt_March.pdf', 'receipt')) {
    throw new Error('receipt hint matches receipt filenames')
  }
  if (!documentHintSearchTerms(['invoice']).includes('invoice')) {
    throw new Error('invoice search terms include singular stem')
  }
}
