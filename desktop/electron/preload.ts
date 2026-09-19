import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ReleaseDecision } from '@suhuella/product/lib/release-lifecycle.ts'
import type {
  ActivityRun,
  AppInfo,
  AppSettings,
  ByokAssistRequest,
  ByokAssistResult,
  ByokConnectRequest,
  ByokConnectResult,
  ByokConversationMessage,
  ByokStatus,
  CompatibilityDiagnostics,
  FolderMatchPreview,
  IndexScanProgress,
  IndexBrowse,
  SourceBrowse,
  IndexStatus,
  KnowledgeIndexHealth,
  NavigateFolderResult,
  OpenFolderResult,
  SearchQuery,
  SearchResults,
  KnowledgeSet,
  KnowledgeSetItem,
  KnowledgeSetValidationError,
  LicenseActionResult,
  LicenseStatusView,
  OrganisationExecutionRequest,
  OrganisationExecutionResult,
  OrganisationPlan,
  OrganisationPlanPreview,
  PlanAssistantStatus,
  PlanAssistantTurn,
  DeviceMetrics,
  DocumentStorageSummary,
  StorageOverview,
  StorageUsage,
  Workflow,
  SuggestedLocation,
  SuggestionPayload,
  UndoExecutionRequest,
  UndoExecutionResult,
  IncludeSourceResult,
} from '@suhuella/product/types.ts'

