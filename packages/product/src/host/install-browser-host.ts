import { brand } from '@suhuella/brand'
import { assembleDeviceMetrics } from '../lib/device-metrics-view'
import {
  canPersistSourceAppearanceColor,
  isCorporateColor,
  isCustomizableIconId,
  normalizeSourceAppearanceStore,
  normalizeSourceKey,
  resolveSourceIdentity,
} from '../lib/source-appearance'
import { capabilitiesFor } from './capabilities'
import { hostAccessFor } from '../lib/platform-capabilities'
import { mergeSuggestedCatalog } from '../lib/plan-source-candidate.ts'
import { toLicenseStatusView } from '../lib/license-status'
import type { SuhuellaAPI } from '../vite-env'
import type {
  ActivityItem,
  ActivityRun,
  AppInfo,
  AppPermissionPreferences,
  AppSettings,
  IndexScanProgress,
  KnowledgeSet,
  KnowledgeSetItem,
  LicenseContext,
  OrganisationExecutionResult,
  PlanExecutionProgressEvent,
  OrganisationPlanItem,
  OrganisationPlanPreview,
  SearchMatchField,
  SearchQuery,
  SearchResults,
  SourceBrowse,
  SuggestedLocation,
  Workflow,
} from '../types'
import { HOST_ACTION_COPY, HostCapabilityError } from '../lib/host-action-copy'
import { recognisedFromNames, uniqueNameCount } from '../lib/recognised-names'
import { browseParentPath, isDirectBrowseChild, normalizeBrowsePath } from '../lib/source-browse'
import { sourceRecommendedAction } from '../lib/source-actions'
import { projectBrowserSource } from './browser/source-adapter'
import { sourceAccessState } from '../lib/source-host-vocabulary'
import { availabilityReasonForStatus } from './handle-lifecycle-bridge'
import { sourceCapabilities } from '../lib/source-capabilities'
import { markPlanItemSourceUnavailable } from '../lib/plan-source.ts'
import { buildSourcePresentation } from '../lib/source-presentation'
import {
  FolderAccessError,
  ensurePermission,
  fileWriteSupported,
  folderAccessKind,
  loadHandle,
  moveOrRenameFile,
  formatBytes,
  isAbortError,
  isProtectedFolderError,
  requestLocalFiles,
  requestLocalFolder,
  scanDirectory,
  scanFileList,
} from './browser/fs'
import { getBrowserComputerName } from '../lib/device-identity'
import {
  activateFromCheckout,
  activateLicense,
  browserLicenseWasOffline,
  createCheckoutAttempt,
  requestLicenseEmailCode,
  verifyLicenseEmailCode,
  updateBusinessBranding,
  getBusinessOrganisation,
  manageBusinessOrganisation,
  checkLicense,
  deactivateLicense,
  freeLicense,
  getDevice,
  loadLicense,
  renameDevice,
} from './browser/license'
import {
  browseCloudSourceChildren,
  disconnectCloudIntegration,
  getCloudIntegrationStatus,
  listCloudIntegrations,
  parseCloudBrowsePath,
  reconnectCloudIntegration,
  startCloudIntegration,
} from './browser/cloud-integrations'
import { fetchPublicServiceHealth, NORMAL_SERVICE_HEALTH } from '../lib/service-health'
import {
  executeGuardedPlan,
  INTENT_NOTE,
  UNCERTAIN_NOTE,
} from './browser/organise-integrity.ts'
import { normalizePermissionPreferences } from '../lib/permissions-preferences.ts'
import { assertHostExecutorGenerationRights } from './generation-executor-gate.ts'
import { previewPlan } from './browser/plan'
import { documentFilterForName, searchKnowledge } from './browser/search'
import { isBrowserDevHost, isDevDemoHint } from './browser/dev-host'
import {
  appStorageBytes,
  connectDemoSource,
  connectLocalFolder,
  clearLocalKnowledge,
  deleteWorkflow,
  deleteSavedPlanRecord,
  duplicateSavedPlanRecord,
  listSavedPlans,
  saveSavedPlanRecord,
  clearActivityRuns,
  listActivityRuns,
  listFiles,
  listFolders,
  listSources,
  listWorkflows,
  markWorkflowRan,
  onBrowserSourcesChanged,
  reconcileSources,
  recordActivityRun,
  refreshSource,
  removeSource,
  restoreSourceAccess,
  saveWorkflow,
} from './browser/store'
import { listOrganiseDescriptors, rememberOrganiseDescriptors } from './browser/organise-descriptors'
import {
  indexedFileFromBrowserFile,
  knowledgeItemsFromBrowserFiles,
  knowledgeItemsFromIndexedFiles,
  ORGANISE_EXECUTION_LIMIT,
  ORGANISE_FOLDER_UNSUPPORTED,
  transientFolderFromName,
} from '../lib/browser-organise-selection'
import { resolveSourceDisplayName } from '../lib/source-display-name.ts'
import type { WebKnowledgeSource, WebPlanItem, WebWorkflow } from './browser/types'

const SUGGESTED_START: Record<string, 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'> = {
  'suhuella:desktop': 'desktop',
  'suhuella:documents': 'documents',
  'suhuella:downloads': 'downloads',
  'suhuella:pictures': 'pictures',
  'suhuella:videos': 'videos',
  'suhuella:movies': 'videos',
  'suhuella:music': 'music',
  'suhuella:icloud': 'documents',
  'suhuella:dropbox': 'documents',
  'suhuella:onedrive': 'documents',
  'suhuella:google-drive': 'documents',
}

function detectPlatform(): AppInfo['platform'] {
  if (typeof navigator === 'undefined') return 'darwin'
  if (/Win/.test(navigator.userAgent)) return 'win32'
  if (/Linux/.test(navigator.userAgent)) return 'linux'
  return 'darwin'
}

function emptySettings(sources: WebKnowledgeSource[] = []): AppSettings {
  return {
    indexedLocations: sources.map((source) => source.id),
    indexedFolderCount: sources.reduce((sum, source) => sum + source.folderCount, 0),
    indexedFileCount: sources.reduce((sum, source) => sum + source.fileCount, 0),
    lastIndexed: sources[0]?.lastIndexed ?? null,
    lastLearnedNewFiles: null,
    lastLearnedUpdatedFolders: null,
    firstRunCompleted: true,
    launchAtLogin: false,
    welcomeNotificationShown: true,
    knowledgeSourcesEnabled: {
      local_folder: true,
      google_drive: false,
      dropbox: false,
      onedrive: false,
      gmail: false,
      outlook: false,
      manual_import: false,
    },
    recentFolders: sources.map((source) => source.id),
    sourceAppearance: loadBrowserSourceAppearance(),
    permissions: loadBrowserPermissions(),
  }
}

