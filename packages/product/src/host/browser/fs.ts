import { productCopy } from '../../lib/product-copy'
import type { IndexedFolderEntry, WebIndexedFile, WebKnowledgeSource } from "./types";
import { idbDelete, idbGet, idbSet, STORE } from "./idb";

const SKIP_NAMES = new Set([
  "library",
  "system",
  "private",
  "etc",
  "proc",
  "dev",
  "bin",
  "sbin",
  "windows",
  "program files",
  "program files (x86)",
  "$recycle.bin",
  "node_modules",
  ".git",
  ".svn",
  "appdata",
  "application data",
]);

const MAX_FILES = 20_000;
const MAX_FILENAMES_PER_FOLDER = 50;
const MAX_DEPTH = 8;

export type WellKnownDirectory = "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";

type DirectoryPickerOptions = {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: WellKnownDirectory;
};

type FileSystemDirectoryHandleWithPicker = FileSystemDirectoryHandle & {
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  values?: () => AsyncIterableIterator<FileSystemHandle>;
};

async function* iterateDirectory(
  dir: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle]> {
  const directory = dir as FileSystemDirectoryHandleWithPicker;
  if (typeof directory.entries === "function") {
    yield* directory.entries();
    return;
  }
  if (typeof directory.values === "function") {
    for await (const child of directory.values()) {
      yield [child.name, child];
    }
  }
}

type MovableFileHandle = FileSystemFileHandle & {
  move?: (dest: FileSystemDirectoryHandle | string, name?: string) => Promise<void>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
  }
}

export type BrowserFolderAccess = "directory-picker" | "webkitdirectory" | "none";

export type PickedLocalFolder =
  | { kind: "handle"; handle: FileSystemDirectoryHandle }
  | { kind: "files"; files: File[] };

export class FolderAccessError extends Error {
  readonly code: "unsupported" | "denied" | "unavailable" | "failed" | "protected";

  constructor(code: FolderAccessError["code"], message: string) {
    super(message);
    this.name = "FolderAccessError";
    this.code = code;
  }
}

export function fileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export function webkitDirectorySupported(): boolean {
  if (typeof document === "undefined") return false;
  const input = document.createElement("input");
  input.type = "file";
  return "webkitdirectory" in input;
}

export function folderAccessKind(): BrowserFolderAccess {
  if (fileSystemAccessSupported()) return "directory-picker";
  if (webkitDirectorySupported()) return "webkitdirectory";
  return "none";
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function isProtectedFolderError(error: unknown): boolean {
  if (error instanceof FolderAccessError && error.code === "protected") return true;
  if (error instanceof DOMException && error.name === "SecurityError") return true;
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  return (
    name === "securityerror" ||
    text.includes("system file") ||
    text.includes("contains system") ||
    text.includes("can't open this folder") ||
    text.includes("cannot open this folder") ||
    text.includes("no se puede abrir esta carpeta") ||
    text.includes("not allowed to access")
  );
}

export async function pickLocalFolder(startIn?: WellKnownDirectory): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new FolderAccessError("unsupported", "Folder access is not available in this browser.");
  }
  try {
    return await window.showDirectoryPicker({
      id: startIn ?? "suhuella-source",
      mode: "read",
      startIn,
    });
  } catch (error) {
    if (isProtectedFolderError(error)) {
      throw new FolderAccessError("protected", "This folder is not available in this browser.");
    }
    if (isAbortError(error)) throw error;
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new FolderAccessError("denied", "Folder permission was not granted.");
    }
    throw new FolderAccessError("failed", productCopy("SuHuella could not open that folder."));
  }
}

