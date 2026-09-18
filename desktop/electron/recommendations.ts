import type {
  RecommendationInput,
  RecommendedFolder,
} from '../src/types.ts'

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
])

const EXTENSION_HINTS: Record<string, string[]> = {
  pdf: [
    'factura',
    'facturas',
    'invoice',
    'invoices',
    'finance',
    'finanzas',
    'legal',
    'contracts',
    'contratos',
    'docs',
    'documents',
    'documentos',
    'admin',
    'contabilidad',
    'tax',
    'impuestos',
    'receipt',
    'receipts',
    'recibos',
  ],
  doc: ['documents', 'docs', 'word', 'letters', 'contracts', 'contratos', 'legal'],
  docx: ['documents', 'docs', 'word', 'letters', 'contracts', 'contratos', 'legal'],
  xls: ['finance', 'budget', 'excel', 'spreadsheet', 'contabilidad', 'finanzas'],
  xlsx: ['finance', 'budget', 'excel', 'spreadsheet', 'contabilidad', 'finanzas'],
  ppt: ['presentations', 'slides', 'decks'],
  pptx: ['presentations', 'slides', 'decks'],
  png: ['images', 'photos', 'pictures', 'design', 'screenshots', 'imagenes'],
  jpg: ['images', 'photos', 'pictures', 'design', 'screenshots', 'imagenes'],
  jpeg: ['images', 'photos', 'pictures', 'design', 'screenshots', 'imagenes'],
  webp: ['images', 'photos', 'pictures', 'design'],
}

const APP_HINTS: Record<string, string[]> = {
  'microsoft word': ['documents', 'docs', 'word', 'letters', 'contracts', 'documentos'],
  'microsoft excel': ['finance', 'budget', 'excel', 'spreadsheet', 'contabilidad'],
  'microsoft powerpoint': ['presentations', 'slides', 'decks'],
  preview: ['documents', 'pdf', 'documentos'],
  'adobe acrobat': ['pdf', 'documents', 'documentos'],
  finder: ['documents', 'downloads'],
  explorer: ['documents', 'downloads'],
}

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

function extensionOf(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? ''
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

function scoreFolder(input: RecommendationInput, folderPath: string): number {
  const fileTokens = unique(
    tokenize(input.fileName).filter((token) => !FILE_STOP_WORDS.has(token)),
  )
  const folderTokens = unique(tokenize(folderPath))
  const ext = extensionOf(input.fileName)
  const appHints = APP_HINTS[input.sourceApp.toLowerCase()] ?? []
  const extHints = EXTENSION_HINTS[ext] ?? []
  const lastSegment = (folderSegments(folderPath).at(-1) ?? '').toLowerCase()

  let score = 8

  for (const fileToken of fileTokens) {
    if (fileToken === ext) continue
    let best: 'exact' | 'partial' | null = null
    for (const folderToken of folderTokens) {
      const overlap = tokensOverlap(fileToken, folderToken)
      if (overlap === 'exact') {
        best = 'exact'
        break
      }
      if (overlap === 'partial') best = 'partial'
    }
    if (best === 'exact') score += /^\d{4}$/.test(fileToken) ? 16 : 34
    else if (best === 'partial') score += 16
  }

  for (const fileToken of fileTokens) {
    if (fileToken === ext) continue
    const leafOverlap = tokensOverlap(fileToken, lastSegment)
    if (leafOverlap === 'exact') score += 18
    else if (leafOverlap === 'partial') score += 10
  }

  if (ext && folderTokens.includes(ext)) score += 20

  const hintMatches = new Set<string>()
  for (const hint of [...extHints, ...appHints]) {
    for (const folderToken of folderTokens) {
      if (tokensOverlap(hint, folderToken)) hintMatches.add(hint)
    }
    if (tokensOverlap(hint, lastSegment)) hintMatches.add(hint)
  }
  score += Math.min(24, hintMatches.size * 10)

  if (
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) &&
    ['documents', 'documentos', 'docs'].includes(lastSegment)
  ) {
    score += 20
  }

  if (input.recentFolders?.includes(folderPath)) score += 12
  const frequency = input.frequentFolders?.[folderPath] ?? 0
  if (frequency > 0) score += Math.min(16, frequency * 2)

  const depth = Math.max(0, folderSegments(folderPath).length - 3)
  score += Math.min(8, depth * 2)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function recommendFolders(input: RecommendationInput): RecommendedFolder[] {
  const ranked = input.favouriteFolders
    .filter((folder) => folder.trim().length > 0)
    .map((folder) => ({
      folder,
      score: scoreFolder(input, folder),
      label: folderLabel(folder),
    }))
    .sort((a, b) => b.score - a.score || a.folder.localeCompare(b.folder))
    .slice(0, 3)

  return ranked
}