const BROWSER_SOURCE_APPEARANCE_KEY = 'suhuella-source-appearance'
const BROWSER_PERMISSIONS_KEY = 'suhuella-permissions'

function loadBrowserPermissions(): AppPermissionPreferences {
  if (typeof localStorage === 'undefined') {
    return normalizePermissionPreferences(null)
  }
  try {
    return normalizePermissionPreferences(JSON.parse(localStorage.getItem(BROWSER_PERMISSIONS_KEY) ?? 'null'))
  } catch {
    return normalizePermissionPreferences(null)
  }
}

function saveBrowserPermissions(prefs: AppPermissionPreferences): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(BROWSER_PERMISSIONS_KEY, JSON.stringify(prefs))
}

function loadBrowserSourceAppearance(): AppSettings['sourceAppearance'] {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_SOURCE_APPEARANCE_KEY) ?? '{}')
    return normalizeSourceAppearanceStore(parsed, detectPlatform())
  } catch {
    return {}
  }
}

function saveBrowserSourceAppearance(next: AppSettings['sourceAppearance']): AppSettings['sourceAppearance'] {
  const normalized = normalizeSourceAppearanceStore(next)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(BROWSER_SOURCE_APPEARANCE_KEY, JSON.stringify(normalized))
  }
  return normalized
}

async function applyBrowserSourceAppearance(
  path: string,
  update: { color?: string | null; iconId?: string | null },
): Promise<AppSettings> {
  const key = normalizeSourceKey(path)
  const sources = await listSources()
  if (!key) return emptySettings(sources)
  const source = sources.find((item) => item.id === path)
  const hints = source
    ? { name: source.name, kind: 'user_folder' as const }
    : resolveSourceIdentity(path, detectPlatform())
  if (!canPersistSourceAppearanceColor(path, detectPlatform(), hints)) return emptySettings(sources)

  const current = loadBrowserSourceAppearance()
  const next = { ...current }
  const entry = { ...next[key] }

  if ('color' in update) {
    const color = update.color
    if (color && isCorporateColor(color)) entry.color = color
    else delete entry.color
  }
  if ('iconId' in update) {
    const iconId = update.iconId
    if (iconId && isCustomizableIconId(iconId)) entry.iconId = iconId
    else delete entry.iconId
  }

  if (Object.keys(entry).length === 0) delete next[key]
  else next[key] = entry

  saveBrowserSourceAppearance(next)
  return emptySettings(sources)
}

function dropBrowserSourceAppearance(path: string): void {
  const key = normalizeSourceKey(path)
  if (!key) return
  const current = loadBrowserSourceAppearance()
  if (!current[key]) return
  const next = { ...current }
  delete next[key]
  saveBrowserSourceAppearance(next)
}

function knowledgePath(sourceId: string, relativePath: string): string {
  return `${sourceId}/${relativePath}`
}

function parseKnowledgePath(path: string): { sourceId: string; relativePath: string } {
  const slash = path.indexOf('/')
  if (slash <= 0) return { sourceId: path, relativePath: '' }
  return { sourceId: path.slice(0, slash), relativePath: path.slice(slash + 1) }
}

function toPlanItem(item: WebPlanItem, sourceName?: string): OrganisationPlanItem {
  return {
    action: item.action === 'create_folder' || item.action === 'create_structure' ? item.action : item.action,
    currentPath: item.currentPath.startsWith(`${item.sourceId}/`)
      ? item.currentPath
      : knowledgePath(item.sourceId, item.currentPath),
    proposedPath: item.proposedPath
      ? knowledgePath(item.destSourceId || item.sourceId, item.proposedPath)
      : null,
    createdFolders: item.createdFolders,
    explanation: item.explanation,
    status: item.status,
    warnings: item.warnings,
    reviewGroup: item.reviewGroup,
    selected: item.selected,
    fileName: item.fileName,
    score: item.score,
    confidenceLabel: item.confidenceLabel,
    alternatives: [],
    skipReason: item.skipReason,
    renameStrategy: item.action === 'rename' ? 'normalize' : null,
    renameReasons: item.renameReasons,
    sourceId: item.sourceId,
    ...(sourceName ? { sourceName } : {}),
  }
}

function fromPlanItem(item: OrganisationPlanItem): WebPlanItem {
  const current = parseKnowledgePath(item.currentPath)
  const proposed = item.proposedPath ? parseKnowledgePath(item.proposedPath) : null
  return {
    action: item.action === 'archive' || item.action === 'ignore' ? 'none' : item.action,
    currentPath: current.relativePath || item.fileName,
    proposedPath: proposed?.relativePath || null,
    fileName: item.fileName,
    sourceId: current.sourceId,
    destSourceId: proposed?.sourceId || current.sourceId,
    explanation: item.explanation,
    renameReasons: item.renameReasons ?? [],
    warnings: item.warnings,
    reviewGroup: item.reviewGroup,
    selected: item.selected,
    score: item.score,
    confidenceLabel: item.confidenceLabel,
    skipReason: item.skipReason,
    status:
      item.status === 'preview' ||
      item.status === 'applied' ||
      item.status === 'skipped' ||
      item.status === 'failed'
        ? item.status
        : 'skipped',
  }
}

function toWorkflow(item: WebWorkflow): Workflow {
  return {
    id: item.id,
    name: item.name,
    description: '',
    category: null,
    workflowVersion: 1,
    trigger: 'manual',
    plan: { knowledgeSet: { items: item.fileIds.map((path) => ({ path, kind: 'file' as const })) } },
    createdAt: item.createdAt,
    updatedAt: item.lastRunAt ?? item.createdAt,
    lastRunAt: item.lastRunAt,
    approvedPlan: null,
    approvedAt: null,
    autopilotEnabled: false,
  }
}

function toActivityItems(items: OrganisationPlanItem[]): ActivityItem[] {
  return items.map((item) => ({
    sourcePath: item.currentPath,
    targetPath: item.proposedPath,
    fileName: item.fileName,
    action: item.action,
    status:
      item.status === 'applied' ? 'moved' : item.status === 'failed' ? 'failed' : 'skipped',
    reason: item.skipReason || item.explanation,
    confidence: item.score,
    undoAvailable: item.status === 'applied' && (item.action === 'move' || item.action === 'rename'),
  }))
}

async function browserComputerName(): Promise<string> {
  try {
    return (await getDevice()).deviceName
  } catch {
    return getBrowserComputerName()
  }
}

async function licenseView(context?: LicenseContext | null) {
  const sources = await listSources()
  return toLicenseStatusView(context ?? (await loadLicense()) ?? (freeLicense() as LicenseContext), {
    computerName: await browserComputerName(),
    learningOk: sources.length > 0,
    saveAsActive: false,
    lastSeenOffline: browserLicenseWasOffline(),
  })
}