export function pickFolderViaWebkitDirectory(): Promise<File[]> {
  return new Promise((resolve, reject) => {
    if (!webkitDirectorySupported()) {
      reject(new FolderAccessError("unsupported", "Folder access is not available in this browser."));
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    let settled = false;
    const finish = (next: () => void) => {
      if (settled) return;
      settled = true;
      input.remove();
      next();
    };
    input.addEventListener("change", () => {
      finish(() => resolve(Array.from(input.files ?? [])));
    });
    input.addEventListener("cancel", () => {
      finish(() => reject(new DOMException("The user aborted a request.", "AbortError")));
    });
    document.body.appendChild(input);
    input.click();
  });
}

export function filePickerSupported(): boolean {
  if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") return true;
  if (typeof document === "undefined") return false;
  const input = document.createElement("input");
  input.type = "file";
  return "multiple" in input;
}

function pickFilesViaInput(): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.csv,.png,.jpg,.jpeg,.gif,.webp,.heic,.tif,.tiff";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    let settled = false;
    const finish = (next: () => void) => {
      if (settled) return;
      settled = true;
      input.remove();
      next();
    };
    input.addEventListener("change", () => {
      finish(() => resolve(Array.from(input.files ?? [])));
    });
    input.addEventListener("cancel", () => {
      finish(() => reject(new DOMException("The user aborted a request.", "AbortError")));
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Real file picker. Never invents a selection from the index. */
export async function requestLocalFiles(): Promise<File[]> {
  if (!filePickerSupported()) {
    throw new FolderAccessError("unsupported", "This browser cannot choose documents.");
  }
  if (typeof window.showOpenFilePicker === "function") {
    try {
      const handles = await window.showOpenFilePicker({ multiple: true });
      return Promise.all(handles.map((handle) => handle.getFile()));
    } catch (error) {
      if (isAbortError(error)) throw error;
    }
  }
  return pickFilesViaInput();
}

export async function requestLocalFolder(startIn?: WellKnownDirectory): Promise<PickedLocalFolder> {
  const access = folderAccessKind();
  if (access === "none") {
    throw new FolderAccessError("unsupported", "Folder access is not available in this browser.");
  }
  if (access === "directory-picker") {
    return { kind: "handle", handle: await pickLocalFolder(startIn) };
  }
  return { kind: "files", files: await pickFolderViaWebkitDirectory() };
}

export async function persistHandle(sourceId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  await idbSet(STORE.handles, sourceId, handle);
}

export async function loadHandle(sourceId: string): Promise<FileSystemDirectoryHandle | null> {
  return (await idbGet<FileSystemDirectoryHandle>(STORE.handles, sourceId)) ?? null;
}

export async function removeHandle(sourceId: string): Promise<void> {
  await idbDelete(STORE.handles, sourceId);
}

function permissionHandle(handle: FileSystemDirectoryHandle) {
  return handle as FileSystemDirectoryHandle & {
    queryPermission?: (options: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (options: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  };
}

export async function queryPermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "read",
): Promise<PermissionState> {
  return (await permissionHandle(handle).queryPermission?.({ mode })) ?? "granted";
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "read",
): Promise<boolean> {
  const current = await queryPermission(handle, mode);
  if (current === "granted") return true;
  const next = (await permissionHandle(handle).requestPermission?.({ mode })) ?? "denied";
  return next === "granted";
}

export async function directoryAvailable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    await iterateDirectory(handle).next();
    return true;
  } catch {
    return false;
  }
}

export function fileWriteSupported(): boolean {
  if (typeof FileSystemFileHandle === "undefined") return false;
  const proto = FileSystemFileHandle.prototype as MovableFileHandle & {
    createWritable?: () => Promise<unknown>;
  };
  return typeof proto.move === "function" || typeof proto.createWritable === "function";
}

function shouldSkip(name: string): boolean {
  if (name.startsWith(".")) return true;
  return SKIP_NAMES.has(name.toLowerCase());
}

function joinRelative(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  sourceId: string,
): Promise<{ source: Omit<WebKnowledgeSource, "id" | "status">; folders: IndexedFolderEntry[]; files: WebIndexedFile[] }> {
  const folders: IndexedFolderEntry[] = [];
  const files: WebIndexedFile[] = [];
  let bytes = 0;

  async function walk(
    dir: FileSystemDirectoryHandle,
    relativePath: string,
    depth: number,
  ): Promise<void> {
    if (files.length >= MAX_FILES || depth > MAX_DEPTH) return;

    const fileNames: string[] = [];
    const extensions = new Set<string>();
    let fileCount = 0;
    const parentTokens = relativePath
      .split("/")
      .filter(Boolean)
      .slice(0, -1)
      .map((part) => part.toLowerCase());

    for await (const [name, child] of iterateDirectory(dir)) {
      if (shouldSkip(name)) continue;
      const childPath = joinRelative(relativePath, name);

      if (child.kind === "directory") {
        await walk(child as FileSystemDirectoryHandle, childPath, depth + 1);
        continue;
      }

      fileCount += 1;
      if (fileNames.length < MAX_FILENAMES_PER_FOLDER) fileNames.push(name);
      const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
      if (ext) extensions.add(ext);

      let size = 0;
      let lastModified: string | null = null;
      try {
        const file = await (child as FileSystemFileHandle).getFile();
        size = file.size;
        lastModified = new Date(file.lastModified).toISOString();
        bytes += size;
      } catch {
        /* permission or file disappeared */
      }

      files.push({
        id: `${sourceId}:${childPath}`,
        sourceId,
        name,
        relativePath: childPath,
        parentRelative: relativePath,
        size,
        lastModified,
      });
      if (files.length >= MAX_FILES) break;
    }

    folders.push({
      id: `${sourceId}:${relativePath || "."}`,
      sourceId,
      sourceType: "local_folder",
      kind: "folder",
      name: relativePath ? relativePath.split("/").at(-1) ?? handle.name : handle.name,
      locator: relativePath || handle.name,
      absolutePath: relativePath || handle.name,
      relativePath: relativePath || ".",
      folderName: relativePath ? relativePath.split("/").at(-1) ?? handle.name : handle.name,
      parentTokens,
      depth,
      extensions: [...extensions],
      fileCount,
      fileNames,
      lastModified: null,
    });
  }

  await walk(handle, "", 0);

  return {
    source: {
      kind: "local",
      type: "local_folder",
      name: handle.name,
      fileCount: files.length,
      folderCount: folders.length,
      bytes,
      lastIndexed: new Date().toISOString(),
    },
    folders,
    files,
  };
}

function rootNameFromFiles(files: File[]): string {
  const first = files[0]?.webkitRelativePath || files[0]?.name || "Folder";
  return first.split(/[/\\]/).filter(Boolean)[0] ?? "Folder";
}

function relativeFromWebkitPath(file: File, rootName: string): string {
  const relative = file.webkitRelativePath || file.name;
  const parts = relative.split(/[/\\]/).filter(Boolean);
  if (parts[0]?.toLowerCase() === rootName.toLowerCase()) parts.shift();
  return parts.join("/");
}

export function scanFileList(
  fileList: File[],
  sourceId: string,
  rootName = rootNameFromFiles(fileList),
): { source: Omit<WebKnowledgeSource, "id" | "status">; folders: IndexedFolderEntry[]; files: WebIndexedFile[] } {
  const files: WebIndexedFile[] = [];
  const folderMap = new Map<string, IndexedFolderEntry>();
  let bytes = 0;

  const ensureFolder = (relativePath: string, depth: number) => {
    const key = relativePath || ".";
    if (folderMap.has(key)) return folderMap.get(key)!;
    const name = relativePath ? relativePath.split("/").at(-1) ?? rootName : rootName;
    const parentTokens = relativePath
      .split("/")
      .filter(Boolean)
      .slice(0, -1)
      .map((part) => part.toLowerCase());
    const folder: IndexedFolderEntry = {
      id: `${sourceId}:${key}`,
      sourceId,
      sourceType: "local_folder",
      kind: "folder",
      name,
      locator: relativePath || rootName,
      absolutePath: relativePath || rootName,
      relativePath: key,
      folderName: name,
      parentTokens,
      depth,
      extensions: [],
      fileCount: 0,
      fileNames: [],
      lastModified: null,
    };
    folderMap.set(key, folder);
    return folder;
  };

  ensureFolder("", 0);

  for (const file of fileList) {
    if (files.length >= MAX_FILES) break;
    const relativePath = relativeFromWebkitPath(file, rootName);
    if (!relativePath) continue;
    const parts = relativePath.split("/").filter(Boolean);
    const name = parts.at(-1);
    if (!name || shouldSkip(name)) continue;
    if (parts.slice(0, -1).some((part) => shouldSkip(part))) continue;

    let parent = "";
    parts.slice(0, -1).forEach((part, index) => {
      parent = joinRelative(parent, part);
      ensureFolder(parent, index + 1);
    });

    const folder = ensureFolder(parent, Math.max(0, parts.length - 1));
    folder.fileCount += 1;
    if (folder.fileNames.length < MAX_FILENAMES_PER_FOLDER) folder.fileNames.push(name);
    const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (ext && !folder.extensions.includes(ext)) folder.extensions.push(ext);

    bytes += file.size;
    files.push({
      id: `${sourceId}:${relativePath}`,
      sourceId,
      name,
      relativePath,
      parentRelative: parent,
      size: file.size,
      lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    });
  }

  return {
    source: {
      kind: "local",
      type: "local_folder",
      name: rootName,
      fileCount: files.length,
      folderCount: folderMap.size,
      bytes,
      lastIndexed: new Date().toISOString(),
    },
    folders: [...folderMap.values()],
    files,
  };
}

async function directoryAt(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  if (!relativePath || relativePath === ".") return root;
  let current = root;
  for (const part of relativePath.split("/").filter(Boolean)) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

export async function moveOrRenameFile(
  root: FileSystemDirectoryHandle,
  fromRelative: string,
  toRelative: string,
): Promise<void> {
  const fromParts = fromRelative.split("/").filter(Boolean);
  const toParts = toRelative.split("/").filter(Boolean);
  const fromName = fromParts.at(-1);
  const toName = toParts.at(-1);
  if (!fromName || !toName) throw new Error("Invalid file path.");

  const fromDir = await directoryAt(root, fromParts.slice(0, -1).join("/"));
  const toDir = await directoryAt(root, toParts.slice(0, -1).join("/"), true);
  const fileHandle = (await fromDir.getFileHandle(fromName)) as MovableFileHandle;

  try {
    const existing = await toDir.getFileHandle(toName);
    if (existing && (fromDir !== toDir || fromName !== toName)) {
      throw new Error("Skipped to avoid overwrite.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Skipped to avoid overwrite.") throw error;
  }

  if (typeof fileHandle.move === "function") {
    await fileHandle.move(toDir, toName);
    return;
  }

  const file = await fileHandle.getFile();
  const dest = await toDir.getFileHandle(toName, { create: true });
  const writable = await dest.createWritable();
  await writable.write(file);
  await writable.close();
  await fromDir.removeEntry(fromName);
}

export const BrowserFileSystem = {
  supported: fileSystemAccessSupported,
  requestFolderAccess: pickLocalFolder,
  persistPermission: persistHandle,
  loadPermission: loadHandle,
  removePermission: removeHandle,
  ensurePermission,
  listAndRead: scanDirectory,
  moveFile: moveOrRenameFile,
  renameFile: moveOrRenameFile,
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
