export type KnowledgeSourceType =
  | 'local_folder'
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  | 'gmail'
  | 'outlook'
  | 'manual_import'

export type KnowledgeSourceStatus = 'ready' | 'error' | 'disconnected' | 'needs_auth'

export type KnowledgeSourcesEnabled = Record<KnowledgeSourceType, boolean>

export type KnowledgeSource = {
  id: string
  type: KnowledgeSourceType
  displayName: string
  rootLocator: string
  status: KnowledgeSourceStatus
  lastIndexed: string | null
  itemCount: number
  errorMessage?: string
}

export type KnowledgeItemKind = 'folder' | 'file' | 'attachment'

export type SourceIconId =
  | 'folder'
  | 'documents'
  | 'downloads'
  | 'desktop'
  | 'pictures'
  | 'movies'
  | 'music'
  | 'shared'
  | 'applications'
  | 'developer'
  | 'icloud'
  | 'dropbox'
  | 'onedrive'
  | 'google_drive'
  | 'volume'
  | 'usb'

export type SourceAppearanceOverride = {
  color?: string
  iconId?: SourceIconId
}

export type AppSettings = {
  indexedLocations: string[]
  indexedFolderCount: number
  indexedFileCount: number
  lastIndexed: string | null
  lastLearnedNewFiles: number | null
  lastLearnedUpdatedFolders: number | null
  firstRunCompleted: boolean
  launchAtLogin: boolean
  welcomeNotificationShown: boolean
  knowledgeSourcesEnabled: KnowledgeSourcesEnabled
  recentFolders: string[]
  sourceAppearance: Record<string, SourceAppearanceOverride>
}

export type IndexBrowseFolder = {
  path: string
  name: string
  fileCount: number
}

export type IndexBrowseFile = {
  path: string
  name: string
  extension?: string
}

export type IndexBrowse = {
  folders: IndexBrowseFolder[]
  files: IndexBrowseFile[]
}

export type SourceBrowseEntry = {
  path: string
  name: string
  kind: 'folder' | 'file'
  extension?: string
  size?: number | null
  lastModified?: string | null
}

export type SourceBrowse = {
  path: string
  name: string
  parentPath: string | null
  entries: SourceBrowseEntry[]
}

export type SearchDocumentFilter = 'all' | 'pdf' | 'docx' | 'images' | 'archives' | 'other'

export type SearchMatchField =
  | 'filename'
  | 'folder'
  | 'extension'
  | 'document_type'
  | 'recent'
  | 'workflow'
  | 'recommendation'

export type SearchHitKind = 'file' | 'folder' | 'recent' | 'workflow' | 'recommendation' | 'activity'

export type SearchHit = {
  id: string
  kind: SearchHitKind
  title: string
  subtitle: string
  path: string | null
  folderPath: string | null
  extension: string | null
  documentFilter: Exclude<SearchDocumentFilter, 'all'> | null
  lastSeenAt: string | null
  matchedOn: SearchMatchField[]
  workflowId?: string
  workflowName?: string
  activityRunId?: string
}

export type SearchQuery = {
  text: string
  filter: SearchDocumentFilter
}

export type SearchResults = {
  query: string
  filter: SearchDocumentFilter
  hits: SearchHit[]
}

export type AppHost = 'electron' | 'browser'

export type PlatformCapabilities = {
  saveAs: boolean
  tray: boolean
  openFolder: boolean
  reveal: boolean
  filesystem: boolean
  notifications: boolean
  nativeDialogs: boolean
  organise: boolean
  search: boolean
  activity: boolean
  workflows: boolean
  license: boolean
}

export type AppInfo = {
  name: string
  version: string
  buildVersion: string
  platform: 'darwin' | 'win32' | 'linux'
  development: boolean
  host?: AppHost
  folderAccess?: boolean
  capabilities?: PlatformCapabilities
  computerName?: string
  osVersion?: string
}