function locationStatus(status: WebKnowledgeSource['status']) {
  if (status === 'needs_permission') return 'permission_denied' as const
  if (status === 'missing') return 'missing' as const
  if (status === 'error') return 'error' as const
  if (status === 'unavailable') return 'unavailable' as const
  if (status === 'indexing') return 'indexing' as const
  return 'ready' as const
}

function sourceToLocation(source: WebKnowledgeSource) {
  const projected = projectBrowserSource(source)
  const status = locationStatus(source.status)
  const availabilityReason =
    projected.health.availabilityReason ??
    availabilityReasonForStatus(projected.status, source.availabilityReason)
  const presentation = buildSourcePresentation({
    id: projected.source.id,
    displayName: projected.source.displayName,
    locationStatus: status,
    documentCount: source.fileCount,
    lastIndexedAt: projected.health.lastIndexedAt,
    lastCheckedAt: projected.health.lastCheckedAt,
    lastStateChangeAt: projected.health.lastStateChangeAt,
    availabilityReason,
    permission: projected.handle.permission,
    access: hostAccessFor('browser'),
    scanning: projected.status === 'indexing',
  })
  return {
    path: source.id,
    name: presentation.summary.title,
    lastIndexed: source.lastIndexed,
    folderCount: source.folderCount,
    fileCount: source.fileCount,
    status,
    usefulness: 'useful' as const,
    exists: presentation.status.accessible,
    catalogKey: source.wellKnownToken ?? null,
    lastCheckedAt: source.lastCheckedAt ?? null,
    lastStateChangeAt: source.lastStateChangeAt ?? null,
    availabilityReason,
    recommendedAction: presentation.actions.find((action) => action !== 'remove') ?? sourceRecommendedAction(presentation.status.kind),
    detailMessage: presentation.status.detail,
    capabilities: presentation.capabilities,
    presentation,
  }
}

function storageStatus(status: WebKnowledgeSource['status'], supported: boolean) {
  if (!supported) return 'unsupported' as const
  if (status === 'needs_permission') return 'permission_required' as const
  if (status === 'unavailable') return 'unavailable' as const
  if (status === 'indexing') return 'measuring' as const
  return 'measured' as const
}

async function indexStatus() {
  const sources = await listSources()
  const [files, folders] = await Promise.all([listFiles(), listFolders()])
  const settings = emptySettings(sources)
  const names = [
    ...sources.map((source) => source.name),
    ...folders.flatMap((folder) => [folder.folderName, folder.name, ...folder.fileNames]),
    ...files.map((file) => file.name),
  ]
  const extensions = [
    ...folders.flatMap((folder) => folder.extensions),
    ...files.map((file) => file.name.split('.').pop() ?? ''),
  ].filter(Boolean)
  const recognised = recognisedFromNames(names, extensions)
  const latest = sources.find((source) => source.lastIndexed)
  const indexing = sources.some((source) => source.status === 'indexing')
  return {
    settings: {
      ...settings,
      lastLearnedNewFiles: latest?.fileCount ?? null,
      lastLearnedUpdatedFolders: latest ? 1 : null,
    },
    scan: {
      status: indexing ? ('scanning' as const) : ('ready' as const),
      foldersScanned: sources.reduce((sum, source) => sum + source.folderCount, 0),
      filesSeen: sources.reduce((sum, source) => sum + source.fileCount, 0),
      currentPath: indexing ? (sources.find((source) => source.status === 'indexing')?.name ?? '') : '',
      startedAt: indexing ? new Date().toISOString() : null,
      finishedAt: null,
      estimatedRemainingSeconds: indexing ? null : null,
    },
    locations: sources.map(sourceToLocation),
    summary: {
      topFolders: sources.map((source) => source.name).slice(0, 3),
      languages: [],
      documentTypes: [],
      quality: sources.length > 0 ? ('good' as const) : ('needs_more' as const),
      lastLearnedNewFiles: latest?.fileCount ?? null,
      lastLearnedUpdatedFolders: latest ? 1 : null,
      historyYears: null,
      recognised,
      uniqueNames: uniqueNameCount(names),
    },
  }
}

export function folderAccessSupported(): boolean {
  return folderAccessKind() !== 'none'
}

