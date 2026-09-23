import type { IndexedFolderEntry, OrganisationPlanItem, SearchHit } from '../types.ts'
import { resolveSourceDisplayName } from './source-display-name.ts'
import { sourceId, type SourceId } from './source-identity.ts'

export const PLAN_SOURCE_UNAVAILABLE = 'Source unavailable'

export type PlanSourceBlockReason = 'disconnected' | 'permission' | 'missing'

const READY_SCORE = 50

export function planSourceInlineAction(item: OrganisationPlanItem): string | null {
  if (item.status !== 'source_unavailable') return null
  const label = item.sourceName?.trim() ? resolveSourceDisplayName(item.sourceName) : 'Source'
  const hint = item.warnings.find((warning) => /^(Connect|Reconnect|Grant access to)/.test(warning))
  if (hint?.startsWith('Grant access to')) return hint.replace(/ to move this file\.?$/, '')
  if (hint?.startsWith('Reconnect')) return hint.replace(/ to move this file\.?$/, '')
  if (hint?.startsWith('Connect')) return hint.replace(/ to move this file\.?$/, '')
  return `Connect ${label}`
}

export function planSourceUnavailableExplanation(
  sourceName: string | undefined,
  reason: PlanSourceBlockReason,
): { explanation: string; warning: string; inlineAction: string } {
  const label = sourceName?.trim() ? resolveSourceDisplayName(sourceName) : 'Source'
  if (reason === 'permission') {
    const inlineAction = `Grant access to ${label}`
    return {
      inlineAction,
      explanation: `${inlineAction} to move this file.`,
      warning: `${inlineAction} to move this file.`,
    }
  }
  if (reason === 'missing') {
    const inlineAction = `Connect ${label}`
    return {
      inlineAction,
      explanation: `${inlineAction} to move this file.`,
      warning: `${inlineAction} to move this file.`,
    }
  }
  const inlineAction = `Reconnect ${label}`
  return {
    inlineAction,
    explanation: `${inlineAction} to move this file.`,
    warning: `${inlineAction} to move this file.`,
  }
}

export function restorePlanItemAfterSourceAvailable(item: OrganisationPlanItem): OrganisationPlanItem {
  const confirmable =
    item.action !== 'none' && item.action !== 'ignore' && Boolean(item.proposedPath?.trim())
  const ready = typeof item.score === 'number' && item.score >= READY_SCORE
  const warnings = item.warnings.filter(
    (warning) => !/^(Connect|Reconnect|Grant access to)/.test(warning),
  )
  if (confirmable && ready) {
    return {
      ...item,
      status: 'preview',
      reviewGroup: 'ready',
      selected: true,
      skipReason: null,
      warnings,
    }
  }
  return {
    ...item,
    status: 'preview',
    reviewGroup: item.reviewGroup === 'skipped' && confirmable ? 'review' : item.reviewGroup,
    skipReason: item.skipReason === PLAN_SOURCE_UNAVAILABLE ? null : item.skipReason,
    warnings,
  }
}

export function isAbsoluteFilesystemPath(filePath: string): boolean {
  return filePath.startsWith('/') || /^[a-z]:[\\/]/i.test(filePath) || filePath.startsWith('\\\\')
}

/** Browser knowledge paths use `sourceId/relative`. File ids use `sourceId:relative`. */
export function parseKnowledgePath(filePath: string): { sourceId: SourceId; relativePath: string } | null {
  const colon = filePath.indexOf(':')
  const slash = filePath.indexOf('/')
  if (colon > 0 && (slash < 0 || colon < slash)) {
    const id = filePath.slice(0, colon)
    if (!id || id.includes('\\') || id.startsWith('cloud:')) return null
    return { sourceId: sourceId(id), relativePath: filePath.slice(colon + 1) }
  }
  if (slash > 0) {
    const id = filePath.slice(0, slash)
    if (!id || id.includes('\\') || id.startsWith('cloud:')) return null
    return { sourceId: sourceId(id), relativePath: filePath.slice(slash + 1) }
  }
  return null
}

export function knowledgePathFromHitPath(path: string | null | undefined): string | null {
  const raw = path?.trim()
  if (!raw) return null
  const colon = raw.indexOf(':')
  const slash = raw.indexOf('/')
  if (colon > 0 && (slash < 0 || colon < slash)) {
    const parsed = parseKnowledgePath(raw)
    if (parsed) {
      return parsed.relativePath ? `${parsed.sourceId}/${parsed.relativePath}` : String(parsed.sourceId)
    }
  }
  if (slash > 0) return raw
  const parsed = parseKnowledgePath(raw)
  if (!parsed) return raw
  return parsed.relativePath ? `${parsed.sourceId}/${parsed.relativePath}` : String(parsed.sourceId)
}

