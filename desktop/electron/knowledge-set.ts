import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { assertConfirmationReceived } from './confirmed-executor.ts'
import { describeKnowledgeItem } from './descriptors.ts'
import { enrichKnowledgeDescriptor } from './local-intelligence.ts'
import { recommendFolders } from './recommendations.ts'
import { proposeSafeRename, renameNameConflicts, validateSafeFileName } from './rename-proposal.ts'
import { applyBrandPresentation } from '@suhuella/brand'
import type { IndexedFolderEntry } from '@suhuella/product/types.ts'
import { organisationPlanCapability } from '@suhuella/product/lib/generation-capabilities.ts'
import { assertExecutorGenerationRights } from './license-rights.ts'
import type { LicenseContext } from '@suhuella/product/types.ts'
import type {
  KnowledgeSet,
  KnowledgeSetItem,
  KnowledgeSetItemKind,
  KnowledgeSetValidationError,
  KnowledgeSetValidationErrorCode,
  OrganisationDestinationOption,
  OrganisationExecutionResult,
  OrganisationPlan,
  OrganisationPlanItem,
  OrganisationPlanPreview,
  OrganisationReviewGroup,
  PlanExecutionProgressEvent,
} from '@suhuella/product/types.ts'
import { PLAN_SOURCE_UNAVAILABLE } from '@suhuella/product/lib/plan-source.ts'
import {
  refreshDesktopPlanItemAvailability,
  withDesktopPlanSourceFields,
} from './plan-source-check.ts'

export const ORGANISATION_PREVIEW_MESSAGE = applyBrandPresentation(
  'Review the plan. Confirm selected actions only. SuHuella may create folders. Existing files are never overwritten or deleted.',
)

const MIN_MOVE_SCORE = 30
const READY_SCORE = 50

export type KnowledgeSetOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: KnowledgeSetValidationError }

function validationError(
  code: KnowledgeSetValidationErrorCode,
  message: string,
): KnowledgeSetOperationResult<never> {
  return { ok: false, error: { code, message } }
}

function isSupportedLocalPath(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) return false
  if (trimmed.startsWith('file://')) return false
  if (trimmed.includes('\0')) return false
  return path.isAbsolute(path.normalize(trimmed))
}

function normalizeKnowledgeSetItem(item: unknown): KnowledgeSetItem | null {
  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>
  const rawPath = typeof record.path === 'string' ? record.path.trim() : ''
  const kind = record.kind

  if (!rawPath || (kind !== 'file' && kind !== 'folder')) {
    return null
  }

  if (!isSupportedLocalPath(rawPath)) {
    return null
  }

  return {
    path: path.normalize(rawPath),
    kind,
  }
}

export function validateKnowledgeSet(
  input: unknown,
): KnowledgeSetOperationResult<KnowledgeSet> {
  if (!input || typeof input !== 'object') {
    return validationError('invalid_knowledge_set', 'A knowledge set is required.')
  }

  const record = input as Record<string, unknown>
  if (!Array.isArray(record.items)) {
    return validationError('invalid_knowledge_set', 'Knowledge set items must be an array.')
  }

  const items: KnowledgeSetItem[] = []
  for (const rawItem of record.items) {
    const item = normalizeKnowledgeSetItem(rawItem)
    if (!item) {
      return validationError(
        'invalid_item',
        'Each knowledge set item must be a local file or folder path.',
      )
    }
    items.push(item)
  }

  if (items.length === 0) {
    return validationError('empty_knowledge_set', 'Add at least one file or folder.')
  }

  const seen = new Set<string>()
  const uniqueItems: KnowledgeSetItem[] = []
  for (const item of items) {
    const key = item.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    uniqueItems.push(item)
  }

  return {
    ok: true,
    data: { items: uniqueItems },
  }
}

function descriptorForKnowledgeSetItem(item: KnowledgeSetItem) {
  const fileName = path.basename(item.path)
  return enrichKnowledgeDescriptor(
    describeKnowledgeItem({
      origin: 'local_file',
      displayName: fileName,
      metadata: { filePath: item.path },
    }),
  )
}

function formatRecommendationExplanation(
  label: string,
  score: number,
  confidenceLabel: string,
  reasons: string[],
): string {
  const reasonText = reasons.length > 0 ? reasons.join(' · ') : label
  return `${confidenceLabel} (${score}%) — ${reasonText}`
}

function destinationOptions(
  recommendations: ReturnType<typeof recommendFolders>,
  folders: IndexedFolderEntry[],
): OrganisationDestinationOption[] {
  return recommendations.map((item) => {
    const dest = path.normalize(item.folder)
    const created =
      !destinationDirExists(dest) && isUnderIndexedRoot(dest, folders) ? foldersToCreate(dest) : []
    return {
      folder: item.folder,
      label: item.label,
      score: item.score,
      confidenceLabel: item.confidenceLabel,
      reasons: item.reasons,
      ...(created.length > 0 ? { createdFolders: created } : {}),
    }
  })
}

function planItem(partial: Omit<OrganisationPlanItem, 'status'> & { status?: OrganisationPlanItem['status'] }): OrganisationPlanItem {
  return {
    status: 'preview',
    ...partial,
  }
}

function buildFolderPlanItem(item: KnowledgeSetItem): OrganisationPlanItem {
  return planItem({
    action: 'none',
    currentPath: item.path,
    proposedPath: null,
    explanation: 'Folders are not organised yet. Select documents to review destinations.',
    warnings: [],
    reviewGroup: 'skipped',
    selected: false,
    fileName: path.basename(item.path),
    score: null,
    confidenceLabel: null,
    alternatives: [],
    skipReason: 'Unsupported item',
  })
}

