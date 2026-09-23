import type {
  IndexedLocationSummary,
  OrganisationPlanItem,
  OrganisationPlanPreview,
  SearchHit,
  SuggestedLocation,
} from '../types.ts'
import { planScopeFromSearchHits } from './plan-scope.ts'
import { sameSourceName, wellKnownSources, type WellKnownSource } from './well-known-sources.ts'

export const PLAN_SOURCE_CANDIDATE_ENABLED = true

export const PLAN_SOURCE_NOT_CONNECTED = 'Source not connected'

/** Remote cloud OAuth (OneDrive/Dropbox/Google account) — out of scope; local folder grant only. */
export const PLAN_CLOUD_OAUTH_DEBT =
  'Remote cloud accounts connect via OAuth in a later track. Grant adds the local sync folder only.'

export const PLAN_SCOPE_SOURCE_DOC_PENDING =
  'Connect the named source first. Matching documents there will appear after indexing.'

export type PlanSourceCandidate = {
  id: string
  label: string
  path: string
  grantHint: string
  kind?: SuggestedLocation['kind']
}

type Host = 'browser' | 'electron'

/** Longest phrases first so “google drive” wins over “drive”. */
const SOURCE_PROMPT_ALIASES: Array<{ id: string; phrases: string[] }> = [
  { id: 'google_drive', phrases: ['google drive', 'google-drive', 'googledrive'] },
  { id: 'icloud', phrases: ['icloud drive', 'icloud'] },
  { id: 'onedrive', phrases: ['one drive', 'onedrive'] },
  { id: 'dropbox', phrases: ['dropbox'] },
  { id: 'downloads', phrases: ['downloads', 'descargas'] },
  { id: 'documents', phrases: ['documents', 'documentos'] },
  { id: 'desktop', phrases: ['desktop', 'escritorio'] },
  { id: 'pictures', phrases: ['pictures', 'photos', 'fotos', 'imagenes', 'imágenes'] },
  { id: 'music', phrases: ['music', 'musica', 'música'] },
  { id: 'movies', phrases: ['movies', 'peliculas', 'películas'] },
  { id: 'videos', phrases: ['videos'] },
  { id: 'developer', phrases: ['developer'] },
  { id: 'applications', phrases: ['applications', 'apps'] },
  { id: 'shared', phrases: ['shared', 'public', 'compartido'] },
  { id: 'usb', phrases: ['usb drive', 'usb'] },
  { id: 'external', phrases: ['external ssd', 'external drive', 'external'] },
  { id: 'nas', phrases: ['nas'] },
]

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function pathsMatch(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right)
}

function mentionedInPrompt(note: string, phrase: string): boolean {
  const trimmed = phrase.trim()
  if (!trimmed) return false
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(note)
}

function grantHintFor(host: Host, place: SuggestedLocation, known?: WellKnownSource): string {
  if (host === 'browser') return known?.token ?? place.path
  if (place.path.startsWith('suhuella:')) return place.path
  return place.path
}

function isIndexed(candidate: PlanSourceCandidate, indexed: IndexedLocationSummary[]): boolean {
  return indexed.some(
    (location) =>
      pathsMatch(location.path, candidate.path) ||
      sameSourceName(location.name, candidate.label) ||
      (location.catalogKey ? pathsMatch(location.catalogKey, candidate.grantHint) : false),
  )
}

function catalogKey(place: SuggestedLocation): string {
  return place.id.toLowerCase()
}

/** Merge OS suggested folders with well-known catalog entries missing on this host. */
export function mergeSuggestedCatalog(
  host: Host,
  platform: string,
  suggested: SuggestedLocation[],
): SuggestedLocation[] {
  const merged = new Map<string, SuggestedLocation>()
  for (const place of suggested) {
    if (!place.path?.trim()) continue
    merged.set(catalogKey(place), place)
  }
  for (const known of wellKnownSources(platform)) {
    const key = known.id.toLowerCase()
    const existing = merged.get(key)
    if (existing) {
      merged.set(key, {
        ...existing,
        label: existing.label || known.label,
        kind: existing.kind ?? known.kind,
      })
      continue
    }
    merged.set(key, {
      id: known.id,
      label: known.label,
      path: known.token,
      exists: host === 'browser',
      kind: known.kind,
    })
  }
  return [...merged.values()]
}

