import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type {
  ActivityFileIdentity,
  ActivityItem,
  ActivityRun,
  KnowledgeSetValidationError,
  KnowledgeSetValidationErrorCode,
  OrganisationExecutionResult,
  UndoExecutionResult,
} from '../src/types.ts'
import { activityItemFromPlanItem } from '../src/lib/activity-copy.ts'
import { isFolderCreateAction } from '../src/lib/plan-editor-copy.ts'
import {
  loadActivityRuns,
  nextActivityRunNumber,
  recordActivityRun,
} from './activity-store.ts'
import { assertConfirmationReceived } from './confirmed-executor.ts'
import { executeOrganisationPlan, previewOrganisationPlanForFolders } from './knowledge-set.ts'
import {
  buildInverseOrganisationPlan,
  filterInversePlan,
  inversePlanFromActivityRun,
  planFromExecutedItems,
} from './organisation-plan.ts'
import type { IndexedFolderEntry } from '../src/types.ts'

export const UNDO_MAX_AGE_DAYS = 30

export const UNDO_REASON = {
  originalUnavailable: 'Original location is no longer available',
  originalOccupied: 'A file already exists at the original location',
  fileMissing: 'The moved file is no longer in the destination',
  unsafe: 'This operation cannot be safely undone',
  expired: 'Undo is only available for 30 days. History stays on your computer.',
} as const

export function isWithinUndoWindow(completedAt: string, now = Date.now()): boolean {
  const completed = Date.parse(completedAt)
  if (!Number.isFinite(completed)) return false
  const cutoff = now - UNDO_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  return completed >= cutoff
}

export type UndoInspectResult = {
  available: boolean
  reason?: string
}

type OperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: KnowledgeSetValidationError }

function validationError(
  code: KnowledgeSetValidationErrorCode,
  message: string,
): OperationResult<never> {
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

function samePath(left: string, right: string): boolean {
  return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase()
}

function asSafeInteger(value: number | bigint): number | null {
  const numeric = typeof value === 'bigint' ? Number(value) : value
  return Number.isSafeInteger(numeric) ? numeric : null
}

export function captureMovedFileIdentity(filePath: string): ActivityFileIdentity | null {
  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) return null
    const inode = asSafeInteger(stat.ino)
    const device = asSafeInteger(stat.dev)
    if (inode === null || inode === 0 || device === null) return null
    return { device, inode, size: stat.size }
  } catch {
    return null
  }
}

function sameMovedFile(filePath: string, identity: ActivityFileIdentity): boolean {
  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) return false
    const inode = asSafeInteger(stat.ino)
    const device = asSafeInteger(stat.dev)
    return inode === identity.inode && device === identity.device && inode !== 0
  } catch {
    return false
  }
}