function buildFilePlanItem(
  item: KnowledgeSetItem,
  folders: IndexedFolderEntry[],
): OrganisationPlanItem {
  const fileName = path.basename(item.path)

  if (folders.length === 0) {
    return planItem({
      action: 'none',
      currentPath: item.path,
      proposedPath: null,
      explanation: applyBrandPresentation('Add folders SuHuella learns from, then review the plan again.'),
      warnings: [],
      reviewGroup: 'skipped',
      selected: false,
      fileName,
      score: null,
      confidenceLabel: null,
      alternatives: [],
      skipReason: 'Destination unavailable',
    })
  }

  const descriptor = descriptorForKnowledgeSetItem(item)
  const recommendations = recommendFolders({ descriptor, folders })
  const alternatives = destinationOptions(recommendations, folders)
  const top = recommendations[0]

  if (!top || top.score < MIN_MOVE_SCORE) {
    return planItem({
      action: 'none',
      currentPath: item.path,
      proposedPath: null,
      explanation:
        top && top.score > 0
          ? `Best match was too weak (${top.score}% · ${top.label}).`
          : 'No confident destination found.',
      warnings: [],
      reviewGroup: 'skipped',
      selected: false,
      fileName,
      score: top?.score ?? null,
      confidenceLabel: top?.confidenceLabel ?? null,
      alternatives,
      skipReason: 'No confident destination found',
    })
  }

  const currentDir = path.normalize(path.dirname(item.path))
  const destinationDir = path.normalize(top.folder)

  if (currentDir.toLowerCase() === destinationDir.toLowerCase()) {
    const destinationFolder = folderAtPath(folders, destinationDir)
    return buildRenamePlanItem(
      item.path,
      fileName,
      top,
      alternatives,
      siblingNamesInFolder(destinationDir, destinationFolder?.fileNames ?? []),
    )
  }

  const proposedPath = path.join(destinationDir, fileName)
  let destinationReady = destinationDirExists(destinationDir)
  let canCreateDestination = false

  if (!destinationReady) {
    if (existsSync(item.path) && isUnderIndexedRoot(destinationDir, folders)) {
      canCreateDestination = true
    } else if (allowedDestinationSet(folders).has(destinationDir.toLowerCase())) {
      destinationReady = true
    }
  }

  if (!destinationReady && !canCreateDestination) {
    return planItem({
      action: 'none',
      currentPath: item.path,
      proposedPath: null,
      explanation: `${top.label} is not available on this computer.`,
      warnings: [],
      reviewGroup: 'skipped',
      selected: false,
      fileName,
      score: top.score,
      confidenceLabel: top.confidenceLabel,
      alternatives,
      skipReason: 'Destination unavailable',
    })
  }

  if (existsSync(proposedPath)) {
    return planItem({
      action: 'none',
      currentPath: item.path,
      proposedPath,
      explanation: formatRecommendationExplanation(top.label, top.score, top.confidenceLabel, top.reasons),
      warnings: [],
      reviewGroup: 'skipped',
      selected: false,
      fileName,
      score: top.score,
      confidenceLabel: top.confidenceLabel,
      alternatives,
      skipReason: 'Target already exists',
    })
  }

  const ready = top.score >= READY_SCORE
  const createdFolders = canCreateDestination ? foldersToCreate(destinationDir) : []
  const action =
    createdFolders.length > 1 ? 'create_structure' : createdFolders.length === 1 ? 'create_folder' : 'move'
  return planItem({
    action,
    currentPath: item.path,
    proposedPath,
    explanation: createdFolders.length > 0
      ? `${CREATE_DESTINATION_STRUCTURE_WHY} ${formatRecommendationExplanation(top.label, top.score, top.confidenceLabel, top.reasons)}`
      : formatRecommendationExplanation(top.label, top.score, top.confidenceLabel, top.reasons),
    warnings: createdFolders.length > 0
      ? ready
        ? [folderCreateWarning(createdFolders)]
        : [folderCreateWarning(createdFolders), 'Needs a destination choice before it can move.']
      : ready
        ? []
        : ['Needs a destination choice before it can move.'],
    reviewGroup: ready ? 'ready' : 'review',
    selected: ready,
    fileName,
    score: top.score,
    confidenceLabel: top.confidenceLabel,
    alternatives,
    skipReason: null,
    ...(createdFolders.length > 0 ? { createdFolders } : {}),
  })
}

function buildPlanItem(
  item: KnowledgeSetItem,
  folders: IndexedFolderEntry[],
): OrganisationPlanItem {
  if (item.kind === 'folder') {
    return withDesktopPlanSourceFields(buildFolderPlanItem(item), folders)
  }
  return withDesktopPlanSourceFields(buildFilePlanItem(item, folders), folders)
}

const MAX_EXPANDED_PLAN_FILES = 200

