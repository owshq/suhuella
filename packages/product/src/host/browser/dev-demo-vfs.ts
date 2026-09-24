import type { TransferEffect } from './organise-integrity.ts'
import { isSafeRelativePath } from './organise-integrity.ts'
import {
  DEV_DEMO_DISPLAY_NAME,
  DEV_DEMO_FILES,
  DEV_DEMO_SOURCE_ID,
  demoFileDescriptors,
  isBrowserDevHost,
} from './dev-host.ts'
import type { IndexedFolderEntry, WebIndexedFile } from './types.ts'

export const DEV_DEMO_VFS_HANDLE = { kind: 'dev-demo-vfs' as const }

type VfsEntry = {
  relativePath: string
  name: string
  size: number
}

let entries: VfsEntry[] = DEV_DEMO_FILES.map((file) => ({
  relativePath: file.relativePath,
  name: file.name,
  size: file.size,
}))

export function resetDevDemoVfs(): void {
  entries = DEV_DEMO_FILES.map((file) => ({
    relativePath: file.relativePath,
    name: file.name,
    size: file.size,
  }))
}

export function devDemoVfsEnabled(): boolean {
  return isBrowserDevHost()
}

export function isDevDemoVfsHandle(handle: unknown): handle is typeof DEV_DEMO_VFS_HANDLE {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'kind' in handle &&
    (handle as { kind?: string }).kind === 'dev-demo-vfs'
  )
}

function dirname(relativePath: string): string {
  const index = relativePath.lastIndexOf('/')
  return index === -1 ? '' : relativePath.slice(0, index)
}

function basename(relativePath: string): string {
  return relativePath.split('/').at(-1) ?? relativePath
}

export function devDemoVfsFiles(): WebIndexedFile[] {
  return entries.map((entry) => ({
    id: `${DEV_DEMO_SOURCE_ID}:${entry.relativePath}`,
    sourceId: DEV_DEMO_SOURCE_ID,
    name: entry.name,
    relativePath: entry.relativePath,
    parentRelative: dirname(entry.relativePath),
    size: entry.size,
    lastModified: null,
  }))
}

export function devDemoVfsHasPath(relativePath: string): boolean {
  return entries.some((entry) => entry.relativePath === relativePath)
}

export async function transferDevDemoFile(
  fromRelative: string,
  toRelative: string,
  allowCreateFolders: boolean,
): Promise<TransferEffect> {
  if (!isSafeRelativePath(fromRelative) || !isSafeRelativePath(toRelative)) {
    return { outcome: 'failed', reason: 'Invalid file path.', createdFolders: [] }
  }
  const sourceIndex = entries.findIndex((entry) => entry.relativePath === fromRelative)
  if (sourceIndex === -1) {
    return { outcome: 'failed', reason: 'Source file is missing.', createdFolders: [] }
  }
  if (entries.some((entry) => entry.relativePath === toRelative)) {
    return { outcome: 'skipped', reason: 'Destination already exists.', createdFolders: [] }
  }
  const destDir = dirname(toRelative)
  if (destDir && !allowCreateFolders) {
    const folderExists = entries.some((entry) => dirname(entry.relativePath) === destDir || entry.relativePath.startsWith(`${destDir}/`))
    if (!folderExists && !DEV_DEMO_FILES.some((file) => file.relativePath.startsWith(`${destDir}/`))) {
      return { outcome: 'skipped', reason: 'Destination folder is missing.', createdFolders: [] }
    }
  }
  const name = basename(toRelative)
  entries[sourceIndex] = {
    relativePath: toRelative,
    name,
    size: entries[sourceIndex]!.size,
  }
  const createdFolders: string[] = []
  if (destDir && !entries.some((entry) => entry.relativePath === destDir)) {
    createdFolders.push(destDir)
  }
  return { outcome: 'applied', reason: null, createdFolders }
}

export function buildDemoFoldersFromVfs(
  files: WebIndexedFile[],
  sourceId = DEV_DEMO_SOURCE_ID,
): IndexedFolderEntry[] {
  const folderMap = new Map<string, IndexedFolderEntry>()
  const ensureFolder = (relativePath: string, depth: number) => {
    const key = relativePath || '.'
    if (folderMap.has(key)) return folderMap.get(key)!
    const name =
      relativePath === '' || relativePath === '.'
        ? DEV_DEMO_DISPLAY_NAME
        : (relativePath.split('/').at(-1) ?? relativePath)
    const folder: IndexedFolderEntry = {
      id: `${sourceId}:${key}`,
      sourceId,
      sourceType: 'local_folder',
      kind: 'folder',
      name,
      locator: key === '.' ? DEV_DEMO_DISPLAY_NAME : relativePath,
      absolutePath: key === '.' ? DEV_DEMO_DISPLAY_NAME : relativePath,
      relativePath: key,
      folderName: name,
      parentTokens:
        relativePath && relativePath !== '.'
          ? relativePath.split('/').slice(0, -1).map((part) => part.toLowerCase())
          : [],
      depth,
      extensions: [],
      fileCount: 0,
      fileNames: [],
      lastModified: null,
    }
    folderMap.set(key, folder)
    return folder
  }

  ensureFolder('.', 0)
  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean)
    const name = parts.at(-1) ?? file.name
    let parent = ''
    parts.slice(0, -1).forEach((part, index) => {
      parent = parent ? `${parent}/${part}` : part
      ensureFolder(parent, index + 1)
    })
    const folderKey = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    const folder = ensureFolder(folderKey, parts.length > 1 ? parts.length - 1 : 0)
    folder.fileCount += 1
    if (folder.fileNames.length < 50) folder.fileNames.push(name)
    const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
    if (ext && !folder.extensions.includes(ext)) folder.extensions.push(ext)
  }
  return [...folderMap.values()]
}

export function buildDevDemoKnowledgeFromVfs(sourceId = DEV_DEMO_SOURCE_ID) {
  const files = devDemoVfsFiles().map((file) =>
    file.sourceId === sourceId ? file : { ...file, id: `${sourceId}:${file.relativePath}`, sourceId },
  )
  const folders = buildDemoFoldersFromVfs(files, sourceId)
  return { files, folders, descriptors: demoFileDescriptors(sourceId) }
}
