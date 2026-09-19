export type KnowledgeSourceType =
  | "local_folder"
  | "google_drive"
  | "dropbox"
  | "onedrive"
  | "gmail"
  | "outlook"
  | "sharepoint"
  | "nas";

export type KnowledgeItemKind = "folder" | "file" | "attachment";

export type KnowledgeOrigin = "local_file" | "preview";

export type ConfidenceLabel = "Strong match" | "Good match" | "Possible match" | "Weak match";

export type FileFamily =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "email"
  | "code"
  | "design"
  | "database"
  | "text"
  | "unknown";

export type ScoreContribution = {
  label: string;
  points: number;
};

export type FileProfile = {
  originalName: string;
  baseName: string;
  extension: string | null;
  fileFamily: FileFamily;
  tokens: string[];
  strongTokens: string[];
  weakTokens: string[];
  entities: string[];
  dates: string[];
  documentHints: string[];
  topicHints: string[];
  languageHints: string[];
  sourceApp?: string;
};

export type FolderProfile = {
  folderId: string;
  sourceId: string;
  absolutePath: string;
  folderNameTokens: string[];
  pathTokens: string[];
  parentTokens: string[];
  existingFileTokens: string[];
  dominantEntities: string[];
  dominantDocumentHints: string[];
  dominantTopics: string[];
  extensionDistribution: Record<string, number>;
  genericPenaltyHints: string[];
};

export type KnowledgeDescriptor = {
  id: string;
  kind: KnowledgeItemKind;
  source: KnowledgeSourceType;
  origin: KnowledgeOrigin;
  displayName: string;
  suggestedName: string;
  mimeType: string | null;
  language: string[];
  entities: string[];
  dates: string[];
  topics: string[];
  hints: string[];
  metadata: Record<string, unknown>;
};

export type IndexedFolderEntry = {
  id: string;
  sourceId: string;
  sourceType: KnowledgeSourceType;
  kind: KnowledgeItemKind;
  name: string;
  locator: string;
  absolutePath: string;
  relativePath: string;
  folderName: string;
  parentTokens: string[];
  depth: number;
  extensions: string[];
  fileCount: number;
  fileNames: string[];
  lastModified: string | null;
};

export type RecommendationInput = {
  descriptor: KnowledgeDescriptor;
  folders: IndexedFolderEntry[];
};

export type RecommendedFolder = {
  folder: string;
  score: number;
  confidenceLabel: ConfidenceLabel;
  label: string;
  reasons: string[];
  contributions: ScoreContribution[];
};

export type WebSourceKind = "local";

export type WebSourceStatus = "ready" | "needs_permission" | "indexing" | "unavailable";

export type WebKnowledgeSource = {
  id: string;
  kind: WebSourceKind;
  type: KnowledgeSourceType;
  name: string;
  fileCount: number;
  folderCount: number;
  bytes: number;
  lastIndexed: string | null;
  status: WebSourceStatus;
  access?: "persistent" | "limited";
  /** suhuella:documents etc. when connected from the Sources catalog card */
  wellKnownToken?: string;
};

export type WebIndexedFile = {
  id: string;
  sourceId: string;
  name: string;
  relativePath: string;
  parentRelative: string;
  size: number;
  lastModified: string | null;
};

export type WebPlanAction = "none" | "rename" | "move" | "create_folder" | "create_structure";

export type WebPlanItem = {
  action: WebPlanAction;
  currentPath: string;
  proposedPath: string | null;
  fileName: string;
  sourceId: string;
  explanation: string;
  renameReasons: string[];
  warnings: string[];
  reviewGroup: "ready" | "review" | "skipped";
  selected: boolean;
  score: number | null;
  confidenceLabel: ConfidenceLabel | null;
  skipReason: string | null;
  status: "preview" | "applied" | "skipped" | "failed";
};

export type WebActivityRun = {
  id: string;
  completedAt: string;
  message: string;
  items: WebPlanItem[];
};

export type WebWorkflow = {
  id: string;
  name: string;
  createdAt: string;
  lastRunAt: string | null;
  fileIds: string[];
};

export type LicenseEdition =
  | "free"
  | "personal_lifetime"
  | "personal_monthly"
  | "business"
  | "enterprise";

export type LicenseStatus = "active" | "expired" | "revoked";

export type LicenseContext = {
  licenseId: string;
  customerId: string;
  email: string;
  edition: LicenseEdition;
  status: LicenseStatus;
  capabilities: string[];
  enabledKnowledgeSources: string[];
  deviceLimit: number;
  activatedDevices: number;
  organisationId?: string;
  organisationName?: string;
  organisationLogo?: string | null;
  memberRole?: "owner" | "admin" | "member";
  validUntil: string | null;
  lastCheckedAt: string;
  offlineUntil: string;
  channel: "stable" | "beta";
  licenseToken: string;
};

export type LicenseApiError =
  | "unknown_email"
  | "no_license"
  | "device_limit"
  | "revoked"
  | "not_activated"
  | "expired"
  | "invalid_request"
  | "rate_limited"
  | "server_error"
  | "service_unavailable"
  | "offline"
  | "payment_incomplete";

