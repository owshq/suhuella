import type {
  AppStorageMetrics,
  DeviceMetrics,
  DeviceStorageMetrics,
  PerformanceMetrics,
  StorageOverview,
} from '../types.ts'
import { emptyAppStorage } from './storage-overview.ts'

function appStorageMetrics(breakdown: StorageOverview['appStorage']): AppStorageMetrics {
  const totalBytes =
    breakdown.indexBytes +
    breakdown.activityBytes +
    breakdown.cacheBytes +
    breakdown.logsBytes +
    breakdown.workflowsBytes +
    breakdown.settingsBytes +
    breakdown.licenseBytes
  return { ...breakdown, totalBytes }
}

function performanceFromPartial(partial?: Partial<PerformanceMetrics>): PerformanceMetrics {
  const status =
    partial?.status ??
    (partial?.memoryBytes != null ||
    partial?.cpuPercent != null ||
    partial?.startupMs != null ||
    partial?.lastRecommendationMs != null ||
    partial?.lastPlanExecutionMs != null ||
    partial?.lastIndexingMs != null
      ? 'measured'
      : 'not_measured')
  return {
    memoryBytes: partial?.memoryBytes,
    cpuPercent: partial?.cpuPercent,
    startupMs: partial?.startupMs,
    lastRecommendationMs: partial?.lastRecommendationMs,
    lastPlanExecutionMs: partial?.lastPlanExecutionMs,
    lastIndexingMs: partial?.lastIndexingMs,
    lastPlanActions: partial?.lastPlanActions,
    status,
  }
}

export function assembleDeviceMetrics(input: {
  host: DeviceMetrics['host']
  platform: DeviceMetrics['platform']
  deviceName: string
  overview: StorageOverview
  deviceStorage?: DeviceStorageMetrics
  performance?: Partial<PerformanceMetrics>
  folderCount?: number
}): DeviceMetrics {
  const knowledgeBytes = input.overview.knowledgeTotalBytes ?? undefined
  return {
    host: input.host,
    platform: input.platform,
    deviceName: input.deviceName,
    measuredAt: input.overview.measuredAt ?? new Date().toISOString(),
    deviceStorage: input.deviceStorage,
    knowledgeStorage: {
      totalBytes: knowledgeBytes,
      documentCount: input.overview.knowledgeDocumentCount,
      folderCount: input.folderCount ?? 0,
      sourceCount: input.overview.sourceCount,
      status: input.overview.status,
    },
    appStorage: appStorageMetrics(input.overview.appStorage),
    performance: performanceFromPartial(input.performance),
    sources: input.overview.sources,
    warnings: input.overview.warnings,
  }
}

export function emptyDeviceMetrics(host: DeviceMetrics['host'] = 'desktop'): DeviceMetrics {
  return assembleDeviceMetrics({
    host,
    platform: host === 'web' ? 'web' : 'darwin',
    deviceName: 'This computer',
    overview: {
      knowledgeTotalBytes: null,
      knowledgeDocumentCount: 0,
      sourceCount: 0,
      localBytes: null,
      cloudBytes: null,
      appStorageTotalBytes: 0,
      sources: [],
      appStorage: emptyAppStorage(),
      measuredAt: null,
      status: 'empty',
      warnings: [],
    },
    deviceStorage: host === 'web' ? { status: 'unsupported' } : { status: 'unavailable' },
    performance: { status: 'not_measured' },
  })
}
