import { statfsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { DeviceMetrics, DeviceStorageMetrics } from '@suhuella/product/types.ts'
import { assembleDeviceMetrics, emptyDeviceMetrics } from '@suhuella/product/lib/device-metrics-view.ts'
import { getOsComputerName } from './device-identity.ts'
import { assembleStorageOverview } from './document-storage.ts'
import { emptyAppStorage } from '@suhuella/product/lib/storage-overview.ts'

let startupMs: number | null = null
let lastRecommendationMs: number | null = null
let lastCpuSample: NodeJS.CpuUsage | null = null
let lastCpuAt = 0

export function recordStartupDuration(ms: number): void {
  if (ms >= 0) startupMs = Math.round(ms)
}

export function recordRecommendationDuration(ms: number): void {
  if (ms >= 0) lastRecommendationMs = Math.round(ms)
}

function toNumber(value: number | bigint): number {
  if (typeof value === 'bigint') return Number(value)
  return value
}

export function measureDeviceDisk(targetPath: string): DeviceStorageMetrics {
  try {
    const stats = statfsSync(targetPath)
    const blockSize = toNumber(stats.bsize)
    const totalBytes = toNumber(stats.blocks) * blockSize
    const freeBytes = toNumber(stats.bavail) * blockSize
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      return { status: 'unavailable' }
    }
    return {
      totalBytes,
      freeBytes: Number.isFinite(freeBytes) ? Math.max(0, freeBytes) : 0,
      usedBytes: Number.isFinite(freeBytes) ? Math.max(0, totalBytes - freeBytes) : undefined,
      volumeName: path.parse(path.resolve(targetPath)).root || undefined,
      status: 'measured',
    }
  } catch {
    return { status: 'unavailable' }
  }
}

export function sampleAppMemoryBytes(): number | null {
  try {
    const rss = process.memoryUsage().rss
    return Number.isFinite(rss) && rss > 0 ? rss : null
  } catch {
    return null
  }
}

export function sampleAppCpuPercent(): number | null {
  try {
    const now = Date.now()
    if (!lastCpuSample) {
      lastCpuSample = process.cpuUsage()
      lastCpuAt = now
      return null
    }
    const delta = process.cpuUsage(lastCpuSample)
    const elapsedMs = now - lastCpuAt
    lastCpuSample = process.cpuUsage()
    lastCpuAt = now
    if (elapsedMs <= 0) return null
    const percent = ((delta.user + delta.system) / 1000 / elapsedMs) * 100
    if (!Number.isFinite(percent) || percent < 0) return null
    return Math.round(Math.min(percent, 100) * 10) / 10
  } catch {
    return null
  }
}

function lastIndexingMs(): number | null {
  try {
    const { getScanProgress } = require('./index-service.ts') as typeof import('./index-service.ts')
    const scan = getScanProgress()
    if (!scan.startedAt || !scan.finishedAt) return null
    const started = Date.parse(scan.startedAt)
    const finished = Date.parse(scan.finishedAt)
    if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) return null
    return finished - started
  } catch {
    return null
  }
}

export { assembleDeviceMetrics, emptyDeviceMetrics }

export function getDesktopDeviceMetrics(): DeviceMetrics {
  try {
    const { app } = require('electron') as typeof import('electron')
    const { getStorageOverview } = require('./document-storage.ts') as typeof import('./document-storage.ts')
    const { loadSettings } = require('./settings-store.ts') as typeof import('./settings-store.ts')
    const { loadActivityRuns } = require('./activity-store.ts') as typeof import('./activity-store.ts')
    const overview = getStorageOverview()
    const settings = loadSettings()
    const home = os.homedir()
    const diskTarget = settings.indexedLocations[0] || home || '/'
    const plan = lastPlanTimingFrom(loadActivityRuns, app.getPath('userData'))
    return assembleDeviceMetrics({
      host: 'desktop',
      platform: process.platform as DeviceMetrics['platform'],
      deviceName: getOsComputerName(),
      overview,
      deviceStorage: measureDeviceDisk(diskTarget),
      performance: {
        memoryBytes: sampleAppMemoryBytes() ?? undefined,
        cpuPercent: sampleAppCpuPercent() ?? undefined,
        startupMs: startupMs ?? undefined,
        lastRecommendationMs: lastRecommendationMs ?? undefined,
        lastPlanExecutionMs: plan?.ms,
        lastPlanActions: plan?.actions,
        lastIndexingMs: lastIndexingMs() ?? undefined,
      },
      folderCount: settings.indexedFolderCount,
    })
  } catch {
    return emptyDeviceMetrics('desktop')
  }
}

