import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type {
  ActivityFileIdentity,
  ActivityItem,
  ActivityItemAction,
  ActivityItemStatus,
  ActivityLog,
  ActivityRun,
  ActivityTrigger,
  KnowledgeSet,
  OrganisationPlan,
  OrganisationPlanAction,
  OrganisationPlanItem,
  OrganisationPlanItemStatus,
  OrganisationReviewGroup,
} from '@suhuella/product/types.ts'

export const ACTIVITY_FILE = 'activity.json'
export const ACTIVITY_LOG_VERSION = 1
export const ACTIVITY_MAX_RUNS = 500
export const ACTIVITY_MAX_AGE_DAYS = 90

const TRIGGERS: ActivityTrigger[] = [
  'organise_documents',
  'move_this_file',
  'workflow',
  'autopilot',
  'undo',
]

const ITEM_STATUSES: ActivityItemStatus[] = ['moved', 'skipped', 'failed']

const ITEM_ACTIONS: ActivityItemAction[] = [
  'none',
  'rename',
  'move',
  'create_folder',
  'create_structure',
  'archive',
  'ignore',
]

const EMPTY_LOG: ActivityLog = {
  version: ACTIVITY_LOG_VERSION,
  updatedAt: '',
  runs: [],
}

export function getActivityFilePath(userDataDir: string): string {
  return path.join(userDataDir, ACTIVITY_FILE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeMovedFile(value: unknown): ActivityFileIdentity | null {
  if (!isRecord(value)) return null
  const device = asNumber(value.device)
  const inode = asNumber(value.inode)
  const size = asNumber(value.size)
  if (device === null || inode === null || inode === 0 || size === null || size < 0) return null
  return { device, inode, size }
}

function normalizeCreatedFolders(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const folders = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => path.normalize(item))
  return folders.length > 0 ? folders : undefined
}

const PLAN_ACTIONS: OrganisationPlanAction[] = [
  'none',
  'rename',
  'move',
  'create_folder',
  'create_structure',
  'archive',
  'ignore',
]

const PLAN_STATUSES: OrganisationPlanItemStatus[] = ['preview', 'applied', 'skipped', 'failed']

function normalizeKnowledgeSet(value: unknown): KnowledgeSet | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null
  const items = value.items
    .map((item) => {
      if (!isRecord(item)) return null
      const itemPath = asString(item.path)
      if (!itemPath || (item.kind !== 'file' && item.kind !== 'folder')) return null
      return { path: itemPath, kind: item.kind }
    })
    .filter((item): item is KnowledgeSet['items'][number] => item !== null)
  return { items }
}

function normalizePlanItem(value: unknown): OrganisationPlanItem | null {
  if (!isRecord(value)) return null
  const currentPath = asString(value.currentPath)
  const fileName = asString(value.fileName) ?? (currentPath ? currentPath.split(/[/\\]/).pop() : null)
  const action = PLAN_ACTIONS.find((item) => item === value.action)
  const status = PLAN_STATUSES.find((item) => item === value.status) ?? 'preview'
  if (!currentPath || !fileName || !action) return null
  const reviewGroup: OrganisationReviewGroup =
    value.reviewGroup === 'ready' || value.reviewGroup === 'review' ? value.reviewGroup : 'skipped'
  const createdFolders = normalizeCreatedFolders(value.createdFolders)
  return {
    action,
    currentPath,
    proposedPath: asString(value.proposedPath),
    explanation: asString(value.explanation) ?? '',
    status,
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === 'string')
      : [],
    reviewGroup,
    selected: value.selected === true,
    fileName,
    score: asNumber(value.score),
    confidenceLabel: null,
    alternatives: [],
    skipReason: asString(value.skipReason),
    ...(createdFolders ? { createdFolders } : {}),
  }
}

function normalizePlan(value: unknown): OrganisationPlan | undefined {
  if (!isRecord(value)) return undefined
  const knowledgeSet = normalizeKnowledgeSet(value.knowledgeSet) ?? { items: [] }
  const items = Array.isArray(value.items)
    ? value.items.map(normalizePlanItem).filter((item): item is OrganisationPlanItem => item !== null)
    : []
  if (items.length === 0 && knowledgeSet.items.length === 0) return undefined
  return { knowledgeSet, items }
}

