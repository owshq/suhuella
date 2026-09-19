import { productCopy } from './product-copy.ts'
import type {
  StorageOverview,
  StorageOverviewWarning,
  StorageSource,
  StorageSourceStatus,
} from '../types.ts'
import { formatLastUpdated } from './folders-ui.ts'
import { formatStorageSize } from './storage-format.ts'

export function storageSourceWarning(sources: StorageSource[]): StorageOverviewWarning | null {
  if (sources.some((source) => source.status === 'permission_required')) {
    return {
      code: 'permission_required',
      message: productCopy('SuHuella cannot measure this folder yet. Grant access or remove it from Sources.'),
    }
  }
  if (sources.some((source) => source.status === 'unavailable')) {
    return {
      code: 'unavailable',
      message: productCopy('This source is not available right now.'),
    }
  }
  if (sources.some((source) => source.status === 'failed' || source.status === 'skipped')) {
    return {
      code: 'failed',
      message: 'Some sources could not be measured.',
    }
  }
  return null
}

export function overviewWarningCopy(overview: StorageOverview | null, hasSources: boolean): string | null {
  if (!hasSources) {
    return productCopy('No sources yet. Add a folder so SuHuella can see it.')
  }
  if (!overview) {
    return productCopy('Storage details could not be refreshed. SuHuella can still organise your documents.')
  }
  if (overview.status === 'empty') {
    return productCopy('No sources yet. Add a folder so SuHuella can see it.')
  }
  if (overview.warnings[0]?.message) return overview.warnings[0].message
  return null
}

export function formatOverviewUpdated(iso: string | null): string {
  if (!iso) return 'Not yet'
  return formatLastUpdated(iso)
}

export function sourceStatusLabel(status: StorageSourceStatus): string | null {
  if (status === 'permission_required') return 'Needs access'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'measuring') return 'Measuring…'
  if (status === 'failed' || status === 'skipped') return 'Size unavailable'
  if (status === 'not_connected') return 'Not connected'
  if (status === 'unsupported') return 'Not available here'
  return null
}

export function sourceSizeLabel(source: Pick<StorageSource, 'status' | 'bytes'> | undefined): string {
  if (source?.status === 'measured' && source.bytes != null) return formatStorageSize(source.bytes)
  if (source?.status === 'permission_required') return 'Permission needed'
  if (source?.status === 'unsupported') return 'Not supported in this browser'
  if (source?.status === 'measuring') return 'Measuring…'
  if (source?.status === 'not_connected') return 'Not connected'
  return 'Size unavailable'
}

export function emptyAppStorage() {
  return {
    indexBytes: 0,
    activityBytes: 0,
    cacheBytes: 0,
    logsBytes: 0,
    workflowsBytes: 0,
    settingsBytes: 0,
    licenseBytes: 0,
  }
}