function lastPlanTimingFrom(
  loadRuns: typeof import('./activity-store.ts').loadActivityRuns,
  userDataDir: string,
): { ms: number; actions: number } | null {
  try {
    const runs = loadRuns(userDataDir).filter((run) => run.trigger !== 'undo')
    const latest = runs[0]
    if (!latest) return null
    const started = Date.parse(latest.startedAt)
    const completed = Date.parse(latest.completedAt)
    if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) return null
    return {
      ms: completed - started,
      actions: latest.summary.moved + latest.summary.skipped + latest.summary.failed,
    }
  } catch {
    return null
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function runDeviceMetricsChecks(): void {
  const now = '2026-09-18T18:20:00.000Z'
  const overview = assembleStorageOverview(
    [
      {
        id: 'downloads',
        name: 'Downloads',
        kind: 'local_folder',
        locator: '/Users/demo/Downloads',
        bytes: 18.4 * 1024 ** 3,
        documentCount: 2341,
        status: 'measured',
        lastMeasuredAt: now,
      },
      {
        id: 'documents',
        name: 'Documents',
        kind: 'local_folder',
        locator: '/Users/demo/Documents',
        status: 'unavailable',
        lastMeasuredAt: now,
      },
    ],
    {
      indexBytes: 38 * 1024 * 1024,
      activityBytes: 4 * 1024 * 1024,
      cacheBytes: 124 * 1024 * 1024,
      logsBytes: 2 * 1024 * 1024,
      workflowsBytes: 12 * 1024,
      settingsBytes: 4 * 1024,
      licenseBytes: 2 * 1024,
    },
    { measuredAt: now, documentCount: 42381 },
  )

  const metrics = assembleDeviceMetrics({
    host: 'desktop',
    platform: 'darwin',
    deviceName: 'MacBook Pro',
    overview,
    deviceStorage: {
      totalBytes: 512 * 1024 ** 3,
      freeBytes: 218 * 1024 ** 3,
      usedBytes: 294 * 1024 ** 3,
      volumeName: '/',
      status: 'measured',
    },
    performance: {
      memoryBytes: 48 * 1024 * 1024,
      cpuPercent: 0.1,
      lastPlanExecutionMs: 2100,
      lastPlanActions: 18,
      lastIndexingMs: 134_000,
    },
    folderCount: 86,
  })

  assert(metrics.deviceStorage?.status === 'measured', 'device disk is a separate measurement')
  assert(metrics.knowledgeStorage.sourceCount === 2, 'knowledge counts sources independently')
  assert(metrics.knowledgeStorage.totalBytes === 18.4 * 1024 ** 3, 'unmeasured sources do not become 0 B')
  assert(metrics.appStorage.totalBytes > 0, 'app storage totals only SuHuella files')
  assert(metrics.performance.lastPlanExecutionMs === 2100, 'plan time is performance, not storage')
  assert(metrics.warnings[0]?.code === 'unavailable', 'failed source stays a warning')

  const web = assembleDeviceMetrics({
    host: 'web',
    platform: 'web',
    deviceName: 'This Mac',
    overview: assembleStorageOverview([], emptyAppStorage()),
    deviceStorage: { status: 'unsupported' },
  })
  assert(web.deviceStorage?.status === 'unsupported', 'web does not invent full-disk numbers')
  assert(web.deviceStorage?.totalBytes == null, 'unsupported disk has no fake total')
  assert(web.knowledgeStorage.status === 'empty', 'empty knowledge is not a failure')

  const missingDisk = measureDeviceDisk(path.join(path.sep, 'suhuella-missing-volume'))
  assert(missingDisk.status === 'unavailable', 'disk failures are unavailable, not fatal')
  assert(missingDisk.totalBytes == null, 'unmeasured disk does not report 0 B')
}
