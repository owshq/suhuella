import type {
  KnowledgeDescriptor,
  KnowledgeItemKind,
  KnowledgeOrigin,
  KnowledgeSourceType,
} from '@suhuella/product/types.ts'

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  rtf: 'application/rtf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  zip: 'application/zip',
  eml: 'message/rfc822',
}

function originSource(origin: KnowledgeOrigin): KnowledgeSourceType {
  if (origin === 'gmail') return 'gmail'
  if (origin === 'outlook') return 'outlook'
  if (origin === 'dropbox') return 'dropbox'
  if (origin === 'google_drive') return 'google_drive'
  if (origin === 'onedrive') return 'onedrive'
  return 'local_folder'
}

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
}

export function mimeTypeForName(fileName: string): string | null {
  const extension = extensionOf(fileName)
  return extension ? (MIME_BY_EXTENSION[extension] ?? null) : null
}

export function descriptorDisplayName(descriptor: KnowledgeDescriptor): string {
  return descriptor.suggestedName.trim() || descriptor.displayName.trim()
}

function descriptorKind(origin: KnowledgeOrigin): KnowledgeItemKind {
  if (origin === 'gmail' || origin === 'outlook') return 'attachment'
  return 'file'
}

function descriptorId(
  origin: KnowledgeOrigin,
  displayName: string,
  metadata: Record<string, unknown>,
): string {
  const locator =
    (typeof metadata.filePath === 'string' && metadata.filePath) ||
    (typeof metadata.currentFolder === 'string' && `${metadata.currentFolder}/${displayName}`) ||
    displayName
  return `kd_${Buffer.from(`${origin}:${locator}`, 'utf8').toString('base64url')}`
}

/** Every Knowledge Item entering SuHuella must first become a KnowledgeDescriptor. */
export function describeKnowledgeItem(input: {
  origin: KnowledgeOrigin
  displayName: string
  suggestedName?: string
  id?: string
  kind?: KnowledgeItemKind
  source?: KnowledgeSourceType
  mimeType?: string | null
  entities?: string[]
  language?: string[]
  dates?: string[]
  topics?: string[]
  hints?: string[]
  metadata?: Record<string, unknown>
}): KnowledgeDescriptor {
  const displayName = input.displayName.trim()
  const suggestedName = (input.suggestedName ?? displayName).trim() || displayName
  const metadata = input.metadata ?? {}

  return {
    id: input.id ?? descriptorId(input.origin, displayName, metadata),
    kind: input.kind ?? descriptorKind(input.origin),
    source: input.source ?? originSource(input.origin),
    origin: input.origin,
    displayName,
    suggestedName,
    mimeType: input.mimeType === undefined ? mimeTypeForName(suggestedName || displayName) : input.mimeType,
    language: input.language ?? [],
    entities: input.entities ?? [],
    dates: input.dates ?? [],
    topics: input.topics ?? [],
    hints: input.hints ?? [],
    metadata,
  }
}