export type CompatibilityStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_TESTED' | 'NOT_SUPPORTED'

export type NavigationMethod =
  | 'UIAutomation'
  | 'AddressBar'
  | 'CtrlL'
  | 'AltD'
  | 'PasteEnter'
  | 'Failed'

export type CompatibilityAttempt = {
  timestamp: string
  appName: string
  processName: string
  windowTitle: string
  className: string
  windowHandle: string
  detected: boolean
  filenameExtracted: boolean
  currentFolderExtracted: boolean
  windowHandlePresent: boolean
  recommendationCount: number
  navigationAttempted: boolean
  navigationMethod: NavigationMethod | null
  navigationSucceeded: boolean
  failureReason: string
}

export type CompatibilityDiagnostics = {
  development: boolean
  attemptCount: number
  lastAttempt: CompatibilityAttempt | null
  attempts: CompatibilityAttempt[]
}

export type IndexedFolderEntry = {
  id: string
  sourceId: string
  sourceType: KnowledgeSourceType
  kind: KnowledgeItemKind
  name: string
  locator: string
  absolutePath: string
  relativePath: string
  folderName: string
  parentTokens: string[]
  depth: number
  extensions: string[]
  fileCount: number
  fileNames: string[]
  lastModified: string | null
  metadata?: Record<string, unknown>
}

export type IndexedKnowledgeItem = {
  id: string
  sourceId: string
  sourceType: KnowledgeSourceType
  kind: Exclude<KnowledgeItemKind, 'folder'>
  name: string
  locator: string
  absolutePath?: string
  tokens: string[]
  extension?: string
  lastModified?: string | null
  metadata?: Record<string, unknown>
}

export type FolderIndex = {
  version: number
  indexVersion: number
  generatedAt: string | null
  indexedAt: string | null
  locations: string[]
  sources: KnowledgeSource[]
  folders: IndexedFolderEntry[]
  files: IndexedKnowledgeItem[]
}

export type IndexScanStatus = 'idle' | 'scanning' | 'ready' | 'error' | 'cancelled'

export type IndexScanProgress = {
  status: IndexScanStatus
  foldersScanned: number
  filesSeen: number
  currentPath: string
  startedAt: string | null
  finishedAt: string | null
  estimatedRemainingSeconds: number | null
  error?: string
}

export type SuggestedLocationKind = 'user_folder' | 'cloud_folder' | 'volume'

export type SuggestedLocation = {
  id: string
  label: string
  path: string
  exists: boolean
  kind?: SuggestedLocationKind
}

export type IndexedLocationStatus =
  | 'ready'
  | 'indexing'
  | 'unavailable'
  | 'permission_denied'
  | 'external_drive_disconnected'
  | 'not_indexed'
  | 'needs_refresh'
  | 'cancelled'

export type LocationUsefulness = 'very_useful' | 'useful' | 'rarely_used' | 'unknown'

export type IndexedLocationSummary = {
  path: string
  name: string
  lastIndexed: string | null
  folderCount: number
  fileCount: number
  status: IndexedLocationStatus
  usefulness: LocationUsefulness
  exists: boolean
  /** Browser catalog token (suhuella:documents) when connected from a grant card */
  catalogKey?: string | null
}

export type FoldersKnowledgeQuality = 'excellent' | 'good' | 'learning' | 'needs_more'

export type FoldersKnowledgeSummary = {
  topFolders: string[]
  languages: string[]
  documentTypes: string[]
  recognised: string[]
  uniqueNames: number
  lastLearnedNewFiles: number | null
  lastLearnedUpdatedFolders: number | null
  historyYears: number | null
  quality: FoldersKnowledgeQuality
}

export type IndexStatus = {
  settings: AppSettings
  scan: IndexScanProgress
  locations: IndexedLocationSummary[]
  summary: FoldersKnowledgeSummary
}

export type ScoreContribution = {
  label: string
  points: number
}

