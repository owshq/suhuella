import type { SourceBrowseEntry } from '../types.ts'

export function normalizeBrowsePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

export function browseParentPath(value: string): string | null {
  const normalized = normalizeBrowsePath(value)
  if (!normalized || !normalized.includes('/')) return null
  return normalized.slice(0, normalized.lastIndexOf('/')) || null
}

export function isBrowsePathUnder(root: string, candidate: string): boolean {
  const parent = normalizeBrowsePath(root).toLowerCase()
  const child = normalizeBrowsePath(candidate).toLowerCase()
  return child === parent || child.startsWith(`${parent}/`)
}

export function resolveBrowseRoot(
  folderPath: string,
  roots: Array<{ path: string }>,
): string {
  const normalized = normalizeBrowsePath(folderPath).toLowerCase()
  let best: string | null = null
  for (const root of roots) {
    const candidate = normalizeBrowsePath(root.path)
    const lower = candidate.toLowerCase()
    if (normalized === lower || normalized.startsWith(`${lower}/`)) {
      if (!best || candidate.length > best.length) best = candidate
    }
  }
  return best ?? normalizeBrowsePath(folderPath)
}

export function isDirectBrowseChild(root: string, candidate: string): boolean {
  const parent = normalizeBrowsePath(root).toLowerCase()
  const child = normalizeBrowsePath(candidate).toLowerCase()
  if (!child.startsWith(`${parent}/`)) return false
  return !child.slice(parent.length + 1).includes('/')
}

export function sourceBrowseKindLabel(entry: SourceBrowseEntry): string {
  if (entry.kind === 'folder') return 'Folder'
  const ext = (entry.extension ?? entry.name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return 'PDF'
  if (ext === 'doc' || ext === 'docx') return 'Word'
  if (ext === 'xls' || ext === 'xlsx') return 'Excel'
  if (ext === 'ppt' || ext === 'pptx') return 'PowerPoint'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'heic') {
    return 'Image'
  }
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'Archive'
  if (ext === 'mp3' || ext === 'wav' || ext === 'aac' || ext === 'm4a') return 'Audio'
  if (ext === 'mp4' || ext === 'mov' || ext === 'mkv') return 'Movie'
  if (ext === 'txt' || ext === 'md') return 'Plain Text'
  if (ext) return ext.toUpperCase()
  return 'Document'
}

export function formatBrowseDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
