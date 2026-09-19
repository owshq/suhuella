import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AppStorageBreakdown, StorageUsage } from '../src/types.ts'
import { ACTIVITY_MAX_AGE_DAYS, ACTIVITY_MAX_RUNS, clearActivityRuns, loadActivityRuns } from './activity-store.ts'
import { cacheSizeBytes, clearCache, loadCacheManifest, pruneCache } from './cache-store.ts'
import { clearLogs, logsSizeBytes, pruneLogs } from './log-store.ts'
import { storageLayout } from './storage-paths.ts'

export function ensureStorageLayout(userDataDir: string): void {
  const layout = storageLayout(userDataDir)
  mkdirSync(layout.cacheDir, { recursive: true })
  mkdirSync(layout.logsDir, { recursive: true })
  mkdirSync(layout.diagnosticsDir, { recursive: true })
}

function fileSize(filePath: string): number {
  if (!existsSync(filePath)) return 0
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

export function getAppStorageBreakdown(userDataDir: string): AppStorageBreakdown {
  ensureStorageLayout(userDataDir)
  const layout = storageLayout(userDataDir)
  return {
    indexBytes: fileSize(layout.index),
    activityBytes: fileSize(layout.activity),
    cacheBytes: cacheSizeBytes(userDataDir),
    logsBytes: logsSizeBytes(userDataDir),
    workflowsBytes: fileSize(layout.workflows),
    settingsBytes: fileSize(layout.settings),
    licenseBytes: fileSize(layout.license) + fileSize(layout.device),
  }
}

export function getStorageUsage(userDataDir: string): StorageUsage {
  const breakdown = getAppStorageBreakdown(userDataDir)
  return {
    ...breakdown,
    lastCleanupAt: loadCacheManifest(userDataDir).lastCleanupAt,
  }
}

export function runAutomaticCleanup(userDataDir: string, now = Date.now()): StorageUsage {
  ensureStorageLayout(userDataDir)
  pruneCache(userDataDir, now)
  pruneLogs(userDataDir, now)
  return getStorageUsage(userDataDir)
}

export function clearManagedCache(userDataDir: string): StorageUsage {
  ensureStorageLayout(userDataDir)
  clearCache(userDataDir)
  return getStorageUsage(userDataDir)
}

export function clearManagedLogs(userDataDir: string): StorageUsage {
  ensureStorageLayout(userDataDir)
  clearLogs(userDataDir)
  return getStorageUsage(userDataDir)
}

export function clearManagedActivity(userDataDir: string): StorageUsage {
  ensureStorageLayout(userDataDir)
  clearActivityRuns(userDataDir)
  return getStorageUsage(userDataDir)
}

export function exportActivityJson(userDataDir: string, destinationPath: string): string {
  const runs = loadActivityRuns(userDataDir)
  writeFileSync(
    destinationPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        retention: { maxRuns: ACTIVITY_MAX_RUNS, maxAgeDays: ACTIVITY_MAX_AGE_DAYS },
        runs,
      },
      null,
      2,
    ),
    'utf8',
  )
  return destinationPath
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function runStorageChecks(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'suhuella-storage-'))
  try {
    ensureStorageLayout(root)
    const layout = storageLayout(root)
    assert(existsSync(layout.cacheDir), 'cache directory is created')
    assert(existsSync(layout.logsDir), 'logs directory is created')
    assert(existsSync(layout.diagnosticsDir), 'diagnostics directory is created')

    writeFileSync(path.join(layout.cacheDir, 'stale.bin'), 'temp')
    const before = getStorageUsage(root)
    assert(before.cacheBytes > 0, 'cache size includes temporary files')
    assert(before.activityBytes === 0, 'clearing cache does not invent activity')

    const afterCache = clearManagedCache(root)
    assert(afterCache.cacheBytes === 0, 'clear cache removes only cache')
    assert(!existsSync(layout.index), 'clear cache does not create an index')

    writeFileSync(path.join(layout.logsDir, 'old.log'), 'log')
    assert(clearManagedLogs(root).logsBytes === 0, 'clear logs removes only logs')
    assert(loadActivityRuns(root).length === 0, 'storage actions do not create activity')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}
