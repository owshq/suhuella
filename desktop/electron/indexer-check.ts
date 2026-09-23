import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildFolderIndex, INDEX_YIELD_EVERY_FILES, locationNeedsScan } from './indexer.ts'
import type { FolderIndex, IndexScanProgress } from '@suhuella/product/types.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function writeTree(root: string, files: string[]): void {
  for (const relative of files) {
    const filePath = path.join(root, relative)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, relative)
  }
}

function folderNames(index: FolderIndex, root: string): string[] {
  return index.folders
    .filter((folder) => folder.absolutePath.toLowerCase().startsWith(path.normalize(root).toLowerCase()))
    .flatMap((folder) => folder.fileNames)
}

export async function runIndexerChecks(): Promise<void> {
  const empty: FolderIndex = {
    version: 2,
    indexVersion: 2,
    generatedAt: null,
    indexedAt: null,
    locations: [],
    sources: [],
    folders: [],
    files: [],
  }

  assert(locationNeedsScan('/docs', undefined, 'pending'), 'missing previous index must scan')
  assert(locationNeedsScan('/docs', empty, 'all'), 'full refresh must scan even an empty previous index')
  assert(locationNeedsScan('/docs', empty, 'pending'), 'empty previous index must scan')

  const workspace = mkdtempSync(path.join(os.tmpdir(), 'suhuella-indexer-'))
  const first = path.join(workspace, 'Clients')
  const second = path.join(workspace, 'Invoices')

  try {
    writeTree(first, ['Acme/keep-me.txt', 'Acme/notes.md'])
    writeTree(second, ['2026/new-invoice.pdf'])

    const firstIndex = await buildFolderIndex([first], {
      cancelled: () => false,
      onProgress: () => undefined,
      refresh: 'all',
    })
    const firstSource = firstIndex.sources.find((source) => source.rootLocator === path.normalize(first))
    assert(firstSource?.lastIndexed, 'first scan records lastIndexed')
    assert(
      folderNames(firstIndex, first).includes('keep-me.txt'),
      'first scan learns files from the added folder',
    )

    const remembered: FolderIndex = {
      ...firstIndex,
      sources: firstIndex.sources.map((source) =>
        source.rootLocator === path.normalize(first)
          ? { ...source, lastIndexed: '2026-01-01T00:00:00.000Z' }
          : source,
      ),
    }

    assert(
      !locationNeedsScan(first, remembered, 'pending'),
      'a successfully learned location is reused on pending refresh',
    )
    assert(
      locationNeedsScan(second, remembered, 'pending'),
      'a new location still needs a scan',
    )
    assert(
      locationNeedsScan(first, remembered, 'all'),
      'Learn again still walks already-learned locations',
    )
    assert(
      locationNeedsScan(first, {
        ...remembered,
        sources: remembered.sources.map((source) => ({ ...source, status: 'error' as const })),
      }, 'pending'),
      'a failed location is scanned again',
    )

    rmSync(path.join(first, 'Acme', 'keep-me.txt'))

    const pending = await buildFolderIndex([first, second], {
      cancelled: () => false,
      onProgress: () => undefined,
      previous: remembered,
      refresh: 'pending',
    })

    const reused = pending.sources.find((source) => source.rootLocator === path.normalize(first))
    const added = pending.sources.find((source) => source.rootLocator === path.normalize(second))
    assert(reused?.lastIndexed === '2026-01-01T00:00:00.000Z', 'pending refresh keeps the previous lastIndexed')
    assert(added?.lastIndexed && added.lastIndexed !== reused?.lastIndexed, 'the new location gets a fresh lastIndexed')
    assert(
      folderNames(pending, first).includes('keep-me.txt'),
      'pending refresh keeps already-learned files instead of walking the large folder again',
    )
    assert(
      folderNames(pending, second).includes('new-invoice.pdf'),
      'pending refresh learns the newly added folder',
    )

    const removed = await buildFolderIndex([second], {
      cancelled: () => false,
      onProgress: () => undefined,
      previous: pending,
      refresh: 'pending',
    })
    assert(
      removed.locations.length === 1 && removed.locations[0] === path.normalize(second),
      'removing a location drops it without walking the remaining folder',
    )
    assert(
      !folderNames(removed, first).includes('keep-me.txt') &&
        folderNames(removed, second).includes('new-invoice.pdf'),
      'the remaining location is reused after a removal',
    )

    const rebuilt = await buildFolderIndex([first, second], {
      cancelled: () => false,
      onProgress: () => undefined,
      previous: remembered,
      refresh: 'all',
    })
    assert(
      !folderNames(rebuilt, first).includes('keep-me.txt'),
      'Learn again walks the folder again and drops files that are gone',
    )
    assert(
      folderNames(rebuilt, second).includes('new-invoice.pdf'),
      'Learn again still learns every current location',
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }

  const large = mkdtempSync(path.join(os.tmpdir(), 'suhuella-indexer-large-'))
  try {
    const fileCount = INDEX_YIELD_EVERY_FILES * 2
    writeTree(
      large,
      Array.from({ length: fileCount }, (_, index) => `doc-${String(index + 1).padStart(3, '0')}.txt`),
    )

    const progress: Array<Partial<IndexScanProgress>> = []
    await buildFolderIndex([large], {
      cancelled: () => false,
      onProgress: (partial) => {
        progress.push(partial)
      },
      refresh: 'all',
    })

    const midFolder = progress.find(
      (item) => (item.filesSeen ?? 0) >= INDEX_YIELD_EVERY_FILES && (item.foldersScanned ?? 0) === 0,
    )
    assert(midFolder, 'a large flat folder emits progress before the folder walk finishes')
    assert(midFolder.currentPath, 'mid-folder progress names the file being seen')

    let cancelAfterProgress = false
    let sawCancelWindow = false
    const cancelled = await buildFolderIndex([large], {
      cancelled: () => cancelAfterProgress,
      onProgress: (partial) => {
        if ((partial.filesSeen ?? 0) >= INDEX_YIELD_EVERY_FILES && (partial.foldersScanned ?? 0) === 0) {
          sawCancelWindow = true
          cancelAfterProgress = true
        }
      },
      refresh: 'all',
    })
    assert(sawCancelWindow, 'cancel can be requested during a large folder yield')
    assert(
      cancelled.folders.length === 0,
      'cancel during a large folder stops before the folder is committed',
    )
    assert(cancelled.indexedAt === null, 'a cancelled large-folder scan does not mark the index complete')
  } finally {
    rmSync(large, { recursive: true, force: true })
  }
}

const invokedDirectly = process.argv[1]?.includes('indexer-check')
if (invokedDirectly) {
  void runIndexerChecks()
    .then(() => {
      console.log('indexer checks passed')
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