function findCatalogPlace(catalog: SuggestedLocation[], id: string): SuggestedLocation | undefined {
  const key = id.toLowerCase()
  return catalog.find((place) => catalogKey(place) === key || place.id.toLowerCase().includes(key))
}

/** Source ids explicitly named in the prompt (Downloads, OneDrive, …). */
export function mentionedSourceIdsInPrompt(note: string): string[] {
  return matchedSourceIds(note)
}

function matchedSourceIds(note: string): string[] {
  const lower = note.toLowerCase()
  const matches: Array<{ id: string; length: number; index: number }> = []
  for (const entry of SOURCE_PROMPT_ALIASES) {
    for (const phrase of entry.phrases) {
      const index = lower.indexOf(phrase.toLowerCase())
      if (index >= 0) {
        matches.push({ id: entry.id, length: phrase.length, index })
      }
    }
  }
  matches.sort((left, right) => right.length - left.length || left.index - right.index)
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const match of matches) {
    if (seen.has(match.id)) continue
    seen.add(match.id)
    ordered.push(match.id)
  }
  return ordered
}

function candidateFromPlace(
  place: SuggestedLocation,
  host: Host,
  platform: string,
): PlanSourceCandidate | null {
  if (!place.path?.trim()) return null
  if (host !== 'browser' && place.exists === false) return null
  const known = wellKnownSources(platform).find((entry) => entry.id === place.id)
  return {
    id: place.id,
    label: place.label,
    path: host === 'browser' && known ? known.token : place.path,
    grantHint: grantHintFor(host, place, known),
    kind: place.kind,
  }
}

function volumeCandidates(note: string, catalog: SuggestedLocation[], host: Host): PlanSourceCandidate[] {
  const results: PlanSourceCandidate[] = []
  for (const place of catalog) {
    if (place.kind !== 'volume') continue
    if (!place.path?.trim() || place.exists === false) continue
    if (!mentionedInPrompt(note, place.label)) continue
    const candidate = candidateFromPlace(place, host, 'darwin')
    if (candidate) results.push(candidate)
  }
  return results
}

/**
 * Resolve never-indexed folders the host can see that the prompt names explicitly.
 */
export function resolvePlanSourceCandidatesFromPrompt(
  note: string,
  suggested: SuggestedLocation[],
  indexed: IndexedLocationSummary[],
  host: Host,
  platform = 'darwin',
): PlanSourceCandidate[] {
  if (!PLAN_SOURCE_CANDIDATE_ENABLED) return []
  const catalog = mergeSuggestedCatalog(host, platform, suggested)
  const results: PlanSourceCandidate[] = []
  const seen = new Set<string>()

  for (const id of matchedSourceIds(note)) {
    const place = findCatalogPlace(catalog, id)
    if (!place) continue
    const candidate = candidateFromPlace(place, host, platform)
    if (!candidate || isIndexed(candidate, indexed)) continue
    const key = `${candidate.grantHint}::${candidate.label}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(candidate)
  }

  for (const candidate of volumeCandidates(note, catalog, host)) {
    if (isIndexed(candidate, indexed)) continue
    const key = `${candidate.grantHint}::${candidate.label}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(candidate)
  }

  return results
}

/** @deprecated Use resolvePlanSourceCandidatesFromPrompt — returns first match for legacy checks. */
export function resolvePlanSourceCandidateSpike(
  note: string,
  suggested: SuggestedLocation[],
  indexed: IndexedLocationSummary[],
  host: Host,
  platform = 'darwin',
): PlanSourceCandidate | null {
  return resolvePlanSourceCandidatesFromPrompt(note, suggested, indexed, host, platform)[0] ?? null
}

export function candidateAlreadyInSearchScope(candidate: PlanSourceCandidate, hits: SearchHit[]): boolean {
  if (hits.length === 0) return false
  const scoped = planScopeFromSearchHits(hits)
  return scoped.some((entry) => {
    if (entry.sourceName && sameSourceName(entry.sourceName, candidate.label)) return true
    const path = entry.path?.toLowerCase() ?? ''
    const candidatePath = normalizePath(candidate.path)
    return (
      path.includes(`/${candidate.id.toLowerCase()}/`) ||
      path.startsWith(`${candidate.id.toLowerCase()}/`) ||
      (candidatePath.length > 0 && path.includes(candidatePath.replace(/^suhuella:/, '')))
    )
  })
}

