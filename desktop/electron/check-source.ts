import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Repo root when checks run from `desktop/` or from the monorepo root. */
export function repoRoot(): string {
  const cwd = process.cwd()
  if (existsSync(path.join(cwd, 'desktop/electron/main.ts'))) return cwd
  if (existsSync(path.join(cwd, 'electron/main.ts'))) return path.resolve(cwd, '..')
  return cwd
}

export function desktopDir(): string {
  return path.join(repoRoot(), 'desktop')
}

export function productDir(): string {
  return path.join(repoRoot(), 'packages/product')
}

function firstExisting(candidates: string[]): string {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`missing source file — tried:\n${candidates.join('\n')}`)
}

export function readDesktopSource(relativePath: string): string {
  return readFileSync(firstExisting([path.join(desktopDir(), relativePath)]), 'utf8')
}

export function readProductSource(relativePath: string): string {
  return readFileSync(
    firstExisting([
      path.join(productDir(), relativePath),
      path.join(desktopDir(), relativePath),
      path.join(process.cwd(), relativePath),
    ]),
    'utf8',
  )
}
