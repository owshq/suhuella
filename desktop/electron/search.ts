import path from 'node:path'
import type {
  ActivityRun,
  FolderIndex,
  IndexedFolderEntry,
  SearchDocumentFilter,
  SearchHit,
  SearchHitKind,
  SearchMatchField,
  SearchQuery,
  SearchResults,
  Workflow,
} from '../src/types.ts'

const MAX_HITS = 40
const MAX_QUERY = 200

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'tif',
  'tiff',
  'bmp',
  'svg',
  'ico',
  'raw',
])

const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'dmg', 'iso'])

const TYPE_WORDS: Record<Exclude<SearchDocumentFilter, 'all'>, string[]> = {
  pdf: ['pdf', 'pdfs'],
  docx: ['docx', 'doc', 'word'],
  images: ['image', 'images', 'photo', 'photos', 'picture', 'pictures', 'jpg', 'jpeg', 'png'],
  archives: ['archive', 'archives', 'zip', 'rar'],
  other: ['other'],
}

const RECENT_WORDS = new Set(['recent', 'recents', 'latest', 'new'])
const WORKFLOW_WORDS = new Set(['workflow', 'workflows'])
const HISTORY_WORDS = new Set(['activity', 'history', 'recommended', 'recommendation', 'organised', 'organized'])

export type SearchCorpus = {
  index: FolderIndex
  recents: string[]
  activity: ActivityRun[]
  workflows: Workflow[]
}

type DraftHit = SearchHit & {
  score: number
  typeFilters: Set<Exclude<SearchDocumentFilter, 'all'>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isSearchFilter(value: unknown): value is SearchDocumentFilter {
  return value === 'all' || value === 'pdf' || value === 'docx' || value === 'images' || value === 'archives' || value === 'other'
}

export function normalizeSearchQuery(value: unknown): SearchQuery {
  if (typeof value === 'string') {
    return { text: value.slice(0, MAX_QUERY), filter: 'all' }
  }
  if (!isRecord(value)) {
    return { text: '', filter: 'all' }
  }
  const text = typeof value.text === 'string' ? value.text : typeof value.query === 'string' ? value.query : ''
  return {
    text: text.slice(0, MAX_QUERY),
    filter: isSearchFilter(value.filter) ? value.filter : 'all',
  }
}

export function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

export function documentFilterOf(extension: string | null | undefined): Exclude<SearchDocumentFilter, 'all'> {
  const ext = (extension ?? '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (IMAGE_EXTENSIONS.has(ext)) return 'images'
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archives'
  return 'other'
}

function baseName(target: string): string {
  return target.split(/[/\\]/).filter(Boolean).at(-1) ?? target
}

function folderLabel(folderPath: string): string {
  const parts = folderPath.split(/[/\\]+/).filter(Boolean)
  if (parts.length === 0) return folderPath
  if (parts.length === 1) return parts[0]
  return `${parts.at(-2)} / ${parts.at(-1)}`
}

function joinFile(folderPath: string, fileName: string): string {
  return path.join(folderPath, fileName)
}

function normalizeKey(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase()
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.]+/i)
    .map((token) => token.replace(/^\./, ''))
    .filter((token) => token.length > 0)
}

function uniqueFields(fields: SearchMatchField[]): SearchMatchField[] {
  return [...new Set(fields)]
}

function activityTitle(run: ActivityRun): string {
  if (run.trigger === 'undo') return `Undo #${run.runNumber}`
  if (run.workflowName) return run.workflowName
  return `Organise #${run.runNumber}`
}

function recencyBoost(iso: string | null, now: number): number {
  if (!iso) return 0
  const age = now - Date.parse(iso)
  if (!Number.isFinite(age) || age < 0) return 0
  const days = age / 86_400_000
  if (days < 1) return 8
  if (days < 7) return 5
  if (days < 30) return 2
  return 0
}