export function inspectActivityItemUndo(item: ActivityItem): UndoInspectResult {
  if (
    item.status !== 'moved' ||
    (item.action !== 'move' && !isFolderCreateAction(item.action) && item.action !== 'rename') ||
    !item.targetPath
  ) {
    return { available: false, reason: UNDO_REASON.unsafe }
  }

  if (!isSupportedLocalPath(item.sourcePath) || !isSupportedLocalPath(item.targetPath)) {
    return { available: false, reason: UNDO_REASON.unsafe }
  }

  const sameName =
    path.basename(item.sourcePath).toLowerCase() === path.basename(item.targetPath).toLowerCase()
  const sameDirectory = samePath(path.dirname(item.sourcePath), path.dirname(item.targetPath))
  if (item.action === 'rename') {
    if (sameName || !sameDirectory) {
      return { available: false, reason: UNDO_REASON.unsafe }
    }
  } else if (!sameName) {
    return { available: false, reason: UNDO_REASON.unsafe }
  }

  if (samePath(item.sourcePath, item.targetPath)) {
    return { available: false, reason: UNDO_REASON.unsafe }
  }

  if (!item.movedFile) {
    return { available: false, reason: UNDO_REASON.unsafe }
  }

  if (!existsSync(item.targetPath)) {
    return { available: false, reason: UNDO_REASON.fileMissing }
  }

  let targetStat
  try {
    targetStat = statSync(item.targetPath)
  } catch {
    return { available: false, reason: UNDO_REASON.fileMissing }
  }

  if (!targetStat.isFile() || !sameMovedFile(item.targetPath, item.movedFile)) {
    return { available: false, reason: UNDO_REASON.fileMissing }
  }

  if (existsSync(item.sourcePath)) {
    return { available: false, reason: UNDO_REASON.originalOccupied }
  }

  const originalDir = path.dirname(item.sourcePath)
  if (!existsSync(originalDir)) {
    return { available: false, reason: UNDO_REASON.originalUnavailable }
  }

  let originalDirStat
  try {
    originalDirStat = statSync(originalDir)
  } catch {
    return { available: false, reason: UNDO_REASON.originalUnavailable }
  }

  if (!originalDirStat.isDirectory()) {
    return { available: false, reason: UNDO_REASON.originalUnavailable }
  }

  const targetDevice = asSafeInteger(targetStat.dev)
  const originDevice = asSafeInteger(originalDirStat.dev)
  if (targetDevice === null || originDevice === null || targetDevice !== originDevice) {
    return { available: false, reason: UNDO_REASON.unsafe }
  }

  return { available: true }
}

export function attachMovedFileIdentity(item: ActivityItem): ActivityItem {
  if (item.status !== 'moved' || !item.targetPath || item.movedFile) return item
  const movedFile = captureMovedFileIdentity(item.targetPath)
  return movedFile ? { ...item, movedFile } : item
}

export function withUndoState(item: ActivityItem): ActivityItem {
  if (item.status !== 'moved') {
    return { ...item, undoAvailable: false }
  }

  const eligibility = inspectActivityItemUndo(item)
  return {
    ...item,
    undoAvailable: eligibility.available,
    ...(eligibility.available ? {} : { undoReason: eligibility.reason ?? UNDO_REASON.unsafe }),
  }
}

export function applyLiveUndoState(run: ActivityRun, now = Date.now()): ActivityRun {
  const undoWindowOpen = run.trigger === 'undo' || isWithinUndoWindow(run.completedAt, now)
  return {
    ...run,
    items: run.items.map((item) => {
      if (!undoWindowOpen && item.status === 'moved') {
        return {
          ...item,
          undoAvailable: false,
          undoReason: UNDO_REASON.expired,
        }
      }
      return withUndoState(item)
    }),
  }
}

export function listActivityWithUndoState(userDataDir: string): ActivityRun[] {
  return loadActivityRuns(userDataDir).map(applyLiveUndoState)
}

export function canUndoActivityRun(run: ActivityRun): boolean {
  const moved = run.items.filter((item) => item.status === 'moved')
  return moved.length > 0 && moved.every((item) => inspectActivityItemUndo(item).available)
}