const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  getIndexStatus: (): Promise<IndexStatus> => ipcRenderer.invoke('index:getStatus'),
  getIndexBrowse: (): Promise<IndexBrowse> => ipcRenderer.invoke('index:getBrowse'),
  browseSource: (path: string): Promise<SourceBrowse> => ipcRenderer.invoke('index:browseSource', path),
  searchDocuments: (query: SearchQuery): Promise<SearchResults> =>
    ipcRenderer.invoke('search:query', query),
  openSearchPath: (target: string): Promise<OpenFolderResult> =>
    ipcRenderer.invoke('search:open', target),
  revealSearchPath: (target: string): Promise<OpenFolderResult> =>
    ipcRenderer.invoke('search:reveal', target),
  getKnowledgeIndexHealth: (): Promise<KnowledgeIndexHealth> =>
    ipcRenderer.invoke('index:getKnowledgeHealth'),
  getSuggestedLocations: (): Promise<SuggestedLocation[]> =>
    ipcRenderer.invoke('index:getSuggestedLocations'),
  addIndexedLocation: (): Promise<AppSettings> => ipcRenderer.invoke('index:addLocation'),
  removeIndexedLocation: (location: string): Promise<AppSettings> =>
    ipcRenderer.invoke('index:removeLocation', location),
  setIndexedLocations: (locations: string[]): Promise<AppSettings> =>
    ipcRenderer.invoke('index:setLocations', locations),
  startIndexScan: (): Promise<AppSettings> => ipcRenderer.invoke('index:startScan'),
  restoreSourceAccess: (sourceId: string): Promise<AppSettings> =>
    ipcRenderer.invoke('index:restoreSourceAccess', sourceId),
  cancelIndexScan: (): Promise<void> => ipcRenderer.invoke('index:cancelScan'),
  onIndexProgress: (listener: (progress: IndexScanProgress) => void): (() => void) => {
    const handler = (_event: unknown, progress: IndexScanProgress) => listener(progress)
    ipcRenderer.on('index:progress', handler)
    return () => {
      ipcRenderer.removeListener('index:progress', handler)
    }
  },
  droppedFilePath: (file: File): string | null => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return null
    }
  },
  matchFoldersForFile: (file: File): Promise<FolderMatchPreview | null> => {
    try {
      const filePath = webUtils.getPathForFile(file)
      return ipcRenderer.invoke('settings:matchFoldersForFile', filePath)
    } catch {
      return Promise.resolve(null)
    }
  },
  setLaunchAtLogin: (enabled: boolean): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:setLaunchAtLogin', enabled),
  setSourceAppearanceColor: (path: string, color: string | null): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:setSourceAppearanceColor', path, color),
  setSourceAppearance: (
    path: string,
    update: { color?: string | null; iconId?: string | null },
  ): Promise<AppSettings> => ipcRenderer.invoke('settings:setSourceAppearance', path, update),
  getSettingsPath: (): Promise<string> => ipcRenderer.invoke('settings:getPath'),
  revealSettingsFile: (): Promise<void> => ipcRenderer.invoke('settings:revealFile'),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
  checkRelease: (): Promise<ReleaseDecision> => ipcRenderer.invoke('release:check'),
  getLicense: (): Promise<LicenseStatusView> => ipcRenderer.invoke('license:get'),
  getServiceHealth: () => ipcRenderer.invoke('license:serviceHealth'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:openExternal', url),
  openCheckout: (plan: 'lifetime' | 'monthly' | 'business', email?: string): Promise<boolean> =>
    ipcRenderer.invoke('license:openCheckout', plan, email ?? ''),
  createCheckoutAttempt: (
    plan: 'lifetime' | 'monthly' | 'business',
  ): Promise<{ ok: true; activationAttemptId: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('license:createCheckoutAttempt', plan),
  activateFromCheckout: (
    sessionId: string,
    activationAttemptId?: string,
  ): Promise<LicenseActionResult> =>
    ipcRenderer.invoke('license:activateFromCheckout', sessionId, activationAttemptId ?? ''),
  requestLicenseEmailCode: (
    email: string,
  ): Promise<{ ok: true; challengeId: string; message: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('license:requestEmailCode', email),
  verifyLicenseEmailCode: (
    challengeId: string,
    code: string,
  ): Promise<{ ok: true; proofId: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('license:verifyEmailCode', challengeId, code),
  activateLicense: (emailProofId: string): Promise<LicenseActionResult> =>
    ipcRenderer.invoke('license:activate', emailProofId),
  updateBusinessBranding: (dataUrl: string | null): Promise<LicenseActionResult> =>
    ipcRenderer.invoke('license:updateBranding', dataUrl),
  checkLicense: (): Promise<LicenseActionResult> => ipcRenderer.invoke('license:check'),
  deactivateLicense: (): Promise<LicenseActionResult> => ipcRenderer.invoke('license:deactivate'),
  deactivateRemoteDevice: (deviceIndex: number): Promise<LicenseActionResult> =>
    ipcRenderer.invoke('license:deactivate-remote', deviceIndex),
  renameThisDevice: (name: string): Promise<LicenseActionResult> =>
    ipcRenderer.invoke('license:rename-device', name),
  getCompatibilityDiagnostics: (): Promise<CompatibilityDiagnostics> =>
    ipcRenderer.invoke('diagnostics:get'),
  exportCompatibilityDiagnostics: (): Promise<string | null> =>
    ipcRenderer.invoke('diagnostics:export'),
  finishOnboarding: (destination?: 'home' | 'organise'): Promise<AppSettings> =>
    ipcRenderer.invoke('onboarding:finish', destination),
  previewSuggestions: (): Promise<void> => ipcRenderer.invoke('suggestion:preview'),
  previewSuggestionName: (fileName: string): Promise<SuggestionPayload> =>
    ipcRenderer.invoke('suggestion:previewName', fileName),
  pickSuggestionFile: (): Promise<SuggestionPayload | null> =>
    ipcRenderer.invoke('suggestion:pickFile'),
  getSuggestion: (): Promise<SuggestionPayload | null> => ipcRenderer.invoke('suggestion:get'),
  onSuggestionUpdated: (listener: (payload: SuggestionPayload) => void): (() => void) => {
    const handler = (_event: unknown, payload: SuggestionPayload) => listener(payload)
    ipcRenderer.on('suggestion:updated', handler)
    return () => {
      ipcRenderer.removeListener('suggestion:updated', handler)
    }
  },
  chooseRecommendedFolder: (folder: string): Promise<NavigateFolderResult> =>
    ipcRenderer.invoke('suggestion:choose', folder),
  chooseAnotherFolder: (): Promise<void> => ipcRenderer.invoke('suggestion:chooseAnother'),
  copyFolderPath: (folder: string): Promise<boolean> =>
    ipcRenderer.invoke('suggestion:copyPath', folder),
  openFolder: (folder: string): Promise<OpenFolderResult> =>
    ipcRenderer.invoke('suggestion:openFolder', folder),
  includeSource: (folder: string): Promise<IncludeSourceResult> =>
    ipcRenderer.invoke('suggestion:includeSource', folder),
  closeSuggestion: (): Promise<void> => ipcRenderer.invoke('suggestion:close'),
  pickKnowledgeSetFiles: (): Promise<KnowledgeSetItem[]> =>
    ipcRenderer.invoke('knowledge-set:pickFiles'),
  pickKnowledgeSetFolders: (): Promise<KnowledgeSetItem[]> =>
    ipcRenderer.invoke('knowledge-set:pickFolders'),
  previewOrganisationPlan: (
    knowledgeSet: KnowledgeSet,
  ): Promise<
    | { ok: true; preview: OrganisationPlanPreview }
    | { ok: false; error: KnowledgeSetValidationError }
  > => ipcRenderer.invoke('knowledge-set:previewPlan', knowledgeSet),
  proposeOrganisationPlan: (
    knowledgeSet: KnowledgeSet,
    note?: string,
    extras?: { workflowNames?: string[] },
  ): Promise<PlanAssistantTurn> =>
    ipcRenderer.invoke('knowledge-set:suggestPlan', {
      knowledgeSet,
      note,
      workflowNames: extras?.workflowNames,
    }),
  getPlanAssistantStatus: (): Promise<PlanAssistantStatus> =>
    ipcRenderer.invoke('plan-assistant:status'),
  executeOrganisationPlan: (
    request: OrganisationExecutionRequest,
  ): Promise<
    | { ok: true; result: OrganisationExecutionResult }
    | { ok: false; error: KnowledgeSetValidationError }
  > => ipcRenderer.invoke('knowledge-set:executePlan', request),
  getByokStatus: (): Promise<ByokStatus> => ipcRenderer.invoke('byok:get'),
  connectByok: (request: ByokConnectRequest): Promise<ByokConnectResult> =>
    ipcRenderer.invoke('byok:connect', request),
  disconnectByok: (): Promise<ByokStatus> => ipcRenderer.invoke('byok:disconnect'),
  assistWithByok: (request: ByokAssistRequest): Promise<ByokAssistResult> =>
    ipcRenderer.invoke('byok:assist', request),
  getByokConversation: (): Promise<ByokConversationMessage[]> =>
    ipcRenderer.invoke('byok:conversation'),
  clearByokConversation: (): Promise<ByokConversationMessage[]> =>
    ipcRenderer.invoke('byok:clearConversation'),
  getActivity: (): Promise<ActivityRun[]> => ipcRenderer.invoke('activity:get'),
  undoActivity: (
    request: UndoExecutionRequest,
  ): Promise<
    | { ok: true; result: UndoExecutionResult }
    | { ok: false; error: KnowledgeSetValidationError }
  > => ipcRenderer.invoke('activity:undo', request),
  getStorageUsage: (): Promise<StorageUsage> => ipcRenderer.invoke('storage:get'),
  getDocumentStorageSummary: (): Promise<DocumentStorageSummary> =>
    ipcRenderer.invoke('storage:documentSummary'),
  getStorageOverview: (): Promise<StorageOverview> => ipcRenderer.invoke('storage:overview'),
  getDeviceMetrics: (): Promise<DeviceMetrics> => ipcRenderer.invoke('metrics:get'),
  clearCache: (): Promise<StorageUsage> => ipcRenderer.invoke('storage:clearCache'),
  clearLogs: (): Promise<StorageUsage> => ipcRenderer.invoke('storage:clearLogs'),
  clearActivityHistory: (): Promise<StorageUsage> => ipcRenderer.invoke('storage:clearActivity'),
  exportActivity: (): Promise<string | null> => ipcRenderer.invoke('storage:exportActivity'),
  listWorkflows: (): Promise<Workflow[]> => ipcRenderer.invoke('workflows:list'),
  saveWorkflow: (
    draft: {
      name: string
      description?: string
      category?: string | null
      trigger: 'manual'
      knowledgeSet: KnowledgeSet
      approvedPlan?: OrganisationPlan
      autopilotEnabled?: boolean
    },
  ): Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }> =>
    ipcRenderer.invoke('workflows:save', draft),
  updateWorkflow: (
    workflowId: string,
    draft: {
      name: string
      description?: string
      category?: string | null
      trigger: 'manual'
      knowledgeSet: KnowledgeSet
      approvedPlan?: OrganisationPlan
      autopilotEnabled?: boolean
    },
  ): Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }> =>
    ipcRenderer.invoke('workflows:update', workflowId, draft),
  deleteWorkflow: (
    workflowId: string,
  ): Promise<{ ok: true; workflows: Workflow[] } | { ok: false; error: KnowledgeSetValidationError }> =>
    ipcRenderer.invoke('workflows:delete', workflowId),
  duplicateWorkflow: (
    workflowId: string,
  ): Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }> =>
    ipcRenderer.invoke('workflows:duplicate', workflowId),
  loadWorkflowForRun: (
    workflowId: string,
  ): Promise<
    | { ok: true; workflow: Workflow; knowledgeSet: KnowledgeSet }
    | { ok: false; error: KnowledgeSetValidationError }
  > => ipcRenderer.invoke('workflows:loadForRun', workflowId),
  setWorkflowAutopilot: (
    workflowId: string,
    enabled: boolean,
  ): Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }> =>
    ipcRenderer.invoke('workflows:setAutopilot', workflowId, enabled),
  approveWorkflowPlan: (
    workflowId: string,
    plan: OrganisationPlan,
  ): Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }> =>
    ipcRenderer.invoke('workflows:approvePlan', workflowId, plan),
  runAutopilot: (
    workflowId: string,
  ): Promise<
    | { ok: true; result: OrganisationExecutionResult }
    | { ok: false; error: KnowledgeSetValidationError }
  > => ipcRenderer.invoke('autopilot:run', { workflowId }),
}

try {
  contextBridge.exposeInMainWorld('suhuella', api)
} catch (error) {
  console.error('[suhuella] failed to expose preload API', error)
}