function listImmediateFiles(folderPath: string): string[] {
  try {
    return readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => path.join(folderPath, entry.name))
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

export function expandKnowledgeSetForPlan(knowledgeSet: KnowledgeSet): KnowledgeSet {
  const seen = new Set<string>()
  const items: KnowledgeSetItem[] = []

  const add = (item: KnowledgeSetItem) => {
    const key = item.path.toLowerCase()
    if (seen.has(key) || items.length >= MAX_EXPANDED_PLAN_FILES) return
    seen.add(key)
    items.push(item)
  }

  for (const item of knowledgeSet.items) {
    if (items.length >= MAX_EXPANDED_PLAN_FILES) break
    if (item.kind !== 'folder') {
      add(item)
      continue
    }

    const files = listImmediateFiles(item.path)
    if (files.length === 0) {
      add(item)
      continue
    }
    for (const filePath of files) {
      add({ path: filePath, kind: 'file' })
      if (items.length >= MAX_EXPANDED_PLAN_FILES) break
    }
  }

  return { items }
}

export function previewOrganisationPlanForFolders(
  input: unknown,
  folders: IndexedFolderEntry[],
): KnowledgeSetOperationResult<OrganisationPlanPreview> {
  const validated = validateKnowledgeSet(input)
  if (!validated.ok) return validated

  const expanded = expandKnowledgeSetForPlan(validated.data)
  const items = expanded.items.map((item) => refreshDesktopPlanItemAvailability(buildPlanItem(item, folders), folders))

  return {
    ok: true,
    data: {
      simulated: true,
      message: ORGANISATION_PREVIEW_MESSAGE,
      knowledgeSet: validated.data,
      items,
    },
  }
}

export function validateOrganisationPlan(input: unknown): KnowledgeSetOperationResult<OrganisationPlan> {
  if (!input || typeof input !== 'object') {
    return validationError('invalid_plan', 'A preview plan is required.')
  }

  const record = input as Record<string, unknown>
  const knowledgeSetInput = record.knowledgeSet ?? record.context
  const knowledgeSetResult = validateKnowledgeSet(knowledgeSetInput)
  if (!knowledgeSetResult.ok) return knowledgeSetResult

  if (!Array.isArray(record.items)) {
    return validationError('invalid_plan', 'Plan items must be an array.')
  }

  const items: OrganisationPlanItem[] = []
  for (const rawItem of record.items) {
    if (!rawItem || typeof rawItem !== 'object') {
      return validationError('invalid_plan', 'Each plan item is invalid.')
    }

    const planItem = rawItem as OrganisationPlanItem
    if (typeof planItem.currentPath !== 'string' || !planItem.currentPath.trim()) {
      return validationError('invalid_plan', 'Each plan item needs a current path.')
    }

    const reviewGroup: OrganisationReviewGroup =
      planItem.reviewGroup === 'ready' || planItem.reviewGroup === 'review'
        ? planItem.reviewGroup
        : 'skipped'
    const createdFolders = normalizeCreatedFolders(planItem.createdFolders)

    items.push({
      action: planItem.action,
      currentPath: path.normalize(planItem.currentPath),
      proposedPath:
        typeof planItem.proposedPath === 'string' && planItem.proposedPath.trim()
          ? path.normalize(planItem.proposedPath)
          : null,
      explanation:
        typeof planItem.explanation === 'string'
          ? planItem.explanation
          : ORGANISATION_PREVIEW_MESSAGE,
      status: 'preview',
      warnings: Array.isArray(planItem.warnings)
        ? planItem.warnings.filter((warning): warning is string => typeof warning === 'string')
        : [],
      reviewGroup,
      selected: planItem.selected === true,
      fileName:
        typeof planItem.fileName === 'string' && planItem.fileName.trim()
          ? planItem.fileName
          : path.basename(planItem.currentPath),
      score: typeof planItem.score === 'number' ? planItem.score : null,
      confidenceLabel: planItem.confidenceLabel ?? null,
      alternatives: Array.isArray(planItem.alternatives) ? planItem.alternatives : [],
      skipReason: typeof planItem.skipReason === 'string' ? planItem.skipReason : null,
      ...(planItem.renameStrategy === 'normalize' ||
      planItem.renameStrategy === 'shorten' ||
      planItem.renameStrategy === 'disambiguate' ||
      planItem.renameStrategy === 'keep_original'
        ? { renameStrategy: planItem.renameStrategy }
        : {}),
      ...(Array.isArray(planItem.renameReasons)
        ? {
            renameReasons: planItem.renameReasons.filter(
              (reason): reason is string => typeof reason === 'string' && reason.trim().length > 0,
            ),
          }
        : {}),
      ...(createdFolders ? { createdFolders } : {}),
      ...(typeof planItem.sourceId === 'string' && planItem.sourceId.trim()
        ? { sourceId: planItem.sourceId.trim() }
        : {}),
      ...(typeof planItem.sourceName === 'string' && planItem.sourceName.trim()
        ? { sourceName: planItem.sourceName.trim() }
        : {}),
    })
  }

  if (items.length === 0) {
    return validationError('invalid_plan', 'The plan has no items.')
  }

  return {
    ok: true,
    data: {
      knowledgeSet: knowledgeSetResult.data,
      items,
    },
  }
}

function samePath(left: string, right: string): boolean {
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase()
}

function allowedDestinationSet(folders: IndexedFolderEntry[]): Set<string> {
  return new Set(folders.map((folder) => path.normalize(folder.absolutePath).toLowerCase()))
}

function isUnderIndexedRoot(destinationDir: string, folders: IndexedFolderEntry[]): boolean {
  const normalized = path.normalize(destinationDir).toLowerCase()
  for (const folder of folders) {
    const root = path.normalize(folder.absolutePath).toLowerCase()
    if (normalized === root) return true
    if (normalized.startsWith(`${root}${path.sep}`)) return true
  }
  return false
}

function siblingNamesInFolder(absolutePath: string, indexedNames: string[] = []): string[] {
  const names = new Set(indexedNames)
  try {
    if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
      for (const name of readdirSync(absolutePath)) names.add(name)
    }
  } catch {
    /* index names are enough when the folder is a fixture */
  }
  return [...names]
}

function folderAtPath(folders: IndexedFolderEntry[], absolutePath: string): IndexedFolderEntry | undefined {
  return folders.find((folder) => samePath(folder.absolutePath, absolutePath))
}

function buildRenamePlanItem(
  currentPath: string,
  fileName: string,
  top: { folder: string; label: string; score: number; confidenceLabel: OrganisationPlanItem['confidenceLabel'] },
  alternatives: OrganisationDestinationOption[],
  siblingNames: string[],
): OrganisationPlanItem {
  const proposal = proposeSafeRename(fileName, siblingNames)
  if (!proposal) {
    return planItem({
      action: 'none',
      currentPath,
      proposedPath: null,
      explanation: `Already in ${top.label}.`,
      warnings: [],
      reviewGroup: 'skipped',
      selected: false,
      fileName,
      score: top.score,
      confidenceLabel: top.confidenceLabel,
      alternatives,
      skipReason: 'Already in the recommended folder',
    })
  }

  const proposedPath = path.join(path.dirname(currentPath), proposal.name)
  const conflict =
    renameNameConflicts(proposal.name, fileName, siblingNames) ||
    (existsSync(proposedPath) && !samePath(proposedPath, currentPath))

  if (conflict) {
    return planItem({
      action: 'rename',
      currentPath,
      proposedPath,
      explanation: `A file named ${proposal.name} already exists.`,
      warnings: ['A file with that name already exists.'],
      reviewGroup: 'skipped',
      selected: false,
      fileName,
      score: top.score,
      confidenceLabel: top.confidenceLabel,
      alternatives,
      skipReason: 'A file with that name already exists',
    })
  }

  const ready = top.score >= READY_SCORE
  return planItem({
    action: 'rename',
    currentPath,
    proposedPath,
    explanation: proposal.explanation,
    renameStrategy: proposal.strategy,
    renameReasons: proposal.reasons,
    warnings: ready ? [] : ['Needs a name check before it can rename.'],
    reviewGroup: ready ? 'ready' : 'review',
    selected: ready,
    fileName,
    score: top.score,
    confidenceLabel: top.confidenceLabel,
    alternatives,
    skipReason: null,
  })
}