export function executeUndo(
  input: unknown,
  userDataDir: string,
): OperationResult<UndoExecutionResult> {
  if (!input || typeof input !== 'object') {
    return validationError('invalid_request', 'Undo request is required.')
  }

  const record = input as Record<string, unknown>
  try {
    assertConfirmationReceived(record.confirmed)
  } catch {
    return validationError('confirmation_required', 'Confirm changes before undoing.')
  }

  const runId = typeof record.runId === 'string' ? record.runId.trim() : ''
  if (!runId) {
    return validationError('invalid_request', 'A run is required to undo.')
  }

  const runs = loadActivityRuns(userDataDir)
  const run = runs.find((item) => item.runId === runId)
  if (!run) {
    return validationError('invalid_request', 'That activity run was not found.')
  }

  if (run.trigger !== 'undo' && !isWithinUndoWindow(run.completedAt)) {
    return validationError('undo_unavailable', UNDO_REASON.expired)
  }

  const requestedPaths = Array.isArray(record.sourcePaths)
    ? record.sourcePaths.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    : null

  const moved = run.items.filter((item) => item.status === 'moved')
  const selected = requestedPaths
    ? moved.filter((item) => requestedPaths.some((value) => samePath(value, item.sourcePath)))
    : moved

  if (selected.length === 0) {
    return validationError('undo_unavailable', UNDO_REASON.unsafe)
  }

  if (!requestedPaths && !canUndoActivityRun(run)) {
    const blocked = selected.find((item) => !inspectActivityItemUndo(item).available)
    return validationError(
      'undo_unavailable',
      blocked ? (inspectActivityItemUndo(blocked).reason ?? UNDO_REASON.unsafe) : UNDO_REASON.unsafe,
    )
  }

  const blockedItem = selected.find((item) => !inspectActivityItemUndo(item).available)
  if (blockedItem) {
    return validationError(
      'undo_unavailable',
      inspectActivityItemUndo(blockedItem).reason ?? UNDO_REASON.unsafe,
    )
  }

  const startedAt = new Date().toISOString()
  const inversePlan = filterInversePlan(inversePlanFromActivityRun(run), requestedPaths)
  if (inversePlan.items.length === 0) {
    return validationError('undo_unavailable', UNDO_REASON.unsafe)
  }

  const runNumber = nextActivityRunNumber(loadActivityRuns(userDataDir))
  const executed = executeOrganisationPlan(
    { plan: inversePlan, confirmed: true, runNumber },
    [],
    { inverse: true },
  )
  if (!executed.ok) {
    return { ok: false, error: executed.error }
  }
  if (executed.data.appliedCount === 0) {
    return validationError(
      'undo_unavailable',
      executed.data.items[0]?.skipReason ?? executed.data.items[0]?.warnings.at(-1) ?? UNDO_REASON.unsafe,
    )
  }

  const plan = planFromExecutedItems(executed.data.items, executed.data.knowledgeSet)
  const undoRun = applyLiveUndoState({
    runId: executed.data.runId,
    runNumber: executed.data.runNumber,
    startedAt,
    completedAt: executed.data.completedAt,
    trigger: 'undo',
    reversesRunId: runId,
    plan,
    inversePlan: buildInverseOrganisationPlan(plan),
    summary: {
      moved: executed.data.appliedCount,
      skipped: executed.data.skippedCount,
      failed: executed.data.failedCount,
    },
    items: executed.data.items.map((item) => {
      const recorded = activityItemFromPlanItem(item)
      if (recorded.status === 'moved') {
        recorded.reason =
          recorded.action === 'rename' ? 'Restored original name' : 'Restored to original location'
      }
      return withUndoState(attachMovedFileIdentity(recorded))
    }),
  })

  recordActivityRun(userDataDir, undoRun)

  return {
    ok: true,
    data: {
      run: undoRun,
      runs: listActivityWithUndoState(userDataDir),
    },
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function realFolder(absolutePath: string, fileNames: string[]): IndexedFolderEntry {
  const folderName = path.basename(absolutePath)
  return {
    id: absolutePath,
    sourceId: 'src_undo_check',
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

function persistMovedRun(userDataDir: string, result: OrganisationExecutionResult): ActivityRun[] {
  const plan = planFromExecutedItems(result.items, result.knowledgeSet)
  return recordActivityRun(
    userDataDir,
    applyLiveUndoState({
      runId: result.runId,
      runNumber: result.runNumber,
      startedAt: result.completedAt,
      completedAt: result.completedAt,
      trigger: 'organise_documents',
      plan,
      inversePlan: buildInverseOrganisationPlan(plan),
      summary: {
        moved: result.appliedCount,
        skipped: result.skippedCount,
        failed: result.failedCount,
      },
      items: result.items.map((item) =>
        withUndoState(attachMovedFileIdentity(activityItemFromPlanItem(item))),
      ),
    }),
  )
}

function moveInvoiceFile(
  filePath: string,
  folders: IndexedFolderEntry[],
  runNumber: number,
) {
  const preview = previewOrganisationPlanForFolders(
    { items: [{ path: filePath, kind: 'file' }] },
    folders,
  )
  assert(preview.ok && preview.data.items[0]?.action === 'move', `invoice should be ready to move: ${filePath}`)
  return executeOrganisationPlan({ plan: preview.data, confirmed: true, runNumber }, folders)
}

export function runUndoChecks(): void {
  const root = mkdtempSync(path.join(tmpdir(), 'suhuella-undo-'))
  const userData = mkdtempSync(path.join(tmpdir(), 'suhuella-undo-data-'))
  try {
    const sourceDir = path.join(root, 'Downloads')
    const destDir = path.join(root, 'Clients', 'ACME', 'Invoices')
    mkdirSync(sourceDir, { recursive: true })
    mkdirSync(destDir, { recursive: true })
    writeFileSync(path.join(destDir, 'Invoice_ACME_2024.pdf'), 'old')
    const liveFolders = [realFolder(destDir, ['Invoice_ACME_2024.pdf'])]

    const sourceFile = path.join(sourceDir, 'Invoice_ACME_2026.pdf')
    const destFile = path.join(destDir, 'Invoice_ACME_2026.pdf')
    writeFileSync(sourceFile, 'invoice')

    const moved = moveInvoiceFile(sourceFile, liveFolders, 1)
    assert(moved.ok && moved.data.appliedCount === 1, 'confirmed move should apply')
    assert(!existsSync(sourceFile) && existsSync(destFile), 'file should be in the destination')

    const recorded = persistMovedRun(userData, moved.data)
    assert(recorded[0]?.plan?.items[0]?.action === 'move', 'activity stores the executed plan')
    assert(
      recorded[0]?.inversePlan?.items[0]?.proposedPath === sourceFile,
      'activity stores the inverse plan',
    )
    const live = listActivityWithUndoState(userData)
    assert(live[0]?.items[0]?.undoAvailable === true, 'safe local move should be undoable')
    assert(canUndoActivityRun(live[0]!), 'run undo should be available when every moved item is safe')

    const withoutConfirm = executeUndo({ runId: recorded[0]!.runId, confirmed: false }, userData)
    assert(!withoutConfirm.ok, 'undo without confirmation should fail')
    assert(!existsSync(sourceFile) && existsSync(destFile), 'unconfirmed undo must not move files')

    const undone = executeUndo({ runId: recorded[0]!.runId, confirmed: true }, userData)
    assert(undone.ok, 'confirmed undo should succeed')
    assert(existsSync(sourceFile) && !existsSync(destFile), 'file should return to the original path')
    assert(undone.ok && undone.data.runs.some((run) => run.runId === recorded[0]!.runId), 'original history stays')
    assert(undone.ok && undone.data.run.trigger === 'undo', 'undo records a new activity run')
    assert(undone.ok && undone.data.run.reversesRunId === recorded[0]!.runId, 'undo links to the source run')
    assert(undone.ok && undone.data.run.runNumber === 2, 'undo uses the next run number')
    assert(undone.ok && undone.data.run.plan?.items[0]?.action === 'move', 'undo stores the inverse plan')
    assert(
      undone.ok && undone.data.run.plan?.items[0]?.proposedPath === sourceFile,
      'undo plan restores the original path',
    )

    const originalAfter = undone.ok
      ? undone.data.runs.find((run) => run.runId === recorded[0]!.runId)
      : undefined
    assert(originalAfter?.items[0]?.undoAvailable === false, 'original run is no longer undoable')
    assert(
      originalAfter?.items[0]?.undoReason === UNDO_REASON.fileMissing,
      'original run explains why undo is gone',
    )

    writeFileSync(destFile, 'already-there')
    const overwritePreview = previewOrganisationPlanForFolders(
      { items: [{ path: sourceFile, kind: 'file' }] },
      liveFolders,
    )
    assert(
      overwritePreview.ok && overwritePreview.data.items[0]?.action !== 'move',
      'occupied destination must be skipped in the plan',
    )
    const overwrite = executeOrganisationPlan(
      { plan: overwritePreview.data, confirmed: true, runNumber: 3 },
      liveFolders,
    )
    assert(!overwrite.ok || overwrite.data.appliedCount === 0, 'occupied destination is never overwritten')
    assert(existsSync(sourceFile) && existsSync(destFile), 'overwrite protection still holds')

    rmSync(destFile)
    const secondMove = moveInvoiceFile(sourceFile, liveFolders, 3)
    assert(secondMove.ok && secondMove.data.appliedCount === 1, 'second confirmed move should apply')
    const secondRecorded = persistMovedRun(userData, secondMove.data)
    writeFileSync(sourceFile, 'blocker')
    const blockedOccupied = listActivityWithUndoState(userData).find(
      (run) => run.runId === secondRecorded[0]?.runId,
    )
    assert(blockedOccupied?.items[0]?.undoAvailable === false, 'occupied original is not undoable')
    assert(
      blockedOccupied?.items[0]?.undoReason === UNDO_REASON.originalOccupied,
      'occupied original shows the exact reason',
    )
    const refusedOccupied = executeUndo({ runId: secondRecorded[0]!.runId, confirmed: true }, userData)
    assert(!refusedOccupied.ok, 'undo must refuse when the original path is occupied')
    assert(existsSync(destFile), 'refused undo must not move or delete the destination')

    rmSync(sourceFile)
    const missingSource = path.join(sourceDir, 'Invoice_ACME_missing.pdf')
    const missingDest = path.join(destDir, 'Invoice_ACME_missing.pdf')
    writeFileSync(missingSource, 'invoice')
    const missingMove = moveInvoiceFile(missingSource, liveFolders, 4)
    assert(missingMove.ok && missingMove.data.appliedCount === 1, 'missing-file case should move first')
    const missingRecorded = persistMovedRun(userData, missingMove.data)
    rmSync(missingDest)
    const missingState = listActivityWithUndoState(userData).find(
      (run) => run.runId === missingRecorded[0]?.runId,
    )
    assert(missingState?.items[0]?.undoAvailable === false, 'missing destination file is not undoable')
    assert(
      missingState?.items[0]?.undoReason === UNDO_REASON.fileMissing,
      'missing destination shows the exact reason',
    )

    const replacedSource = path.join(sourceDir, 'Invoice_ACME_replaced.pdf')
    const replacedDest = path.join(destDir, 'Invoice_ACME_replaced.pdf')
    writeFileSync(replacedSource, 'original-bytes')
    const replacedMove = moveInvoiceFile(replacedSource, liveFolders, 5)
    assert(replacedMove.ok && replacedMove.data.appliedCount === 1, 'replaced-file case should move first')
    const replacedRecorded = persistMovedRun(userData, replacedMove.data)
    rmSync(replacedDest)
    writeFileSync(replacedDest, 'different-file')
    const replacedState = listActivityWithUndoState(userData).find(
      (run) => run.runId === replacedRecorded[0]?.runId,
    )
    assert(replacedState?.items[0]?.undoAvailable === false, 'a different file at the destination is not undoable')
    assert(
      replacedState?.items[0]?.undoReason === UNDO_REASON.fileMissing,
      'replaced destination shows the exact reason',
    )
    const refusedReplaced = executeUndo({ runId: replacedRecorded[0]!.runId, confirmed: true }, userData)
    assert(!refusedReplaced.ok, 'undo must refuse when the destination is a different file')
    assert(existsSync(replacedDest), 'refused undo must not delete the replacement')

    const goneDirSource = path.join(root, 'Inbox', 'Invoice_ACME_gone.pdf')
    mkdirSync(path.dirname(goneDirSource), { recursive: true })
    writeFileSync(goneDirSource, 'invoice')
    const goneMove = moveInvoiceFile(goneDirSource, liveFolders, 6)
    assert(goneMove.ok && goneMove.data.appliedCount === 1, 'gone-folder case should move first')
    const goneRecorded = persistMovedRun(userData, goneMove.data)
    rmSync(path.dirname(goneDirSource), { recursive: true, force: true })
    const goneState = listActivityWithUndoState(userData).find((run) => run.runId === goneRecorded[0]?.runId)
    assert(goneState?.items[0]?.undoAvailable === false, 'missing original folder is not undoable')
    assert(
      goneState?.items[0]?.undoReason === UNDO_REASON.originalUnavailable,
      'missing original folder shows the exact reason',
    )

    const messyName = 'Invoice ACME undo.pdf'
    const tidyName = 'Invoice_ACME_undo.pdf'
    const messyFile = path.join(destDir, messyName)
    const tidyFile = path.join(destDir, tidyName)
    writeFileSync(messyFile, 'rename-undo')
    const renameFolders = [realFolder(destDir, ['Invoice_ACME_2024.pdf', messyName])]
    const renamePreview = previewOrganisationPlanForFolders(
      { items: [{ path: messyFile, kind: 'file' }] },
      renameFolders,
    )
    assert(renamePreview.ok && renamePreview.data.items[0]?.action === 'rename', 'messy invoice should preview rename')

    const editedName = 'Invoice_ACME_undo_FINAL.pdf'
    const editedPlan = {
      knowledgeSet: renamePreview.data.knowledgeSet,
      items: renamePreview.data.items.map((item) => ({
        ...item,
        proposedPath: path.join(destDir, editedName),
        selected: true,
        reviewGroup: 'ready' as const,
      })),
    }
    const editedRenamed = executeOrganisationPlan(
      { plan: editedPlan, confirmed: true, runNumber: 7 },
      renameFolders,
    )
    const editedFile = path.join(destDir, editedName)
    assert(editedRenamed.ok && editedRenamed.data.appliedCount === 1, 'user-edited rename should apply')
    assert(!existsSync(messyFile) && existsSync(editedFile), 'user-edited rename should change the file name')
    const editedRecorded = persistMovedRun(userData, editedRenamed.data)
    const editedUndone = executeUndo({ runId: editedRecorded[0]!.runId, confirmed: true }, userData)
    assert(editedUndone.ok, 'user-edited rename undo should succeed')
    assert(existsSync(messyFile) && !existsSync(editedFile), 'user-edited rename undo should restore the original name')

    const renamed = executeOrganisationPlan(
      { plan: renamePreview.data, confirmed: true, runNumber: 8 },
      renameFolders,
    )
    assert(renamed.ok && renamed.data.appliedCount === 1, 'confirmed rename should apply')
    assert(!existsSync(messyFile) && existsSync(tidyFile), 'rename should change the file name')
    const renameRecorded = persistMovedRun(userData, renamed.data)
    assert(renameRecorded[0]?.items[0]?.undoAvailable === true, 'safe rename should be undoable')
    assert(renameRecorded[0]?.inversePlan?.items[0]?.action === 'rename', 'inverse plan is a rename back')

    const renameWithoutConfirm = executeUndo({ runId: renameRecorded[0]!.runId, confirmed: false }, userData)
    assert(!renameWithoutConfirm.ok, 'rename undo without confirmation should fail')
    assert(!existsSync(messyFile) && existsSync(tidyFile), 'unconfirmed rename undo must not change files')

    const renameUndone = executeUndo({ runId: renameRecorded[0]!.runId, confirmed: true }, userData)
    assert(renameUndone.ok, 'confirmed rename undo should succeed')
    assert(existsSync(messyFile) && !existsSync(tidyFile), 'rename undo should restore the original name')
    assert(
      renameUndone.ok && renameUndone.data.run.items[0]?.reason === 'Restored original name',
      'rename undo explains the inverse',
    )

    writeFileSync(messyFile, 'rename-undo-again')
    const secondRenamePreview = previewOrganisationPlanForFolders(
      { items: [{ path: messyFile, kind: 'file' }] },
      renameFolders,
    )
    assert(secondRenamePreview.ok, 'second messy invoice should preview rename')
    const secondRename = executeOrganisationPlan(
      { plan: secondRenamePreview.data, confirmed: true, runNumber: 9 },
      renameFolders,
    )
    assert(secondRename.ok && secondRename.data.appliedCount === 1, 'second rename should apply')
    const secondRenameRecorded = persistMovedRun(userData, secondRename.data)
    writeFileSync(messyFile, 'blocker')
    const blockedRename = listActivityWithUndoState(userData).find(
      (run) => run.runId === secondRenameRecorded[0]?.runId,
    )
    assert(blockedRename?.items[0]?.undoAvailable === false, 'occupied original name is not undoable')
    const refusedRename = executeUndo({ runId: secondRenameRecorded[0]!.runId, confirmed: true }, userData)
    assert(!refusedRename.ok, 'rename undo must refuse when the original name is occupied')
    assert(existsSync(tidyFile), 'refused rename undo must not change the renamed file')

    const structureDest = path.join(root, 'Clients', 'Structure', 'Invoices')
    const structureSource = path.join(sourceDir, 'Invoice_ACME_structure.pdf')
    writeFileSync(structureSource, 'invoice')
    const structurePreview = previewOrganisationPlanForFolders(
      { items: [{ path: structureSource, kind: 'file' }] },
      [realFolder(structureDest, ['Invoice_ACME_2024.pdf'])],
    )
    assert(
      structurePreview.ok && structurePreview.data.items[0]?.action === 'create_structure',
      'nested missing destination should preview create_structure',
    )
    const structureMove = executeOrganisationPlan(
      { plan: structurePreview.data, confirmed: true, runNumber: 9 },
      [realFolder(structureDest, ['Invoice_ACME_2024.pdf'])],
    )
    const structureFile = path.join(structureDest, 'Invoice_ACME_structure.pdf')
    assert(structureMove.ok && existsSync(structureFile), 'create_structure should move the file')
    const structureRecorded = persistMovedRun(userData, structureMove.data)
    assert(
      (structureRecorded[0]?.items[0]?.createdFolders?.length ?? 0) >= 2,
      'activity should remember created folders',
    )
    const structureUndone = executeUndo({ runId: structureRecorded[0]!.runId, confirmed: true }, userData)
    assert(structureUndone.ok, 'create_structure undo should restore the file')
    assert(existsSync(structureSource) && !existsSync(structureFile), 'file returns after structure undo')
    assert(!existsSync(structureDest), 'empty created folders are deleted on undo')
    assert(!existsSync(path.dirname(structureDest)), 'empty parent created folders are deleted on undo')

    const keptDest = path.join(root, 'Clients', 'Kept')
    const keptSource = path.join(sourceDir, 'Invoice_ACME_kept.pdf')
    writeFileSync(keptSource, 'invoice')
    const keptPreview = previewOrganisationPlanForFolders(
      { items: [{ path: keptSource, kind: 'file' }] },
      [realFolder(keptDest, ['Invoice_ACME_2024.pdf'])],
    )
    assert(keptPreview.ok && keptPreview.data.items[0]?.action === 'create_folder', 'one missing folder is create_folder')
    const keptMove = executeOrganisationPlan(
      { plan: keptPreview.data, confirmed: true, runNumber: 10 },
      [realFolder(keptDest, ['Invoice_ACME_2024.pdf'])],
    )
    const keptFile = path.join(keptDest, 'Invoice_ACME_kept.pdf')
    assert(keptMove.ok && existsSync(keptFile), 'create_folder should move the file')
    writeFileSync(path.join(keptDest, 'notes.txt'), 'keep-me')
    const keptRecorded = persistMovedRun(userData, keptMove.data)
    const keptUndone = executeUndo({ runId: keptRecorded[0]!.runId, confirmed: true }, userData)
    assert(keptUndone.ok, 'create_folder undo should restore the file even if the folder is not empty')
    assert(existsSync(keptSource) && !existsSync(keptFile), 'file returns after create_folder undo')
    assert(existsSync(keptDest), 'non-empty created folders are never deleted')
    assert(existsSync(path.join(keptDest, 'notes.txt')), 'other files in the created folder stay')
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