export function filterCandidatesForComposer(
  candidates: PlanSourceCandidate[],
  hits: SearchHit[],
  indexed: IndexedLocationSummary[],
): PlanSourceCandidate[] {
  return candidates.filter(
    (candidate) => !isIndexed(candidate, indexed) && !candidateAlreadyInSearchScope(candidate, hits),
  )
}

export function buildCandidatePlanItem(candidate: PlanSourceCandidate): OrganisationPlanItem {
  const inlineAction = `Grant access to ${candidate.label}`
  return {
    action: 'none',
    currentPath: `candidate:${candidate.id}`,
    proposedPath: null,
    explanation: `${inlineAction} before SuHuella can plan changes there.`,
    status: 'source_needs_access',
    warnings: [`${inlineAction} to include this source in the plan.`],
    reviewGroup: 'skipped',
    selected: false,
    fileName: `${candidate.label} (not connected)`,
    score: null,
    confidenceLabel: null,
    alternatives: [],
    skipReason: PLAN_SOURCE_NOT_CONNECTED,
    sourceName: candidate.label,
    candidateSourcePath: candidate.path,
    candidateSourceGrantHint: candidate.grantHint,
  }
}

export function buildCandidatePlanPreview(
  candidates: PlanSourceCandidate[],
  options?: { documentHintPending?: boolean },
): OrganisationPlanPreview {
  const connectCopy =
    candidates.length === 1
      ? 'Connect the source SuHuella identified in your prompt, then prepare the plan again.'
      : 'Connect the sources SuHuella identified in your prompt, then prepare the plan again.'
  return {
    simulated: true,
    message: options?.documentHintPending ? PLAN_SCOPE_SOURCE_DOC_PENDING : connectCopy,
    knowledgeSet: { items: [] },
    items: candidates.map(buildCandidatePlanItem),
  }
}

export function indexedLocationForSourceId(
  sourceId: string,
  catalog: SuggestedLocation[],
  indexed: IndexedLocationSummary[],
): IndexedLocationSummary | undefined {
  const place = findCatalogPlace(catalog, sourceId)
  if (!place) return undefined
  return indexed.find(
    (location) =>
      pathsMatch(location.path, place.path) ||
      sameSourceName(location.name, place.label) ||
      (location.catalogKey ? pathsMatch(location.catalogKey, place.path) : false),
  )
}