function destinationDirExists(destinationDir: string): boolean {
  try {
    return existsSync(destinationDir) && statSync(destinationDir).isDirectory()
  } catch {
    return false
  }
}

function isFolderCreateAction(action: OrganisationPlanItem['action']): boolean {
  return action === 'create_folder' || action === 'create_structure'
}

function foldersToCreate(destinationDir: string): string[] {
  const missing: string[] = []
  let current = path.normalize(destinationDir)
  while (current && !destinationDirExists(current)) {
    missing.unshift(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return missing
}

export const CREATE_DESTINATION_STRUCTURE_WHY =
  'These folders are missing under your indexed location and are needed before moving this document.'

function folderCreateWarning(createdFolders: string[]): string {
  return createdFolders.length > 1
    ? 'Creates the destination folders, then moves the file.'
    : 'Creates the destination folder, then moves the file.'
}

function normalizeCreatedFolders(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const folders = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => path.normalize(item))
  return folders.length > 0 ? folders : undefined
}

function isEmptyDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory() && readdirSync(dir).length === 0
  } catch {
    return false
  }
}

export function deleteEmptyCreatedFolders(createdFolders: string[] | undefined): string[] {
  if (!createdFolders || createdFolders.length === 0) return []
  const deleted: string[] = []
  for (const folder of [...createdFolders].reverse()) {
    if (!existsSync(folder) || !isEmptyDirectory(folder)) continue
    try {
      rmdirSync(folder)
      if (!existsSync(folder)) deleted.push(folder)
    } catch {
      /* never delete a folder that is not empty */
    }
  }
  return deleted
}

export function isExecutablePlanAction(action: OrganisationPlanItem['action']): boolean {
  return action === 'move' || isFolderCreateAction(action) || action === 'rename'
}

function skipItem(item: OrganisationPlanItem, reason: string): OrganisationPlanItem {
  return {
    ...item,
    status: 'skipped',
    warnings: [...item.warnings, reason],
  }
}

function failItem(item: OrganisationPlanItem, reason: string): OrganisationPlanItem {
  return {
    ...item,
    status: 'failed',
    warnings: [...item.warnings, reason],
  }
}

function applyConfirmedPlanItem(
  item: OrganisationPlanItem,
  folders: IndexedFolderEntry[],
  inverse = false,
): OrganisationPlanItem {
  const working = refreshDesktopPlanItemAvailability(item, folders)
  if (working.status === 'source_unavailable') {
    return {
      ...working,
      status: 'skipped',
      skipReason: working.skipReason ?? PLAN_SOURCE_UNAVAILABLE,
    }
  }

  if (working.selected !== true) {
    return {
      ...working,
      status: 'skipped',
      skipReason: working.skipReason ?? 'Not selected',
    }
  }

  if (working.action === 'none' || working.action === 'ignore') {
    return { ...working, status: 'skipped' }
  }

  if (!isExecutablePlanAction(working.action) || !working.proposedPath) {
    return skipItem(working, 'Only confirmed plan actions are supported in this version.')
  }

  if (working.action === 'rename') {
    return applyConfirmedRename(working, folders, inverse)
  }

  return applyConfirmedFileTransfer(working, folders, inverse)
}

function applyConfirmedRename(
  item: OrganisationPlanItem,
  folders: IndexedFolderEntry[],
  inverse = false,
): OrganisationPlanItem {
  const proposedPath = item.proposedPath
  if (!proposedPath) {
    return skipItem(item, 'Rename needs a new file name.')
  }

  if (!isSupportedLocalPath(item.currentPath) || !isSupportedLocalPath(proposedPath)) {
    return skipItem(item, 'Rename paths must be local absolute paths.')
  }

  const currentDir = path.normalize(path.dirname(item.currentPath))
  const proposedDir = path.normalize(path.dirname(proposedPath))
  if (!samePath(currentDir, proposedDir)) {
    return skipItem(item, 'Rename must stay in the same folder.')
  }

  const currentName = path.basename(item.currentPath)
  const proposedName = path.basename(proposedPath)
  if (currentName.toLowerCase() === proposedName.toLowerCase()) {
    return skipItem(item, 'Already using that name.')
  }

  if (!inverse) {
    const validation = validateSafeFileName(proposedName)
    if (!validation.ok) {
      return skipItem(item, validation.reason)
    }

    const destinationAllowed =
      allowedDestinationSet(folders).has(currentDir.toLowerCase()) || isUnderIndexedRoot(currentDir, folders)
    if (!destinationAllowed) {
      return skipItem(item, 'Destination is not in the knowledge index.')
    }
  }

  let sourceStat
  try {
    sourceStat = statSync(item.currentPath)
  } catch {
    return skipItem(item, 'Source file is missing.')
  }

  if (!sourceStat.isFile()) {
    return skipItem(item, 'Only files can be renamed.')
  }

  if (existsSync(proposedPath)) {
    return skipItem(item, 'Skipped to avoid overwrite.')
  }

  try {
    renameSync(item.currentPath, proposedPath)
  } catch {
    return failItem(item, 'Could not rename this file.')
  }

  if (existsSync(item.currentPath) || !existsSync(proposedPath)) {
    return failItem(item, 'Rename did not complete. The original file was left in place.')
  }

  return {
    ...item,
    status: 'applied',
  }
}