export function sourceIdForPath(filePath: string, folders: IndexedFolderEntry[] = []): SourceId | undefined {
  const parsed = parseKnowledgePath(filePath)
  if (parsed) return parsed.sourceId
  if (!isAbsoluteFilesystemPath(filePath)) return undefined
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  let match: IndexedFolderEntry | undefined
  for (const folder of folders) {
    const root = folder.absolutePath.replace(/\\/g, '/').toLowerCase()
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      if (!match || root.length > match.absolutePath.replace(/\\/g, '/').length) {
        match = folder
      }
    }
  }
  return match ? sourceId(match.sourceId) : undefined
}

export function sourceRootAbsolutePath(
  filePath: string,
  folders: IndexedFolderEntry[],
): string | undefined {
  if (!isAbsoluteFilesystemPath(filePath)) return undefined
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  let best: string | undefined
  for (const folder of folders) {
    const root = folder.absolutePath.replace(/\\/g, '/').toLowerCase()
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      if (!best || root.length > best.replace(/\\/g, '/').length) {
        best = folder.absolutePath
      }
    }
  }
  return best
}

export function sourceNameFromHit(hit: SearchHit): string | undefined {
  return hit.sourceName?.trim() || undefined
}

export function markPlanItemSourceUnavailable(
  item: OrganisationPlanItem,
  sourceName?: string,
  reason: PlanSourceBlockReason = 'disconnected',
): OrganisationPlanItem {
  const copy = planSourceUnavailableExplanation(sourceName, reason)
  return {
    ...item,
    status: 'source_unavailable',
    reviewGroup: 'skipped',
    selected: false,
    skipReason: PLAN_SOURCE_UNAVAILABLE,
    explanation: copy.explanation,
    warnings: [copy.warning],
    ...(sourceName ? { sourceName } : {}),
  }
}

export function attachPlanSourceFields(
  item: OrganisationPlanItem,
  fields: { sourceId?: SourceId; sourceName?: string },
): OrganisationPlanItem {
  return {
    ...item,
    ...(fields.sourceId ? { sourceId: fields.sourceId } : {}),
    ...(fields.sourceName ? { sourceName: fields.sourceName } : {}),
  }
}

export function runPlanSourceChecks(): void {
  const parsed = parseKnowledgePath('src_demo/invoices/a.pdf')
  if (parsed?.sourceId !== 'src_demo' || parsed.relativePath !== 'invoices/a.pdf') {
    throw new Error('slash knowledge paths parse sourceId')
  }
  const fromId = parseKnowledgePath('src_demo:invoices/a.pdf')
  if (fromId?.sourceId !== 'src_demo' || fromId.relativePath !== 'invoices/a.pdf') {
    throw new Error('colon file ids parse sourceId')
  }
  if (knowledgePathFromHitPath('src_demo:invoices/a.pdf') !== 'src_demo/invoices/a.pdf') {
    throw new Error('hit paths normalize to knowledge paths')
  }
  const folders: IndexedFolderEntry[] = [
    {
      id: 'root',
      sourceId: 'src_local_docs',
      sourceType: 'local_folder',
      kind: 'folder',
      name: 'Docs',
      locator: '/Users/demo/Docs',
      absolutePath: '/Users/demo/Docs',
      relativePath: '.',
      folderName: 'Docs',
      parentTokens: [],
      depth: 0,
      extensions: [],
      fileCount: 1,
      fileNames: ['a.pdf'],
      lastModified: null,
    },
  ]
  if (sourceIdForPath('/Users/demo/Docs/a.pdf', folders) !== 'src_local_docs') {
    throw new Error('desktop paths resolve sourceId from indexed folders')
  }
  const blocked = markPlanItemSourceUnavailable(
    {
      action: 'move',
      currentPath: 'src_usb/invoices/a.pdf',
      proposedPath: 'src_usb/clients/a.pdf',
      explanation: 'Move to Clients',
      status: 'preview',
      warnings: [],
      reviewGroup: 'ready',
      selected: true,
      fileName: 'a.pdf',
      score: 80,
      confidenceLabel: 'Strong match',
      alternatives: [],
      skipReason: null,
      sourceName: 'USB Trabajo',
    },
    'USB Trabajo',
    'disconnected',
  )
  if (planSourceInlineAction(blocked) !== 'Reconnect USB Trabajo') {
    throw new Error('disconnected sources use Reconnect inline action')
  }
  const permission = markPlanItemSourceUnavailable(blocked, 'Informes', 'permission')
  if (planSourceInlineAction(permission) !== 'Grant access to Informes') {
    throw new Error('permission sources use Grant access inline action')
  }
  const restored = restorePlanItemAfterSourceAvailable(blocked)
  if (restored.status !== 'preview' || restored.selected !== true || restored.reviewGroup !== 'ready') {
    throw new Error('restored items regain ready selection when source returns')
  }
}