export type ConfidenceLabel = 'Strong match' | 'Good match' | 'Possible match' | 'Weak match'

export type SaveAsMatchLabel =
  | 'Strong match'
  | 'Good match'
  | 'Possible match'
  | 'Starter suggestion'
  | 'Available place'
  | 'Needs learning'

export type SaveAsAssistantState =
  | 'learned'
  | 'first_use'
  | 'partial'
  | 'no_filename'
  | 'no_match'
  | 'preview'

export type SaveAsDestinationOrigin = 'learned' | 'available' | 'current'

export type SaveAsDocumentView = {
  fileName: string
  extension: string | null
  typeLabel: string
  sourceApp: string
  currentFolder: string
  currentFolderLabel: string
  looksLike: string[]
  detected: string[]
  language: string | null
}

export type SaveAsDestination = {
  id: string
  folder: string
  label: string
  pathLabel: string
  matchLabel: SaveAsMatchLabel
  reason: string
  reasons: string[]
  origin: SaveAsDestinationOrigin
  included: boolean
  exists: boolean
}

export type SaveAsComingLater = {
  id: string
  label: string
  status: 'Coming later' | 'Not connected'
}

export type FileFamily =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'email'
  | 'code'
  | 'design'
  | 'database'
  | 'text'
  | 'unknown'

export type FileProfile = {
  originalName: string
  baseName: string
  extension: string | null
  fileFamily: FileFamily
  tokens: string[]
  strongTokens: string[]
  weakTokens: string[]
  entities: string[]
  dates: string[]
  documentHints: string[]
  topicHints: string[]
  languageHints: string[]
  sourceApp?: string
}

export type FolderProfile = {
  folderId: string
  sourceId: string
  absolutePath: string
  folderNameTokens: string[]
  pathTokens: string[]
  parentTokens: string[]
  existingFileTokens: string[]
  dominantEntities: string[]
  dominantDocumentHints: string[]
  dominantTopics: string[]
  extensionDistribution: Record<string, number>
  genericPenaltyHints: string[]
}

export type RecommendedFolder = {
  folder: string
  score: number
  confidenceLabel: ConfidenceLabel
  label: string
  reasons: string[]
  contributions: ScoreContribution[]
}

export type SuggestionMode = 'preview' | 'demo' | 'save-dialog'

export type SuggestionPayload = {
  fileName: string
  sourceApp: string
  currentFolder: string
  mode: SuggestionMode
  recommendations: RecommendedFolder[]
  windowHandle?: string
  extension?: string
  navigationError?: string | null
  detectedSignals?: string[]
  document?: SaveAsDocumentView
  destinations?: SaveAsDestination[]
  comingLater?: SaveAsComingLater[]
  saveAsState?: SaveAsAssistantState
  learnedFolderCount?: number
}

export type NavigateFolderResult = {
  ok: boolean
  folder: string
  error?: string
  method?: NavigationMethod
}

export type OpenFolderResult = {
  ok: boolean
  error?: string
}

export type IncludeSourceResult = {
  ok: boolean
  folder?: string
  error?: string
}

export type KnowledgeIndexHealth = {
  status: IndexScanStatus | 'not-indexed'
  locationCount: number
  sourceCount: number
  folderCount: number
  fileCount: number
  indexVersion: number
  lastIndexed: string | null
  searchReady: boolean
}

export type KnowledgeOrigin =
  | 'save_dialog'
  | 'preview'
  | 'local_file'
  | 'fixture'
  | 'gmail'
  | 'outlook'
  | 'dropbox'
  | 'google_drive'
  | 'onedrive'
  | 'scanner'
  | 'ocr'
  | 'mcp'
  | 'agent'

export type KnowledgeDescriptor = {
  id: string
  kind: KnowledgeItemKind
  source: KnowledgeSourceType
  origin: KnowledgeOrigin
  displayName: string
  suggestedName: string
  mimeType: string | null
  language: string[]
  entities: string[]
  dates: string[]
  topics: string[]
  hints: string[]
  metadata: Record<string, unknown>
}

