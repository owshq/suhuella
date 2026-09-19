import { descriptorDisplayName } from './descriptors.ts'
import { enrichKnowledgeDescriptor } from './local-intelligence.ts'
import type {
  ConfidenceLabel,
  FileFamily,
  FileProfile,
  FolderProfile,
  IndexedFolderEntry,
  KnowledgeDescriptor,
  RecommendationInput,
  RecommendedFolder,
  ScoreContribution,
} from '../src/types.ts'

const MAX_CANDIDATES = 100

const FILE_STOP_WORDS = new Set([
  'untitled',
  'document',
  'file',
  'new',
  'copy',
  'final',
  'draft',
  'image',
  'img',
  'temp',
  'tmp',
  'the',
  'and',
  'for',
  'del',
  'de',
  'la',
  'el',
  'los',
  'las',
])

const GENERIC_FOLDERS = new Set([
  'downloads',
  'desktop',
  'documents',
  'documentos',
  'docs',
  'misc',
  'general',
  'temp',
  'tmp',
  'old',
  'archive',
  'backup',
  'screenshots',
  'files',
])

const TYPE_ORGANISED_FOLDERS = new Set([
  'pdf',
  'pdfs',
  'images',
  'photos',
  'pictures',
  'imagenes',
  'imágenes',
  'spreadsheets',
  'excel',
  'scans',
  'videos',
  'music',
  'audio',
])

const MONTHS = new Set([
  'january',
  'february',
  'march',
  'april',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
  'gener',
  'febrer',
  'març',
  'abril',
  'maig',
  'juny',
  'juliol',
  'agost',
  'setembre',
  'octubre',
  'novembre',
  'desembre',
])

const FILE_FAMILIES: Record<string, FileFamily> = {
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  rtf: 'document',
  odt: 'document',
  pages: 'document',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  numbers: 'spreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  key: 'presentation',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  heic: 'image',
  webp: 'image',
  tiff: 'image',
  tif: 'image',
  bmp: 'image',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  eml: 'email',
  msg: 'email',
  js: 'code',
  ts: 'code',
  py: 'code',
  java: 'code',
  cs: 'code',
  html: 'code',
  css: 'code',
  json: 'code',
  md: 'text',
  txt: 'text',
  psd: 'design',
  ai: 'design',
  sketch: 'design',
  fig: 'design',
  dwg: 'design',
  sqlite: 'database',
  db: 'database',
  accdb: 'database',
}

type HintGroup = {
  id: string
  topic: string
  terms: string[]
}

