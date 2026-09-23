/**
 * ELECTRON-SOURCE-ADAPTER-001
 *
 * Desktop path → Adapter → Registry → index-service probe.
 *
 * The settings store still persists the path. That is the provider token.
 * Access checks go through SourceHandle + handle-lifecycle-bridge.
 * Index walking still reads the path (provider token).
 *
 * Registry owns Handle lifetime. UI never calls handle.dispose().
 */

import { createElectronHandleAdapter } from '@suhuella/product/host/adapters/electron-handle-adapter.ts'
import { handleStatusToLifecycle } from '@suhuella/product/host/handle-lifecycle-bridge.ts'
import {
  createSourceHandleRegistry,
  type HandleStatus,
  type SourceHandle,
  type SourceHandleRegistry,
} from '@suhuella/product/host/source-handles.ts'
import type { IndexedLocationStatus } from '@suhuella/product/types.ts'
import { localSourceId } from './knowledge-sources.ts'
import {
  isExternalElectronPath,
  normalizeElectronPath,
  probeElectronPath,
  watchElectronPath,
} from './electron-path-access.ts'

let registry: SourceHandleRegistry = createSourceHandleRegistry()

function adapterFromPath(absolutePath: string): SourceHandle {
  const normalized = normalizeElectronPath(absolutePath)
  return createElectronHandleAdapter({
    probe: () => probeElectronPath(normalized),
    requestAccess: () => probeElectronPath(normalized) === 'available',
    watchPath: () => watchElectronPath(normalized),
  })
}

export function electronHandleRegistry(): SourceHandleRegistry {
  return registry
}

export function electronSourceIdForPath(absolutePath: string): string {
  return localSourceId(normalizeElectronPath(absolutePath))
}

export async function bindElectronPathHandle(absolutePath: string): Promise<SourceHandle> {
  const sourceId = electronSourceIdForPath(absolutePath)
  const adapter = adapterFromPath(absolutePath)
  if (registry.get(sourceId)) {
    return registry.replace(sourceId, adapter)
  }
  registry.bind(sourceId, adapter)
  return adapter
}

export function resolveElectronPathHandle(absolutePath: string): SourceHandle {
  const sourceId = electronSourceIdForPath(absolutePath)
  const bound = registry.get(sourceId)
  if (bound) return bound
  const adapter = adapterFromPath(absolutePath)
  registry.bind(sourceId, adapter)
  return adapter
}

export async function unbindElectronPathHandle(absolutePath: string): Promise<void> {
  await registry.unbind(electronSourceIdForPath(absolutePath))
}

export async function disposeElectronHandleRegistry(): Promise<void> {
  await registry.dispose()
  registry = createSourceHandleRegistry()
}

export async function refreshElectronPathHandle(absolutePath: string): Promise<HandleStatus> {
  const handle = resolveElectronPathHandle(absolutePath)
  const refreshed = await handle.refresh()
  return refreshed.status
}

/**
 * Host record words for the existing Desktop summary.
 * Translation to Lifecycle goes only through the bridge.
 * missing stays Unavailable so Desktop copy does not change.
 */
export function desktopLocationIssueFromHandleStatus(
  status: HandleStatus,
  absolutePath: string,
): Extract<IndexedLocationStatus, 'unavailable' | 'permission_denied' | 'external_drive_disconnected'> | null {
  const probe = handleStatusToLifecycle(status)
  if (probe.status === 'indexed' || probe.status === 'indexing') return null
  if (probe.status === 'permission_required') return 'permission_denied'
  if (probe.availabilityReason === 'disk_offline' || isExternalElectronPath(absolutePath)) {
    return 'external_drive_disconnected'
  }
  return 'unavailable'
}

export function inspectElectronLocation(
  absolutePath: string,
): Extract<IndexedLocationStatus, 'unavailable' | 'permission_denied' | 'external_drive_disconnected'> | null {
  resolveElectronPathHandle(absolutePath)
  return desktopLocationIssueFromHandleStatus(probeElectronPath(absolutePath), absolutePath)
}

export async function syncElectronHandles(paths: string[]): Promise<void> {
  const wanted = new Set(paths.map((item) => electronSourceIdForPath(item)))
  for (const path of paths) {
    resolveElectronPathHandle(path)
  }
  for (const binding of registry.list()) {
    if (!wanted.has(binding.sourceId)) {
      await registry.unbind(binding.sourceId)
    }
  }
}