export function searchHitBelongsToSource(
  hit: SearchHit,
  sourceId: string,
  catalog: SuggestedLocation[],
  indexed: IndexedLocationSummary[],
): boolean {
  const place = findCatalogPlace(catalog, sourceId)
  if (!place) return false
  const location = indexedLocationForSourceId(sourceId, catalog, indexed)
  const haystack = [hit.title, hit.path, hit.subtitle, hit.folderPath, hit.sourceName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (hit.sourceName && sameSourceName(hit.sourceName, place.label)) return true
  const sourceKey = sourceId.toLowerCase().replace(/_/g, '-')
  if (haystack.includes(sourceKey) || haystack.includes(place.label.toLowerCase())) return true
  if (!location) return false
  const root = normalizePath(location.path)
  const hitPath = normalizePath(hit.path ?? hit.id)
  return hitPath.startsWith(`${root}/`) || hitPath === root || hitPath.includes(`/${sourceKey}/`)
}

export function mergeCandidatesIntoPreview(
  preview: OrganisationPlanPreview,
  candidates: PlanSourceCandidate[],
): OrganisationPlanPreview {
  if (candidates.length === 0) return preview
  const seen = new Set(
    preview.items.flatMap((item) => [
      item.candidateSourceGrantHint?.toLowerCase(),
      item.sourceName?.replace(/\s+/g, '').toLowerCase(),
    ]),
  )
  const additions = candidates
    .filter((candidate) => {
      const grant = candidate.grantHint.toLowerCase()
      const label = candidate.label.replace(/\s+/g, '').toLowerCase()
      return !seen.has(grant) && !seen.has(label)
    })
    .map(buildCandidatePlanItem)
  if (additions.length === 0) return preview
  return {
    ...preview,
    items: [...preview.items, ...additions],
  }
}

export function isPlanSourceCandidateItem(item: OrganisationPlanItem): boolean {
  return item.status === 'source_needs_access' && Boolean(item.candidateSourceGrantHint?.trim())
}

export function planCandidateInlineAction(item: OrganisationPlanItem): string | null {
  if (!isPlanSourceCandidateItem(item)) return null
  const label = item.sourceName?.trim() || 'Source'
  const hint = item.warnings.find((warning) => warning.startsWith('Grant access to'))
  if (hint) return hint.replace(/ to include this source in the plan\.?$/, '')
  return `Grant access to ${label}`
}

export function runPlanSourceCandidateChecks(): void {
  const suggested: SuggestedLocation[] = [
    {
      id: 'onedrive',
      label: 'OneDrive',
      path: '/Users/demo/OneDrive',
      exists: true,
      kind: 'cloud_folder',
    },
    {
      id: 'downloads',
      label: 'Downloads',
      path: '/Users/demo/Downloads',
      exists: true,
      kind: 'user_folder',
    },
    {
      id: 'documents',
      label: 'Documents',
      path: '/Users/demo/Documents',
      exists: true,
      kind: 'user_folder',
    },
    {
      id: 'volume-backup',
      label: 'Backup',
      path: '/Volumes/Backup',
      exists: true,
      kind: 'volume',
    },
  ]
  const indexed: IndexedLocationSummary[] = [
    {
      path: '/Users/demo/Documents',
      name: 'Documents',
      lastIndexed: null,
      folderCount: 1,
      fileCount: 2,
      status: 'ready',
      usefulness: 'useful',
      exists: true,
    },
  ]

  const onedriveOnly = resolvePlanSourceCandidatesFromPrompt(
    'Move invoices from OneDrive into Clients',
    suggested,
    indexed,
    'electron',
  )
  if (onedriveOnly.length !== 1 || onedriveOnly[0]?.label !== 'OneDrive') {
    throw new Error('composer resolves OneDrive when mentioned and not indexed')
  }

  const multi = resolvePlanSourceCandidatesFromPrompt(
    'Move files from Downloads and OneDrive into Documents',
    suggested,
    indexed,
    'electron',
  )
  if (multi.length !== 2 || !multi.some((entry) => entry.label === 'Downloads')) {
    throw new Error('composer resolves multiple named sources')
  }

  if (resolvePlanSourceCandidatesFromPrompt('Move invoices in Documents', suggested, indexed, 'electron').length !== 0) {
    throw new Error('composer ignores already-indexed folders')
  }

  const volume = resolvePlanSourceCandidatesFromPrompt(
    'Organise files on Backup',
    suggested,
    indexed,
    'electron',
  )
  if (volume.length !== 1 || volume[0]?.label !== 'Backup') {
    throw new Error('composer resolves mounted volumes by label')
  }

  const browser = resolvePlanSourceCandidatesFromPrompt('Organise OneDrive invoices', [], [], 'browser')
  if (!browser.some((entry) => entry.grantHint === 'suhuella:onedrive')) {
    throw new Error('browser composer falls back to well-known grant tokens')
  }

  const hits: SearchHit[] = [
    {
      id: 'src_demo:invoices/a.pdf',
      kind: 'file',
      title: 'a.pdf',
      subtitle: 'downloads',
      path: 'src_demo:invoices/a.pdf',
      folderPath: null,
      extension: 'pdf',
      documentFilter: 'pdf',
      lastSeenAt: null,
      matchedOn: ['filename'],
      sourceName: 'Downloads',
    },
  ]
  const filtered = filterCandidatesForComposer(
    resolvePlanSourceCandidatesFromPrompt('Move OneDrive invoices', suggested, indexed, 'electron'),
    hits,
    indexed,
  )
  if (filtered.length !== 1 || filtered[0]?.label !== 'OneDrive') {
    throw new Error('composer drops candidates already covered by search hits')
  }

  const item = buildCandidatePlanItem(onedriveOnly[0]!)
  if (item.status !== 'source_needs_access' || item.sourceId) {
    throw new Error('candidate items have no sourceId and use source_needs_access')
  }
  if (planCandidateInlineAction(item) !== 'Grant access to OneDrive') {
    throw new Error('candidate inline action matches Grant access pattern')
  }
}