export type RecommendationInput = {
  descriptor: KnowledgeDescriptor
  folders: IndexedFolderEntry[]
  recentFolders?: string[]
  frequentFolders?: Record<string, number>
}

export type FolderMatchPreview = {
  fileName: string
  filePath: string
  recommendations: RecommendedFolder[]
}

export type SafetyClass = 'SAFE_NOW' | 'CONFIRM_REQUIRED' | 'FORBIDDEN'

export type IntentId =
  | 'store_file'
  | 'inspect_recommendation'
  | 'browse_folder'
  | 'refresh_knowledge'
  | 'store_attachment'
  | 'store_document'
  | 'organize_download'
  | 'move_existing_file'
  | 'rename_file'
  | 'organize_project'
  | 'summarize_folder'
  | 'classify_document'
  | 'extract_information'
  | 'archive_document'

export type IntentContext = {
  mode?: SuggestionMode | 'probe'
}

export type Intent = {
  id: IntentId
  kind: IntentId
  confidence: number
  context: IntentContext
  metadata: Record<string, unknown>
}

export type CapabilityId =
  | 'recommend_folder'
  | 'explain_recommendation'
  | 'open_folder'
  | 'copy_path'
  | 'navigate_save_dialog'
  | 'refresh_index'
  | 'create_folder'
  | 'rename_file'
  | 'move_file'
  | 'save_attachment'
  | 'download_file'
  | 'upload_to_cloud'
  | 'apply_bulk_organisation'
  | 'delete_file'
  | 'overwrite_file'
  | 'send_email'
  | 'modify_document_content'
  | 'auto_save_without_user'
  | 'background_cloud_sync'

export type ActionId = 'copy_path' | 'open_folder' | 'navigate_save_dialog' | 'refresh_index'

export type CapabilityDefinition = {
  id: CapabilityId
  intent: IntentId
  safety: SafetyClass
  implemented: boolean
  executes: ActionId | null
}

export type ActionDefinition = {
  id: ActionId
  capability: CapabilityId
  safety: SafetyClass
  implemented: boolean
}

/** Local path entry inside a Knowledge Set. Connectors may add other locators later. */
export type KnowledgeSetItemKind = 'file' | 'folder'

export type KnowledgeSetItem = {
  path: string
  kind: KnowledgeSetItemKind
}

/** The set of Knowledge Items SuHuella is working on right now. */
export type KnowledgeSet = {
  items: KnowledgeSetItem[]
}

export type OrganisationPlanAction =
  | 'none'
  | 'rename'
  | 'move'
  | 'create_folder'
  | 'create_structure'
  | 'archive'
  | 'ignore'

export type OrganisationPlanItemStatus = 'preview' | 'applied' | 'skipped' | 'failed'

export type OrganisationReviewGroup = 'ready' | 'review' | 'skipped'

/** Rename strategy on a plan item. Only `normalize` runs today; others are reserved for future proposals. */
export type RenameStrategy = 'normalize' | 'shorten' | 'disambiguate' | 'keep_original'

export type OrganisationDestinationOption = {
  folder: string
  label: string
  score: number
  confidenceLabel: ConfidenceLabel
  reasons: string[]
  createdFolders?: string[]
}

export type OrganisationPlanItem = {
  action: OrganisationPlanAction
  currentPath: string
  proposedPath: string | null
  explanation: string
  status: OrganisationPlanItemStatus
  warnings: string[]
  reviewGroup: OrganisationReviewGroup
  selected: boolean
  fileName: string
  score: number | null
  confidenceLabel: ConfidenceLabel | null
  alternatives: OrganisationDestinationOption[]
  skipReason: string | null
  /** How this rename was proposed. Execution accepts user-edited names regardless of strategy. */
  renameStrategy?: RenameStrategy | null
  /** Human-readable reasons shown as “Why this name”. */
  renameReasons?: string[]
  /** Folders this action will create, or did create, from nearest existing parent to leaf. */
  createdFolders?: string[]
}