function typeFromToken(token: string): Exclude<SearchDocumentFilter, 'all'> | null {
  for (const [filter, words] of Object.entries(TYPE_WORDS) as Array<
    [Exclude<SearchDocumentFilter, 'all'>, string[]]
  >) {
    if (words.includes(token)) return filter
  }
  return null
}

function containsToken(haystack: string, token: string): 'exact' | 'prefix' | 'includes' | null {
  const value = haystack.toLowerCase()
  if (!token) return null
  if (value === token) return 'exact'
  if (value.startsWith(token)) return 'prefix'
  if (value.includes(token)) return 'includes'
  return null
}

function tokenScore(kind: 'exact' | 'prefix' | 'includes' | null, weight: number): number {
  if (kind === 'exact') return weight
  if (kind === 'prefix') return Math.round(weight * 0.75)
  if (kind === 'includes') return Math.round(weight * 0.5)
  return 0
}

function draftHit(partial: Omit<DraftHit, 'score' | 'typeFilters' | 'matchedOn'> & {
  matchedOn?: SearchMatchField[]
  typeFilters?: Array<Exclude<SearchDocumentFilter, 'all'>>
}): DraftHit {
  const documentFilter = partial.documentFilter
  return {
    ...partial,
    matchedOn: uniqueFields(partial.matchedOn ?? []),
    score: 0,
    typeFilters: new Set(partial.typeFilters ?? (documentFilter ? [documentFilter] : [])),
  }
}

function mergeHit(current: DraftHit, incoming: DraftHit): DraftHit {
  const matchedOn = uniqueFields([...current.matchedOn, ...incoming.matchedOn])
  const typeFilters = new Set([...current.typeFilters, ...incoming.typeFilters])
  return {
    ...current,
    subtitle: current.subtitle.length >= incoming.subtitle.length ? current.subtitle : incoming.subtitle,
    lastSeenAt:
      current.lastSeenAt && incoming.lastSeenAt
        ? Date.parse(current.lastSeenAt) >= Date.parse(incoming.lastSeenAt)
          ? current.lastSeenAt
          : incoming.lastSeenAt
        : current.lastSeenAt ?? incoming.lastSeenAt,
    matchedOn,
    typeFilters,
    workflowId: current.workflowId ?? incoming.workflowId,
    workflowName: current.workflowName ?? incoming.workflowName,
    activityRunId: current.activityRunId ?? incoming.activityRunId,
    score: Math.max(current.score, incoming.score),
  }
}

function putHit(map: Map<string, DraftHit>, hit: DraftHit) {
  const key = `${hit.kind}:${normalizeKey(hit.path ?? hit.id)}`
  const existing = map.get(key)
  map.set(key, existing ? mergeHit(existing, hit) : hit)
}

function folderTypeFilters(folder: IndexedFolderEntry): Array<Exclude<SearchDocumentFilter, 'all'>> {
  return [...new Set(folder.extensions.map((extension) => documentFilterOf(extension)))]
}