function applyConfirmedFileTransfer(
  item: OrganisationPlanItem,
  folders: IndexedFolderEntry[],
  inverse = false,
): OrganisationPlanItem {
  const proposedPath = item.proposedPath
  if (!proposedPath) {
    return skipItem(item, 'Only confirmed moves and folder creation are supported in this version.')
  }

  if (!isSupportedLocalPath(item.currentPath) || !isSupportedLocalPath(proposedPath)) {
    return skipItem(item, 'Move paths must be local absolute paths.')
  }

  if (path.basename(item.currentPath).toLowerCase() !== path.basename(proposedPath).toLowerCase()) {
    return skipItem(item, 'Rename is not supported yet. Destination must keep the same file name.')
  }

  let sourceStat
  try {
    sourceStat = statSync(item.currentPath)
  } catch {
    return skipItem(item, 'Source file is missing.')
  }

  if (!sourceStat.isFile()) {
    return skipItem(item, 'Only files can be moved.')
  }

  const destinationDir = path.normalize(path.dirname(proposedPath))

  if (!inverse) {
    const destinationAllowed =
      allowedDestinationSet(folders).has(destinationDir.toLowerCase()) ||
      isUnderIndexedRoot(destinationDir, folders)
    if (!destinationAllowed) {
      return skipItem(item, 'Destination is not in the knowledge index.')
    }

    const descriptor = descriptorForKnowledgeSetItem({
      path: item.currentPath,
      kind: 'file',
    })
    const currentRecommendations = recommendFolders({ descriptor, folders }).filter(
      (recommendation) => recommendation.score >= MIN_MOVE_SCORE,
    )
    if (currentRecommendations.length === 0) {
      return skipItem(item, 'No confident destination found.')
    }

    if (!currentRecommendations.some((recommendation) => samePath(recommendation.folder, destinationDir))) {
      return skipItem(item, 'Destination is not an available recommendation.')
    }

    if (samePath(path.dirname(item.currentPath), destinationDir)) {
      return skipItem(item, 'File is already in the recommended folder.')
    }
  }

  let createdFolders = item.createdFolders
  let didCreateFolders = false

  if (!destinationDirExists(destinationDir)) {
    if (!inverse && isFolderCreateAction(item.action) && isUnderIndexedRoot(destinationDir, folders)) {
      createdFolders = foldersToCreate(destinationDir)
      try {
        mkdirSync(destinationDir, { recursive: true })
        didCreateFolders = createdFolders.length > 0
      } catch {
        return failItem(item, 'Could not create the destination folder.')
      }
      if (!destinationDirExists(destinationDir)) {
        return failItem(item, 'Could not create the destination folder.')
      }
    } else {
      return skipItem(item, 'Destination folder does not exist.')
    }
  }

  const rollbackCreatedFolders = () => {
    if (didCreateFolders && createdFolders && createdFolders.length > 0) {
      deleteEmptyCreatedFolders(createdFolders)
    }
  }

  if (existsSync(proposedPath)) {
    rollbackCreatedFolders()
    return skipItem(item, 'Skipped to avoid overwrite.')
  }

  try {
    renameSync(item.currentPath, proposedPath)
  } catch (error) {
    rollbackCreatedFolders()
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code === 'EXDEV') {
      return skipItem(item, 'Skipped cross-volume move. Copy is not used in this version.')
    }
    return failItem(item, 'Could not move this file.')
  }

  if (existsSync(item.currentPath) || !existsSync(proposedPath)) {
    rollbackCreatedFolders()
    return failItem(item, 'Move did not complete. The original file was left in place.')
  }

  if (inverse) {
    deleteEmptyCreatedFolders(item.createdFolders)
  }

  return {
    ...item,
    status: 'applied',
    ...(createdFolders && createdFolders.length > 0 ? { createdFolders } : {}),
  }
}

export type ExecuteOrganisationPlanHooks = {
  onItemApplied?: (event: PlanExecutionProgressEvent) => void
}

export function executeOrganisationPlan(
  input: unknown,
  folders: IndexedFolderEntry[],
  hooks?: ExecuteOrganisationPlanHooks,
): KnowledgeSetOperationResult<OrganisationExecutionResult> {
  return executeOrganisationPlanInternal(input, folders, {
    inverse: false,
    enforceGenerationRights: true,
    onItemApplied: hooks?.onItemApplied,
  })
}

/**
 * Host-only inverse execution after Activity validates the recorded run and inverse plan.
 * Not exposed on IPC — callers must not accept client-supplied recovery flags.
 */
export function executeOrganisationPlanForVerifiedUndo(
  input: unknown,
  folders: IndexedFolderEntry[],
): KnowledgeSetOperationResult<OrganisationExecutionResult> {
  return executeOrganisationPlanInternal(input, folders, { inverse: true, enforceGenerationRights: false })
}

function executeOrganisationPlanInternal(
  input: unknown,
  folders: IndexedFolderEntry[],
  options: {
    inverse: boolean
    enforceGenerationRights: boolean
    onItemApplied?: (event: PlanExecutionProgressEvent) => void
  },
): KnowledgeSetOperationResult<OrganisationExecutionResult> {
  if (!input || typeof input !== 'object') {
    return validationError('invalid_request', 'Execution request is required.')
  }

  const record = input as Record<string, unknown>
  try {
    assertConfirmationReceived(record.confirmed)
  } catch {
    return validationError('confirmation_required', 'Confirm changes before executing.')
  }

  if (options.enforceGenerationRights) {
    const rights = assertExecutorGenerationRights(undefined, organisationPlanCapability())
    if (!rights.ok) {
      if (rights.error.code === 'generation_required') {
        return validationError('generation_required', rights.error.message)
      }
      return validationError('invalid_request', rights.error.message)
    }
  }

  const planResult = validateOrganisationPlan(record.plan)
  if (!planResult.ok) return planResult

  const plannedItems = planResult.data.items
  const total = plannedItems.length
  const items: OrganisationPlanItem[] = []
  for (let index = 0; index < total; index += 1) {
    const applied = applyConfirmedPlanItem(plannedItems[index], folders, options.inverse === true)
    items.push(applied)
    options.onItemApplied?.({ item: applied, index, total })
  }
  const appliedCount = items.filter((item) => item.status === 'applied').length
  const skippedCount = items.filter((item) => item.status === 'skipped').length
  const failedCount = items.filter((item) => item.status === 'failed').length
  const completedAt = new Date().toISOString()
  const runNumber = Number(record.runNumber)
  const resolvedRunNumber = Number.isInteger(runNumber) && runNumber > 0 ? runNumber : 1
  const day = completedAt.slice(0, 10)

  return {
    ok: true,
    data: {
      simulated: false,
      runId: `${day}-${String(resolvedRunNumber).padStart(3, '0')}`,
      runNumber: resolvedRunNumber,
      completedAt,
      knowledgeSet: planResult.data.knowledgeSet,
      message:
        failedCount > 0
          ? `Plan completed with ${failedCount} issue${failedCount === 1 ? '' : 's'}.`
          : appliedCount > 0
            ? 'Plan completed successfully'
            : 'No files were changed',
      appliedCount,
      skippedCount,
      failedCount,
      items,
    },
  }
}

