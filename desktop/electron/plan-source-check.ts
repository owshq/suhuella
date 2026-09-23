import path from 'node:path'
import type { SourceId } from '@suhuella/product/lib/source-identity.ts'
import type { IndexedFolderEntry, OrganisationPlanItem } from '@suhuella/product/types.ts'
import {
  attachPlanSourceFields,
  markPlanItemSourceUnavailable,
  restorePlanItemAfterSourceAvailable,
  type PlanSourceBlockReason,
  sourceIdForPath,
  sourceRootAbsolutePath,
} from '@suhuella/product/lib/plan-source.ts'
import { inspectElectronLocation } from './handle-registry.ts'
import { loadIndex } from './index-store.ts'

function sourceDisplayName(sourceId: string): string | undefined {
  const source = loadIndex().sources.find((entry) => entry.id === sourceId)
  return source?.displayName
}

function blockReasonForIssue(issue: ReturnType<typeof inspectElectronLocation>): PlanSourceBlockReason {
  if (issue === 'permission_denied') return 'permission'
  if (issue === 'external_drive_disconnected') return 'disconnected'
  return 'missing'
}

export function desktopSourceUnavailableForPath(
  filePath: string,
  folders: IndexedFolderEntry[],
): { unavailable: boolean; sourceId?: string; sourceName?: string; reason?: PlanSourceBlockReason } {
  const resolvedId = sourceIdForPath(filePath, folders)
  const root = sourceRootAbsolutePath(filePath, folders)
  if (!root) {
    return resolvedId ? { unavailable: false, sourceId: resolvedId, sourceName: sourceDisplayName(resolvedId) } : { unavailable: false }
  }
  const issue = inspectElectronLocation(root)
  const sourceName = resolvedId ? sourceDisplayName(resolvedId) : undefined
  if (issue === 'external_drive_disconnected' || issue === 'unavailable' || issue === 'permission_denied') {
    return {
      unavailable: true,
      reason: blockReasonForIssue(issue),
      ...(resolvedId ? { sourceId: resolvedId } : {}),
      ...(sourceName ? { sourceName } : {}),
    }
  }
  return {
    unavailable: false,
    ...(resolvedId ? { sourceId: resolvedId } : {}),
    ...(sourceName ? { sourceName } : {}),
  }
}

export function withDesktopPlanSourceFields(
  item: OrganisationPlanItem,
  folders: IndexedFolderEntry[],
): OrganisationPlanItem {
  const availability = desktopSourceUnavailableForPath(item.currentPath, folders)
  const withSource = attachPlanSourceFields(item, {
    sourceId: availability.sourceId as SourceId | undefined,
    sourceName: availability.sourceName,
  })
  if (availability.unavailable) {
    return markPlanItemSourceUnavailable(withSource, availability.sourceName, availability.reason ?? 'disconnected')
  }
  return withSource
}

export function refreshDesktopPlanItemAvailability(
  item: OrganisationPlanItem,
  folders: IndexedFolderEntry[],
): OrganisationPlanItem {
  if (item.status === 'applied' || item.status === 'failed') return item
  const availability = desktopSourceUnavailableForPath(item.currentPath, folders)
  const withSource = attachPlanSourceFields(item, {
    sourceId: (availability.sourceId ?? item.sourceId) as SourceId | undefined,
    sourceName: availability.sourceName ?? item.sourceName,
  })
  if (availability.unavailable) {
    return markPlanItemSourceUnavailable(
      withSource,
      availability.sourceName ?? item.sourceName,
      availability.reason ?? 'disconnected',
    )
  }
  if (item.status === 'source_unavailable') {
    return restorePlanItemAfterSourceAvailable(withSource)
  }
  return withSource
}

export function runPlanSourceCheckSelfTest(): void {
  const folders: IndexedFolderEntry[] = [
    {
      id: '/tmp/plan-source-check',
      sourceId: 'src_check',
      sourceType: 'local_folder',
      kind: 'folder',
      name: 'check',
      locator: '/tmp/plan-source-check',
      absolutePath: '/tmp/plan-source-check',
      relativePath: '.',
      folderName: 'check',
      parentTokens: [],
      depth: 0,
      extensions: [],
      fileCount: 0,
      fileNames: [],
      lastModified: null,
    },
  ]
  const resolved = desktopSourceUnavailableForPath(path.join('/tmp/plan-source-check', 'a.pdf'), folders)
  if (resolved.sourceId !== 'src_check') {
    throw new Error('plan source check resolves sourceId')
  }
}