export type OrganisationPlanPreview = {
  simulated: true
  message: string
  knowledgeSet: KnowledgeSet
  items: OrganisationPlanItem[]
  proposedBy?: 'engine' | 'assistant'
}

export type PlanAssistantHint =
  | 'rename'
  | 'move'
  | 'archive'
  | 'create_folder'
  | 'ignore'
  | 'workflow'

export type PlanWorkflowIdea = {
  id: string
  title: string
  explanation: string
  relatedPaths: string[]
}

export type PlanAssistantRequest = {
  knowledgeSet: KnowledgeSet
  note?: string
}

/** on_device = rules today. local_ai is reserved for a real on-device model. */
export type PlanAssistantBackend = 'on_device' | 'local_ai' | 'byok'

/** Who generated the proposal or answer. Never who ranked folders. */
export type PlanAssistantUsing = {
  backend: PlanAssistantBackend
  label: string
}

export type PlanAssistantStatus = {
  using: PlanAssistantUsing
}

export type PlanAssistantProposal = {
  simulated: true
  source: 'assistant'
  message: string
  knowledgeSet: KnowledgeSet
  preview: OrganisationPlanPreview
  workflows: PlanWorkflowIdea[]
  note: string | null
  using: PlanAssistantUsing
}

export type PlanAssistantTurn =
  | { ok: true; kind: 'proposal'; proposal: PlanAssistantProposal }
  | { ok: true; kind: 'answer'; text: string; using: PlanAssistantUsing }
  | { ok: false; error: KnowledgeSetValidationError }

export type OrganisationPlan = {
  knowledgeSet: KnowledgeSet
  items: OrganisationPlanItem[]
}

export type OrganisationExecutionRequest = {
  plan: OrganisationPlan
  confirmed: boolean
  runNumber?: number
  trigger?: 'organise_documents' | 'move_this_file' | 'workflow'
  workflowId?: string
}

export type OrganisationExecutionResult = {
  simulated: false
  runId: string
  runNumber: number
  completedAt: string
  message: string
  knowledgeSet: KnowledgeSet
  appliedCount: number
  skippedCount: number
  failedCount: number
  items: OrganisationPlanItem[]
}

/** What started an Activity run. Stored as a stable id; the UI shows the human label. */
export type ActivityTrigger =
  | 'organise_documents'
  | 'move_this_file'
  | 'workflow'
  | 'autopilot'
  | 'undo'

export type ActivityItemStatus = 'moved' | 'skipped' | 'failed'

export type ActivityItemAction = OrganisationPlanAction

/** Identity of the file that was moved, captured after a successful local rename. */
export type ActivityFileIdentity = {
  device: number
  inode: number
  size: number
}

export type ActivityItem = {
  sourcePath: string
  targetPath: string | null
  fileName: string
  action: ActivityItemAction
  status: ActivityItemStatus
  reason: string
  confidence: number | null
  recommendationId?: string
  movedFile?: ActivityFileIdentity
  createdFolders?: string[]
  undoAvailable: boolean
  undoReason?: string
}

export type ActivityRunSummary = {
  moved: number
  skipped: number
  failed: number
}

export type ActivityRun = {
  runId: string
  runNumber: number
  startedAt: string
  completedAt: string
  trigger: ActivityTrigger
  /** Undo runs point at the Organisation Run they reverse. */
  reversesRunId?: string
  /** Executed plan. Organisation runs store the confirmed plan; undo runs store the inverse plan. */
  plan?: OrganisationPlan
  /** Inverse of the executed plan. Present on organisation runs so Undo executes a stored plan. */
  inversePlan?: OrganisationPlan
  summary: ActivityRunSummary
  items: ActivityItem[]
  /** Workflow Template this run came from. Activity shows the name, not only “Workflow”. */
  workflowId?: string
  workflowName?: string
  /** What the workflow does. Stored so Activity still explains a deleted workflow. */
  workflowSummary?: string
}