export function resolveKnowledgeSetItemKind(filePath: string): KnowledgeSetItemKind {
  try {
    return statSync(filePath).isDirectory() ? 'folder' : 'file'
  } catch {
    return 'file'
  }
}

export function pathsToKnowledgeSetItems(filePaths: string[]): KnowledgeSetItem[] {
  return filePaths.map((filePath) => ({
    path: path.normalize(filePath),
    kind: resolveKnowledgeSetItemKind(filePath),
  }))
}

function fixtureFolder(relativePath: string, fileNames: string[]): IndexedFolderEntry {
  const absolutePath = path.join('/suhuella-organise-check', relativePath)
  const segments = relativePath.split('/').filter(Boolean)
  const folderName = segments.at(-1) ?? relativePath

  return {
    id: relativePath,
    sourceId: 'src_organise_check',
    sourceType: 'local_folder',
    kind: 'folder',
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath,
    folderName,
    parentTokens: [],
    depth: segments.length,
    extensions: [],
    fileCount: fileNames.length,
    fileNames,
    lastModified: null,
  }
}

function realFolder(absolutePath: string, fileNames: string[]): IndexedFolderEntry {
  const folderName = path.basename(absolutePath)
  return {
    id: absolutePath,
    sourceId: 'src_organise_check',
    sourceType: 'local_folder',
    kind: 'folder',
    name: folderName,
    locator: absolutePath,
    absolutePath,
    relativePath: folderName,
    folderName,
    parentTokens: [],
    depth: 1,
    extensions: [],
    fileCount: fileNames.length,
    fileNames,
    lastModified: null,
  }
}

export function knowledgeSetCheckLicenseContext(): LicenseContext {
  return {
    licenseId: 'lic_knowledge_set_check',
    customerId: 'cust_knowledge_set_check',
    email: 'knowledge-set-check@test.local',
    edition: 'personal_lifetime',
    status: 'active',
    capabilities: [
      'recommend_folder',
      'explain_recommendation',
      'navigate_save_dialog',
      'copy_path',
      'open_folder',
      'refresh_index',
      'create_folder',
      'rename_file',
      'move_file',
      'apply_bulk_organisation',
    ],
    enabledKnowledgeSources: ['local_folder'],
    deviceLimit: 1,
    activatedDevices: 0,
    validUntil: null,
    lastCheckedAt: '2026-09-18T00:00:00.000Z',
    offlineUntil: '2026-12-01T00:00:00.000Z',
    channel: 'stable',
    licenseToken: 'hidden',
  }
}

