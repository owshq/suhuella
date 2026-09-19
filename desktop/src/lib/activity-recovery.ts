import { movedActivityItems } from './activity-copy'
import type { ActivityItem, ActivityRun } from '../types'

function undoableItems(run: ActivityRun) {
  return movedActivityItems(run).filter((item) => item.undoAvailable)
}

/** Matches `UNDO_MAX_AGE_DAYS` in electron/undo.ts — renderer-safe copy. */
export const UNDO_WINDOW_DAYS = 30

const EXPIRED_REASON =
  'Undo is only available for 30 days. History stays on your computer.' as const

export type RunRecoveryState =
  | 'undo_available'
  | 'partially_restored'
  | 'history_expired'
  | 'history_complete'

export function undoExpiresInDays(completedAt: string, now = Date.now()): number {
  const completed = Date.parse(completedAt)
  if (!Number.isFinite(completed)) return 0
  const elapsedDays = Math.floor((now - completed) / 86_400_000)
  const remaining = UNDO_WINDOW_DAYS - elapsedDays
  return remaining > 0 ? remaining : 0
}

export function isUndoExpiredReason(undoReason: string | undefined): boolean {
  return undoReason === EXPIRED_REASON
}

export function runRecoveryState(run: ActivityRun, undos: ActivityRun[]): RunRecoveryState {
  const undoable = undoableItems(run).length
  const moved = movedActivityItems(run).length

  if (undos.length > 0 && undoable === 0) return 'partially_restored'
  if (undoable > 0) return 'undo_available'

  const movedItems = movedActivityItems(run)
  if (
    movedItems.length > 0 &&
    movedItems.every((item) => !item.undoAvailable && isUndoExpiredReason(item.undoReason))
  ) {
    return 'history_expired'
  }

  if (moved > 0 && undoable === 0) return 'history_complete'
  return 'history_complete'
}

export function runRecoveryHeadline(state: RunRecoveryState): string {
  if (
    state === 'history_expired' ||
    state === 'history_complete' ||
    state === 'partially_restored'
  ) {
    return 'History'
  }
  return ''
}

export function runRecoveryDetail(state: RunRecoveryState): string {
  if (state === 'history_expired') return '✓ Completed · Undo period expired'
  if (state === 'partially_restored' || state === 'history_complete') return '✓ Completed'
  return ''
}

export function humanItemRecoveryNote(item: ActivityItem, runState: RunRecoveryState): string | null {
  if (item.status !== 'moved' || item.undoAvailable || !item.undoReason) return null
  if (runState === 'history_expired' && isUndoExpiredReason(item.undoReason)) return null

  const raw = item.undoReason
  if (raw.includes('original location is no longer available')) {
    return 'The original folder is no longer available.'
  }
  if (raw.includes('already exists at the original')) {
    return 'A file is already at the original location.'
  }
  if (raw.includes('no longer in the destination')) {
    return 'This file is no longer at the destination.'
  }
  if (raw.includes('cannot be safely undone')) {
    return 'This change is kept in your history.'
  }
  return null
}

export function expiresInLabel(days: number): string {
  if (days <= 0) return 'Undo period expired'
  if (days === 1) return 'Expires in 1 day'
  return `Expires in ${days} days`
}