function collectHits(corpus: SearchCorpus): DraftHit[] {
  const files = new Map<string, DraftHit>()
  const others: DraftHit[] = []
  const recentKeys = new Set(corpus.recents.map(normalizeKey))

  for (const folder of corpus.index.folders) {
    const types = folderTypeFilters(folder)
    others.push(
      draftHit({
        id: `folder:${folder.absolutePath}`,
        kind: 'folder',
        title: folder.name || folder.folderName || baseName(folder.absolutePath),
        subtitle: folderLabel(folder.absolutePath),
        path: folder.absolutePath,
        folderPath: folder.absolutePath,
        extension: null,
        documentFilter: types.length === 1 ? types[0] : null,
        lastSeenAt: folder.lastModified,
        typeFilters: types,
      }),
    )

    for (const fileName of folder.fileNames) {
      const filePath = joinFile(folder.absolutePath, fileName)
      const extension = extensionOf(fileName)
      putHit(
        files,
        draftHit({
          id: `file:${filePath}`,
          kind: 'file',
          title: fileName,
          subtitle: folderLabel(folder.absolutePath),
          path: filePath,
          folderPath: folder.absolutePath,
          extension: extension || null,
          documentFilter: documentFilterOf(extension),
          lastSeenAt: folder.lastModified,
        }),
      )
    }
  }

  for (const file of corpus.index.files) {
    const filePath = file.absolutePath || file.locator
    const extension = file.extension || extensionOf(file.name)
    putHit(
      files,
      draftHit({
        id: `file:${filePath}`,
        kind: 'file',
        title: file.name,
        subtitle: file.absolutePath ? folderLabel(path.dirname(file.absolutePath)) : file.name,
        path: filePath,
        folderPath: file.absolutePath ? path.dirname(file.absolutePath) : null,
        extension: extension || null,
        documentFilter: documentFilterOf(extension),
        lastSeenAt: file.lastModified ?? null,
      }),
    )
  }

  for (const folderPath of corpus.recents) {
    others.push(
      draftHit({
        id: `recent:${folderPath}`,
        kind: 'recent',
        title: baseName(folderPath),
        subtitle: folderLabel(folderPath),
        path: folderPath,
        folderPath: folderPath,
        extension: null,
        documentFilter: null,
        lastSeenAt: new Date().toISOString(),
        matchedOn: ['recent'],
      }),
    )
  }

  for (const workflow of corpus.workflows) {
    others.push(
      draftHit({
        id: `workflow:${workflow.id}`,
        kind: 'workflow',
        title: workflow.name,
        subtitle: workflow.description || workflow.category || 'Saved workflow',
        path: null,
        folderPath: null,
        extension: null,
        documentFilter: null,
        lastSeenAt: workflow.lastRunAt ?? workflow.updatedAt,
        workflowId: workflow.id,
        workflowName: workflow.name,
      }),
    )

    for (const item of workflow.plan.knowledgeSet.items) {
      if (item.kind !== 'file') continue
      const extension = extensionOf(item.path)
      putHit(
        files,
        draftHit({
          id: `file:${item.path}`,
          kind: 'file',
          title: baseName(item.path),
          subtitle: folderLabel(path.dirname(item.path)),
          path: item.path,
          folderPath: path.dirname(item.path),
          extension: extension || null,
          documentFilter: documentFilterOf(extension),
          lastSeenAt: workflow.lastRunAt ?? workflow.updatedAt,
          workflowId: workflow.id,
          workflowName: workflow.name,
          matchedOn: ['workflow'],
        }),
      )
    }
  }

  for (const run of corpus.activity) {
    others.push(
      draftHit({
        id: `activity:${run.runId}`,
        kind: 'activity',
        title: activityTitle(run),
        subtitle: run.workflowSummary || `${run.summary.moved} moved`,
        path: null,
        folderPath: null,
        extension: null,
        documentFilter: null,
        lastSeenAt: run.completedAt,
        workflowId: run.workflowId,
        workflowName: run.workflowName,
        activityRunId: run.runId,
      }),
    )

    for (const item of run.items) {
      const filePath = item.targetPath || item.sourcePath
      const extension = extensionOf(item.fileName)
      putHit(
        files,
        draftHit({
          id: `file:${filePath}`,
          kind: 'file',
          title: item.fileName,
          subtitle: item.reason || folderLabel(path.dirname(filePath)),
          path: filePath,
          folderPath: path.dirname(filePath),
          extension: extension || null,
          documentFilter: documentFilterOf(extension),
          lastSeenAt: run.completedAt,
          workflowId: run.workflowId,
          workflowName: run.workflowName,
          activityRunId: run.runId,
          matchedOn: ['recommendation'],
        }),
      )
      others.push(
        draftHit({
          id: `recommendation:${run.runId}:${item.sourcePath}`,
          kind: 'recommendation',
          title: item.fileName,
          subtitle: item.reason || activityTitle(run),
          path: filePath,
          folderPath: path.dirname(filePath),
          extension: extension || null,
          documentFilter: documentFilterOf(extension),
          lastSeenAt: run.completedAt,
          workflowId: run.workflowId,
          workflowName: run.workflowName,
          activityRunId: run.runId,
          matchedOn: ['recommendation'],
        }),
      )
    }
  }

  const hits = [...files.values(), ...others]
  for (const hit of hits) {
    if (hit.path && recentKeys.has(normalizeKey(hit.folderPath ?? hit.path))) {
      hit.matchedOn = uniqueFields([...hit.matchedOn, 'recent'])
    }
  }
  return hits
}