export type UndoExecutionRequest = {
  runId: string
  sourcePaths?: string[]
  confirmed: boolean
}

export type UndoExecutionResult = {
  run: ActivityRun
  runs: ActivityRun[]
}

export type ActivityLog = {
  version: number
  updatedAt: string
  runs: ActivityRun[]
}

export type ActivityPeriodSummary = {
  label: 'Today' | 'This history'
  organised: number
  moved: number
  skipped: number
  failed: number
  topDestinations: Array<{ label: string; count: number }>
  mostActiveFolder: string | null
  mostCommonSkipReason: string | null
}

export type StorageUsage = {
  indexBytes: number
  activityBytes: number
  cacheBytes: number
  logsBytes: number
  workflowsBytes: number
  settingsBytes: number
  licenseBytes: number
  lastCleanupAt: string | null
}

export type StorageSourceStatus =
  | 'measured'
  | 'measuring'
  | 'permission_required'
  | 'unavailable'
  | 'not_connected'
  | 'unsupported'
  | 'failed'
  | 'skipped'

export type StorageSourceKind = 'local_folder' | 'cloud' | 'network' | 'email'

export type StorageSource = {
  id: string
  name: string
  kind: StorageSourceKind
  locator: string
  bytes?: number
  documentCount?: number
  folderCount?: number
  status: StorageSourceStatus
  errorCode?: string
  lastMeasuredAt?: string | null
}

export type AppStorageBreakdown = {
  indexBytes: number
  activityBytes: number
  cacheBytes: number
  logsBytes: number
  workflowsBytes: number
  settingsBytes: number
  licenseBytes: number
}

export type StorageOverviewStatus = 'measured' | 'partial' | 'empty' | 'measuring' | 'unavailable'

export type StorageOverviewWarning = {
  code: 'permission_required' | 'unavailable' | 'failed' | 'refresh_failed' | 'empty'
  message: string
}

/** Knowledge SuHuella manages, separate from app data under userData. */
export type StorageOverview = {
  knowledgeTotalBytes: number | null
  knowledgeDocumentCount: number
  sourceCount: number
  localBytes: number | null
  cloudBytes: number | null
  appStorageTotalBytes: number
  sources: StorageSource[]
  appStorage: AppStorageBreakdown
  measuredAt: string | null
  status: StorageOverviewStatus
  warnings: StorageOverviewWarning[]
}

export type MetricStatus = 'measured' | 'unavailable' | 'unsupported' | 'not_measured'

export type DeviceStorageMetrics = {
  totalBytes?: number
  freeBytes?: number
  usedBytes?: number
  volumeName?: string
  status: MetricStatus
}

export type KnowledgeStorageMetrics = {
  totalBytes?: number
  documentCount: number
  folderCount: number
  sourceCount: number
  status: StorageOverviewStatus
}

export type AppStorageMetrics = AppStorageBreakdown & {
  totalBytes: number
}

export type PerformanceMetrics = {
  memoryBytes?: number
  cpuPercent?: number
  startupMs?: number
  lastRecommendationMs?: number
  lastPlanExecutionMs?: number
  lastIndexingMs?: number
  lastPlanActions?: number
  status: MetricStatus
}

export type DeviceMetrics = {
  host: 'desktop' | 'web'
  platform: 'darwin' | 'win32' | 'linux' | 'web'
  deviceName: string
  measuredAt: string
  deviceStorage?: DeviceStorageMetrics
  knowledgeStorage: KnowledgeStorageMetrics
  appStorage: AppStorageMetrics
  performance: PerformanceMetrics
  sources: StorageSource[]
  warnings: StorageOverviewWarning[]
}

