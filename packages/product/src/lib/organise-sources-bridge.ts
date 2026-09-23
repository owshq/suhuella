import { normalizeBrowsePath } from './source-browse.ts'
import type { KnowledgeSetItem } from '../types.ts'

export const PENDING_ORGANISE_KEY = 'suhuella-pending-organise'

export const ORGANISE_THIS_FOLDER = 'Plan this folder'
export const ORGANISE_THESE_FILES = 'Plan these files'
export const ORGANISE_OVERFLOW = 'Plan…'

const FORBIDDEN_COPY = ['Plan mode', 'Create plan', 'Organise selected'] as const

export type PendingOrganiseContext = {
  sourceId: string
  sourceTitle: string
  folderScope: string
  fileIds: string[]
  fileNames: string[]
  kind: 'files' | 'folder'
  createdAt: number
}

export function sourceBrowseOrganiseCta(selectedFileCount: number): string {
  return selectedFileCount > 0 ? ORGANISE_THESE_FILES : ORGANISE_THIS_FOLDER
}

export function sourceIdFromBrowsePath(path: string): string {
  const normalized = normalizeBrowsePath(path)
  const slash = normalized.indexOf('/')
  return slash <= 0 ? normalized : normalized.slice(0, slash)
}

export function buildPendingOrganiseContext(input: {
  sourceId: string
  sourceTitle: string
  folderScope: string
  fileIds: string[]
  fileNames: string[]
}): PendingOrganiseContext {
  return {
    sourceId: input.sourceId,
    sourceTitle: input.sourceTitle,
    folderScope: normalizeBrowsePath(input.folderScope),
    fileIds: input.fileIds.map((id) => normalizeBrowsePath(id)),
    fileNames: input.fileNames,
    kind: input.fileIds.length > 0 ? 'files' : 'folder',
    createdAt: Date.now(),
  }
}

function isPendingOrganiseContext(value: unknown): value is PendingOrganiseContext {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.sourceId === 'string' &&
    typeof record.sourceTitle === 'string' &&
    typeof record.folderScope === 'string' &&
    Array.isArray(record.fileIds) &&
    record.fileIds.every((item) => typeof item === 'string') &&
    Array.isArray(record.fileNames) &&
    record.fileNames.every((item) => typeof item === 'string') &&
    (record.kind === 'files' || record.kind === 'folder') &&
    typeof record.createdAt === 'number'
  )
}

export function writePendingOrganiseContext(context: PendingOrganiseContext): void {
  try {
    sessionStorage.setItem(PENDING_ORGANISE_KEY, JSON.stringify(context))
  } catch {
    // ignore storage failures
  }
}

export function readPendingOrganiseContext(): PendingOrganiseContext | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORGANISE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isPendingOrganiseContext(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function consumePendingOrganiseContext(): PendingOrganiseContext | null {
  const pending = readPendingOrganiseContext()
  if (!pending) return null
  try {
    sessionStorage.removeItem(PENDING_ORGANISE_KEY)
  } catch {
    // ignore storage failures
  }
  return pending
}

export function pendingContextToKnowledgeItems(context: PendingOrganiseContext): KnowledgeSetItem[] {
  if (context.kind === 'files') {
    return context.fileIds.map((path) => ({ path, kind: 'file' as const }))
  }
  return [{ path: context.folderScope, kind: 'folder' as const }]
}

export function pendingOrganiseUsesUrlPaths(): boolean {
  return false
}

export function sourceBrowseUsesForbiddenOrganiseCopy(text: string): boolean {
  return FORBIDDEN_COPY.some((phrase) => text.includes(phrase))
}

export function sourceBrowseShowsPlanUi(sourceBrowseSource: string): boolean {
  const lower = sourceBrowseSource.toLowerCase()
  return (
    lower.includes('confir plan') ||
    lower.includes('confirm plan') ||
    lower.includes('plandestination') ||
    lower.includes('planeditor') ||
    lower.includes('reviewgroup') ||
    lower.includes('proposedpath')
  )
}