function scoreHit(
  hit: DraftHit,
  tokens: string[],
  wantsRecent: boolean,
  wantsWorkflow: boolean,
  wantsHistory: boolean,
  typeFromQuery: Exclude<SearchDocumentFilter, 'all'> | null,
  now: number,
): DraftHit {
  const matchedOn = [...hit.matchedOn]
  let score = 0
  let matchedTokens = 0

  const title = hit.title
  const subtitle = hit.subtitle
  const filePath = hit.path ?? ''
  const folder = hit.folderPath ?? ''
  const extension = hit.extension ?? ''

  for (const token of tokens) {
    const before = score
    const nameMatch = containsToken(title, token)
    if (nameMatch) {
      score += tokenScore(nameMatch, hit.kind === 'file' || hit.kind === 'recommendation' ? 24 : 18)
      matchedOn.push(hit.kind === 'folder' || hit.kind === 'recent' ? 'folder' : 'filename')
    }

    const folderMatch =
      containsToken(folderLabel(folder || filePath), token) ||
      containsToken(folder, token) ||
      containsToken(filePath, token)
    if (folderMatch && !nameMatch) {
      score += tokenScore(folderMatch, 14)
      matchedOn.push('folder')
    }

    if (token === extension || token === `.${extension}`) {
      score += 18
      matchedOn.push('extension')
    }

    const type = typeFromToken(token)
    if (type && (hit.documentFilter === type || hit.typeFilters.has(type))) {
      score += 14
      matchedOn.push('document_type')
    }

    if (hit.workflowName && containsToken(hit.workflowName, token)) {
      score += 16
      matchedOn.push('workflow')
    }
    if (hit.kind === 'workflow' && containsToken(subtitle, token)) {
      score += 10
      matchedOn.push('workflow')
    }
    if ((hit.kind === 'recommendation' || hit.kind === 'activity') && containsToken(subtitle, token)) {
      score += 12
      matchedOn.push('recommendation')
    }
    if (score > before) matchedTokens += 1
  }

  if (tokens.length > 0 && matchedTokens === 0) {
    return { ...hit, score: 0, matchedOn: uniqueFields(matchedOn) }
  }

  score += recencyBoost(hit.lastSeenAt, now)
  if (hit.kind === 'recent' || matchedOn.includes('recent')) score += 3
  if (wantsRecent && (hit.kind === 'recent' || matchedOn.includes('recent'))) {
    score += 16
    matchedOn.push('recent')
  }
  if (wantsWorkflow && (hit.kind === 'workflow' || hit.workflowId)) {
    score += 16
    matchedOn.push('workflow')
  }
  if (wantsHistory && (hit.kind === 'activity' || hit.kind === 'recommendation' || hit.activityRunId)) {
    score += 16
    matchedOn.push('recommendation')
  }
  if (typeFromQuery && (hit.documentFilter === typeFromQuery || hit.typeFilters.has(typeFromQuery))) {
    score += 10
    matchedOn.push('document_type')
  }

  return {
    ...hit,
    score,
    matchedOn: uniqueFields(matchedOn),
  }
}

function passesFilter(hit: DraftHit, filter: SearchDocumentFilter): boolean {
  if (filter === 'all') return true
  if (hit.documentFilter === filter) return true
  return hit.typeFilters.has(filter)
}

function kindRank(kind: SearchHitKind): number {
  if (kind === 'file') return 0
  if (kind === 'recommendation') return 1
  if (kind === 'folder' || kind === 'recent') return 2
  if (kind === 'workflow') return 3
  return 4
}