export function installBrowserHost(): void {
  if (typeof window === 'undefined') return
  window.__suhuellaHost = 'browser'
  void getDevice()

  const progressListeners = new Set<(progress: IndexScanProgress) => void>()
  const planProgressListeners = new Set<(event: PlanExecutionProgressEvent) => void>()
  const emitIndexProgress = (sources: WebKnowledgeSource[]) => {
    const indexing = sources.some((source) => source.status === 'indexing')
    const progress: IndexScanProgress = {
      status: indexing ? 'scanning' : 'ready',
      foldersScanned: sources.reduce((sum, source) => sum + source.folderCount, 0),
      filesSeen: sources.reduce((sum, source) => sum + source.fileCount, 0),
      currentPath: sources.find((source) => source.status === 'indexing')?.name ?? '',
      startedAt: indexing ? new Date().toISOString() : null,
      finishedAt: indexing ? null : new Date().toISOString(),
      estimatedRemainingSeconds: indexing ? null : 0,
    }
    for (const listener of progressListeners) listener(progress)
  }
  onBrowserSourcesChanged((sources) => {
    emitIndexProgress(sources)
  })
  void reconcileSources()

  const api: SuhuellaAPI = {
    getSettings: async () => emptySettings(await listSources()),
    getIndexStatus: () => indexStatus(),
    browseSource: async (rootPath: string): Promise<SourceBrowse> => {
      const requested = normalizeBrowsePath(rootPath)
      const lastSegment = requested.split('/').filter(Boolean).at(-1) ?? requested
      const empty: SourceBrowse = {
        path: requested,
        name: lastSegment,
        parentPath: browseParentPath(requested),
        entries: [],
      }
      if (!requested) return empty

      const cloud = parseCloudBrowsePath(rootPath.trim().startsWith('cloud:') ? rootPath.trim() : requested)
      if (cloud) {
        const page = await browseCloudSourceChildren({
          connectionId: cloud.connectionId,
          parentId: cloud.itemId,
        })
        if (!page.ok) {
          return {
            path: rootPath.trim(),
            name: lastSegment,
            parentPath: cloud.itemId ? `cloud:${cloud.connectionId}` : null,
            entries: [],
          }
        }
        const itemId = cloud.itemId
        const parentOfParent = page.page.parentOfParentId
        let parentPath: string | null = null
        if (itemId) {
          if (itemId === 'root' || itemId === 'sharedWithMe') {
            parentPath = `cloud:${cloud.connectionId}`
          } else if (parentOfParent) {
            parentPath = `cloud:${cloud.connectionId}/${parentOfParent}`
          } else {
            parentPath = `cloud:${cloud.connectionId}/root`
          }
        }
        return {
          path: rootPath.trim(),
          name: page.page.parentName,
          parentPath,
          entries: page.page.items.map((item) => ({
            path: `cloud:${cloud.connectionId}/${item.id}`,
            name: item.name,
            kind: item.kind,
            extension: item.kind === 'file' && item.name.includes('.')
              ? item.name.split('.').pop()
              : undefined,
            size: item.size ?? null,
            lastModified: item.modifiedAt ?? null,
          })),
        }
      }

      const { sourceId, relativePath } = parseKnowledgePath(requested)
      const [files, folders, sources] = await Promise.all([listFiles(), listFolders(), listSources()])
      const source = sources.find((item) => item.id === sourceId)
      const name = relativePath
        ? lastSegment
        : resolveSourceDisplayName(source?.name, lastSegment)
      const sourceFiles = files.filter((file) => file.sourceId === sourceId)
      const sourceFolders = folders.filter((folder) => folder.sourceId === sourceId)
      const folderEntries = sourceFolders
        .filter((folder) => isDirectBrowseChild(relativePath || sourceId, knowledgePath(folder.sourceId, folder.relativePath)))
        .map((folder) => ({
          path: knowledgePath(folder.sourceId, folder.relativePath),
          name: folder.folderName || folder.name,
          kind: 'folder' as const,
          size: null,
          lastModified: folder.lastModified,
        }))
      const fileEntries = sourceFiles
        .filter((file) => {
          const parent = knowledgePath(file.sourceId, file.parentRelative)
          return normalizeBrowsePath(parent).toLowerCase() === requested.toLowerCase()
            || (relativePath === '' && file.parentRelative === '' && file.sourceId === sourceId && requested === sourceId)
        })
        .map((file) => ({
          path: knowledgePath(file.sourceId, file.relativePath),
          name: file.name,
          kind: 'file' as const,
          extension: file.name.includes('.') ? file.name.split('.').pop() : undefined,
          size: file.size,
          lastModified: file.lastModified,
        }))
      return {
        path: requested,
        name,
        parentPath: browseParentPath(requested),
        entries: [...folderEntries, ...fileEntries].sort((left, right) => {
          if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
          return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
        }),
      }
    },
    getIndexBrowse: async () => {
      const folders = await listFolders()
      const files = await listFiles()
      return {
        folders: folders.map((folder) => ({
          path: knowledgePath(folder.sourceId, folder.relativePath),
          name: folder.folderName,
          fileCount: folder.fileCount,
        })),
        files: files.map((file) => ({
          path: knowledgePath(file.sourceId, file.relativePath),
          name: file.name,
          extension: file.name.split('.').pop(),
        })),
      }
    },
    searchDocuments: async (query: SearchQuery): Promise<SearchResults> => {
      const [files, folders, sources, workflows, activity] = await Promise.all([
        listFiles(),
        listFolders(),
        listSources(),
        listWorkflows(),
        listActivityRuns(),
      ])
      const hits = searchKnowledge({
        query: query.text,
        files,
        folders,
        sources,
        workflows,
        activity: activity.map((run) => ({
          id: run.runId,
          completedAt: run.completedAt,
          message: run.workflowName ?? `${run.summary.moved} organised`,
          items: [],
        })),
      })
      const mapped = hits.map((hit) => {
        const extension = hit.kind === 'file' ? hit.title.split('.').pop() ?? null : null
        const documentFilter = documentFilterForName(hit.title)
        const matchedOn: SearchMatchField[] =
          hit.kind === 'file' ? ['filename'] : hit.kind === 'folder' ? ['folder'] : ['recent']
        const file = hit.kind === 'file' ? files.find((item) => item.id === hit.id) : undefined
        const source = file ? sources.find((item) => item.id === file.sourceId) : undefined
        const sourceAvailable = !source || sourceCapabilities(sourceAccessState(source.status)).openable
        return {
          id: hit.id,
          kind:
            hit.kind === 'source'
              ? 'folder' as const
              : hit.kind === 'file'
                ? 'file' as const
                : hit.kind === 'folder'
                  ? 'folder' as const
                  : hit.kind === 'workflow'
                    ? 'workflow' as const
                    : 'activity' as const,
          title: hit.title,
          subtitle: hit.subtitle,
          path:
            file != null
              ? knowledgePath(file.sourceId, file.relativePath)
              : hit.kind === 'folder'
                ? (() => {
                    const folder = folders.find((entry) => entry.id === hit.id)
                    return folder ? knowledgePath(folder.sourceId, folder.relativePath) : hit.id
                  })()
                : hit.id,
          folderPath: hit.kind === 'folder' || hit.kind === 'source' ? hit.id : null,
          extension,
          documentFilter,
          lastSeenAt: null,
          matchedOn,
          workflowId: hit.kind === 'workflow' ? hit.id : undefined,
          activityRunId: hit.kind === 'activity' ? hit.id : undefined,
          sourceAvailable,
          sourceName: source?.name,
        }
      })
      const filtered =
        query.filter === 'all'
          ? mapped
          : mapped.filter((hit) => hit.kind !== 'file' || hit.documentFilter === query.filter)
      console.info('[suhuella-connect] search', {
        query: query.text,
        filter: query.filter,
        filesRead: files.length,
        sourcesRead: sources.length,
        resultCount: filtered.length,
      })
      return {
        query: query.text,
        filter: query.filter,
        hits: filtered,
      }
    },
    openSearchPath: async () => ({ ok: false, error: HOST_ACTION_COPY.openFileDesktopOnly }),
    revealSearchPath: async () => ({ ok: false, error: HOST_ACTION_COPY.revealUnavailable }),
    getKnowledgeIndexHealth: async () => {
      const sources = await listSources()
      const files = sources.reduce((sum, source) => sum + source.fileCount, 0)
      return {
        status: 'ready',
        locationCount: sources.length,
        sourceCount: sources.length,
        folderCount: sources.reduce((sum, source) => sum + source.folderCount, 0),
        fileCount: files,
        indexVersion: 1,
        lastIndexed: sources[0]?.lastIndexed ?? null,
        searchReady: true,
      }
    },
    getSuggestedLocations: async (): Promise<SuggestedLocation[]> => {
      return mergeSuggestedCatalog('browser', detectPlatform(), []).map((place) => ({
        ...place,
        exists: true,
      }))
    },
    // Chrome picker in production. Localhost Dev Host can seed /dev-data without a picker.
    addIndexedLocation: async (hint?: string) => {
      if (isDevDemoHint(hint)) {
        if (!isBrowserDevHost()) {
          return emptySettings(await listSources())
        }
        await connectDemoSource()
        emitIndexProgress(await listSources())
        return emptySettings(await listSources())
      }
      const wellKnown = hint?.startsWith('suhuella:') ? hint : undefined
      try {
        await connectLocalFolder(SUGGESTED_START[hint ?? ''] ?? undefined, wellKnown)
        emitIndexProgress(await listSources())
        return emptySettings(await listSources())
      } catch (error) {
        if (isProtectedFolderError(error)) {
          throw error instanceof FolderAccessError
            ? error
            : new FolderAccessError('protected', 'This folder is not available in this browser.')
        }
        throw error
      }
    },
    removeIndexedLocation: async (location: string) => {
      await removeSource(location)
      dropBrowserSourceAppearance(location)
      return emptySettings(await listSources())
    },
    setIndexedLocations: async (locations: string[]) => {
      const added = locations.filter((location) => location.startsWith('suhuella:'))
      if (added[0]) {
        try {
          await connectLocalFolder(SUGGESTED_START[added[0]])
        } catch (error) {
          if (!isAbortError(error)) throw error
        }
        return emptySettings(await listSources())
      }
      return emptySettings(await listSources())
    },
    startIndexScan: async (_refresh?: 'pending' | 'all') => {
      const sources = await listSources()
      for (const source of sources) {
        if (source.status === 'indexing') continue
        await refreshSource(source.id)
      }
      emitIndexProgress(await listSources())
      return emptySettings(await listSources())
    },
    restoreSourceAccess: async (sourceId: string) => {
      await restoreSourceAccess(sourceId)
      return emptySettings(await listSources())
    },
    cancelIndexScan: async () => {},
    onIndexProgress: (listener) => {
      progressListeners.add(listener)
      return () => {
        progressListeners.delete(listener)
      }
    },
    onPlanExecutionProgress: (listener) => {
      planProgressListeners.add(listener)
      return () => {
        planProgressListeners.delete(listener)
      }
    },
    droppedFilePath: () => null,
    matchFoldersForFile: async () => null,
    setLaunchAtLogin: async () => emptySettings(await listSources()),
    setPermissionPreferences: async (prefs) => {
      const current = loadBrowserPermissions()
      const next = normalizePermissionPreferences({
        allowFolderChanges:
          typeof prefs.allowFolderChanges === 'boolean'
            ? prefs.allowFolderChanges
            : current.allowFolderChanges,
        trashEnabled:
          typeof prefs.trashEnabled === 'boolean' ? prefs.trashEnabled : current.trashEnabled,
      })
      saveBrowserPermissions(next)
      return { ...emptySettings(await listSources()), permissions: next }
    },
    setSourceAppearanceColor: async (path: string, color: string | null) =>
      applyBrowserSourceAppearance(path, { color }),
    setSourceAppearance: applyBrowserSourceAppearance,
    getSettingsPath: async () => 'This device',
    revealSettingsFile: async () => {},
    checkRelease: async () => ({
      kind: 'current' as const,
      installed: brand.release.version,
      latest: brand.release.version,
      minimum: brand.release.minimumVersion,
      notes: '',
      url: null,
      canInstall: false,
    }),
    getAppInfo: async () => {
      const platform = detectPlatform()
      const access = folderAccessKind()
      const folderAccess = access !== 'none'
      return {
        name: brand.displayName,
        version: brand.release.version,
        buildVersion: brand.release.version,
        platform,
        development: false,
        host: 'browser' as const,
        folderAccess,
        computerName: await browserComputerName(),
        osVersion: platform === 'win32' ? 'Windows' : platform === 'linux' ? 'Linux' : 'macOS',
        capabilities: capabilitiesFor({
          host: 'browser',
          platform,
          folderAccess,
          organise: access === 'directory-picker' && fileWriteSupported(),
        }),
      }
    },
    getLicense: async () => licenseView(),
    getServiceHealth: async () => {
      const health = await fetchPublicServiceHealth()
      return health ?? NORMAL_SERVICE_HEALTH
    },
    openExternal: async (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer')
      return true
    },
    createCheckoutAttempt: async (plan) => createCheckoutAttempt(plan),
    openCheckout: async (plan, email) => {
      const attempt = await createCheckoutAttempt(plan)
      const params = new URLSearchParams({ return: 'settings' })
      if (email?.trim()) params.set('email', email.trim())
      if (attempt.ok) {
        sessionStorage.setItem('suhuella_activation_attempt_id', attempt.activationAttemptId)
        params.set('attempt', attempt.activationAttemptId)
      }
      window.location.assign(`/checkout/${plan}?${params.toString()}`)
      return true
    },
    activateFromCheckout: async (sessionId: string, activationAttemptId?: string) => {
      const attemptId =
        activationAttemptId?.trim() ||
        sessionStorage.getItem('suhuella_activation_attempt_id') ||
        undefined
      const result = await activateFromCheckout(sessionId, attemptId)
      if (result.ok) sessionStorage.removeItem('suhuella_activation_attempt_id')
      const view = await licenseView(result.license as LicenseContext | null)
      return result.ok ? { ok: true as const, license: view } : { ok: false as const, error: result.error, license: view }
    },
    requestLicenseEmailCode: async (email: string) => requestLicenseEmailCode(email),
    verifyLicenseEmailCode: async (challengeId: string, code: string) =>
      verifyLicenseEmailCode(challengeId, code),
    updateBusinessBranding: async (dataUrl: string | null) => {
      const result = await updateBusinessBranding(dataUrl)
      const view = await licenseView(result.license as LicenseContext | null)
      return result.ok ? { ok: true as const, license: view } : { ok: false as const, error: result.error, license: view }
    },
    getBusinessOrganisation: () => getBusinessOrganisation(),
    manageBusinessOrganisation: (action, payload) => manageBusinessOrganisation(action, payload),
    listCloudIntegrations: () => listCloudIntegrations(),
    startCloudIntegration: (provider) => startCloudIntegration(provider),
    disconnectCloudIntegration: (connectionId) => disconnectCloudIntegration(connectionId),
    reconnectCloudIntegration: (connectionId) => reconnectCloudIntegration(connectionId),
    getCloudIntegrationStatus: (connectionId) => getCloudIntegrationStatus(connectionId),
    activateLicense: async (emailProofId: string) => {
      const result = await activateLicense(emailProofId)
      const view = await licenseView(result.license as LicenseContext | null)
      return result.ok ? { ok: true as const, license: view } : { ok: false as const, error: result.error, license: view }
    },
    checkLicense: async () => {
      const result = await checkLicense()
      const view = await licenseView(result.license as LicenseContext | null)
      return result.ok ? { ok: true as const, license: view } : { ok: false as const, error: result.error, license: view }
    },
    deactivateLicense: async () => {
      const result = await deactivateLicense()
      const view = await licenseView(result.license as LicenseContext | null)
      return result.ok ? { ok: true as const, license: view } : { ok: false as const, error: result.error, license: view }
    },
    deactivateRemoteDevice: async () => ({ ok: false, error: 'invalid_request', license: await licenseView() }),
    renameThisDevice: async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) {
        return { ok: false as const, error: 'invalid_request' as const, license: await licenseView() }
      }
      await renameDevice(trimmed)
      const view = await licenseView()
      return { ok: true as const, license: view }
    },
    getCompatibilityDiagnostics: async () => ({
      development: false,
      attemptCount: 0,
      lastAttempt: null,
      attempts: [],
    }),
    exportCompatibilityDiagnostics: async () => {
      throw new HostCapabilityError(HOST_ACTION_COPY.exportUnavailable)
    },
    finishOnboarding: async () => emptySettings(await listSources()),
    dismissWelcomeHint: async () => ({
      ...emptySettings(await listSources()),
      welcomeNotificationShown: true,
    }),
    previewSuggestions: async () => {},
    previewSuggestionName: async (fileName: string) => ({
      fileName,
      sourceApp: 'browser',
      currentFolder: '',
      mode: 'preview' as const,
      recommendations: [],
    }),
    pickSuggestionFile: async () => null,
    getSuggestion: async () => null,
    onSuggestionUpdated: () => () => {},
    chooseRecommendedFolder: async () => ({
      ok: false,
      folder: '',
      error: HOST_ACTION_COPY.saveAsPreviewOnly,
    }),
    chooseAnotherFolder: async () => {},
    copyFolderPath: async () => {
      throw new HostCapabilityError(HOST_ACTION_COPY.revealUnavailable)
    },
    openFolder: async () => ({ ok: false, error: HOST_ACTION_COPY.openFolderUnavailable }),
    includeSource: async () => ({
      ok: false,
      error: HOST_ACTION_COPY.openFolderUnavailable,
    }),
    closeSuggestion: async () => {},
    pickKnowledgeSetFiles: async (): Promise<KnowledgeSetItem[]> => {
      try {
        const files = await requestLocalFiles()
        const stamp = Date.now()
        const descriptors = files.map((file, index) =>
          indexedFileFromBrowserFile(file, 'picked', `${stamp}-${index}/${file.name}`),
        )
        rememberOrganiseDescriptors(descriptors, [transientFolderFromName('picked', 'Chosen files')])
        return knowledgeItemsFromBrowserFiles(files, (_file, index) =>
          knowledgePath('picked', `${stamp}-${index}/${files[index]?.name ?? 'file'}`),
        )
      } catch (error) {
        if (isAbortError(error)) return []
        throw error
      }
    },
    pickKnowledgeSetFolders: async (): Promise<KnowledgeSetItem[]> => {
      if (folderAccessKind() === 'none') {
        throw new FolderAccessError('unsupported', ORGANISE_FOLDER_UNSUPPORTED)
      }
      try {
        const picked = await requestLocalFolder()
        const sourceId = `picked_${Date.now().toString(36)}`
        if (picked.kind === 'handle') {
          const scanned = await scanDirectory(picked.handle, sourceId)
          rememberOrganiseDescriptors(scanned.files, scanned.folders)
          return knowledgeItemsFromIndexedFiles(scanned.files, (file) =>
            knowledgePath(file.sourceId, file.relativePath),
          )
        }
        const scanned = scanFileList(picked.files, sourceId)
        rememberOrganiseDescriptors(scanned.files, scanned.folders)
        return knowledgeItemsFromIndexedFiles(scanned.files, (file) =>
          knowledgePath(file.sourceId, file.relativePath),
        )
      } catch (error) {
        if (isAbortError(error)) return []
        throw error
      }
    },
    previewOrganisationPlan: async (knowledgeSet: KnowledgeSet) => {
      const transient = listOrganiseDescriptors()
      const files = [...(await listFiles()), ...transient.files]
      const folders = [...(await listFolders()), ...transient.folders]
      const selected = knowledgeSet.items.flatMap((item) => {
        const parsed = parseKnowledgePath(item.path)
        if (item.kind === 'file') {
          const file = files.find(
            (entry) =>
              entry.id === item.path ||
              (entry.sourceId === parsed.sourceId && entry.relativePath === parsed.relativePath),
          )
          if (file) return [file]
          if (parsed.sourceId === 'picked' || parsed.sourceId.startsWith('picked')) {
            const name = parsed.relativePath.split('/').pop() || parsed.relativePath
            return [
              {
                id: item.path,
                sourceId: parsed.sourceId,
                name,
                relativePath: parsed.relativePath || name,
                parentRelative: parsed.relativePath.includes('/')
                  ? parsed.relativePath.split('/').slice(0, -1).join('/')
                  : '',
                size: 0,
                lastModified: null,
              },
            ]
          }
          return []
        }
        return files.filter((file) => {
          if (file.sourceId !== parsed.sourceId && file.sourceId !== item.path) return false
          if (!parsed.relativePath) return true
          return file.relativePath === parsed.relativePath || file.relativePath.startsWith(`${parsed.relativePath}/`)
        })
      })
      const sources = await listSources()
      const items = previewPlan(selected, folders).map((item) => {
        const source = sources.find((entry) => entry.id === item.sourceId)
        const sourceName = source?.name
        const openable = !source || sourceCapabilities(sourceAccessState(source.status)).openable
        const planItem = toPlanItem(
          {
            ...item,
            currentPath: knowledgePath(item.sourceId, item.currentPath),
            proposedPath: item.proposedPath ? knowledgePath(item.sourceId, item.proposedPath) : null,
          },
          sourceName,
        )
        if (source && !openable) {
          const reason = source.status === 'needs_permission' ? 'permission' : 'disconnected'
          return markPlanItemSourceUnavailable(planItem, sourceName, reason)
        }
        return planItem
      })
      const preview: OrganisationPlanPreview = {
        simulated: true,
        message: 'Review the plan. Confirm selected actions only.',
        knowledgeSet,
        items,
        proposedBy: 'engine',
      }
      return { ok: true as const, preview }
    },
    proposeOrganisationPlan: async (knowledgeSet) => {
      const preview = await api.previewOrganisationPlan(knowledgeSet)
      if (!preview.ok) return { ok: false as const, error: preview.error }
      return {
        ok: true as const,
        kind: 'proposal' as const,
        proposal: {
          simulated: true as const,
          source: 'assistant' as const,
          message: 'Review this plan. Confirm stays with you.',
          knowledgeSet,
          preview: preview.preview,
          workflows: [],
          note: null,
          using: { backend: 'on_device' as const, label: 'Built-in rules' },
        },
      }
    },
    getPlanAssistantStatus: async () => ({
      using: { backend: 'on_device' as const, label: 'Built-in rules' },
    }),
    executeOrganisationPlan: async (request) => {
      if (!request.confirmed) {
        return {
          ok: false as const,
          error: { code: 'confirmation_required' as const, message: 'Confirm changes before executing.' },
        }
      }
      if (loadBrowserPermissions().allowFolderChanges === false) {
        return {
          ok: false as const,
          error: {
            code: 'invalid_request' as const,
            message:
              'Folder changes are turned off in Settings → Permissions. Turn them on to Confirm Plan.',
          },
        }
      }
      const rights = assertHostExecutorGenerationRights(await loadLicense())
      if (!rights.ok) {
        return {
          ok: false as const,
          error: {
            code: rights.error.code === 'generation_required' ? ('generation_required' as const) : ('invalid_request' as const),
            message: rights.error.message,
          },
        }
      }
      const canWrite = folderAccessKind() === 'directory-picker' && fileWriteSupported()
      if (!canWrite) {
        return {
          ok: false as const,
          error: { code: 'invalid_request' as const, message: ORGANISE_EXECUTION_LIMIT },
        }
      }
      const runId = `web-${Date.now().toString(36)}`
      const runNumber = request.runNumber ?? 1
      const startedAt = new Date().toISOString()
      const publish = async (webItems: WebPlanItem[], completedAt: string) => {
        const items = webItems.map((item) => toPlanItem(item))
        const appliedCount = items.filter((item) => item.status === 'applied').length
        const skippedCount = items.filter((item) => item.status === 'skipped').length
        const failedCount = items.filter((item) => item.status === 'failed').length
        const run: ActivityRun = {
          runId,
          runNumber,
          startedAt,
          completedAt,
          trigger: request.trigger ?? 'organise_documents',
          plan: { knowledgeSet: request.plan.knowledgeSet, items },
          inversePlan: {
            knowledgeSet: request.plan.knowledgeSet,
            items: items
              .filter((item) => item.status === 'applied')
              .map((item) => ({
                ...item,
                currentPath: item.proposedPath ?? item.currentPath,
                proposedPath: item.currentPath,
                status: 'preview' as const,
                selected: true,
              })),
          },
          summary: { moved: appliedCount, skipped: skippedCount, failed: failedCount },
          items: toActivityItems(items),
        }
        await recordActivityRun(run)
        const existing = activityCache.findIndex((entry) => entry.runId === runId)
        if (existing >= 0) activityCache[existing] = run
        else activityCache.unshift(run)
        return { items, appliedCount, skippedCount, failedCount }
      }
      const watchExecution = request.executionMode === 'watch'
      let progressCursor = 0
      const executed = await executeGuardedPlan(request.plan.items.map(fromPlanItem), {
        canWrite,
        loadHandle,
        ensurePermission: (handle) => ensurePermission(handle as FileSystemDirectoryHandle, 'readwrite'),
        transfer: (handle, fromRelative, toRelative, allowCreateFolders) =>
          moveOrRenameFile(handle as FileSystemDirectoryHandle, fromRelative, toRelative, allowCreateFolders),
        onJournal: async (snapshot) => {
          if (watchExecution && snapshot.phase === 'settled') {
            for (let index = progressCursor; index < snapshot.items.length; index += 1) {
              const webItem = snapshot.items[index]
              if (webItem.skipReason === INTENT_NOTE || webItem.skipReason === UNCERTAIN_NOTE) continue
              const settled =
                webItem.status === 'applied' ||
                webItem.status === 'failed' ||
                (webItem.status === 'skipped' && webItem.skipReason !== INTENT_NOTE)
              if (!settled) continue
              const event: PlanExecutionProgressEvent = {
                item: toPlanItem(webItem),
                index,
                total: snapshot.items.length,
              }
              for (const listener of planProgressListeners) listener(event)
              progressCursor = index + 1
            }
          }
          await publish(snapshot.items, new Date().toISOString())
        },
      })
      if (!executed.ok) {
        return { ok: false as const, error: executed.error }
      }
      const published = await publish(executed.items, new Date().toISOString())
      const indexFailures: string[] = []
      for (const sourceId of executed.affectedSourceIds) {
        try {
          const refreshed = await refreshSource(sourceId)
          if (!refreshed) indexFailures.push(sourceId)
        } catch {
          indexFailures.push(sourceId)
        }
      }
      const indexMessage =
        indexFailures.length > 0
          ? `File changes were kept. Index update failed for ${indexFailures.join(', ')}.`
          : null
      const result: OrganisationExecutionResult = {
        simulated: false,
        runId,
        runNumber,
        completedAt: new Date().toISOString(),
        message: [
          published.appliedCount > 0
            ? `Confirmed ${published.appliedCount} action${published.appliedCount === 1 ? '' : 's'}`
            : 'No actions applied',
          indexMessage,
        ]
          .filter(Boolean)
          .join(' '),
        knowledgeSet: request.plan.knowledgeSet,
        appliedCount: published.appliedCount,
        skippedCount: published.skippedCount,
        failedCount: published.failedCount,
        items: published.items,
      }
      return { ok: true as const, result }
    },
    probeLocalModels: async () => {
      const { probeLocalModelsBrowser } = await import('../lib/local-model-discovery.ts')
      return probeLocalModelsBrowser()
    },
    getByokStatus: async () => ({
      connected: false,
      assistant: null,
      assistantLabel: null,
      model: null,
      hasKey: false,
    }),
    connectByok: async () => ({ ok: false, error: 'not_available' }),
    disconnectByok: async () => ({
      connected: false,
      assistant: null,
      assistantLabel: null,
      model: null,
      hasKey: false,
    }),
    assistWithByok: async () => ({ ok: false, error: 'not_available' }),
    getByokConversation: async () => [],
    clearByokConversation: async () => [],
    getActivity: async () => {
      if (activityCache.length === 0) {
        activityCache.push(...(await listActivityRuns()))
      }
      return [...activityCache]
    },
    undoActivity: async (request) => {
      if (!request.confirmed) {
        return {
          ok: false as const,
          error: { code: 'confirmation_required' as const, message: 'Confirm changes before undoing.' },
        }
      }
      const run = activityCache.find((item) => item.runId === request.runId)
      if (!run?.inversePlan) {
        return { ok: false as const, error: { code: 'invalid_request' as const, message: 'This run cannot be undone.' } }
      }
      const executed = await api.executeOrganisationPlan({
        plan: run.inversePlan,
        confirmed: true,
        trigger: 'organise_documents',
        runNumber: activityCache.length + 1,
      })
      if (!executed.ok) return executed
      const undoRun = activityCache[0]
      if (undoRun) {
        undoRun.trigger = 'undo'
        undoRun.reversesRunId = run.runId
        await recordActivityRun(undoRun)
      }
      return {
        ok: true as const,
        result: {
          run: undoRun ?? run,
          runs: activityCache,
        },
      }
    },
    getStorageUsage: async () => ({
      indexBytes: (await appStorageBytes()) ?? 0,
      activityBytes: 0,
      cacheBytes: 0,
      logsBytes: 0,
      workflowsBytes: 0,
      settingsBytes: 0,
      licenseBytes: 0,
      lastCleanupAt: null,
    }),
    getDocumentStorageSummary: async () => {
      const sources = await listSources()
      return {
        measuredAt: new Date().toISOString(),
        totalBytes: sources.reduce((sum, source) => sum + source.bytes, 0),
        sources: sources.map((source) => ({
          id: source.id,
          kind: 'local_folder' as const,
          label: source.name,
          bytes: source.bytes,
          fileCount: source.fileCount,
          status: source.status === 'ready' ? ('ready' as const) : ('unavailable' as const),
        })),
      }
    },
    getStorageOverview: async () => {
      const sources = await reconcileSources()
      const supported = folderAccessKind() !== 'none'
      const appBytes = (await appStorageBytes()) ?? 0
      const now = new Date().toISOString()
      const mapped = sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: 'local_folder' as const,
        locator: source.name,
        bytes: source.bytes,
        documentCount: source.fileCount,
        folderCount: source.folderCount,
        status: storageStatus(source.status, supported),
        lastMeasuredAt: now,
      }))
      const localBytes = mapped.reduce((sum, source) => sum + (source.bytes ?? 0), 0)
      return {
        knowledgeTotalBytes: mapped.length > 0 ? localBytes : null,
        knowledgeDocumentCount: mapped.reduce((sum, source) => sum + (source.documentCount ?? 0), 0),
        sourceCount: mapped.length,
        localBytes: mapped.length > 0 ? localBytes : null,
        cloudBytes: null,
        appStorageTotalBytes: appBytes,
        sources: mapped,
        appStorage: {
          indexBytes: appBytes,
          activityBytes: 0,
          cacheBytes: 0,
          logsBytes: 0,
          workflowsBytes: 0,
          settingsBytes: 0,
          licenseBytes: 0,
        },
        measuredAt: now,
        status: !supported ? ('unavailable' as const) : mapped.length === 0 ? ('empty' as const) : ('measured' as const),
        warnings: !supported
          ? [
              {
                code: 'failed' as const,
                message: 'Folder access is not available in this browser. Use Chrome or Edge, or download the desktop app.',
              },
            ]
          : [],
      }
    },
    getDeviceMetrics: async () => {
      const overview = await api.getStorageOverview()
      const sources = await listSources()
      const memory = (performance as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
      let appBytes = overview.appStorage.indexBytes
      try {
        const estimate = await navigator.storage?.estimate?.()
        if (estimate?.usage != null && estimate.usage > 0) {
          appBytes = estimate.usage
        }
      } catch {
        // Browser quota is optional.
      }
      return assembleDeviceMetrics({
        host: 'web',
        platform: 'web',
        deviceName: await browserComputerName(),
        overview: {
          ...overview,
          appStorage: {
            ...overview.appStorage,
            indexBytes: appBytes,
          },
          appStorageTotalBytes: appBytes,
        },
        deviceStorage: { status: 'unsupported' },
        performance: {
          memoryBytes: memory && memory > 0 ? memory : undefined,
          status: memory && memory > 0 ? 'measured' : 'not_measured',
        },
        folderCount: sources.reduce((sum, source) => sum + source.folderCount, 0),
      })
    },
    clearCache: async () => api.getStorageUsage(),
    clearLogs: async () => api.getStorageUsage(),
    clearActivityHistory: async () => {
      activityCache.length = 0
      await clearActivityRuns()
      return api.getStorageUsage()
    },
    exportActivity: async () => {
      throw new HostCapabilityError(HOST_ACTION_COPY.exportUnavailable)
    },
    listSavedPlans: async () => listSavedPlans(),
    saveSavedPlan: async (draft) => {
      if (draft.id) {
        const existing = (await listSavedPlans()).find((plan) => plan.id === draft.id)
        if (!existing) return { ok: false as const, error: { code: 'invalid_plan' as const, message: 'Saved Plan not found.' } }
      }
      const plan = await saveSavedPlanRecord(draft)
      if (!plan) return { ok: false as const, error: { code: 'invalid_plan' as const, message: 'A saved Plan needs documents and plan items.' } }
      return { ok: true as const, plan }
    },
    deleteSavedPlan: async (planId) => {
      const existing = (await listSavedPlans()).some((plan) => plan.id === planId)
      if (!existing) return { ok: false as const, error: { code: 'invalid_plan' as const, message: 'Saved Plan not found.' } }
      await deleteSavedPlanRecord(planId)
      return { ok: true as const, plans: await listSavedPlans() }
    },
    duplicateSavedPlan: async (planId) => {
      const plan = await duplicateSavedPlanRecord(planId)
      if (!plan) return { ok: false as const, error: { code: 'invalid_plan' as const, message: 'Saved Plan not found.' } }
      return { ok: true as const, plan }
    },
    listWorkflows: async () => (await listWorkflows()).map(toWorkflow),
    saveWorkflow: async (draft) => {
      const workflow = await saveWorkflow(
        draft.name,
        draft.knowledgeSet.items.map((item) => item.path),
      )
      return { ok: true as const, workflow: toWorkflow(workflow) }
    },
    updateWorkflow: async (_id, draft) => api.saveWorkflow(draft),
    deleteWorkflow: async (workflowId) => {
      await deleteWorkflow(workflowId)
      return { ok: true as const, workflows: (await listWorkflows()).map(toWorkflow) }
    },
    duplicateWorkflow: async (workflowId) => {
      const workflows = await listWorkflows()
      const current = workflows.find((item) => item.id === workflowId)
      if (!current) return { ok: false as const, error: { code: 'invalid_workflow' as const, message: 'Workflow not found.' } }
      const copy = await saveWorkflow(`${current.name} (copy)`, current.fileIds)
      return { ok: true as const, workflow: toWorkflow(copy) }
    },
    loadWorkflowForRun: async (workflowId) => {
      const workflows = await listWorkflows()
      const current = workflows.find((item) => item.id === workflowId)
      if (!current) return { ok: false as const, error: { code: 'invalid_workflow' as const, message: 'Workflow not found.' } }
      await markWorkflowRan(workflowId)
      return {
        ok: true as const,
        workflow: toWorkflow(current),
        knowledgeSet: { items: current.fileIds.map((path) => ({ path, kind: 'file' as const })) },
      }
    },
    setWorkflowAutopilot: async () => ({
      ok: false as const,
      error: { code: 'invalid_workflow' as const, message: 'Autopilot is not available in the browser.' },
    }),
    approveWorkflowPlan: async () => ({
      ok: false as const,
      error: { code: 'invalid_plan' as const, message: 'Autopilot is not available in the browser.' },
    }),
    runAutopilot: async () => ({
      ok: false as const,
      error: { code: 'invalid_request' as const, message: 'Autopilot is not available in the browser.' },
    }),
  }

  window.suhuella = api
}

const activityCache: ActivityRun[] = []

export { formatBytes, clearLocalKnowledge }