const HINT_GROUPS: HintGroup[] = [
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

const TERM_TO_HINT = new Map<string, HintGroup>()
for (const group of HINT_GROUPS) {
  for (const term of group.terms) {
    TERM_TO_HINT.set(term, group)
  }
}

type ScorerResult = {
  scorerId: string
  score: number
  reasons: string[]
  contributions: ScoreContribution[]
}

type Scorer = (file: FileProfile, folder: FolderProfile) => ScorerResult

export function tokenize(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function unique(tokens: string[]): string[] {
  return [...new Set(tokens)]
}

function extensionOf(fileName: string): string | null {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? null
}

function baseNameOf(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function fileFamilyOf(extension: string | null): FileFamily {
  if (!extension) return 'unknown'
  return FILE_FAMILIES[extension] ?? 'unknown'
}

function folderSegments(folderPath: string): string[] {
  return folderPath.split(/[/\\]+/).filter(Boolean)
}

export function folderLabel(folderPath: string): string {
  const segments = folderSegments(folderPath)
  if (segments.length === 0) return folderPath
  if (segments.length === 1) return segments[0]

  const last = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  const grandparent = segments[segments.length - 3]
  if (parent && ['users', 'home'].includes(parent.toLowerCase())) return last
  if (grandparent && ['users', 'home'].includes(grandparent.toLowerCase())) return last
  return `${parent} / ${last}`
}

function tokensOverlap(a: string, b: string): 'exact' | 'partial' | null {
  if (a === b) return 'exact'
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
    return 'partial'
  }
  return null
}

function bestOverlap(token: string, haystack: string[]): 'exact' | 'partial' | null {
  let best: 'exact' | 'partial' | null = null
  for (const item of haystack) {
    const overlap = tokensOverlap(token, item)
    if (overlap === 'exact') return 'exact'
    if (overlap === 'partial') best = 'partial'
  }
  return best
}

function isYear(token: string): boolean {
  return /^\d{4}$/.test(token) && Number(token) >= 1900 && Number(token) <= 2100
}

function capitalizeToken(token: string): string {
  if (!token) return token
  return token.charAt(0).toUpperCase() + token.slice(1)
}

function prettyList(values: string[]): string {
  return values.map(capitalizeToken).join(', ')
}

function countTokens(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

function topTokens(tokens: string[], limit: number, exclude: Set<string> = new Set()): string[] {
  return [...countTokens(tokens).entries()]
    .filter(([token]) => !exclude.has(token) && !FILE_STOP_WORDS.has(token))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token)
}

export function buildFileProfile(fileName: string, sourceApp = ''): FileProfile {
  const extension = extensionOf(fileName)
  const baseName = baseNameOf(fileName)
  const rawTokens = unique(tokenize(baseName))
  const tokens = rawTokens.filter((token) => !FILE_STOP_WORDS.has(token))
  const dates: string[] = []
  const documentHints: string[] = []
  const topicHints: string[] = []
  const languageHints: string[] = []
  const entities: string[] = []
  const weakTokens: string[] = []

  for (const token of tokens) {
    const hint = TERM_TO_HINT.get(token)
    if (hint) {
      if (!documentHints.includes(hint.id)) documentHints.push(hint.id)
      if (!topicHints.includes(hint.topic)) topicHints.push(hint.topic)
      continue
    }
    if (isYear(token) || MONTHS.has(token)) {
      dates.push(token)
      weakTokens.push(token)
      continue
    }
    if (token === extension) {
      weakTokens.push(token)
      continue
    }
    if (token.length >= 3) {
      entities.push(token)
    } else {
      weakTokens.push(token)
    }
  }

  const strongTokens = unique([...documentHints, ...entities])

  return {
    originalName: fileName,
    baseName,
    extension,
    fileFamily: fileFamilyOf(extension),
    tokens,
    strongTokens,
    weakTokens,
    entities,
    dates,
    documentHints,
    topicHints,
    languageHints,
    sourceApp: sourceApp || undefined,
  }
}

export function buildFileProfileFromDescriptor(descriptor: KnowledgeDescriptor): FileProfile {
  const profile = buildFileProfile(descriptorDisplayName(descriptor))
  return {
    ...profile,
    entities: unique([...profile.entities, ...descriptor.entities]),
    dates: unique([...profile.dates, ...descriptor.dates]),
    documentHints: unique([...profile.documentHints, ...descriptor.hints]),
    topicHints: unique([...profile.topicHints, ...descriptor.topics]),
    languageHints: unique([...profile.languageHints, ...descriptor.language]),
    strongTokens: unique([
      ...profile.documentHints,
      ...descriptor.hints,
      ...profile.entities,
      ...descriptor.entities,
    ]),
  }
}

export function fileUnderstandingLabels(profile: FileProfile): string[] {
  const labels: string[] = []
  for (const hint of profile.documentHints) {
    labels.push(capitalizeToken(hint))
  }
  for (const entity of profile.entities.slice(0, 3)) {
    labels.push(entity.toUpperCase() === entity ? entity : capitalizeToken(entity))
  }
  for (const date of profile.dates.slice(0, 2)) {
    labels.push(capitalizeToken(date))
  }
  return unique(labels).slice(0, 5)
}

export function buildFolderProfile(entry: IndexedFolderEntry): FolderProfile {
  const absolutePath = entry.absolutePath || entry.locator
  const folderNameTokens = unique(tokenize(entry.folderName || entry.name))
  const pathTokens = unique(tokenize(absolutePath))
  const parentTokens = unique(entry.parentTokens.flatMap((token) => tokenize(token)))
  const existingFileTokens = unique(
    entry.fileNames.flatMap((name) =>
      tokenize(baseNameOf(name)).filter((token) => !FILE_STOP_WORDS.has(token)),
    ),
  )

  const documentHints: string[] = []
  const topics: string[] = []
  for (const token of [...folderNameTokens, ...pathTokens, ...existingFileTokens]) {
    const hint = TERM_TO_HINT.get(token)
    if (!hint) continue
    if (!documentHints.includes(hint.id)) documentHints.push(hint.id)
    if (!topics.includes(hint.topic)) topics.push(hint.topic)
  }

  const extensionDistribution: Record<string, number> = {}
  for (const name of entry.fileNames) {
    const ext = extensionOf(name)
    if (!ext) continue
    extensionDistribution[ext] = (extensionDistribution[ext] ?? 0) + 1
  }
  for (const ext of entry.extensions) {
    extensionDistribution[ext] = extensionDistribution[ext] ?? 1
  }

  const lastSegment = folderNameTokens[folderNameTokens.length - 1] ?? entry.folderName.toLowerCase()
  const genericPenaltyHints = GENERIC_FOLDERS.has(lastSegment) ? [lastSegment] : []

  return {
    folderId: entry.id,
    sourceId: entry.sourceId,
    absolutePath,
    folderNameTokens,
    pathTokens,
    parentTokens,
    existingFileTokens,
    dominantEntities: topTokens(
      [...pathTokens, ...existingFileTokens],
      6,
      new Set([...GENERIC_FOLDERS, ...MONTHS]),
    ).filter((token) => !TERM_TO_HINT.has(token) && !isYear(token)),
    dominantDocumentHints: documentHints,
    dominantTopics: topics,
    extensionDistribution,
    genericPenaltyHints,
  }
}

function generateCandidates(file: FileProfile, folders: FolderProfile[]): FolderProfile[] {
  if (folders.length <= MAX_CANDIDATES) return folders

  const ranked = folders
    .map((folder) => ({ folder, hits: candidateHits(file, folder) }))
    .sort((a, b) => b.hits - a.hits || a.folder.absolutePath.localeCompare(b.folder.absolutePath))

  const withHits = ranked.filter((item) => item.hits > 0).slice(0, MAX_CANDIDATES)
  if (withHits.length >= 12) return withHits.map((item) => item.folder)
  return ranked.slice(0, MAX_CANDIDATES).map((item) => item.folder)
}

function candidateHits(file: FileProfile, folder: FolderProfile): number {
  const haystack = [
    ...folder.folderNameTokens,
    ...folder.pathTokens,
    ...folder.existingFileTokens,
    ...folder.dominantEntities,
    ...folder.dominantDocumentHints,
    ...folder.dominantTopics,
  ]
  let hits = 0
  for (const token of [...file.strongTokens, ...file.documentHints, ...file.entities, ...file.topicHints]) {
    if (bestOverlap(token, haystack)) hits += 1
  }
  return hits
}

function result(
  scorerId: string,
  score: number,
  reasons: string[],
  contributions: ScoreContribution[],
): ScorerResult {
  return { scorerId, score, reasons, contributions }
}

function scoreEntityMatch(file: FileProfile, folder: FolderProfile): ScorerResult {
  if (file.entities.length === 0) return result('entityMatchScorer', 0, [], [])

  let score = 0
  const reasons: string[] = []
  const contributions: ScoreContribution[] = []
  const matched: string[] = []

  for (const entity of file.entities) {
    const nameHit = bestOverlap(entity, folder.folderNameTokens)
    const pathHit = bestOverlap(entity, folder.pathTokens)
    const fileHit = bestOverlap(entity, [...folder.existingFileTokens, ...folder.dominantEntities])
    if (nameHit === 'exact') score += 30
    else if (pathHit === 'exact') score += 24
    else if (fileHit === 'exact') score += 20
    else if (nameHit === 'partial' || pathHit === 'partial' || fileHit === 'partial') score += 10
    else continue
    matched.push(entity)
  }

  score = Math.min(30, score)
  if (matched.length > 0) {
    const label = `${prettyList(matched)} matches this folder`
    reasons.push(label)
    contributions.push({ label, points: score })
  }
  return result('entityMatchScorer', score, reasons, contributions)
}

function scorePathTokens(file: FileProfile, folder: FolderProfile): ScorerResult {
  let score = 0
  const haystack = unique([...folder.folderNameTokens, ...folder.pathTokens])

  for (const token of unique([...file.documentHints, ...file.entities, ...file.strongTokens])) {
    const hit = bestOverlap(token, haystack)
    if (hit === 'exact') {
      score += token === folder.folderNameTokens.at(-1) ? 18 : 12
    } else if (hit === 'partial') {
      score += 6
    }
  }

  score = Math.min(25, score)
  if (score <= 0) return result('pathTokenScorer', 0, [], [])
  const label = 'Folder path match'
  return result('pathTokenScorer', score, [label], [{ label, points: score }])
}

function scoreExistingFilenames(file: FileProfile, folder: FolderProfile): ScorerResult {
  if (folder.existingFileTokens.length === 0) return result('existingFilenameScorer', 0, [], [])

  let score = 0
  const matchedHints: string[] = []
  const interesting = unique([...file.documentHints, ...file.entities, ...file.strongTokens])

  for (const token of interesting) {
    const hit = bestOverlap(token, folder.existingFileTokens)
    if (hit === 'exact') {
      score += 12
      matchedHints.push(token)
    } else if (hit === 'partial') {
      score += 6
      matchedHints.push(token)
    }
  }

  score = Math.min(25, score)
  if (score <= 0) return result('existingFilenameScorer', 0, [], [])
  const label =
    matchedHints.length > 0
      ? `Similar ${prettyList(matchedHints.slice(0, 2))} files already exist here`
      : 'Similar files already exist here'
  return result('existingFilenameScorer', score, [label], [{ label, points: score }])
}

function scoreDocumentHints(file: FileProfile, folder: FolderProfile): ScorerResult {
  if (file.documentHints.length === 0) return result('documentHintScorer', 0, [], [])

  const haystack = [
    ...folder.dominantDocumentHints,
    ...folder.folderNameTokens,
    ...folder.existingFileTokens,
  ]
  let score = 0
  const matched: string[] = []
  for (const hint of file.documentHints) {
    if (bestOverlap(hint, haystack)) {
      score += 12
      matched.push(hint)
    }
  }

  score = Math.min(20, score)
  if (score <= 0) return result('documentHintScorer', 0, [], [])
  const label = `${prettyList(matched)} matches existing files`
  return result('documentHintScorer', score, [label], [{ label, points: score }])
}

function scoreTopics(file: FileProfile, folder: FolderProfile): ScorerResult {
  if (file.topicHints.length === 0) return result('topicScorer', 0, [], [])

  const matched = file.topicHints.filter((topic) =>
    folder.dominantTopics.some((item) => tokensOverlap(topic, item)),
  )
  if (matched.length === 0) {
    const pathHit = file.topicHints.some((topic) => bestOverlap(topic, folder.pathTokens))
    if (!pathHit) return result('topicScorer', 0, [], [])
    const score = 8
    const label = `${prettyList(file.topicHints)}-related folder`
    return result('topicScorer', score, [label], [{ label, points: score }])
  }

  const score = Math.min(15, matched.length * 10)
  const label = `This folder is ${matched[0]}-related`
  return result('topicScorer', score, [label], [{ label, points: score }])
}

function scoreParentContext(file: FileProfile, folder: FolderProfile): ScorerResult {
  if (folder.parentTokens.length === 0) return result('parentContextScorer', 0, [], [])

  const interesting = unique([...file.entities, ...file.documentHints, ...file.topicHints])
  let score = 0
  for (const token of interesting) {
    const hit = bestOverlap(token, folder.parentTokens)
    if (hit === 'exact') score += 8
    else if (hit === 'partial') score += 4
  }

  score = Math.min(10, score)
  if (score <= 0) return result('parentContextScorer', 0, [], [])
  const label = 'The parent folder suggests related work'
  return result('parentContextScorer', score, [label], [{ label, points: score }])
}

function scoreExtension(file: FileProfile, folder: FolderProfile): ScorerResult {
  const ext = file.extension
  if (!ext) return result('extensionScorer', 0, [], [])

  const lastName = folder.folderNameTokens.at(-1) ?? ''
  const typeOrganised = TYPE_ORGANISED_FOLDERS.has(lastName)
  const extCount = folder.extensionDistribution[ext] ?? 0
  const total = Object.values(folder.extensionDistribution).reduce((sum, count) => sum + count, 0)
  const share = total > 0 ? extCount / total : 0

  let score = 0
  if (typeOrganised && bestOverlap(ext, folder.folderNameTokens)) {
    score = 5
  } else if (share >= 0.5) {
    score = 4
  } else if (extCount > 0 || folder.pathTokens.includes(ext)) {
    score = 2
  }

  if (score <= 0) return result('extensionScorer', 0, [], [])
  const label = `${ext.toUpperCase()} files are common here`
  return result('extensionScorer', score, [label], [{ label, points: score }])
}

function scoreGenericPenalty(_file: FileProfile, folder: FolderProfile): ScorerResult {
  if (folder.genericPenaltyHints.length === 0) {
    return result('genericFolderPenaltyScorer', 0, [], [])
  }
  const score = -6
  const label = 'Generic folder'
  return result('genericFolderPenaltyScorer', score, [], [{ label, points: score }])
}

const SCORERS: Scorer[] = [
  scoreEntityMatch,
  scorePathTokens,
  scoreExistingFilenames,
  scoreDocumentHints,
  scoreTopics,
  scoreParentContext,
  scoreExtension,
  scoreGenericPenalty,
]

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 70) return 'Strong match'
  if (score >= 50) return 'Good match'
  if (score >= 30) return 'Possible match'
  return 'Weak match'
}

