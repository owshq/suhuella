import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { storageLayout } from './storage-paths.ts'

export const LOGS_MAX_BYTES = 50 * 1024 * 1024
export const LOGS_MAX_AGE_DAYS = 30

export function ensureLogsDir(userDataDir: string): string {
  const dir = storageLayout(userDataDir).logsDir
  mkdirSync(dir, { recursive: true })
  return dir
}

export function listLogFiles(userDataDir: string): Array<{ filePath: string; size: number; lastUsed: number }> {
  const dir = ensureLogsDir(userDataDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name)
    if (!entry.isFile()) return []
    try {
      const stats = statSync(filePath)
      return [{ filePath, size: stats.size, lastUsed: stats.mtimeMs }]
    } catch {
      return []
    }
  })
}

export function logsSizeBytes(userDataDir: string): number {
  return listLogFiles(userDataDir).reduce((sum, file) => sum + file.size, 0)
}

export function pruneLogs(userDataDir: string, now = Date.now()): number {
  const cutoff = now - LOGS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const files = listLogFiles(userDataDir)
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
    if (total <= LOGS_MAX_BYTES) break
    rmSync(file.filePath, { force: true })
    total -= file.size
    deleted += 1
  }

  return deleted
}

export function clearLogs(userDataDir: string): void {
  const dir = ensureLogsDir(userDataDir)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    rmSync(path.join(dir, entry.name), { recursive: true, force: true })
  }
}
