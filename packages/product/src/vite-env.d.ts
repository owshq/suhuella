/// <reference types="vite/client" />

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
  IncludeSourceResult,
  SearchQuery,
  SearchResults,
  KnowledgeSet,
  KnowledgeSetItem,
  KnowledgeSetValidationError,
  BusinessOrganisationAction,
  BusinessOrganisationResult,
  LicenseActionResult,
  LicenseApiError,
  LicenseStatusView,
  OrganisationExecutionRequest,
  OrganisationExecutionResult,
  OrganisationPlan,
  OrganisationPlanPreview,
  SavedPlan,
  SavedPlanDraft,
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
} from './types'
import type { CheckoutPlan } from './lib/license-plans'
import type { ReleaseDecision } from './lib/release-lifecycle'
import type { PublicServiceHealth } from './lib/service-health'

export type SuhuellaAPI = {
  getSettings: () => Promise<AppSettings>
  getIndexStatus: () => Promise<IndexStatus>
  getIndexBrowse: () => Promise<IndexBrowse>
  browseSource: (path: string) => Promise<SourceBrowse>
  searchDocuments: (query: SearchQuery) => Promise<SearchResults>
  openSearchPath: (target: string) => Promise<OpenFolderResult>
  revealSearchPath: (target: string) => Promise<OpenFolderResult>
  getKnowledgeIndexHealth: () => Promise<KnowledgeIndexHealth>
  getSuggestedLocations: () => Promise<SuggestedLocation[]>
  droppedFilePath: (file: File) => string | null
  addIndexedLocation: (hint?: string) => Promise<AppSettings>
  removeIndexedLocation: (location: string) => Promise<AppSettings>
  setIndexedLocations: (locations: string[]) => Promise<AppSettings>
  startIndexScan: (refresh?: 'pending' | 'all') => Promise<AppSettings>
  restoreSourceAccess: (sourceId: string) => Promise<AppSettings>
  cancelIndexScan: () => Promise<void>
  onIndexProgress: (listener: (progress: IndexScanProgress) => void) => () => void
  matchFoldersForFile: (file: File) => Promise<FolderMatchPreview | null>
  setLaunchAtLogin: (enabled: boolean) => Promise<AppSettings>
  setPermissionPreferences: (prefs: {
    allowFolderChanges?: boolean
    trashEnabled?: boolean
  }) => Promise<AppSettings>
  setSourceAppearanceColor: (path: string, color: string | null) => Promise<AppSettings>
  setSourceAppearance: (
    path: string,
    update: { color?: string | null; iconId?: import('./types').SourceIconId | null },
  ) => Promise<AppSettings>
  getSettingsPath: () => Promise<string>
  revealSettingsFile: () => Promise<void>
  getAppInfo: () => Promise<AppInfo>
  checkRelease: () => Promise<ReleaseDecision>
  getLicense: () => Promise<LicenseStatusView>
  getServiceHealth: () => Promise<PublicServiceHealth>
  openExternal: (url: string) => Promise<boolean>
  openCheckout: (plan: 'lifetime' | 'monthly' | 'business', email?: string) => Promise<boolean>
  createCheckoutAttempt: (
    plan: CheckoutPlan,
  ) => Promise<{ ok: true; activationAttemptId: string } | { ok: false; error: LicenseApiError }>
  activateFromCheckout: (sessionId: string, activationAttemptId?: string) => Promise<LicenseActionResult>
  requestLicenseEmailCode: (
    email: string,
  ) => Promise<{ ok: true; challengeId: string; message: string } | { ok: false; error: LicenseApiError }>
  verifyLicenseEmailCode: (
    challengeId: string,
    code: string,
  ) => Promise<{ ok: true; proofId: string } | { ok: false; error: LicenseApiError }>
  activateLicense: (emailProofId: string) => Promise<LicenseActionResult>
  updateBusinessBranding: (dataUrl: string | null) => Promise<LicenseActionResult>
  getBusinessOrganisation: () => Promise<BusinessOrganisationResult>
  manageBusinessOrganisation: (
    action: BusinessOrganisationAction,
    payload?: { email?: string; seatId?: string; seatCount?: number },
  ) => Promise<BusinessOrganisationResult>
  listCloudIntegrations: () => Promise<
    | {
        ok: true
        enabled: boolean
        catalog: Array<{
          provider: string
          displayName: string
          enabled: boolean
          supportsWebhooks: boolean
          scopes: string[]
        }>
        connections: Array<{
          id: string
          brandId: string
          provider: string
          status: string
          accountEmail: string | null
          accountDisplayName: string | null
          scopes: string[]
          tokenExpiresAt: string | null
          lastSyncAt: string | null
          lastErrorCode: string | null
          lastErrorMessage: string | null
          createdAt: string
          updatedAt: string
        }>
        sources: Array<{
          id: string
          displayName: string
          provider: string
          status: string
          accountEmail: string | null
          browseRoot: string
        }>
      }
    | { ok: false; error: string }
  >
  startCloudIntegration: (
    provider: string,
  ) => Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }>
  disconnectCloudIntegration: (
    connectionId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  reconnectCloudIntegration: (
    connectionId: string,
  ) => Promise<{ ok: true; authorizeUrl: string } | { ok: false; error: string }>
  getCloudIntegrationStatus: (
    connectionId: string,
  ) => Promise<
    | {
        ok: true
        connection: {
          id: string
          brandId: string
          provider: string
          status: string
          accountEmail: string | null
          accountDisplayName: string | null
          scopes: string[]
          tokenExpiresAt: string | null
          lastSyncAt: string | null
          lastErrorCode: string | null
          lastErrorMessage: string | null
          createdAt: string
          updatedAt: string
        }
        sync: {
          jobId: string
          status: string
          progressFiles: number
          progressBytes: number
          lastErrorCode: string | null
          lastErrorMessage: string | null
          updatedAt: string
        } | null
      }
    | { ok: false; error: string }
  >
  checkLicense: () => Promise<LicenseActionResult>
  deactivateLicense: () => Promise<LicenseActionResult>
  deactivateRemoteDevice: (deviceIndex: number) => Promise<LicenseActionResult>
  renameThisDevice: (name: string) => Promise<LicenseActionResult>
  getCompatibilityDiagnostics: () => Promise<CompatibilityDiagnostics>
  exportCompatibilityDiagnostics: () => Promise<string | null>
  finishOnboarding: (destination?: 'home' | 'organise') => Promise<AppSettings>
  dismissWelcomeHint: () => Promise<AppSettings>
  previewSuggestions: () => Promise<void>
  previewSuggestionName: (fileName: string) => Promise<SuggestionPayload>
  pickSuggestionFile: () => Promise<SuggestionPayload | null>
  getSuggestion: () => Promise<SuggestionPayload | null>
  onSuggestionUpdated: (listener: (payload: SuggestionPayload) => void) => () => void
  chooseRecommendedFolder: (folder: string) => Promise<NavigateFolderResult>
  chooseAnotherFolder: () => Promise<void>
  copyFolderPath: (folder: string) => Promise<boolean>
  openFolder: (folder: string) => Promise<OpenFolderResult>
  includeSource: (folder: string) => Promise<IncludeSourceResult>
  closeSuggestion: () => Promise<void>
  pickKnowledgeSetFiles: () => Promise<KnowledgeSetItem[]>
  pickKnowledgeSetFolders: () => Promise<KnowledgeSetItem[]>
  previewOrganisationPlan: (
    knowledgeSet: KnowledgeSet,
  ) => Promise<
    | { ok: true; preview: OrganisationPlanPreview }
    | { ok: false; error: KnowledgeSetValidationError }
  >
  proposeOrganisationPlan: (
    knowledgeSet: KnowledgeSet,
    note?: string,
    extras?: { workflowNames?: string[]; assistantPreference?: 'on_device' | 'local' },
  ) => Promise<PlanAssistantTurn>
  getPlanAssistantStatus: () => Promise<PlanAssistantStatus>
  executeOrganisationPlan: (
    request: OrganisationExecutionRequest,
  ) => Promise<
    | { ok: true; result: OrganisationExecutionResult }
    | { ok: false; error: KnowledgeSetValidationError }
  >
  onPlanExecutionProgress: (
    listener: (event: import('./types').PlanExecutionProgressEvent) => void,
  ) => () => void
  getByokStatus: () => Promise<ByokStatus>
  probeLocalModels: () => Promise<import('./lib/local-model-discovery.ts').LocalModelProbeResult>
  connectByok: (request: ByokConnectRequest) => Promise<ByokConnectResult>
  disconnectByok: () => Promise<ByokStatus>
  assistWithByok: (request: ByokAssistRequest) => Promise<ByokAssistResult>
  getByokConversation: () => Promise<ByokConversationMessage[]>
  clearByokConversation: () => Promise<ByokConversationMessage[]>
  getActivity: () => Promise<ActivityRun[]>
  undoActivity: (
    request: UndoExecutionRequest,
  ) => Promise<
    | { ok: true; result: UndoExecutionResult }
    | { ok: false; error: KnowledgeSetValidationError }
  >
  getStorageUsage: () => Promise<StorageUsage>
  getDocumentStorageSummary: () => Promise<DocumentStorageSummary>
  getStorageOverview: () => Promise<StorageOverview>
  getDeviceMetrics: () => Promise<DeviceMetrics>
  clearCache: () => Promise<StorageUsage>
  clearLogs: () => Promise<StorageUsage>
  clearActivityHistory: () => Promise<StorageUsage>
  exportActivity: () => Promise<string | null>
  listSavedPlans: () => Promise<SavedPlan[]>
  saveSavedPlan: (
    draft: SavedPlanDraft,
  ) => Promise<{ ok: true; plan: SavedPlan } | { ok: false; error: KnowledgeSetValidationError }>
  deleteSavedPlan: (
    planId: string,
  ) => Promise<{ ok: true; plans: SavedPlan[] } | { ok: false; error: KnowledgeSetValidationError }>
  duplicateSavedPlan: (
    planId: string,
  ) => Promise<{ ok: true; plan: SavedPlan } | { ok: false; error: KnowledgeSetValidationError }>
  listWorkflows: () => Promise<Workflow[]>
  saveWorkflow: (draft: {
    name: string
    description?: string
    category?: string | null
    trigger: 'manual'
    knowledgeSet: KnowledgeSet
    approvedPlan?: OrganisationPlan
    autopilotEnabled?: boolean
  }) => Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }>
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
  ) => Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }>
  deleteWorkflow: (
    workflowId: string,
  ) => Promise<{ ok: true; workflows: Workflow[] } | { ok: false; error: KnowledgeSetValidationError }>
  duplicateWorkflow: (
    workflowId: string,
  ) => Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }>
  loadWorkflowForRun: (
    workflowId: string,
  ) => Promise<
    | { ok: true; workflow: Workflow; knowledgeSet: KnowledgeSet }
    | { ok: false; error: KnowledgeSetValidationError }
  >
  setWorkflowAutopilot: (
    workflowId: string,
    enabled: boolean,
  ) => Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }>
  approveWorkflowPlan: (
    workflowId: string,
    plan: OrganisationPlan,
  ) => Promise<{ ok: true; workflow: Workflow } | { ok: false; error: KnowledgeSetValidationError }>
  runAutopilot: (
    workflowId: string,
  ) => Promise<
    | { ok: true; result: OrganisationExecutionResult }
    | { ok: false; error: KnowledgeSetValidationError }
  >
}

declare global {
  interface Window {
    suhuella: SuhuellaAPI
    __suhuellaHost?: 'electron' | 'browser'
    /** Set by the web shell from PAID_CHECKOUT_ENABLED. Missing means closed. */
    __suhuellaPaidCheckoutEnabled?: boolean
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
    }) => Promise<FileSystemDirectoryHandle>
  }
}

export {}