function toPublicHit(hit: DraftHit): SearchHit {
  return {
    id: hit.id,
    kind: hit.kind,
    title: hit.title,
    subtitle: hit.subtitle,
    path: hit.path,
    folderPath: hit.folderPath,
    extension: hit.extension,
    documentFilter: hit.documentFilter,
    lastSeenAt: hit.lastSeenAt,
    matchedOn: hit.matchedOn,
    workflowId: hit.workflowId,
    workflowName: hit.workflowName,
    activityRunId: hit.activityRunId,
  }
}

export function searchKnowledge(query: SearchQuery, corpus: SearchCorpus): SearchResults {
  const normalized = normalizeSearchQuery(query)
  const tokens = tokenize(normalized.text)
  const leftover: string[] = []
  let wantsRecent = false
  let wantsWorkflow = false
  let wantsHistory = false
  let typeFromQuery: Exclude<SearchDocumentFilter, 'all'> | null = null

  for (const token of tokens) {
    if (RECENT_WORDS.has(token)) {
      wantsRecent = true
      continue
    }
    if (WORKFLOW_WORDS.has(token)) {
      wantsWorkflow = true
      continue
    }
    if (HISTORY_WORDS.has(token)) {
      wantsHistory = true
      continue
    }
    const type = typeFromToken(token)
    if (type) {
      typeFromQuery = type
    }
    leftover.push(token)
  }

  const now = Date.now()
  const scored = collectHits(corpus)
    .filter((hit) => passesFilter(hit, normalized.filter))
    .map((hit) => scoreHit(hit, leftover, wantsRecent, wantsWorkflow, wantsHistory, typeFromQuery, now))

  const looking = leftover.length > 0 || wantsRecent || wantsWorkflow || wantsHistory || typeFromQuery !== null
  const ranked = scored
    .filter((hit) => (looking ? hit.score > 0 : Boolean(hit.lastSeenAt) || hit.kind === 'recent'))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const rightTime = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0
      const leftTime = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0
      if (rightTime !== leftTime) return rightTime - leftTime
      return kindRank(left.kind) - kindRank(right.kind)
    })
    .slice(0, MAX_HITS)
    .map(toPublicHit)

  return {
    query: normalized.text,
    filter: normalized.filter,
    hits: ranked,
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function sampleCorpus(): SearchCorpus {
  const invoices = '/Users/demo/Documents/Invoices'
  const holiday = '/Users/demo/Pictures/Holiday'
  const now = '2026-09-18T10:00:00.000Z'
  return {
    index: {
      version: 2,
      indexVersion: 2,
      generatedAt: now,
      indexedAt: now,
      locations: ['/Users/demo/Documents', '/Users/demo/Pictures'],
      sources: [],
      folders: [
        {
          id: 'invoices',
          sourceId: 'docs',
          sourceType: 'local_folder',
          kind: 'folder',
          name: 'Invoices',
          locator: invoices,
          absolutePath: invoices,
          relativePath: 'Invoices',
          folderName: 'Invoices',
          parentTokens: ['documents'],
          depth: 2,
          extensions: ['pdf', 'docx'],
          fileCount: 2,
          fileNames: ['Invoice_ACME.pdf', 'receipt.docx'],
          lastModified: now,
        },
        {
          id: 'holiday',
          sourceId: 'pics',
          sourceType: 'local_folder',
          kind: 'folder',
          name: 'Holiday',
          locator: holiday,
          absolutePath: holiday,
          relativePath: 'Holiday',
          folderName: 'Holiday',
          parentTokens: ['pictures'],
          depth: 2,
          extensions: ['jpg', 'zip'],
          fileCount: 2,
          fileNames: ['beach.jpg', 'photos.zip'],
          lastModified: '2026-09-10T10:00:00.000Z',
        },
      ],
      files: [],
    },
    recents: [invoices],
    activity: [
      {
        runId: 'run-1',
        runNumber: 1,
        startedAt: now,
        completedAt: now,
        trigger: 'organise_documents',
        summary: { moved: 1, skipped: 0, failed: 0 },
        items: [
          {
            sourcePath: '/Users/demo/Downloads/Invoice_ACME.pdf',
            targetPath: `${invoices}/Invoice_ACME.pdf`,
            fileName: 'Invoice_ACME.pdf',
            action: 'move',
            status: 'moved',
            reason: 'Moved to Documents / Invoices',
            confidence: 0.9,
            undoAvailable: true,
          },
        ],
        workflowId: 'wf-invoices',
        workflowName: 'Monthly invoices',
      },
    ],
    workflows: [
      {
        id: 'wf-invoices',
        name: 'Monthly invoices',
        description: 'Organise downloaded invoices',
        category: 'Finance',
        workflowVersion: 1,
        trigger: 'manual',
        plan: {
          knowledgeSet: {
            items: [{ path: `${invoices}/Invoice_ACME.pdf`, kind: 'file' }],
          },
        },
        createdAt: now,
        updatedAt: now,
        lastRunAt: now,
        approvedPlan: null,
        approvedAt: null,
        autopilotEnabled: false,
      },
    ],
  }
}

export function runSearchChecks(): void {
  const corpus = sampleCorpus()

  const byName = searchKnowledge({ text: 'invoice', filter: 'all' }, corpus)
  assert(
    byName.hits.some((hit) => hit.title === 'Invoice_ACME.pdf' && hit.matchedOn.includes('filename')),
    'search finds a document by filename',
  )

  const byFolder = searchKnowledge({ text: 'holiday', filter: 'all' }, corpus)
  assert(
    byFolder.hits.some((hit) => hit.kind === 'folder' && hit.title === 'Holiday' && hit.matchedOn.includes('folder')),
    'search finds a folder by name',
  )

  const byExtension = searchKnowledge({ text: 'pdf', filter: 'all' }, corpus)
  assert(
    byExtension.hits.some((hit) => hit.extension === 'pdf' && hit.matchedOn.includes('extension')),
    'search finds documents by extension',
  )

  const pdfOnly = searchKnowledge({ text: '', filter: 'pdf' }, corpus)
  assert(
    pdfOnly.hits.length > 0 && pdfOnly.hits.every((hit) => hit.documentFilter === 'pdf' || hit.kind === 'folder'),
    'PDF filter keeps PDF metadata only',
  )
  assert(
    !pdfOnly.hits.some((hit) => hit.extension === 'jpg'),
    'PDF filter excludes images',
  )

  const images = searchKnowledge({ text: 'photo', filter: 'images' }, corpus)
  assert(
    images.hits.some((hit) => hit.title === 'beach.jpg'),
    'document type search finds images',
  )

  const recent = searchKnowledge({ text: 'recent', filter: 'all' }, corpus)
  assert(
    recent.hits.some((hit) => hit.kind === 'recent' && hit.title === 'Invoices'),
    'search finds recent folders',
  )

  const workflow = searchKnowledge({ text: 'monthly', filter: 'all' }, corpus)
  assert(
    workflow.hits.some((hit) => hit.kind === 'workflow' && hit.title === 'Monthly invoices'),
    'search finds a workflow by name',
  )

  const history = searchKnowledge({ text: 'acme', filter: 'all' }, corpus)
  assert(
    history.hits.some((hit) => hit.kind === 'recommendation' && hit.activityRunId === 'run-1'),
    'search finds recommendation history',
  )
  assert(
    history.hits.some((hit) => hit.kind === 'activity' || hit.activityRunId === 'run-1'),
    'search finds activity for an organised document',
  )

  const content = searchKnowledge({ text: 'lorem ipsum hidden body text', filter: 'all' }, corpus)
  assert(content.hits.length === 0, 'search does not invent document contents')

  const missing = searchKnowledge({ text: 'totally-unknown-file', filter: 'all' }, corpus)
  assert(missing.hits.length === 0, 'search only uses metadata already available')
}