export function runKnowledgeSetChecks(): void {
  const empty = validateKnowledgeSet({ items: [] })
  if (empty.ok) throw new Error('empty knowledge set should fail')

  const invalidUrl = validateKnowledgeSet({
    items: [{ path: 'https://example.com/file.pdf', kind: 'file' }],
  })
  if (invalidUrl.ok) throw new Error('URL paths should fail')

  const virtualInvoice = path.join(tmpdir(), 'Invoice_ACME_2026.pdf')
  const valid = validateKnowledgeSet({
    items: [{ path: virtualInvoice, kind: 'file' }],
  })
  if (!valid.ok) throw new Error('valid local path should pass')

  const emptyIndexPreview = previewOrganisationPlanForFolders(valid.data, [])
  if (!emptyIndexPreview.ok || emptyIndexPreview.data.items[0]?.action !== 'none') {
    throw new Error('empty index should produce no move')
  }

  const fixtureFolders = [
    fixtureFolder('Clients/ACME/Invoices', [
      'Invoice_ACME_2024.pdf',
      'Factura_ACME_2025.pdf',
    ]),
  ]
  const movePreview = previewOrganisationPlanForFolders(valid.data, fixtureFolders)
  if (
    !movePreview.ok ||
    movePreview.data.items[0]?.action !== 'move' ||
    movePreview.data.items[0]?.reviewGroup !== 'ready' ||
    movePreview.data.items[0]?.selected !== true
  ) {
    throw new Error('invoice file should be ready to move when index matches')
  }

  const executeWithoutConfirm = executeOrganisationPlan(
    { plan: movePreview.data, confirmed: false },
    fixtureFolders,
  )
  if (executeWithoutConfirm.ok) {
    throw new Error('execute without confirmation should fail')
  }

  const root = mkdtempSync(path.join(tmpdir(), 'suhuella-org-'))
  try {
    const sourceDir = path.join(root, 'Downloads')
    const destDir = path.join(root, 'Clients', 'ACME', 'Invoices')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(destDir, { recursive: true })

    const sourceFile = path.join(sourceDir, 'Invoice_ACME_2026.pdf')
    const destFile = path.join(destDir, 'Invoice_ACME_2026.pdf')
    writeFileSync(sourceFile, 'invoice')
    writeFileSync(path.join(destDir, 'Invoice_ACME_2024.pdf'), 'old')

    const liveFolders = [realFolder(destDir, ['Invoice_ACME_2024.pdf'])]
    const liveSet = validateKnowledgeSet({ items: [{ path: sourceFile, kind: 'file' }] })
    if (!liveSet.ok) throw new Error('live knowledge set should pass')

    const livePreview = previewOrganisationPlanForFolders(liveSet.data, liveFolders)
    if (!livePreview.ok || livePreview.data.items[0]?.reviewGroup !== 'ready') {
      throw new Error('live invoice should be ready to move')
    }

    const unselected = executeOrganisationPlan(
      {
        plan: {
          knowledgeSet: livePreview.data.knowledgeSet,
          items: livePreview.data.items.map((item) => ({ ...item, selected: false })),
        },
        confirmed: true,
      },
      liveFolders,
    )
    if (!unselected.ok || unselected.data.appliedCount !== 0 || !existsSync(sourceFile)) {
      throw new Error('unselected ready items must not move')
    }

    const moved = executeOrganisationPlan({ plan: livePreview.data, confirmed: true }, liveFolders)
    if (!moved.ok || moved.data.simulated || moved.data.appliedCount !== 1) {
      throw new Error('confirmed move should apply one file')
    }
    if (existsSync(sourceFile) || !existsSync(destFile)) {
      throw new Error('source should move to the recommended folder')
    }

    writeFileSync(sourceFile, 'invoice-again')
    writeFileSync(destFile, 'already-there')
    const overwriteSet = validateKnowledgeSet({ items: [{ path: sourceFile, kind: 'file' }] })
    if (!overwriteSet.ok) throw new Error('overwrite knowledge set should pass')
    const overwritePreview = previewOrganisationPlanForFolders(overwriteSet.data, liveFolders)
    if (!overwritePreview.ok || overwritePreview.data.items[0]?.reviewGroup !== 'skipped') {
      throw new Error('existing destination must be skipped in the review plan')
    }
    const skipped = executeOrganisationPlan(
      { plan: overwritePreview.data, confirmed: true },
      liveFolders,
    )
    if (!skipped.ok || skipped.data.appliedCount !== 0 || skipped.data.skippedCount < 1) {
      throw new Error('existing destination must be skipped, never overwritten')
    }
    if (!existsSync(sourceFile)) {
      throw new Error('source must remain when overwrite is skipped')
    }

    const singleDest = path.join(root, 'Clients', 'NewInvoices')
    const singleSource = path.join(sourceDir, 'Invoice_ACME_single.pdf')
    writeFileSync(singleSource, 'invoice')
    const singleSet = validateKnowledgeSet({ items: [{ path: singleSource, kind: 'file' }] })
    if (!singleSet.ok) throw new Error('single folder knowledge set should pass')
    const singlePreview = previewOrganisationPlanForFolders(singleSet.data, [
      realFolder(singleDest, ['Invoice_ACME_2024.pdf']),
    ])
    if (
      !singlePreview.ok ||
      singlePreview.data.items[0]?.action !== 'create_folder' ||
      singlePreview.data.items[0]?.reviewGroup !== 'ready' ||
      singlePreview.data.items[0]?.createdFolders?.length !== 1
    ) {
      throw new Error('one missing folder under index should preview create_folder')
    }

    const unconfirmedSingle = executeOrganisationPlan(
      { plan: singlePreview.data, confirmed: false },
      [realFolder(singleDest, ['Invoice_ACME_2024.pdf'])],
    )
    if (unconfirmedSingle.ok || existsSync(singleDest)) {
      throw new Error('folder creation must wait for confirmation')
    }

    const createdSingle = executeOrganisationPlan({ plan: singlePreview.data, confirmed: true }, [
      realFolder(singleDest, ['Invoice_ACME_2024.pdf']),
    ])
    const createdSingleDest = path.join(singleDest, 'Invoice_ACME_single.pdf')
    if (!createdSingle.ok || createdSingle.data.appliedCount !== 1) {
      throw new Error('create_folder plan should move file into a new folder')
    }
    if (!existsSync(singleDest) || !existsSync(createdSingleDest)) {
      throw new Error('create_folder plan should create destination folder on disk')
    }
    if (createdSingle.data.items[0]?.createdFolders?.length !== 1) {
      throw new Error('create_folder plan should record the created folder')
    }

    const missingDest = path.join(root, 'Clients', 'Missing', 'Invoices')
    const missingSource = path.join(sourceDir, 'Invoice_ACME_missing.pdf')
    writeFileSync(missingSource, 'invoice')
    const missingSet = validateKnowledgeSet({ items: [{ path: missingSource, kind: 'file' }] })
    if (!missingSet.ok) throw new Error('missing destination knowledge set should pass')
    const missingPreview = previewOrganisationPlanForFolders(missingSet.data, [
      realFolder(missingDest, ['Invoice_ACME_2024.pdf']),
    ])
    if (
      !missingPreview.ok ||
      missingPreview.data.items[0]?.action !== 'create_structure' ||
      missingPreview.data.items[0]?.reviewGroup !== 'ready' ||
      (missingPreview.data.items[0]?.createdFolders?.length ?? 0) < 2
    ) {
      throw new Error('nested missing folders under index should preview create_structure')
    }

    const unconfirmedStructure = executeOrganisationPlan(
      { plan: missingPreview.data, confirmed: false },
      [realFolder(missingDest, ['Invoice_ACME_2024.pdf'])],
    )
    if (unconfirmedStructure.ok || existsSync(missingDest)) {
      throw new Error('structure creation must wait for confirmation')
    }

    const created = executeOrganisationPlan({ plan: missingPreview.data, confirmed: true }, [
      realFolder(missingDest, ['Invoice_ACME_2024.pdf']),
    ])
    if (!created.ok || created.data.appliedCount !== 1) {
      throw new Error('create_structure plan should move file into a new folder')
    }
    const createdDest = path.join(missingDest, 'Invoice_ACME_missing.pdf')
    if (!existsSync(missingDest) || !existsSync(createdDest)) {
      throw new Error('create_structure plan should create destination folders on disk')
    }
    if ((created.data.items[0]?.createdFolders?.length ?? 0) < 2) {
      throw new Error('create_structure plan should record every created folder')
    }

    const rollbackDest = path.join(root, 'Clients', 'Rollback', 'Invoices')
    const rollbackSource = path.join(sourceDir, 'Invoice_ACME_rollback.pdf')
    writeFileSync(rollbackSource, 'invoice')
    const rollbackSet = validateKnowledgeSet({ items: [{ path: rollbackSource, kind: 'file' }] })
    if (!rollbackSet.ok) throw new Error('rollback knowledge set should pass')
    const rollbackPreview = previewOrganisationPlanForFolders(rollbackSet.data, [
      realFolder(rollbackDest, ['Invoice_ACME_2024.pdf']),
    ])
    if (!rollbackPreview.ok || !isFolderCreateAction(rollbackPreview.data.items[0]?.action ?? 'none')) {
      throw new Error('rollback case should preview destination structure creation')
    }
    try {
      chmodSync(sourceDir, 0o500)
    } catch {
      throw new Error('rollback case needs chmod support on this platform')
    }
    const rollbackFailed = executeOrganisationPlan({ plan: rollbackPreview.data, confirmed: true }, [
      realFolder(rollbackDest, ['Invoice_ACME_2024.pdf']),
    ])
    try {
      chmodSync(sourceDir, 0o755)
    } catch {
      /* best effort before cleanup */
    }
    if (!rollbackFailed.ok || rollbackFailed.data.appliedCount !== 0) {
      throw new Error('failed move after folder creation should not apply')
    }
    if (!existsSync(rollbackSource)) {
      throw new Error('failed move must leave the source file in place')
    }
    if (existsSync(rollbackDest)) {
      throw new Error('failed move should roll back empty created folders immediately')
    }

    const renameDir = path.join(root, 'Clients', 'ACME', 'Invoices')
    const messyName = 'Factura ACME 2027.pdf'
    const tidyName = 'Factura_ACME_2027.pdf'
    const messyFile = path.join(renameDir, messyName)
    const tidyFile = path.join(renameDir, tidyName)
    writeFileSync(messyFile, 'rename-me')
    const renameFolders = [realFolder(renameDir, ['Invoice_ACME_2024.pdf', messyName])]
    const renameSet = validateKnowledgeSet({ items: [{ path: messyFile, kind: 'file' }] })
    if (!renameSet.ok) throw new Error('rename knowledge set should pass')
    const renamePreview = previewOrganisationPlanForFolders(renameSet.data, renameFolders)
    if (
      !renamePreview.ok ||
      renamePreview.data.items[0]?.action !== 'rename' ||
      renamePreview.data.items[0]?.reviewGroup !== 'ready' ||
      renamePreview.data.items[0]?.selected !== true ||
      path.basename(renamePreview.data.items[0]?.proposedPath ?? '') !== tidyName ||
      renamePreview.data.items[0]?.renameStrategy !== 'normalize' ||
      (renamePreview.data.items[0]?.renameReasons?.length ?? 0) === 0
    ) {
      throw new Error('messy invoice already in the recommended folder should preview a rename')
    }

    const illegalProposal = proposeSafeRename('Invoice: ACME?.pdf', ['Invoice_ACME_2024.pdf'])
    if (
      !illegalProposal ||
      illegalProposal.name !== 'Invoice_ACME.pdf' ||
      !illegalProposal.reasons.some((reason) => reason.includes('Invalid characters'))
    ) {
      throw new Error('illegal characters should normalise with a clear reason')
    }

    const editedName = 'Factura_ACME_2027_FINAL.pdf'
    const editedPlan = {
      knowledgeSet: renamePreview.data.knowledgeSet,
      items: renamePreview.data.items.map((item) => ({
        ...item,
        proposedPath: path.join(renameDir, editedName),
        selected: true,
        reviewGroup: 'ready' as const,
      })),
    }
    const editedRenamed = executeOrganisationPlan({ plan: editedPlan, confirmed: true }, renameFolders)
    if (!editedRenamed.ok || editedRenamed.data.appliedCount !== 1) {
      throw new Error('user-edited rename should apply when the name is still safe')
    }
    const editedFile = path.join(renameDir, editedName)
    if (existsSync(messyFile) || !existsSync(editedFile)) {
      throw new Error('user-edited rename should change only the file name')
    }

    writeFileSync(messyFile, 'rename-me-again')
    const messyAgainSet = validateKnowledgeSet({ items: [{ path: messyFile, kind: 'file' }] })
    if (!messyAgainSet.ok) throw new Error('second rename knowledge set should pass')
    const renamePreviewAgain = previewOrganisationPlanForFolders(messyAgainSet.data, renameFolders)
    if (!renamePreviewAgain.ok || renamePreviewAgain.data.items[0]?.action !== 'rename') {
      throw new Error('second rename preview should pass')
    }

    const renameWithoutConfirm = executeOrganisationPlan(
      { plan: renamePreviewAgain.data, confirmed: false },
      renameFolders,
    )
    if (renameWithoutConfirm.ok) {
      throw new Error('rename without confirmation should fail')
    }
    if (!existsSync(messyFile)) {
      throw new Error('unconfirmed rename must not change the file')
    }

    const renamed = executeOrganisationPlan({ plan: renamePreviewAgain.data, confirmed: true }, renameFolders)
    if (!renamed.ok || renamed.data.appliedCount !== 1) {
      throw new Error('confirmed rename should apply one file')
    }
    if (existsSync(messyFile) || !existsSync(tidyFile)) {
      throw new Error('confirmed rename should change only the file name')
    }

    writeFileSync(messyFile, 'conflict-source')
    writeFileSync(tidyFile, 'already-named')
    const conflictSet = validateKnowledgeSet({ items: [{ path: messyFile, kind: 'file' }] })
    if (!conflictSet.ok) throw new Error('conflict rename knowledge set should pass')
    const conflictPreview = previewOrganisationPlanForFolders(conflictSet.data, [
      realFolder(destDir, ['Invoice_ACME_2024.pdf', messyName, tidyName]),
    ])
    if (
      !conflictPreview.ok ||
      conflictPreview.data.items[0]?.action !== 'rename' ||
      conflictPreview.data.items[0]?.reviewGroup !== 'skipped'
    ) {
      throw new Error('rename conflict should be previewed and skipped')
    }
    const conflicted = executeOrganisationPlan(
      { plan: conflictPreview.data, confirmed: true },
      [realFolder(destDir, ['Invoice_ACME_2024.pdf', messyName, tidyName])],
    )
    if (!conflicted.ok || conflicted.data.appliedCount !== 0 || !existsSync(messyFile) || !existsSync(tidyFile)) {
      throw new Error('rename conflict must never overwrite')
    }

    const reusableDir = path.join(root, 'Receipts')
    const reusableFile = path.join(reusableDir, 'Receipt_ACME.pdf')
    mkdirSync(reusableDir, { recursive: true })
    writeFileSync(reusableFile, 'receipt')
    const folderSet = validateKnowledgeSet({ items: [{ path: reusableDir, kind: 'folder' }] })
    if (!folderSet.ok) throw new Error('folder knowledge set should pass')
    const folderPreview = previewOrganisationPlanForFolders(folderSet.data, liveFolders)
    if (
      !folderPreview.ok ||
      folderPreview.data.knowledgeSet.items[0]?.kind !== 'folder' ||
      !folderPreview.data.items.some((item) => item.currentPath === reusableFile)
    ) {
      throw new Error('folder plans should expand to files without changing the saved source')
    }
    if (!existsSync(reusableFile)) {
      throw new Error('previewing a folder plan must not move files')
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