/** One storage source on the dashboard. Connectors add Drive, Dropbox, etc. later. */
export type DocumentStorageSource = {
  id: string
  kind: 'local_folder' | 'google_drive' | 'dropbox' | 'onedrive'
  label: string
  bytes: number
  fileCount: number
  status: 'ready' | 'unavailable' | 'not_connected'
}

export type DocumentStorageSummary = {
  measuredAt: string
  totalBytes: number
  sources: DocumentStorageSource[]
}

/** Optional assistant after recommendation. Never a Knowledge Source. Never ranks. */
export type ByokProviderId = 'openai' | 'anthropic' | 'openai_compatible'

/** User-facing assistant. Not a Knowledge Source. */
export type ByokAssistantId = 'openai' | 'anthropic' | 'compatible_api' | 'local_server'

export type ByokTask =
  | 'explain_recommendation'
  | 'explain_not_recommended'
  | 'suggest_plan'
  | 'organise_folder'
  | 'generate_workflow_ideas'
  | 'summarise_activity'
  | 'teach_preference'
  | 'answer_question'

/** Assistant session only. Never Knowledge, Activity, or a Workflow. */
export type ByokConversationMessage = {
  role: 'user' | 'assistant'
  text: string
}

export type ByokStatus = {
  connected: boolean
  assistant: ByokAssistantId | null
  assistantLabel: string | null
  model: string | null
  hasKey: boolean
}

export type ByokConnectRequest = {
  assistant: ByokAssistantId
  apiKey: string
  model?: string
  baseUrl?: string
}

export type ByokConnectResult =
  | { ok: true; status: ByokStatus }
  | { ok: false; error: string }

export type ByokDescriptorContext = {
  displayName: string
  entities: string[]
  topics: string[]
  hints: string[]
}

export type ByokAlternativeContext = {
  folderLabel: string
  confidenceLabel: ConfidenceLabel
  reasons: string[]
}

export type ByokRecommendationContext = {
  fileName: string
  folderLabel: string
  confidenceLabel: ConfidenceLabel
  reasons: string[]
  alternatives?: ByokAlternativeContext[]
  descriptor?: ByokDescriptorContext
  notRecommendedQuestion?: string
}

export type ByokFolderFileContext = {
  fileName: string
  action: OrganisationPlanAction | 'none'
  destinationLabel: string | null
  explanation: string
}

export type ByokPlanContextItem = {
  fileName: string
  action: OrganisationPlanAction
  destinationLabel: string | null
  confidenceLabel: ConfidenceLabel | null
  explanation: string
}

export type ByokActivityContext = {
  label: string
  organised: number
  moved: number
  skipped: number
  failed: number
  topDestinations: Array<{ label: string; count: number }>
}

export type ByokAssistRequest = {
  task: ByokTask
  question?: string
  recommendation?: ByokRecommendationContext
  planItems?: ByokPlanContextItem[]
  activity?: ByokActivityContext
  folderLabel?: string
  folderFiles?: ByokFolderFileContext[]
}

export type ByokAssistResult =
  | { ok: true; task: ByokTask; text: string; conversation: ByokConversationMessage[] }
  | { ok: false; error: string }

export type WorkflowTrigger = 'manual' | 'folder_watch' | 'connector'

/** Intent template: what to analyse on the next run. Never files or a past execution. */
export type SavedOrganisationPlan = {
  knowledgeSet: KnowledgeSet
}

/** Intent Template plus the event that starts it. A Workflow never stores files. */
export type Workflow = {
  id: string
  name: string
  description: string
  /** Reserved for later grouping (Personal, Finance, Clients, Downloads, Photos). */
  category: string | null
  /** Format version. Missing records load as 1. */
  workflowVersion: number
  trigger: WorkflowTrigger
  /** Intent template. Running rebuilds a fresh Organisation Plan from this source. */
  plan: SavedOrganisationPlan
  createdAt: string
  updatedAt: string
  lastRunAt: string | null
  /** Last confirmed Organisation Plan. Autopilot executes this as-is. */
  approvedPlan: OrganisationPlan | null
  approvedAt: string | null
  autopilotEnabled: boolean
}