export type ScorerBreakdown = {
  scorerId: string
  score: number
}

export type RankedFolder = RecommendedFolder & {
  scorers: ScorerBreakdown[]
}

function aggregateRanking(
  folder: FolderProfile,
  scorerResults: ScorerResult[],
): RankedFolder {
  const contributions = scorerResults
    .flatMap((item) => item.contributions)
    .filter((item) => item.points !== 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))

  const reasons = unique(scorerResults.flatMap((item) => item.reasons)).slice(0, 4)
  const rawScore = scorerResults.reduce((sum, item) => sum + item.score, 0)
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))

  return {
    folder: folder.absolutePath,
    score,
    confidenceLabel: confidenceLabel(score),
    label: folderLabel(folder.absolutePath),
    reasons,
    contributions,
    scorers: scorerResults.map((item) => ({ scorerId: item.scorerId, score: item.score })),
  }
}

export function rankFolders(input: RecommendationInput): RankedFolder[] {
  const file = buildFileProfileFromDescriptor(enrichKnowledgeDescriptor(input.descriptor))
  const profiles = input.folders
    .filter((entry) => entry.kind !== 'attachment')
    .map(buildFolderProfile)
  const candidates = generateCandidates(file, profiles)

  return candidates
    .map((folder) => aggregateRanking(folder, SCORERS.map((scorer) => scorer(file, folder))))
    .sort((a, b) => b.score - a.score || a.folder.localeCompare(b.folder))
}

/** Unique Recommendation Engine. Determines where a Knowledge Item belongs. Never uses BYOK. */
export function recommendFolders(input: RecommendationInput): RecommendedFolder[] {
  return rankFolders(input)
    .filter((item) => item.score > 0)
    .slice(0, 5)
    .map(({ scorers: _scorers, ...item }) => item)
}