function normalizeItem(value: unknown): ActivityItem | null {
  if (!isRecord(value)) return null
  const sourcePath = asString(value.sourcePath)
  const fileName = asString(value.fileName)
  const status = ITEM_STATUSES.find((item) => item === value.status)
  const action = ITEM_ACTIONS.find((item) => item === value.action)
  const reason = asString(value.reason)
  if (!sourcePath || !fileName || !status || !action || !reason) return null

  const targetPath = asString(value.targetPath)
  const recommendationId = asString(value.recommendationId)
  const undoReason = asString(value.undoReason)
  const movedFile = normalizeMovedFile(value.movedFile)
  const createdFolders = normalizeCreatedFolders(value.createdFolders)

  return {
    sourcePath,
    targetPath,
    fileName,
    action,
    status,
    reason,
    confidence: asNumber(value.confidence),
    ...(recommendationId ? { recommendationId } : {}),
    ...(movedFile ? { movedFile } : {}),
    ...(createdFolders ? { createdFolders } : {}),
    undoAvailable: value.undoAvailable === true,
    ...(undoReason ? { undoReason } : {}),
  }
}

function normalizeRun(value: unknown): ActivityRun | null {
  if (!isRecord(value)) return null
  const runId = asString(value.runId)
  const runNumber = asNumber(value.runNumber)
  const startedAt = asString(value.startedAt)
  const completedAt = asString(value.completedAt)
  const trigger = TRIGGERS.find((item) => item === value.trigger)
  if (!runId || !runNumber || runNumber < 1 || !startedAt || !completedAt || !trigger) return null

  const summaryRecord = isRecord(value.summary) ? value.summary : {}
  const items = Array.isArray(value.items)
    ? value.items.map(normalizeItem).filter((item): item is ActivityItem => item !== null)
    : []

  const reversesRunId = asString(value.reversesRunId)
  const plan = normalizePlan(value.plan)
  const inversePlan = normalizePlan(value.inversePlan)
  const workflowId = asString(value.workflowId)
  const workflowName = asString(value.workflowName)
  const workflowSummary = asString(value.workflowSummary)

  return {
    runId,
    runNumber: Math.trunc(runNumber),
    startedAt,
    completedAt,
    trigger,
    ...(reversesRunId ? { reversesRunId } : {}),
    ...(plan ? { plan } : {}),
    ...(inversePlan ? { inversePlan } : {}),
    ...(workflowId ? { workflowId } : {}),
    ...(workflowName ? { workflowName } : {}),
    ...(workflowSummary ? { workflowSummary } : {}),
    summary: {
      moved: Math.max(0, Math.trunc(asNumber(summaryRecord.moved) ?? items.filter((item) => item.status === 'moved').length)),
      skipped: Math.max(
        0,
        Math.trunc(asNumber(summaryRecord.skipped) ?? items.filter((item) => item.status === 'skipped').length),
      ),
      failed: Math.max(0, Math.trunc(asNumber(summaryRecord.failed) ?? items.filter((item) => item.status === 'failed').length)),
    },
    items,
  }
}

export function pruneActivityRuns(runs: ActivityRun[], now = Date.now()): ActivityRun[] {
  const cutoff = now - ACTIVITY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return [...runs]
    .filter((run) => {
      const completed = Date.parse(run.completedAt)
      return Number.isFinite(completed) && completed >= cutoff
    })
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt) || right.runNumber - left.runNumber,
    )
    .slice(0, ACTIVITY_MAX_RUNS)
}

export function nextActivityRunNumber(runs: ActivityRun[]): number {
  return runs.reduce((max, run) => Math.max(max, run.runNumber), 0) + 1
}

export function loadActivityLog(userDataDir: string): ActivityLog {
  const filePath = getActivityFilePath(userDataDir)
  if (!existsSync(filePath)) {
    return { ...EMPTY_LOG, runs: [] }
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
    if (!isRecord(parsed)) return { ...EMPTY_LOG, runs: [] }
    const runs = pruneActivityRuns(
      Array.isArray(parsed.runs)
        ? parsed.runs.map(normalizeRun).filter((run): run is ActivityRun => run !== null)
        : [],
    )
    return {
      version: ACTIVITY_LOG_VERSION,
      updatedAt: asString(parsed.updatedAt) ?? '',
      runs,
    }
  } catch {
    return { ...EMPTY_LOG, runs: [] }
  }
}

export function loadActivityRuns(userDataDir: string): ActivityRun[] {
  return loadActivityLog(userDataDir).runs
}

export function saveActivityLog(userDataDir: string, log: ActivityLog): ActivityLog {
  const next: ActivityLog = {
    version: ACTIVITY_LOG_VERSION,
    updatedAt: new Date().toISOString(),
    runs: pruneActivityRuns(log.runs),
  }
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(getActivityFilePath(userDataDir), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function recordActivityRun(userDataDir: string, run: ActivityRun): ActivityRun[] {
  const current = loadActivityLog(userDataDir)
  const next = saveActivityLog(userDataDir, {
    ...current,
    runs: [run, ...current.runs.filter((item) => item.runId !== run.runId)],
  })
  return next.runs
}

export function clearActivityRuns(userDataDir: string): ActivityRun[] {
  saveActivityLog(userDataDir, { ...EMPTY_LOG, runs: [] })
  return []
}