export type WorkflowDraft = {
  name: string
  description?: string
  category?: string | null
  trigger: WorkflowTrigger
  knowledgeSet: KnowledgeSet
  approvedPlan?: OrganisationPlan
  autopilotEnabled?: boolean
}

export type AutopilotRunRequest = {
  workflowId: string
}

export type KnowledgeSetValidationErrorCode =
  | 'invalid_knowledge_set'
  | 'invalid_item'
  | 'empty_knowledge_set'
  | 'invalid_plan'
  | 'invalid_request'
  | 'confirmation_required'
  | 'execution_failed'
  | 'undo_unavailable'
  | 'invalid_workflow'
  | 'workflow_not_found'
  | 'workflow_not_approved'
  | 'autopilot_disabled'
  | 'assistant_unavailable'

export type KnowledgeSetValidationError = {
  code: KnowledgeSetValidationErrorCode
  message: string
}

export type LicenseEdition =
  | 'free'
  | 'personal_lifetime'
  | 'personal_monthly'
  | 'business'
  | 'enterprise'

export type LicenseStatus = 'active' | 'expired' | 'revoked'

export type LicenseChannel = 'stable' | 'beta'

export type LicenseContext = {
  licenseId: string
  customerId: string
  email: string
  edition: LicenseEdition
  status: LicenseStatus
  capabilities: string[]
  enabledKnowledgeSources: string[]
  deviceLimit: number
  activatedDevices: number
  organisationId?: string
  organisationName?: string
  organisationLogo?: string | null
  seatId?: string
  memberRole?: 'owner' | 'admin' | 'member'
  validUntil: string | null
  lastCheckedAt: string
  offlineUntil: string
  channel: LicenseChannel
  licenseToken: string
}

export type LicenseApiError =
  | 'unknown_email'
  | 'no_license'
  | 'device_limit'
  | 'revoked'
  | 'not_activated'
  | 'expired'
  | 'invalid_request'
  | 'invalid_proof'
  | 'invalid_code'
  | 'invalid_attempt'
  | 'email_verification_required'
  | 'rate_limited'
  | 'server_error'
  | 'service_unavailable'
  | 'offline'
  | 'payment_incomplete'

export type LicenseStatusKind =
  | 'free'
  | 'personal_lifetime'
  | 'personal_monthly'
  | 'business'
  | 'needs_attention'

export type LicenseProductState =
  | 'ready'
  | 'needs_attention'
  | 'offline'
  | 'refreshing'
  | 'activation_required'
  | 'expired'

export type LicenseDeviceInfo = {
  index: number
  name: string
  platform: string
  lastSeenLabel: string
  current: boolean
}

export type LicenseHealthItem = {
  id: 'save_as' | 'learning' | 'licence' | 'updates'
  label: string
  status: 'ok' | 'attention' | 'unknown'
}

/** Renderer-facing license status. Never includes Stripe, tokens, or customer ids. */
export type LicenseStatusView = {
  kind: LicenseStatusKind
  productState: LicenseProductState
  identityTitle: string
  editionLabel: string
  roleLabel: string | null
  computerName: string
  headline: string
  detail: string
  email: string
  organisationName: string | null
  organisationLogo: string | null
  canEditBranding: boolean
  organisationId: string | null
  deviceCount: number | null
  deviceLimit: number | null
  devices: LicenseDeviceInfo[]
  workingOffline: boolean
  needsAttention: boolean
  lastCheckedLabel: string
  offlineUntilLabel: string | null
  periodEndLabel: string | null
  supportCode: string | null
  health: LicenseHealthItem[]
}

export type LicenseActionResult =
  | { ok: true; license: LicenseStatusView }
  | { ok: false; error: LicenseApiError; license?: LicenseStatusView }
