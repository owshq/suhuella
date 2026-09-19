import type { KnowledgeSetItem } from '../types.ts'
import type { IndexedFolderEntry, WebIndexedFile } from '../host/browser/types.ts'
import { isFolderPickAbort, isProtectedFolderConnectError } from './sources-ui.ts'

export const ORGANISE_DOCUMENTS_TITLE = 'Organise documents'

export const ORGANISE_SCREEN_SUBTITLE =
  'Select documents and review a Plan before anything changes.'

export const ORGANISE_EMPTY_BODY =
  'Select documents from a connected source or choose files from this device. SuHuella will create a Plan before anything changes.'

export const ORGANISE_EMPTY_NO_SOURCES =
  'No connected sources yet. You can connect a folder or choose files directly.'

export const ORGANISE_SELECT_FROM_SOURCES = 'Select from Sources'
export const ORGANISE_CHOOSE_FILES = 'Choose files'
export const ORGANISE_CHOOSE_FOLDER = 'Choose folder'
export const ORGANISE_CONNECT_FOLDER = 'Connect a folder'

export const ORGANISE_FOLDER_UNSUPPORTED =
  'This browser cannot choose folders. Choose files instead.'

export const ORGANISE_EXECUTION_LIMIT =
  'This browser can prepare the Plan. Some file changes may require additional permission.'

export const ORGANISE_FILE_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.tif,.tiff'

const UPLOAD_WORDS = /\b(upload|uploaded|sube|subir|send files|cloud import)\b/i
const DESKTOP_REQUIRED = /\b(download the desktop app|use desktop to apply|open the desktop app)\b/i

export function organiseHasUploadLanguage(text: string): boolean {
  return UPLOAD_WORDS.test(text)
}

export function organiseRequiresDesktop(text: string): boolean {
  return DESKTOP_REQUIRED.test(text)
}

export function organisePickErrorMessage(error: unknown): string | null {
  if (isFolderPickAbort(error)) return null
  const text = error instanceof Error ? error.message : String(error)
  const lower = text.toLowerCase()
  if (
    lower.includes('cannot choose folder') ||
    lower.includes('cannot choose folders') ||
    lower.includes('folder access is not available')
  ) {
    return ORGANISE_FOLDER_UNSUPPORTED
  }
  if (isProtectedFolderConnectError(error)) return null
  if (lower.includes('cannot choose documents') || lower.includes('cannot choose files')) {
    return null
  }
  if (lower.includes('permission') || lower.includes('not allowed') || lower.includes('denied')) {
    return null
  }
  return text.trim() ? text : null
}

export function knowledgeItemsFromBrowserFiles(
  files: Array<Pick<File, 'name'>>,
  idFor: (file: Pick<File, 'name'>, index: number) => string,
): KnowledgeSetItem[] {
  return files
    .filter((file) => file.name.trim().length > 0)
    .map((file, index) => ({
      path: idFor(file, index),
      kind: 'file' as const,
    }))
}

export function knowledgeItemsFromIndexedFiles(
  files: Array<Pick<WebIndexedFile, 'sourceId' | 'relativePath'>>,
  pathFor: (file: Pick<WebIndexedFile, 'sourceId' | 'relativePath'>) => string,
): KnowledgeSetItem[] {
  return files.map((file) => ({
    path: pathFor(file),
    kind: 'file' as const,
  }))
}

export function indexedFileFromBrowserFile(
  file: Pick<File, 'name' | 'size' | 'lastModified' | 'type'>,
  sourceId: string,
  relativePath: string,
): WebIndexedFile {
  return {
    id: `${sourceId}:${relativePath}`,
    sourceId,
    name: file.name.split(/[/\\]/).pop() || file.name,
    relativePath,
    parentRelative: relativePath.includes('/') ? relativePath.split('/').slice(0, -1).join('/') : '',
    size: file.size,
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
  }
}

export function transientFolderFromName(sourceId: string, name: string): IndexedFolderEntry {
  return {
    id: `${sourceId}:.`,
    sourceId,
    sourceType: 'local_folder',
    kind: 'folder',
    name,
    locator: name,
    absolutePath: name,
    relativePath: '.',
    folderName: name,
    parentTokens: [],
    depth: 0,
    extensions: [],
    fileCount: 0,
    fileNames: [],
    lastModified: null,
  }
}

export function planUsesAbsoluteFilesystemPath(path: string): boolean {
  return path.startsWith('/') || /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\')
}
