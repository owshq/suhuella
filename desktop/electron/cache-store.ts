import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { storageLayout } from './storage-paths.ts'

export const CACHE_MANIFEST = 'manifest.json'
export const CACHE_MAX_BYTES = 500 * 1024 * 1024
export const CACHE_MAX_AGE_DAYS = 30

type CacheManifest = {
  lastCleanupAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function ensureCacheDir(userDataDir: string): string {
  const dir = storageLayout(userDataDir).cacheDir
  mkdirSync(dir, { recursive: true })
  return dir
}

export function cacheManifestPath(userDataDir: string): string {
  return path.join(ensureCacheDir(userDataDir), CACHE_MANIFEST)
}

export function loadCacheManifest(userDataDir: string): CacheManifest {
  const filePath = cacheManifestPath(userDataDir)
  if (!existsSync(filePath)) return { lastCleanupAt: null }
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
    if (!isRecord(parsed)) return { lastCleanupAt: null }
    return {
      lastCleanupAt: typeof parsed.lastCleanupAt === 'string' ? parsed.lastCleanupAt : null,
    }
  } catch {
    return { lastCleanupAt: null }
  }
}

function saveCacheManifest(userDataDir: string, manifest: CacheManifest): void {
  writeFileSync(cacheManifestPath(userDataDir), JSON.stringify(manifest, null, 2), 'utf8')
}

export function listCacheFiles(userDataDir: string): Array<{ filePath: string; size: number; lastUsed: number }> {
  const dir = ensureCacheDir(userDataDir)
  if (!existsSync(dir)) return []

  const files: Array<{ filePath: string; size: number; lastUsed: number }> = []
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(filePath)
        continue
      }
      if (entry.name === CACHE_MANIFEST) continue
      try {
        const stats = statSync(filePath)
        files.push({
          filePath,
          size: stats.size,
          lastUsed: stats.atimeMs || stats.mtimeMs,
        })
      } catch {
        // Skip files that disappear during walk.
      }
    }
  }
  walk(dir)
  return files
}

export function cacheSizeBytes(userDataDir: string): number {
  return listCacheFiles(userDataDir).reduce((sum, file) => sum + file.size, 0)
}

export function pruneCache(userDataDir: string, now = Date.now()): { deleted: number; lastCleanupAt: string } {
  const cutoff = now - CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const files = listCacheFiles(userDataDir)
  let remaining = [...files]
  let deleted = 0

  for (const file of files) {
    if (file.lastUsed < cutoff) {
      rmSync(file.filePath, { force: true })
      remaining = remaining.filter((item) => item.filePath !== file.filePath)
      deleted += 1
    }
  }

  remaining.sort((left, right) => left.lastUsed - right.lastUsed)
  let total = remaining.reduce((sum, file) => sum + file.size, 0)
  for (const file of remaining) {
    if (total <= CACHE_MAX_BYTES) break
    rmSync(file.filePath, { force: true })
    total -= file.size
    deleted += 1
  }

  const lastCleanupAt = new Date(now).toISOString()
  saveCacheManifest(userDataDir, { lastCleanupAt })
  return { deleted, lastCleanupAt }
}

export function clearCache(userDataDir: string): void {
  const dir = ensureCacheDir(userDataDir)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === CACHE_MANIFEST) continue
    rmSync(path.join(dir, entry.name), { recursive: true, force: true })
  }
  saveCacheManifest(userDataDir, { lastCleanupAt: new Date().toISOString() })
}
