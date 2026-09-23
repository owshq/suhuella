import type { IndexedLocationSummary, KnowledgeSetItem, SearchHit, SuggestedLocation } from '../types.ts'
import {
  documentHintIdsInPrompt,
  documentHintSearchTerms,
  searchHitMatchesDocumentHints,
} from './document-hints.ts'
import {
  filterCandidatesForComposer,
  indexedLocationForSourceId,
  mergeSuggestedCatalog,
  mentionedSourceIdsInPrompt,
  resolvePlanSourceCandidatesFromPrompt,
  searchHitBelongsToSource,
  type PlanSourceCandidate,
} from './plan-source-candidate.ts'
import {
  knowledgeItemsFromSearchHits,
  planScopeSearchText,
  planScopeSearchTokens,
} from './plan-scope.ts'

export type PlanComposerScope = {
  items: KnowledgeSetItem[]
  hits: SearchHit[]
  candidates: PlanSourceCandidate[]
  /** Named source not indexed yet while prompt also names a document type. */
  strictSourceDocumentPending: boolean
  documentHintIds: ReturnType<typeof documentHintIdsInPrompt>
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

function filterHitsToIndexedSources(
  hits: SearchHit[],
  sourceIds: string[],
  catalog: SuggestedLocation[],
  indexed: IndexedLocationSummary[],
): SearchHit[] {
  if (sourceIds.length === 0) return hits
  return hits.filter((hit) =>
    sourceIds.some((sourceId) => searchHitBelongsToSource(hit, sourceId, catalog, indexed)),
  )
}

export async function resolvePlanComposerScope(
  note: string,
  search: (query: string) => Promise<SearchHit[]>,
  context: {
    suggested: SuggestedLocation[]
    indexed: IndexedLocationSummary[]
    host: 'browser' | 'electron'
    platform?: string
  },
  limit = 40,
): Promise<PlanComposerScope> {
  const host = context.host
  const platform = context.platform ?? 'darwin'
  const catalog = mergeSuggestedCatalog(host, platform, context.suggested)
  const mentionedSources = mentionedSourceIdsInPrompt(note)
  const documentHintIds = documentHintIdsInPrompt(note)
  const candidates = resolvePlanSourceCandidatesFromPrompt(
    note,
    context.suggested,
    context.indexed,
    host,
    platform,
  )
  const unindexedSourceIds = candidates.map((candidate) => candidate.id)
  const indexedSourceIds = mentionedSources.filter(
    (sourceId) =>
      !unindexedSourceIds.includes(sourceId) &&
      Boolean(indexedLocationForSourceId(sourceId, catalog, context.indexed)),
  )
  const strictSourceDocumentPending = unindexedSourceIds.length > 0 && documentHintIds.length > 0

  let hits: SearchHit[] = []

  if (!strictSourceDocumentPending) {
    if (documentHintIds.length > 0) {
      for (const term of documentHintSearchTerms(documentHintIds)) {
        hits = mergeSearchHits(hits, await search(term), limit)
      }
    } else {
      const query = planScopeSearchText(note)
      if (query) {
        hits = await search(query)
      }
      if (hits.length === 0 && query) {
        const tokens = planScopeSearchTokens(note)
        for (const token of tokens) {
          hits = mergeSearchHits(hits, await search(token), limit)
          if (hits.length >= limit) break
        }
      }
    }

    if (documentHintIds.length > 0) {
      hits = hits.filter((hit) => searchHitMatchesDocumentHints(hit, documentHintIds))
    }
    if (indexedSourceIds.length > 0) {
      hits = filterHitsToIndexedSources(hits, indexedSourceIds, catalog, context.indexed)
    }
  }

  const filteredCandidates = filterCandidatesForComposer(candidates, hits, context.indexed)
  const items = knowledgeItemsFromSearchHits(hits, limit)

  return {
    items,
    hits,
    candidates: filteredCandidates,
    strictSourceDocumentPending,
    documentHintIds,
  }
}

export function runPlanComposerScopeChecks(): void {
  const catalog = mergeSuggestedCatalog('electron', 'darwin', [
    {
      id: 'downloads',
      label: 'Downloads',
      path: '/Users/demo/Downloads',
      exists: true,
      kind: 'user_folder',
    },
  ])
  const indexed: IndexedLocationSummary[] = [
    {
      path: '/Users/demo/Downloads',
      name: 'Downloads',
      lastIndexed: null,
      folderCount: 1,
      fileCount: 1,
      status: 'ready',
      usefulness: 'useful',
      exists: true,
    },
  ]
  const docsHit: SearchHit = {
    id: 'file:/Users/demo/Documents/Invoice_ACME.pdf',
    kind: 'file',
    title: 'Invoice_ACME.pdf',
    subtitle: 'Documents',
    path: '/Users/demo/Documents/Invoice_ACME.pdf',
    folderPath: '/Users/demo/Documents',
    extension: 'pdf',
    documentFilter: 'pdf',
    lastSeenAt: null,
    matchedOn: ['filename'],
  }
  const downloadsHit: SearchHit = {
    id: 'file:/Users/demo/Downloads/Invoice_March.pdf',
    kind: 'file',
    title: 'Invoice_March.pdf',
    subtitle: 'Downloads',
    path: '/Users/demo/Downloads/Invoice_March.pdf',
    folderPath: '/Users/demo/Downloads',
    extension: 'pdf',
    documentFilter: 'pdf',
    lastSeenAt: null,
    matchedOn: ['filename'],
    sourceName: 'Downloads',
  }

  const unindexedCandidates = resolvePlanSourceCandidatesFromPrompt(
    'Organise OneDrive invoices',
    [{ id: 'onedrive', label: 'OneDrive', path: '/Users/demo/OneDrive', exists: true }],
    indexed,
    'electron',
  )
  const docHints = documentHintIdsInPrompt('Organise OneDrive invoices')
  if (unindexedCandidates.length === 0 || !docHints.includes('invoice')) {
    throw new Error('fixture resolves unindexed OneDrive and invoice hint')
  }
  if (!searchHitMatchesDocumentHints(docsHit, docHints) || !searchHitMatchesDocumentHints(downloadsHit, docHints)) {
    throw new Error('invoice hint matches invoice filenames')
  }
  const filtered = filterHitsToIndexedSources([docsHit, downloadsHit], ['downloads'], catalog, indexed)
  if (filtered.length !== 1 || filtered[0]?.path !== downloadsHit.path) {
    throw new Error('indexed source filter keeps downloads invoices only')
  }
}
