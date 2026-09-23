/**
 * ELECTRON-SOURCE-ADAPTER-001 — Node path probe.
 *
 * Desktop-only. The product adapter never imports this file.
 * Handle.status() and inspectLocation share this classification.
 */

import { accessSync, constants, existsSync, statSync, watch, type FSWatcher } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { HandleStatus, SourceHandleWatch } from '@suhuella/product/host/source-handles.ts'

export function normalizeElectronPath(location: string): string {
  return path.normalize(location.trim())
}

export function isExternalElectronPath(location: string): boolean {
  const normalized = normalizeElectronPath(location).replace(/\\/g, '/')
  if (normalized.startsWith('/Volumes/')) return true
  if (normalized.startsWith('/media/') || normalized.startsWith('/mnt/')) return true
  if (normalized.startsWith('//')) return true
  if (process.platform === 'win32') {
    const drive = normalized.match(/^([A-Za-z]):/)?.[1]?.toUpperCase()
    const homeDrive = os.homedir().match(/^([A-Za-z]):/)?.[1]?.toUpperCase()
    return Boolean(drive && homeDrive && drive !== homeDrive)
  }
  return false
}

/** Same tokens the frozen Handle contract speaks. */
export function probeElectronPath(location: string): HandleStatus {
  const normalized = normalizeElectronPath(location)
  try {
    if (!existsSync(normalized)) {
      return isExternalElectronPath(normalized) ? 'offline' : 'notFound'
    }
    const stat = statSync(normalized)
    if (!stat.isDirectory()) return 'notFound'
    accessSync(normalized, constants.R_OK)
    return 'available'
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    if (code === 'EACCES' || code === 'EPERM') return 'permissionDenied'
    if (isExternalElectronPath(normalized)) return 'offline'
    return 'notFound'
  }
}

export function watchElectronPath(location: string): SourceHandleWatch | null {
  const normalized = normalizeElectronPath(location)
  let watcher: FSWatcher | null = null
  try {
    watcher = watch(normalized, { persistent: false })
  } catch {
    return null
  }
  return {
    stop() {
      watcher?.close()
      watcher = null
    },
  }
}
